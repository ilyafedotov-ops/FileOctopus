# `fs-core` — Local filesystem provider and operation pipeline

`crates/fs-core` owns local filesystem I/O plus the provider-neutral planner/executor for file-mutating operations. Local disk access is implemented by `LocalFsProvider`; remote schemes are supplied by provider crates registered in `app-core`. Everything privileged that the desktop shell does goes through Rust commands that call this crate or the VFS registry.

- Source: `crates/fs-core/src/lib.rs`, `crates/fs-core/src/file_ops/{mod,planning,execution,archive,trash,paths,tests}.rs`, plus `metadata.rs`, `search.rs`, `locations.rs`, `external_open.rs`, `direct_ops.rs`, `compare.rs`, `content_search.rs`, `sync.rs`, `vfs_io.rs`
- Depends on: `vfs`, `jobs`, `remote-core`, `provider-sftp`, `chrono`, `filetime`, `uuid`, `tokio` (for `spawn_blocking`).
- Used by: `app-core` (which wraps `OperationRuntime` around the planner/executor), Tauri `commands/*`, and integration tests.

The crate splits **read-side** (`lib.rs`, `LocalFsProvider`) from **mutation-side** (`file_ops/`) and **direct helpers** used by IPC commands that are not planned jobs:

| Module          | Role                                                                |
| --------------- | ------------------------------------------------------------------- |
| `file_ops/`     | Plan/execute copy, move, rename, trash, mkdir, create-file, archive |
| `metadata`      | Path properties, folder-size (sync + progress)                      |
| `search`        | Recursive search (sync + progress)                                  |
| `locations`     | `standard_locations` enumeration                                    |
| `external_open` | Open with default app, reveal in file manager                       |
| `direct_ops`    | `create_empty_file`, `delete_permanently` (non-job mutators)        |

## `LocalFsProvider`

`LocalFsProvider` implements `vfs::VfsProvider` for the `local` scheme. It is registered into `VfsRegistry` exactly once during `AppCore::boot`.

```rust
impl VfsProvider for LocalFsProvider {
    fn id(&self) -> ProviderId { ProviderId::new("local") }
    fn schemes(&self) -> &'static [&'static str] { &["local"] }
    fn capabilities(&self) -> ProviderCapabilities { ProviderCapabilities::read_write() }
    async fn stat(&self, uri: &ResourceUri) -> Result<FileEntry, VfsError>;
    async fn list(&self, uri: &ResourceUri, options: ListOptions, sink: DirectorySink) -> Result<(), VfsError>;
    async fn create_directory(&self, uri: &ResourceUri) -> Result<(), VfsError>;
    async fn create_file(&self, uri: &ResourceUri) -> Result<(), VfsError>;
    async fn rename(&self, from: &ResourceUri, to: &ResourceUri) -> Result<(), VfsError>;
    async fn remove(&self, uri: &ResourceUri, recursive: bool) -> Result<(), VfsError>;
    async fn copy_file(&self, source: &ResourceUri, destination: &ResourceUri, on_progress: Box<dyn FnMut(u64) + Send>) -> Result<u64, VfsError>;
    async fn read_file_prefix(&self, uri: &ResourceUri, max_bytes: u64) -> Result<Vec<u8>, VfsError>;
}
```

`capabilities()` reports `read_write()` because single-provider writes now live on the provider trait. The operation pipeline still owns planning, conflict policy, cancellation, progress, and history.

### Read-side responsibilities

- `stat` runs `fs::symlink_metadata` inside `tokio::task::spawn_blocking`. The metadata is mapped into a `FileEntry` via `entry_for_path`.
- `list` performs a synchronous `fs::read_dir` inside `spawn_blocking`, building `FileEntry` values in batches and pushing them to the supplied `DirectorySink` (mpsc sender).
- Hidden filter: entries whose `file_name` starts with `.` are skipped unless `ListOptions.include_hidden` is true. This is a stand-in for richer platform-specific hidden detection.
- Symlinks: file type is detected with `file_type().is_symlink()`. Symlink targets are resolved via `fs::read_link`, made absolute relative to the symlink's parent if needed, and converted to a `local://` URI.
- Errors map through `LocalFsProvider::map_io_error`: `NotFound` → `VfsError::NotFound`, `PermissionDenied` → `VfsError::PermissionDenied`, everything else → `VfsError::Internal`.

### Batching invariants

- `batch_size` is clamped to `>= 1` (the registry default in the Tauri shell is 256).
- Each non-final batch carries `is_complete = false`; a final empty-or-partial batch carries `is_complete = true`. Callers can rely on receiving at least one frame.
- `total_hint` is always `None` for the local provider (we do not pre-walk the directory to count entries).

## `file_ops/` — plan and execute

The `file_ops` module directory re-exports the public API from `mod.rs`. Planning lives in `planning.rs`, execution in `execution.rs`, with `archive.rs`, `trash.rs`, and `paths.rs` for specialised flows.

`file_ops` exports two pure entry points:

```rust
pub fn plan_file_operation(request: FileOperationRequest)
    -> Result<FileOperationPlan, FileOperationError>;

pub fn execute_file_operation(
    plan: &FileOperationPlan,
    job_id: &JobId,
    cancel: &CancellationToken,
    sink: &FileOperationEventSink,
) -> Result<(), FileOperationError>;
```

Plus a sink type alias used everywhere:

```rust
pub type FileOperationEventSink = dyn Fn(JobEvent) + Send + Sync;
```

Callers always wrap the sink in `Arc<FileOperationEventSink>`.

### Planning

`plan_file_operation` is **read-only**. It walks the source tree where appropriate and produces a deterministic `FileOperationPlan` with:

- `operation_id` — a fresh UUID.
- `items` — every concrete filesystem entry the executor will touch, sorted by URI for stability.
- `conflicts` — items whose destination already exists. Populated by `detect_conflicts`.
- `warnings` — non-fatal diagnostics (e.g. `metadata_failed` for a file whose metadata could not be read).
- `total_items`, `total_bytes` — aggregates. `total_bytes` collapses to `None` if any item has unknown size.

Planner behaviour per kind (see `validate_request_shape` and the per-kind helpers):

| Kind              | Sources   | Destination                      | `newName` | Notes                                                                |
| ----------------- | --------- | -------------------------------- | --------- | -------------------------------------------------------------------- |
| `Copy`            | ≥1        | required directory (must exist)  | optional  | Recursively enumerates each source via `collect_copy_or_move_items`. |
| `Move`            | ≥1        | required directory (must exist)  | optional  | Same enumeration; cross-device executes as copy + delete.            |
| `Rename`          | exactly 1 | optional                         | required  | Destination is `parent(source) / newName`.                           |
| `CreateDirectory` | 0         | required (the full new dir path) | required  | Parent directory must exist.                                         |
| `DeleteToTrash`   | ≥1        | none                             | none      | Items are just the source list.                                      |

Shape and basename validation reject empty names, names containing `/`, `\`, `\0`, `.`, or `..` (`validate_basename`). Self/descendant moves are rejected with `RecursiveOperation` (`reject_self_or_descendant`).

### Execution

`execute_file_operation` dispatches on `plan.kind`. Common invariants:

- **`Fail` short-circuit**: if `plan.conflict_policy == Fail` and `plan.conflicts` is non-empty, the executor returns `DestinationConflict` for the first conflict before touching anything.
- **Cancellation**: every per-item loop and the byte-level copy loop call `check_cancelled(cancel, job_id)`. When the token fires, the executor returns `FileOperationError::Cancelled { job_id }`.
- **Progress**: `ExecutionProgress` tracks `completed_items` / `completed_bytes` and emits a `JobEvent::Progress` whenever the byte counter advances by `PROGRESS_BYTE_INTERVAL` (1 MiB) or whenever an item finishes.

Per-kind specifics:

- **Copy** (`execute_copy`) — recreates directory hierarchy through `VfsFilesystem::mkdir`. Local-to-local file copies stream via `copy_file_streaming` (`COPY_BUFFER_SIZE = 64 KiB`) and preserve `mtime` with `filetime`; same-scheme provider copies call the registered provider's `copy_file`; local↔SFTP cross-scheme copies remain the explicit cross-provider bridge.
- **Move** (`execute_move`) — for single-source moves, tries `fs::rename` first. If the destination is on another device the error is detected and the executor falls back to `execute_copy` + per-source delete. Multi-source moves always go copy+delete.
- **Rename** (`execute_rename`) — pure `fs::rename`. Returns `DestinationConflict` if the destination already exists; conflict policies do not apply here (the planner enforced that exactly one source / one new name was provided).
- **CreateDirectory** (`execute_create_directory`) — `fs::create_dir`. Fails if the destination already exists or its parent does not.
- **DeleteToTrash** (`execute_trash`) — delegates to a platform-specific `move_to_trash`:
  - Linux: tries `gio trash`, then `kioclient5 move <path> trash:/`, then `trash-put`. If all three fail it returns `UnsupportedTrash`.
  - macOS: dedicated AppleScript / `osascript` invocation (see `cfg(target_os = "macos")` branch).
  - Windows: `IFileOperation`-style invocation (see `cfg(target_os = "windows")` branch).

### Conflict resolution

`resolve_conflict_path` interprets `ConflictPolicy` at execution time:

- `Fail` — refuses to start the operation when conflicts exist.
- `Skip` — leaves the destination alone, marks the item as completed for progress purposes.
- `Overwrite` — removes the existing destination, then writes the new content.
- `RenameNew` — picks the next unused suffix (`name (1).ext`, `name (2).ext`, …) for the **incoming** item.
- `RenameExisting` — renames the **existing** destination out of the way before writing.

### Constants

| Constant                 | Value         | Purpose                                     |
| ------------------------ | ------------- | ------------------------------------------- |
| `COPY_BUFFER_SIZE`       | `64 * 1024`   | Chunk size for streamed file copies.        |
| `PROGRESS_BYTE_INTERVAL` | `1024 * 1024` | Minimum byte delta between progress events. |

## Threading model

- `LocalFsProvider::stat` / `list` use `tokio::task::spawn_blocking` because `std::fs` is synchronous. `list` blocks the spawned thread until the entire directory is consumed.
- `file_ops::execute_file_operation` is itself synchronous. `app-core::OperationRuntime` runs it on a dedicated `std::thread::spawn`, not on the tokio runtime, so a long copy never starves the IPC reactor.
- The `FileOperationEventSink` is invoked from that worker thread. It must be `Send + Sync` because the `Arc` is cloned into the worker.

## Error mapping

Every IO error funnels through `map_io_error` (provider) or `map_std_io_error` (file_ops). The mapping is intentionally coarse: `NotFound`, `PermissionDenied`, anything else → `Io { code, message }`. The stable codes that result are documented in [api-reference.md](../api-reference.md) §Error model.

## Tests

- `crates/fs-core/tests/` contains integration tests covering: read-side stat/list (hidden files, symlinks), planner shape validation, every operation kind, conflict policy resolution, cross-device move fallback, and cancellation timing.
- Tests use `tempfile::tempdir()` for isolation. Trash tests gate on `cfg(target_os = …)` and the presence of the platform's trash tools.

Run with `cargo test -p fs-core`.

## Conventions

- **Never bypass `ResourceUri`.** Use `to_local_path()` on the `ResourceUri`; do not accept raw `&Path` inputs at module boundaries.
- **No `unwrap`/`expect` on user-reachable paths.** All such cases must map to a `FileOperationError` with a stable `code()`.
- **Planner is pure.** It may read filesystem metadata, but it must not mutate. The executor is the only place that calls `fs::create_*`, `fs::rename`, `fs::remove_*`, or `move_to_trash`.
- **Symmetric errors.** Whenever a new failure mode is introduced, extend the appropriate `FileOperationError` variant in `crates/vfs` rather than reusing `Internal`.
- **Provider-neutral planning.** Same-scheme remote copy planning must use the registered `VfsProvider` for `stat`/`list`; do not add scheme-specific tree walkers for new providers.
