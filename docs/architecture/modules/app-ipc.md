# `app-ipc` — IPC contract: DTOs, event constants, error mapping

`crates/app-ipc` is the **wire-format crate**. Every value that crosses the Tauri IPC boundary either _is_ defined here or has a `From` / `TryFrom` between its domain type and a DTO defined here. There is no business logic — it's a translation layer. Mirror this crate's shape, field-for-field, in `packages/ts-api/src/types.ts`.

- Source: `crates/app-ipc/src/lib.rs`
- Depends on: `vfs`, `jobs`, `chrono`, `serde`, `serde_json`.
- Used by: `apps/desktop-tauri/src-tauri/src/lib.rs` (the only consumer in Rust).

## Why a separate crate

Two reasons:

1. **Single canonical wire shape.** `serde(rename_all = "camelCase")` lives on every DTO here so the TypeScript types can be a mechanical mirror. Domain types in `crates/vfs` and `crates/jobs` also use camelCase serde attrs, but DTOs flatten any Rust-only details (e.g. `FileEntry::capabilities` is unwrapped into five booleans in `FileEntryDto`).
2. **Stable error mapping.** `IpcError` is the only error shape that ever crosses the boundary. The `From` impls for `VfsError` and `FileOperationError` produce stable `code` strings from the corresponding `code()` methods — never `Debug::fmt` or `Display`.

## Public surface

### Request/response DTOs

Pair every Tauri command with a typed request and response:

| Command                       | Request                                                           | Response                                                                      |
| ----------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `app_get_info`                | —                                                                 | `AppInfoResponse`                                                             |
| `fs_stat`                     | `StatRequest { uri }`                                             | `StatResponse { entry: FileEntryDto }`                                        |
| `fs_list_start`               | `ListStartRequest { uri, batchSize?, includeHidden? }`            | `ListStartResponse { sessionId }`                                             |
| `plan_file_operation`         | `PlanFileOperationRequest { operation: FileOperationRequestDto }` | `PlanFileOperationResponse { plan: FileOperationPlanDto }`                    |
| `start_file_operation`        | `StartFileOperationRequest { plan: FileOperationPlanDto }`        | `StartFileOperationResponse { job: JobSnapshot }`                             |
| `cancel_job`                  | `CancelJobRequest { jobId }`                                      | `JobStatusResponse { job: JobSnapshot }`                                      |
| `get_job_status`              | `JobStatusRequest { jobId }`                                      | `JobStatusResponse { job: JobSnapshot }`                                      |
| `list_recent_operations`      | `ListRecentOperationsRequest { limit? }`                          | `ListRecentOperationsResponse { operations: Vec<OperationHistoryRecordDto> }` |
| `clear_operation_history`     | —                                                                 | `ClearOperationHistoryResponse { deletedCount }`                              |
| `diagnostics_app_data_health` | —                                                                 | `AppDataHealthResponse`                                                       |
| `export_diagnostics_bundle`   | `ExportDiagnosticsBundleRequest { destination }`                  | `ExportDiagnosticsBundleResponse { path, files }`                             |

`JobSnapshot` from `crates/jobs` is re-exported through the response types — it is already camelCase, so it does not need a Dto twin.

### Value DTOs

- `FileEntryDto` — flattens `FileEntry` and its `EntryCapabilities` into five booleans (`canRead`, `canList`, `canWrite`, `canDelete`, `canRename`). Symlink targets and provider id are stringified.
- `DirectoryBatchEventDto` — wire form of `DirectoryBatch` with an additional `error: Option<IpcError>` slot used when listing fails mid-stream.
- `FileOperationRequestDto` / `FileOperationPlanDto` / `FileOperationItemDto` / `FileOperationConflictDto` / `FileOperationWarningDto` — DTO mirrors of the planner value graph. URIs are strings; `ConflictPolicy` and `FileOperationKind` round-trip directly because the domain enums already use camelCase serde tags.
- `OperationHistoryRecordDto` — wire form for the SQLite history rows. All path-shaped fields are display paths (not `local://` URIs) because they exist to be shown to humans.
- `IpcError { code, message }` — the canonical error envelope.

### Event constants

```rust
pub const DIRECTORY_BATCH_EVENT: &str = "directory:batch";
pub const JOB_STARTED_EVENT: &str = "fileOperation:job:started";
pub const JOB_PROGRESS_EVENT: &str = "fileOperation:job:progress";
pub const JOB_COMPLETED_EVENT: &str = "fileOperation:job:completed";
pub const JOB_FAILED_EVENT: &str = "fileOperation:job:failed";
pub const JOB_CANCELLED_EVENT: &str = "fileOperation:job:cancelled";
```

These are the **authoritative** names for `app.emit` / `tauri::listen`. The TS client mirrors them in `packages/ts-api/src/events.ts` (re-exported from `@fileoctopus/ts-api`); never hardcode a new string outside `app-ipc` and `events.ts`.

### Event helpers

```rust
pub fn job_event_name(event: &JobEvent) -> &'static str;
pub fn job_event_payload(event: JobEvent) -> serde_json::Value;
```

`job_event_name` is a pure match over `JobEvent` variants. `job_event_payload` serializes the payload struct (`JobStartedEvent`, `JobProgressEvent`, etc.) without the outer enum tag, which is what the frontend expects — payloads on the channel are flat, not tagged.

## From/TryFrom impls

Every domain ↔ DTO conversion is implemented as a `From` or `TryFrom`:

| Direction                                          | Trait                          | Notes                                                                                     |
| -------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------- |
| `FileEntry → FileEntryDto`                         | `From`                         | Infallible. Stringifies `ResourceUri`, `ProviderId`, optional symlink target.             |
| `DirectoryBatch → DirectoryBatchEventDto`          | `From`                         | `error` defaults to `None`; the shell sets it when listing fails.                         |
| `FileOperationRequestDto → FileOperationRequest`   | `TryFrom<…, Error = IpcError>` | Parses each URI via `ResourceUri::parse`; defaults `conflict_policy` to `Fail`.           |
| `FileOperationPlan ↔ FileOperationPlanDto`         | `From` + `TryFrom`             | Bidirectional because the plan goes UI → shell → executor through `start_file_operation`. |
| `FileOperationItem ↔ FileOperationItemDto`         | `From` + `TryFrom`             | URIs are optional on both sides (createDirectory has no source).                          |
| `FileOperationConflict ↔ FileOperationConflictDto` | `From` + `TryFrom`             | Both URIs are required.                                                                   |
| `FileOperationWarning ↔ FileOperationWarningDto`   | `From` (both directions)       | The reverse direction silently drops invalid URIs (a warning is not worth failing for).   |
| `VfsError → IpcError`                              | `From`                         | `code = error.code()`, `message = error.to_string()`.                                     |
| `FileOperationError → IpcError`                    | `From`                         | `code = error.code()`, `message = error.user_message()`.                                  |

`IpcError::internal(message)` is a small constructor for unexpected internal errors.

## `app_core_history::Record`

A small structural type lives in a child module to avoid pulling `app-core` (and its rusqlite dependency) into `app-ipc`. `app-core` constructs the matching `OperationHistoryRecord`, but the conversion goes through this re-shape so the crates stay decoupled. Field-for-field identical to `OperationHistoryRecord`.

## Conventions

- **Every DTO has `#[serde(rename_all = "camelCase")]`.** Don't introduce a DTO without it — the TS side will silently fail to deserialize.
- **All errors out of `TryFrom` are `IpcError`.** Don't propagate `VfsError` directly; the `?` operator should hit the `From<VfsError> for IpcError` impl.
- **URIs are strings on the wire, never paths.** Even in `OperationHistoryRecordDto` where the fields are display paths, they are display paths _because they are for human use_, not because the wire format ever leaks an `OsString`.
- **One source of truth per event name.** The constants here are the canonical strings. If you add an event, name it here first.

## Tests

Co-located in `crates/app-ipc/src/lib.rs`:

- `serializes_stat_response` — round-trips a `StatResponse` through `serde_json` and re-parses it.
- `serializes_directory_batch_event` — same for `DirectoryBatchEventDto`.
- `maps_vfs_error_to_ipc_error` — pins the `invalid_uri` code on the `IpcError::From<VfsError>` path.

Run with `cargo test -p app-ipc`.
