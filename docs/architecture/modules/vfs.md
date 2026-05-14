# `vfs` — Virtual filesystem domain

`crates/vfs` is the lowest layer of the FileOctopus stack. It defines the **domain language** every other crate speaks: how a resource is named, what a "file entry" looks like, what capabilities a backend exposes, what shape a file operation has, and what errors can be raised. It performs no I/O and depends only on `serde`, `chrono`, `async-trait`, and `tokio` channels.

- Source: `crates/vfs/src/lib.rs`
- Depends on: nothing from this workspace.
- Used by: `fs-core`, `jobs`, `app-core`, `app-ipc`, and (transitively) everything else.

## Responsibilities

1. **Resource identity** — every resource crossing a module boundary is a `ResourceUri` (`scheme://body`). Today only `local` is supported; the type is the seam ADR-0003 was written to enforce.
2. **Entry shape** — `FileEntry` plus the `FileKind` enum and `EntryCapabilities` / `ProviderCapabilities` bitfields.
3. **Provider trait** — `VfsProvider` (async) plus a `VfsRegistry` that dispatches by scheme.
4. **File operation vocabulary** — the request → plan → item / conflict / warning value types and the kinds (`Copy`, `Move`, `Rename`, `DeleteToTrash`, `CreateDirectory`).
5. **Error taxonomy** — `VfsError` for read-side errors and `FileOperationError` for the planner/executor. Each has a stable `code()` string that IPC surfaces unchanged.

## Module map

```
ResourceUri / ProviderId / ListSessionId          ← identity
FileKind · FileEntry · EntryCapabilities          ← read-side data
ProviderCapabilities · ListOptions · DirectoryBatch · DirectorySink
FileOperationKind · ConflictPolicy                ← operation enums
FileOperationRequest · FileOperationPlan          ← top-level operation values
FileOperationItem · FileOperationConflict · FileOperationWarning
VfsProvider trait · VfsRegistry                   ← provider plumbing
VfsError · FileOperationError                     ← errors with stable code()
```

## ResourceUri

A `ResourceUri` is a validated `String` newtype. Construction goes through two functions:

- `ResourceUri::parse(&str)` — rejects anything that is not `local://…`, a missing scheme, a relative body, a Windows non-drive prefix, or a NUL byte.
- `ResourceUri::from_local_path(&Path)` — accepts an absolute platform path and normalizes `\` → `/`. Rejects relative paths.

Read-side accessors: `as_str()`, `scheme()`, `display_path()` (the body without the scheme prefix), `to_local_path() -> PathBuf`. The `display_path()` form is meant for human display; persistent or IPC state must use `as_str()`.

The unit tests in `crates/vfs/src/lib.rs` pin POSIX, Windows, relative-rejection, and unsupported-scheme behaviour.

## FileEntry and capabilities

`FileEntry` is the canonical descriptor for a single resource:

```rust
pub struct FileEntry {
    pub uri: ResourceUri,
    pub name: String,
    pub extension: Option<String>,
    pub kind: FileKind,
    pub size: Option<u64>,
    pub modified_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub accessed_at: Option<DateTime<Utc>>,
    pub is_hidden: bool,
    pub is_symlink: bool,
    pub symlink_target: Option<ResourceUri>,
    pub provider_id: ProviderId,
    pub capabilities: EntryCapabilities,
}
```

`FileKind` covers `File`, `Directory`, `Symlink`, `Archive`, `Virtual`, `Unknown`. The first three are populated by `LocalFsProvider`; the others are reserved for future providers (archive provider, cloud, mounted virtual roots).

`EntryCapabilities` is per-entry (read/list/write/delete/rename booleans). `ProviderCapabilities` is the same shape at the provider level (what the backend supports at all). The convenience constructors `EntryCapabilities::read_only_file()` and `EntryCapabilities::read_only_directory()` describe the current `LocalFsProvider` defaults. Mutation goes through the file-operation pipeline, which performs its own checks; the entry-level booleans are advisory for the UI.

## ListOptions and DirectoryBatch

Directory listings are streamed. The caller hands a `DirectorySink = tokio::sync::mpsc::Sender<DirectoryBatch>` to `VfsProvider::list`; the provider pushes `DirectoryBatch` frames until `is_complete = true`.

```rust
pub struct ListOptions {
    pub session_id: ListSessionId, // caller-supplied UUID
    pub batch_size: usize,
    pub include_hidden: bool,
}

pub struct DirectoryBatch {
    pub session_id: ListSessionId,
    pub uri: ResourceUri,
    pub entries: Vec<FileEntry>,
    pub batch_index: u64,
    pub is_complete: bool,
    pub total_hint: Option<u64>,
}
```

`session_id` is opaque to the provider — it round-trips so that the consumer can route batches back to the right UI panel.

## File operation value types

The planner and executor operate on a small, deterministic value graph:

| Type                    | Role                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `FileOperationKind`     | Discriminant for the operation (`Copy`/`Move`/`Rename`/`DeleteToTrash`/`CreateDirectory`).              |
| `ConflictPolicy`        | `Fail`/`Skip`/`Overwrite`/`RenameNew`/`RenameExisting`; resolved by the executor.                       |
| `FileOperationRequest`  | Caller-built input.                                                                                     |
| `FileOperationPlan`     | Output of `plan_file_operation`; carries items, conflicts, warnings, totals, and a UUID `operation_id`. |
| `FileOperationItem`     | One concrete file/dir touched by the plan, with source/destination URI, size, and a `recursive` flag.   |
| `FileOperationConflict` | A source/destination pair that already exists at the destination.                                       |
| `FileOperationWarning`  | Non-fatal planner diagnostic (e.g. missing metadata).                                                   |

All types implement `Serialize`/`Deserialize` with `#[serde(rename_all = "camelCase")]`, so they round-trip through IPC without translation. The same camelCase representation is what `app-ipc` mirrors in its `*Dto` types.

## VfsProvider trait

```rust
#[async_trait::async_trait]
pub trait VfsProvider: Send + Sync {
    fn id(&self) -> ProviderId;
    fn schemes(&self) -> &'static [&'static str];
    fn capabilities(&self) -> ProviderCapabilities;
    async fn stat(&self, uri: &ResourceUri) -> Result<FileEntry, VfsError>;
    async fn list(
        &self,
        uri: &ResourceUri,
        options: ListOptions,
        sink: DirectorySink,
    ) -> Result<(), VfsError>;
}
```

A provider is registered in `VfsRegistry` against one or more schemes. The current registry rejects duplicate registrations for the same scheme (`VfsError::DuplicateProvider`). The async trait uses `Arc<dyn VfsProvider>` for dynamic dispatch — providers are reference-counted and shared across the runtime.

There is no `write`/`delete` on the trait yet: mutation is handled by `fs-core::file_ops` directly against `ResourceUri::to_local_path()` (for `LocalFsProvider`). When a second provider needs mutation, that surface will need to move onto the trait.

## VfsRegistry

`VfsRegistry::new()` creates an empty registry; `register(Arc<dyn VfsProvider>)` adds one. Lookup is by `ResourceUri::scheme()`. The registry holds an `RwLock<HashMap>` and surfaces poisoning as `VfsError::Internal`. Convenience methods `stat` and `list` look up the provider and delegate. Tests in `crates/vfs/src/lib.rs` cover registration failure modes (duplicate, unknown scheme).

## Error taxonomy

Two error enums, each with `code()`:

```rust
pub enum VfsError {
    InvalidUri { uri: String, reason: String },     // "invalid_uri"
    UnsupportedProvider { scheme: String },         // "unsupported_provider"
    DuplicateProvider { scheme: String },           // "duplicate_provider"
    NotFound { uri: String },                       // "not_found"
    PermissionDenied { uri: String },               // "permission_denied"
    Internal { message: String },                   // "internal"
}

#[serde(tag = "type", rename_all = "camelCase")]
pub enum FileOperationError {
    InvalidRequest { message: String },             // "invalid_request"
    InvalidName { name: String },                   // "invalid_name"
    InvalidPath { uri: String, message: String },   // "invalid_path"
    UnsupportedProvider { scheme: String },         // "unsupported_provider"
    NotFound { uri: String },                       // "not_found"
    PermissionDenied { uri: String },               // "permission_denied"
    DestinationMissing { uri: String },             // "destination_missing"
    DestinationConflict { uri: String },            // "destination_conflict"
    RecursiveOperation { message: String },         // "recursive_operation"
    UnsupportedTrash { message: String },           // "unsupported_trash"
    Cancelled { job_id: Option<String> },           // "cancelled"
    Io { code: String, message: String },           // "io_error"
    Internal { message: String },                   // "internal"
}
```

`From<VfsError> for FileOperationError` lifts read-side errors into the operation domain so the planner can fail with a single error type. The `code()` strings are the contract surfaced through `IpcError` to the frontend — keep them stable and update `docs/architecture/api-reference.md` when you add a new variant. `user_message()` produces a human-readable string for the UI.

## Conventions and invariants

- **Schemes are explicit.** Any function taking a `&str` URI must call `ResourceUri::parse` first. No "best-effort" parsing elsewhere.
- **No I/O.** This crate must remain pure data + traits. Anything filesystem-touching goes in `fs-core` (or a future provider crate).
- **Stable wire shape.** All public types serialize with `camelCase`. Renaming a field requires a coordinated DTO + TS types change (see [api-reference.md](../api-reference.md) §Maintenance).
- **Error code stability.** The `code()` strings cross the IPC boundary; treat them like a public API.

## Tests

Unit tests live alongside the code in `crates/vfs/src/lib.rs`. They cover URI parsing for both POSIX and Windows shapes, registry registration semantics, the async provider trait via an in-module `TestProvider`, and serde round-trips for `FileEntry`, `DirectoryBatch`, and the operation value types. Run with `cargo test -p vfs`.
