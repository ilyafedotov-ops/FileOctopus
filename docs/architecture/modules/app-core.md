# `app-core` — Runtime, job scheduler, operation history

`crates/app-core` is the **composition root** for the Rust side of FileOctopus. It boots the provider registry, attaches the operation history database, and exposes the `OperationRuntime` that the Tauri shell calls into. Everything stateful and process-scoped lives here.

- Source: `crates/app-core/src/{lib,runtime,history,paths}.rs` (integration tests in `crates/app-core/src/tests.rs`)
- Depends on: `vfs`, `fs-core`, `jobs`, `telemetry`, `rusqlite`, `chrono`, `uuid`, `thiserror`.
- Used by: `apps/desktop-tauri/src-tauri/src/lib.rs` (as `tauri::Manager` state) and integration tests.

| File         | Responsibility                                                          |
| ------------ | ----------------------------------------------------------------------- |
| `lib.rs`     | `AppCore`, `AppState`, `AppCoreError`, `pub use` re-exports             |
| `runtime.rs` | `OperationRuntime` — plan, start, cancel, in-memory job table           |
| `history.rs` | `OperationHistoryRepository`, SQLite schema/migrations, history records |
| `paths.rs`   | `AppPaths`, `AppDataHealth`, default platform data/history paths        |

## Boot sequence

```
AppCore::boot()
 ├── telemetry::init()                     ← tracing subscriber (idempotent)
 ├── VfsRegistry::new()                    ← empty registry
 ├── register LocalFsProvider              ← only provider today
 ├── OperationHistoryRepository::new(path) ← opens SQLite, runs migrations
 └── OperationRuntime::new(history)        ← in-memory job table + history
        ↓
   Arc<AppState { vfs, operations }>
```

`AppCore` has no constructor — it is a unit type with two associated functions:

- `boot() -> Result<Arc<AppState>, AppCoreError>` — production entry. Uses `default_history_path` (see below).
- `boot_with_history_path(PathBuf) -> Result<Arc<AppState>, AppCoreError>` — test entry. The repository is opened against a caller-provided path (typically a `tempfile::tempdir`).

`AppCoreError` discriminates `Telemetry`, `Vfs`, and `History` failures with `thiserror`. All three are surfaced to the Tauri shell, which panics on boot if any fire (the desktop process is unusable without these).

## `AppState`

```rust
#[derive(Clone)]
pub struct AppState {
    vfs: Arc<VfsRegistry>,
    operations: Arc<OperationRuntime>,
}
```

The Tauri shell registers `Arc<AppState>` via `tauri::Builder::manage(...)` and threads it into command handlers as `State<'_, Arc<AppState>>`. Both inner `Arc`s expose getters so handlers can hold their own clone for the duration of a request.

## `OperationRuntime`

`OperationRuntime` is the lifecycle manager for file operations. It does three things: plans, runs, and persists.

```rust
pub struct OperationRuntime {
    jobs: Arc<Mutex<HashMap<String, JobRuntimeState>>>,
    history: OperationHistoryRepository,
}
```

`JobRuntimeState` pairs the current `JobSnapshot` with the job's `CancellationToken`. The hashmap is keyed by `JobId` string.

### `plan`

```rust
pub fn plan(&self, request: FileOperationRequest)
    -> Result<FileOperationPlan, FileOperationError>;
```

Pure delegation to `fs_core::file_ops::plan_file_operation`. The runtime does not yet cache plans; callers may call `plan` repeatedly without side effects.

### `start`

```rust
pub fn start(
    &self,
    plan: FileOperationPlan,
    sink: Arc<FileOperationEventSink>,
) -> Result<JobSnapshot, FileOperationError>;
```

Behaviour:

1. Generate a fresh `JobId` (UUID v4).
2. Build an initial `JobSnapshot { status: Queued, started_at: now, …totals from plan }`.
3. Insert `JobRuntimeState { snapshot, cancel: CancellationToken::new() }` into the in-memory job table.
4. Persist a `running` row to `operation_history`.
5. Emit `JobEvent::Started` synchronously to the sink so the UI gets immediate feedback.
6. Flip the snapshot to `Running`.
7. **`std::thread::spawn`** a worker that wraps the caller's sink with a progress-aware sink. The progress sink:
   - Updates the in-memory snapshot when a `JobEvent::Progress` is observed (`update_snapshot_progress`).
   - Forwards every event to the caller's sink.
8. The worker calls `fs_core::file_ops::execute_file_operation(&plan, &job_id, &token, &progress_sink)`. Based on the result:
   - `Ok(())` → snapshot becomes `Completed`, history row becomes `completed`, `JobEvent::Completed` is emitted.
   - `Err(Cancelled { .. })` → snapshot becomes `Cancelled`, history row becomes `cancelled`, `JobEvent::Cancelled` is emitted.
   - `Err(other)` → snapshot becomes `Failed` with `code` + `message`, history row becomes `failed` with `error_code`, `JobEvent::Failed` is emitted.

The worker thread is dedicated and synchronous. This intentionally keeps the long-running `std::fs::*` calls off the tokio runtime that powers IPC.

### `cancel` and `status`

Both take a `&str` job id and return the current `JobSnapshot`. `cancel` flips the cancellation token; `status` is a pure read. Unknown ids return `FileOperationError::NotFound` (with the job id placed in the `uri` field — a small abuse for diagnostic clarity).

### `recent_history`

Reads from the SQLite repository, clamped to `[1, 100]` rows. On error returns an empty `Vec` (history is best-effort; the live IPC path is not gated on it).

## `OperationHistoryRepository`

A thin, owned wrapper over a SQLite file:

```rust
pub struct OperationHistoryRepository { path: Arc<PathBuf> }
```

`new(path)` runs `migrate`, which creates `schema_meta` and `operation_history` if absent. `schema_version = 1` is stored both in `schema_meta` and SQLite `user_version`; future schema versions fail startup instead of resetting the database.

```sql
create table if not exists operation_history (
    job_id text primary key,
    operation_kind text not null,
    source_count integer not null,
    representative_source_path text,
    destination_path text,
    status text not null,        -- "running" | "completed" | "failed" | "cancelled" | "interrupted"
    started_at text not null,    -- RFC3339
    completed_at text,           -- RFC3339, nullable
    error_code text              -- mirrors FileOperationError::code() on failure
)
```

Two write paths:

- `insert_started(plan, snapshot)` — called once at `start`. Records the operation kind (Debug-formatted from `FileOperationKind`), source count, the first source's display path as `representative_source_path`, and `destination_path` if present. Failures are logged via `telemetry::error` but never propagated.
- `update_terminal(job_id, status, error_code)` — called once when the job ends. Updates `status`, sets `completed_at` to `Utc::now().to_rfc3339()`, and stores the optional `error_code`.
- `mark_interrupted_jobs()` — called during boot. Any `queued`, `running`, or `cancelling` row from a previous process is marked `interrupted`.
- `clear_terminal_history()` / `cleanup_terminal_history(retain_count)` — delete terminal rows only, never active rows.

Connections are **not pooled** — each operation opens a fresh `rusqlite::Connection::open(path)`. This is appropriate for the current write volume (one row per user operation); revisit if batch jobs become common.

### Path resolution

```rust
AppPaths::default() -> ~/.fileoctopus/{config,logs,operation-history.sqlite}
```

`home_dir` checks `HOME` then `USERPROFILE`. Tests inject a tempdir via `boot_with_history_path` to avoid touching the real user profile.

## Concurrency invariants

- `OperationRuntime::jobs` is a `Mutex<HashMap>`. All updates (insert at start, progress update, terminal update) acquire the lock briefly. Poisoning maps to `FileOperationError::Internal`.
- The worker holds only a clone of the `Arc<Mutex<...>>`, not the lock, so user-visible reads (`status`, `recent_history`) cannot block on the worker.
- `JobEvent` callbacks fire on the worker thread, including the initial `JobStarted`. Sink implementations must be `Send + Sync`.
- The history repository is `Clone`able (it holds an `Arc<PathBuf>`); each call opens its own connection, so concurrent writes from multiple workers do not deadlock at the application layer (SQLite serializes at the file level).

## Conventions

- **`AppCore::boot` is the only public boot path.** Tests should call `boot_with_history_path`; never reach into `OperationHistoryRepository::new` directly.
- **History writes are best-effort.** Don't change `OperationRuntime` to propagate history errors to the IPC reply; the live job is more important than its archived record.
- **Don't expand `AppState` casually.** Each new field gets cloned across every command handler. Group related state into its own `Arc` if it grows.
- **Treat `OperationRuntime::jobs` as private state.** All access goes through `start`/`cancel`/`status`/`recent_history`. New behaviour belongs on `OperationRuntime`, not on `AppState`.

## Tests

In `crates/app-core/src/lib.rs::tests`:

- `boot_registers_local_provider` — `boot()` returns a registry with `local` resolved to `ProviderId("local")`.
- `operation_history_migration_is_idempotent` — `migrate()` is safe to call repeatedly.
- `successful_operation_is_persisted_as_completed` — full copy round-trip; asserts the history row ends `completed`.
- `failed_operation_is_persisted_as_failed` — destination conflict produces `failed` + `error_code = "destination_conflict"`.
- `cancelled_operation_is_persisted_as_cancelled` — cancels mid-copy and asserts the history row ends `cancelled`.

Run with `cargo test -p app-core`.
