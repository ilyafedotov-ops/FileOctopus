# FileOctopus API Reference

This document is the authoritative description of FileOctopus's runtime API surface: the Tauri IPC commands, the events streamed back from Rust, the `@fileoctopus/ts-api` client that wraps them, and the domain types that flow across the boundary. It is the contract every change to filesystem behaviour must respect (see ADR-0002 and ADR-0003).

- Source of truth (Rust): `apps/desktop-tauri/src-tauri/src/lib.rs`, `crates/app-ipc/src/lib.rs`, `crates/app-core/src/lib.rs`, `crates/vfs/src/lib.rs`, `crates/jobs/src/lib.rs`, `crates/fs-core/src/file_ops.rs`.
- Source of truth (TypeScript): `packages/ts-api/src/client.ts`, `packages/ts-api/src/types.ts`.

When you change any of the above, update the rest as a unit (see [Maintenance](#maintenance)).

## Contents

1. [Architectural surface](#architectural-surface)
2. [Tauri command catalog](#tauri-command-catalog)
3. [Event channels](#event-channels)
4. [TypeScript client (`@fileoctopus/ts-api`)](#typescript-client-fileoctopusts-api)
5. [Resource URIs](#resource-uris)
6. [File entries and capabilities](#file-entries-and-capabilities)
7. [File operations: plan and execute](#file-operations-plan-and-execute)
8. [Jobs and job lifecycle](#jobs-and-job-lifecycle)
9. [Operation history](#operation-history)
10. [Error model](#error-model)
11. [Rust crate APIs](#rust-crate-apis)
12. [Maintenance](#maintenance)

## Architectural surface

The trust boundary is the Tauri IPC layer. Every privileged effect (filesystem read, mutation, trash, history) is exposed only through a registered Tauri command. The frontend has no `tauri-plugin-fs` permissions; it talks to Rust through `FileOctopusClient`.

```
React UI ──► @fileoctopus/ts-api ──► Tauri invoke / listen ──► Rust commands
                                                                │
                                                                ▼
                                       AppState { VfsRegistry, OperationRuntime, history }
                                                                │
                                                                ▼
                                       LocalFsProvider · file_ops planner/executor · SQLite
```

Each IPC payload is a `serde(rename_all = "camelCase")` DTO defined in `crates/app-ipc`. The TypeScript types in `packages/ts-api/src/types.ts` mirror those DTOs exactly. The TS client translates dotted method names (e.g. `fs.stat`) into the underlying snake_case Tauri command names (`fs_stat`) via `commandMap`; both sides must stay aligned.

## Tauri command catalog

The desktop shell registers exactly these commands (`tauri::generate_handler!`):

| Tauri command                 | TS client method                                   | Request DTO                      | Response DTO                      | Purpose                                                             |
| ----------------------------- | -------------------------------------------------- | -------------------------------- | --------------------------------- | ------------------------------------------------------------------- |
| `app_get_info`                | `FileOctopusClient.getAppInfo()`                   | —                                | `AppInfoResponse`                 | App identity, version, build profile, commit, and target OS.        |
| `fs_stat`                     | `FsClient.stat(req)`                               | `StatRequest`                    | `StatResponse`                    | Metadata for a single resource.                                     |
| `fs_list_start`               | `FsClient.listStart(req)`                          | `ListStartRequest`               | `ListStartResponse`               | Start a streamed directory listing. Emits `directory:batch` events. |
| `plan_file_operation`         | `FileOperationsClient.planFileOperation(req)`      | `PlanFileOperationRequest`       | `PlanFileOperationResponse`       | Validate a `FileOperationRequest` and return a deterministic plan.  |
| `start_file_operation`        | `FileOperationsClient.startFileOperation(req)`     | `StartFileOperationRequest`      | `StartFileOperationResponse`      | Enqueue a job from a plan. Emits `fileOperation:job:*` events.      |
| `cancel_job`                  | `JobsClient.cancelJob(req)`                        | `CancelJobRequest`               | `JobStatusResponse`               | Cancel a running job by id.                                         |
| `get_job_status`              | `JobsClient.getJobStatus(req)`                     | `JobStatusRequest`               | `JobStatusResponse`               | Read the latest snapshot for a job.                                 |
| `list_recent_operations`      | `OperationHistoryClient.listRecentOperations(req)` | `ListRecentOperationsRequest`    | `ListRecentOperationsResponse`    | Read recent rows from the operation-history database.               |
| `clear_operation_history`     | `OperationHistoryClient.clearOperationHistory()`   | —                                | `ClearOperationHistoryResponse`   | Delete terminal history rows while preserving active jobs.          |
| `diagnostics_app_data_health` | `DiagnosticsClient.appDataHealth()`                | —                                | `AppDataHealthResponse`           | Report app data, log, and schema health without enumerating files.  |
| `export_diagnostics_bundle`   | `DiagnosticsClient.exportBundle(req)`              | `ExportDiagnosticsBundleRequest` | `ExportDiagnosticsBundleResponse` | Write a redacted diagnostics `.zip` for bug reports.                |
| `get_preferences`             | `PreferencesClient.get()`                          | —                                | `GetPreferencesResponse`            | Read persisted UI preferences (theme, density, view mode, etc.).   |
| `set_preference`              | `PreferencesClient.set(req)`                       | `SetPreferenceRequest`           | `SetPreferenceResponse`           | Update a single preference key with validation.                     |

All command handlers return `Result<TResponse, IpcError>`. Errors carry a stable string `code` (see [Error model](#error-model)).

### `app_get_info`

Returns the application's name, semantic version, build profile, optional commit SHA, and target OS.

```ts
const info = await client.getAppInfo();
// { name: "FileOctopus", version: "0.1.0", buildProfile: "release", commitSha: "abc123", targetOs: "linux" }
```

### `fs_stat`

Synchronous (one-shot) metadata read for a single `ResourceUri`.

```ts
const { entry } = await client.fs.stat({ uri: "local:///home/me/file.txt" });
```

| Field            | Type           | Notes                                               |
| ---------------- | -------------- | --------------------------------------------------- |
| `request.uri`    | `string`       | Must parse as `ResourceUri`.                        |
| `response.entry` | `FileEntryDto` | See [File entries](#file-entries-and-capabilities). |

Errors: `invalid_uri`, `unsupported_provider`, `not_found`, `permission_denied`, `internal`.

### `fs_list_start`

Begins a streamed directory listing. Returns immediately with a `sessionId`; entries arrive asynchronously as `directory:batch` events keyed by that `sessionId`.

```ts
const unlisten = await client.fs.onDirectoryBatch((event) => {
  if (event.error) {
    /* surface event.error */
    return;
  }
  /* append event.entries */
  if (event.isComplete) unlisten();
});

const { sessionId, requestId } = await client.fs.listStart({
  uri: "local:///home/me",
  requestId: crypto.randomUUID(),
  panelId: "left",
  batchSize: 256,
  includeHidden: false,
});
```

| Field                   | Type       | Notes                                                                 |
| ----------------------- | ---------- | --------------------------------------------------------------------- |
| `request.uri`           | `string`   | Directory `ResourceUri`.                                              |
| `request.requestId`     | `string`   | Client-generated correlation id; echoed on every batch for this list. |
| `request.panelId`       | `string?`  | `"left"` or `"right"`; used to cancel superseded listings per pane.   |
| `request.batchSize`     | `number?`  | Default `256`, clamped to `>= 1`.                                     |
| `request.includeHidden` | `boolean?` | Default `false`. Dotfiles are hidden.                                 |
| `response.sessionId`    | `string`   | UUID; matches `DirectoryBatchEventDto.sessionId`.                   |
| `response.requestId`    | `string`   | Echo of `request.requestId`.                                        |

Errors arrive on the event stream as `DirectoryBatchEventDto.error` when listing fails mid-stream (including `permission_denied` and `timeout` after 30s). The synchronous response only fails for invalid input (`invalid_uri`, `unsupported_provider`).

### `get_preferences` / `set_preference`

Preferences persist in SQLite (`preferences.sqlite` under the app data directory). Keys: `theme` (`system` \| `light` \| `dark`), `density` (`compact` \| `comfortable` \| `spacious`), `defaultViewMode` (`details` \| `list` \| `icons`), `showHiddenFiles` (boolean string), `sidebarWidth`, `splitRatio`.

```ts
const { preferences } = await client.preferences.get();
await client.preferences.set({ key: "theme", value: "dark" });
```

Invalid values reject with `IpcError` code `preferences_error`.

### `plan_file_operation`

Validates a user-issued `FileOperationRequest` and produces a `FileOperationPlan` with concrete items, detected conflicts, warnings, and totals. **Planning never mutates the filesystem.** Use the plan to render a preview (item count, byte total, conflict list) and confirm before calling `start_file_operation`.

```ts
const { plan } = await client.fileOperations.planFileOperation({
  operation: {
    kind: "copy",
    sources: ["local:///home/me/a.txt"],
    destination: "local:///home/me/Documents",
    conflictPolicy: "fail",
  },
});
```

### `start_file_operation`

Spawns a background worker thread that executes the plan. Returns the initial `JobSnapshot` (status `queued` → `running`). Progress flows through `fileOperation:job:*` events. The runtime persists a row to the operation-history SQLite DB on start and updates it on terminal states.

```ts
const { job } = await client.fileOperations.startFileOperation({ plan });
```

### `cancel_job` / `get_job_status`

Both take a `jobId` string and return the current `JobSnapshot`. Cancellation flips a `CancellationToken`; the worker checks it between items and surfaces `cancelled` via the job event channel. Cancellation of a finished job is a no-op (returns the final snapshot).

### `list_recent_operations`

Reads the most recent N rows from the operation-history DB (`limit` clamped to `[1, 100]`, default `20`). Rows are `OperationHistoryRecordDto`, ordered by `started_at` descending.

## Event channels

Rust pushes events via `app.emit(name, payload)`. The TS client wraps them in `transport.listen` and returns an `UnlistenFn`.

| Event name (constant)                                 | Payload                  | Emitted by                |
| ----------------------------------------------------- | ------------------------ | ------------------------- |
| `directory:batch` (`DIRECTORY_BATCH_EVENT`)           | `DirectoryBatchEventDto` | `fs_list_start` worker    |
| `fileOperation:job:started` (`JOB_STARTED_EVENT`)     | `JobStartedEvent`        | `OperationRuntime::start` |
| `fileOperation:job:progress` (`JOB_PROGRESS_EVENT`)   | `JobProgressEvent`       | Operation executor        |
| `fileOperation:job:completed` (`JOB_COMPLETED_EVENT`) | `JobCompletedEvent`      | Operation executor        |
| `fileOperation:job:failed` (`JOB_FAILED_EVENT`)       | `JobFailedEvent`         | Operation executor        |
| `fileOperation:job:cancelled` (`JOB_CANCELLED_EVENT`) | `JobCancelledEvent`      | Operation executor        |

Names are exported as constants from both sides (`crates/app-ipc/src/lib.rs` and `packages/ts-api/src/client.ts`). The Rust enum-to-name mapping lives in `app_ipc::job_event_name`; the payload serializer is `app_ipc::job_event_payload`.

### `DirectoryBatchEventDto`

```ts
{
  sessionId: string;          // matches ListStartResponse.sessionId
  requestId: string;          // matches ListStartResponse.requestId
  uri: string;                // listed directory URI
  entries: FileEntryDto[];    // up to batchSize entries
  batchIndex: number;         // 0-based, monotonically increasing
  isComplete: boolean;        // true on the final batch (including error frames)
  totalHint?: number | null;  // unused by local provider; reserved
  error?: IpcError | null;    // populated only when the listing fails mid-stream
}
```

A failing listing emits one final frame with `entries: []`, `isComplete: true`, and a populated `error`.

### Job events

All job events carry `jobId` and `operationKind`. Specific shapes:

- `JobStartedEvent`: `totalItems`, `totalBytes?`, `startedAt`.
- `JobProgressEvent`: `currentItem?`, `completedItems`, `totalItems`, `completedBytes`, `totalBytes?`, `updatedAt`.
- `JobCompletedEvent`: `completedItems`, `completedBytes`, `completedAt`.
- `JobFailedEvent`: `errorCode`, `message`, `failedAt`.
- `JobCancelledEvent`: `cancelledAt`.

Progress events are throttled by a byte interval (`PROGRESS_BYTE_INTERVAL = 1 MiB`) inside copy/move operations; for small operations a single progress event may precede the terminal event.

> ⚠️ `JobSnapshot.jobId` is typed `string | JobId` on the TS side because the Rust `JobId` newtype serializes either as `{"value":"…"}` (in some serde contexts) or as a bare string. Treat as string via `typeof === "string" ? jobId : jobId.value`.

## TypeScript client (`@fileoctopus/ts-api`)

The frontend constructs a `FileOctopusClient` from an `IpcTransport`. Two transports ship in the box:

- `createTauriTransport()` — real Tauri IPC; used in the desktop shell. Translates dotted command names to snake_case via `commandMap`.
- `createPreviewTransport()` — minimal stub for running the UI in a plain browser (empty directory listings, `tauri_unavailable` for any mutating command).

```ts
import { createFileOctopusClient } from "@fileoctopus/ts-api";

const client = createFileOctopusClient(); // auto-selects transport based on __TAURI_INTERNALS__
```

`createFileOctopusClient(transport?)` picks `createTauriTransport()` when `__TAURI_INTERNALS__` is on `globalThis`, else `createPreviewTransport()`.

### Client surface

```ts
class FileOctopusClient {
  readonly fs: FsClient;
  readonly fileOperations: FileOperationsClient;
  readonly jobs: JobsClient;
  readonly operationHistory: OperationHistoryClient;
  readonly diagnostics: DiagnosticsClient;
  getAppInfo(): Promise<AppInfoResponse>;
}

class FsClient {
  stat(req: StatRequest): Promise<StatResponse>;
  listStart(req: ListStartRequest): Promise<ListStartResponse>;
  onDirectoryBatch(
    handler: (e: DirectoryBatchEventDto) => void,
  ): Promise<UnlistenFn>;
}

class FileOperationsClient {
  planFileOperation(
    req: PlanFileOperationRequest,
  ): Promise<PlanFileOperationResponse>;
  startFileOperation(
    req: StartFileOperationRequest,
  ): Promise<StartFileOperationResponse>;
  onJobStarted(h: (e: JobStartedEvent) => void): Promise<UnlistenFn>;
  onJobProgress(h: (e: JobProgressEvent) => void): Promise<UnlistenFn>;
  onJobCompleted(h: (e: JobCompletedEvent) => void): Promise<UnlistenFn>;
  onJobFailed(h: (e: JobFailedEvent) => void): Promise<UnlistenFn>;
  onJobCancelled(h: (e: JobCancelledEvent) => void): Promise<UnlistenFn>;
}

class OperationHistoryClient {
  listRecentOperations(
    req?: ListRecentOperationsRequest,
  ): Promise<ListRecentOperationsResponse>;
  clearOperationHistory(): Promise<ClearOperationHistoryResponse>;
}

class DiagnosticsClient {
  appDataHealth(): Promise<AppDataHealthResponse>;
  exportBundle(
    req: ExportDiagnosticsBundleRequest,
  ): Promise<ExportDiagnosticsBundleResponse>;
}

class JobsClient {
  cancelJob(req: CancelJobRequest): Promise<JobStatusResponse>;
  getJobStatus(req: JobStatusRequest): Promise<JobStatusResponse>;
}

class OperationHistoryClient {
  listRecentOperations(
    req?: ListRecentOperationsRequest,
  ): Promise<ListRecentOperationsResponse>;
}
```

### Error normalization

Every client method rejects with an `IpcError` (`{ code, message }`). Unknown throws are coerced through `normalizeIpcError`, which maps native `Error`s and string throws into `IpcError` with code `"unknown"`. The transport itself can reject with code `"tauri_unavailable"` (preview transport on a mutating command) or `"unsupported_transport"` (event subscription on a transport without `listen`).

### `IpcTransport`

```ts
interface IpcTransport {
  invoke<TResponse>(
    command: string,
    args?: Record<string, unknown>,
  ): Promise<TResponse>;
  listen?<TPayload>(
    event: string,
    handler: (payload: TPayload) => void,
  ): Promise<UnlistenFn>;
}
```

Implement this to plug an alternative transport (tests, mocks, an out-of-process bridge). The optional `listen` is required for any client method that subscribes to events.

## Resource URIs

Every resource crossing the IPC boundary is identified by a `ResourceUri` — a string `scheme://body`. Only the `local` scheme is currently registered (`LocalFsProvider`). `ResourceUri::parse` enforces:

- Scheme separator `://` is present.
- Scheme equals `local`.
- Body starts with `/` (POSIX absolute) or matches a Windows drive prefix `^[A-Za-z]:/`.
- No NUL bytes.

`ResourceUri::from_local_path` accepts a platform `Path` and produces a normalized `local://…` URI, replacing `\` with `/`. Both constructors reject relative paths.

```rust
let uri = ResourceUri::parse("local:///home/me/Documents")?;
assert_eq!(uri.scheme(), "local");
assert_eq!(uri.display_path(), "/home/me/Documents");
```

The TS side treats `ResourceUri` values as opaque strings. Do not parse them ad-hoc in the UI; if you need a friendly path, pull it from `FileEntryDto.name` or render `uri.replace(/^local:\/\//, "")` for display only.

## File entries and capabilities

`FileEntryDto` is the unified entry shape returned by `fs_stat` and streamed via directory batches.

```ts
interface FileEntryDto {
  uri: string;
  name: string;
  extension?: string | null;
  kind: FileKind; // "file" | "directory" | "symlink" | "archive" | "virtual" | "unknown"
  size?: number | null; // bytes; only meaningful for files
  modifiedAt?: string | null; // RFC3339
  createdAt?: string | null;
  accessedAt?: string | null;
  isHidden: boolean;
  isSymlink: boolean;
  symlinkTarget?: string | null; // absolute local:// URI when resolvable
  providerId: string; // "local" for LocalFsProvider
  canRead: boolean;
  canList: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canRename: boolean;
}
```

`canRead`/`canList`/`canWrite`/`canDelete`/`canRename` are per-entry capabilities. The current `LocalFsProvider` exposes the read-only set (`canRead`/`canList`); mutation goes through the file-operation pipeline, which enforces its own checks. UI should still hide buttons whose capability is `false`.

## File operations: plan and execute

The mutation pipeline is two-phase: **plan first**, then **start**.

### Operation kinds

```ts
type FileOperationKind =
  | "copy"
  | "move"
  | "rename"
  | "deleteToTrash"
  | "createDirectory";
```

Shape rules enforced by the planner (`crates/fs-core/src/file_ops.rs::validate_request_shape`):

| Kind              | Sources   | Destination       | `newName`                     |
| ----------------- | --------- | ----------------- | ----------------------------- |
| `copy`, `move`    | ≥1        | required          | optional (single source only) |
| `rename`          | exactly 1 | optional          | required                      |
| `createDirectory` | 0         | required (parent) | required (new dir name)       |
| `deleteToTrash`   | ≥1        | none              | none                          |

### Conflict policies

```ts
type ConflictPolicy =
  | "fail"
  | "skip"
  | "overwrite"
  | "renameNew"
  | "renameExisting";
```

The planner always reports conflicts in `FileOperationPlanDto.conflicts`. The executor's reaction is policy-driven:

- `fail` — executor returns `destination_conflict` on the first conflict.
- `skip` — conflicting items are not written.
- `overwrite` — destination is replaced.
- `renameNew` — the incoming item is renamed (`name (1).ext`, `name (2).ext`, …).
- `renameExisting` — the existing destination is renamed before the operation proceeds.

If the UI presents a plan with `conflicts.length > 0`, surface the chosen policy explicitly before calling `start_file_operation`.

### `FileOperationPlanDto`

```ts
interface FileOperationPlanDto {
  operationId: string; // UUID
  kind: FileOperationKind;
  sources: string[]; // ResourceUri strings
  destination?: string | null;
  newName?: string | null;
  conflictPolicy: ConflictPolicy;
  items: FileOperationItemDto[];
  conflicts: FileOperationConflictDto[];
  warnings: FileOperationWarningDto[];
  totalItems: number;
  totalBytes?: number | null; // null when any item's size is unknown
}
```

Items are sorted deterministically by source/destination URI. `totalBytes` is `null` if any item lacks a size (e.g. directories, symlinks). Warnings are non-fatal planner diagnostics — surface them but do not block execution.

## Jobs and job lifecycle

Each `start_file_operation` allocates a `JobId` (UUID) and registers a `JobRuntimeState` in the in-memory job table. State transitions:

```
queued ──► running ──► completed
                  └──► failed
                  └──► cancelled
```

`JobSnapshot` carries the live state:

```ts
interface JobSnapshot {
  jobId: string | JobId;
  operationKind: FileOperationKind;
  status: JobStatus; // "queued" | "running" | "paused" | "cancelled" | "completed" | "failed"
  currentItem?: string | null;
  completedItems: number;
  totalItems: number;
  completedBytes: number;
  totalBytes?: number | null;
  errorCode?: string | null;
  message?: string | null;
  startedAt: string;
  updatedAt: string;
}
```

`paused` is reserved; the current executor never enters it.

Cancellation is cooperative — the worker checks `CancellationToken::is_cancelled()` between items and during byte-level copy loops. The UI should treat `cancel_job` as best-effort: the job may complete or fail before the token is observed.

## Operation history

A SQLite database stores one row per started job; rows are updated to a terminal status when the job ends.

- Default path: `$HOME/.fileoctopus/operation-history.sqlite` (or `%USERPROFILE%\.fileoctopus\operation-history.sqlite`).
- Schema version: `1`, stored in `schema_meta` and SQLite `user_version`.
- Schema: `operation_history(job_id, operation_kind, source_count, representative_source_path, destination_path, status, started_at, completed_at, error_code)`.
- Startup recovery marks `queued`, `running`, and `cancelling` rows as `interrupted`.

`list_recent_operations` returns `OperationHistoryRecordDto`:

```ts
interface OperationHistoryRecordDto {
  jobId: string;
  operationKind: string; // Debug-formatted FileOperationKind (e.g. "Copy", "DeleteToTrash")
  sourceCount: number;
  representativeSourcePath?: string | null; // display path, not URI
  destinationPath?: string | null;
  status: string; // "running" | "completed" | "failed" | "cancelled" | "interrupted"
  startedAt: string; // RFC3339
  completedAt?: string | null;
  errorCode?: string | null;
}
```

`operationKind` and `status` are strings here (not the enum). The path fields are `display_path()` values, not `ResourceUri` strings, because the history is for human review.

## Error model

`IpcError` is the only error shape that crosses the IPC boundary:

```ts
interface IpcError {
  code: string;
  message: string;
}
```

The `code` is stable and is what the UI branches on (`packages/frontend/src/index.tsx::operationErrorMessage`). All current codes:

| Code                    | Origin                           | Meaning                                                        |
| ----------------------- | -------------------------------- | -------------------------------------------------------------- |
| `invalid_uri`           | `VfsError`                       | URI failed to parse (missing scheme, relative path, NUL byte). |
| `unsupported_provider`  | `VfsError`, `FileOperationError` | No provider registered for the scheme.                         |
| `duplicate_provider`    | `VfsError`                       | Two providers tried to claim the same scheme.                  |
| `not_found`             | `VfsError`, `FileOperationError` | Resource or job id does not exist.                             |
| `permission_denied`     | `VfsError`, `FileOperationError` | OS denied the read/write/delete.                               |
| `timeout`               | `VfsError`                       | Directory listing exceeded the server timeout (30s).             |
| `preferences_error`     | Preferences repository           | Invalid preference key/value or database failure.            |
| `invalid_request`       | `FileOperationError`             | Operation request shape is wrong (missing sources, etc.).      |
| `invalid_name`          | `FileOperationError`             | Proposed name is empty, contains separators, or is reserved.   |
| `invalid_path`          | `FileOperationError`             | URI parsed but is not usable for this operation.               |
| `destination_missing`   | `FileOperationError`             | Destination parent does not exist.                             |
| `destination_conflict`  | `FileOperationError`             | Conflict detected and policy is `fail`.                        |
| `recursive_operation`   | `FileOperationError`             | Source contains destination (move/copy into itself).           |
| `unsupported_symlink`   | `FileOperationError`             | Symlink object copy is not supported in the MVP.               |
| `unsupported_trash`     | `FileOperationError`             | Platform trash unavailable.                                    |
| `cancelled`             | `FileOperationError`             | Operation aborted via `CancellationToken`.                     |
| `io_error`              | `FileOperationError`             | Unclassified `std::io::Error`.                                 |
| `internal`              | `VfsError`, `FileOperationError` | Bug or invariant violation — file an issue.                    |
| `unknown`               | TS client                        | A non-IPC error was caught and wrapped.                        |
| `tauri_unavailable`     | Preview transport                | A mutating command was called outside the Tauri shell.         |
| `unsupported_transport` | TS client                        | Event subscription on a transport without `listen`.            |

The Rust enums are `VfsError::code()` and `FileOperationError::code()` — those are the source of truth, and any new variant must extend this table.

## Rust crate APIs

The frontend never imports these directly, but internal callers and tests do.

### `vfs`

- `ResourceUri::parse(&str) -> Result<ResourceUri, VfsError>` / `ResourceUri::from_local_path(&Path) -> Result<…>` / `as_str()` / `scheme()` / `display_path()` / `to_local_path()`.
- `FileEntry`, `FileKind`, `EntryCapabilities`, `ProviderCapabilities`.
- `FileOperationRequest`, `FileOperationPlan`, `FileOperationItem`, `FileOperationConflict`, `FileOperationWarning`.
- `FileOperationError` and `VfsError` — each exposes `code()`.
- `#[async_trait] VfsProvider`:
  ```rust
  fn id(&self) -> ProviderId;
  fn schemes(&self) -> &'static [&'static str];
  fn capabilities(&self) -> ProviderCapabilities;
  async fn stat(&self, uri: &ResourceUri) -> Result<FileEntry, VfsError>;
  async fn list(&self, uri: &ResourceUri, options: ListOptions, sink: DirectorySink) -> Result<(), VfsError>;
  ```
- `VfsRegistry::new()`, `register(Arc<dyn VfsProvider>)`, `provider_for(&ResourceUri)`, `stat`, `list`. A scheme can be registered at most once.

### `fs-core`

- `LocalFsProvider` — the only registered `VfsProvider` today; read-only stat + streamed list.
- `file_ops::plan_file_operation(FileOperationRequest) -> Result<FileOperationPlan, FileOperationError>` — pure validation, no I/O beyond stat where needed.
- `file_ops::execute_file_operation(plan, &JobId, &CancellationToken, &FileOperationEventSink) -> Result<(), FileOperationError>` — runs the plan, emits `JobEvent::Progress` through the sink, honours the cancellation token.
- `FileOperationEventSink = dyn Fn(JobEvent) + Send + Sync` — wrapped in `Arc` by callers.
- Constants: `COPY_BUFFER_SIZE = 64 KiB`, `PROGRESS_BYTE_INTERVAL = 1 MiB`.

### `jobs`

- `JobId`, `JobStatus`, `JobSnapshot`.
- `JobEvent::{Started, Progress, Completed, Failed, Cancelled}` and the corresponding event structs.
- `CancellationToken { new(), cancel(), is_cancelled() }` — internally a single `AtomicBool` shared via `Arc`.

### `app-core`

- `AppCore::boot() -> Result<Arc<AppState>, AppCoreError>` — registers `LocalFsProvider`, opens the history DB, marks previously running jobs as interrupted, returns shared state. Use `AppCore::boot_with_history_path(PathBuf)` in tests.
- `AppState { vfs, operations, paths, startup_recovery_count }`.
- `OperationRuntime::plan(request) -> FileOperationPlan` — delegates to `file_ops::plan_file_operation`.
- `OperationRuntime::start(plan, sink) -> JobSnapshot` — spawns the worker thread, inserts a history row, returns the initial snapshot.
- `OperationRuntime::cancel(&str) -> JobSnapshot` / `status(&str) -> JobSnapshot` — look up the job by id.
- `OperationRuntime::recent_history(limit: u32) -> Vec<OperationHistoryRecord>` — clamped to `[1, 100]`.
- `OperationRuntime::clear_terminal_history()` / `cleanup_history()` — remove terminal rows without deleting active jobs.
- `OperationHistoryRepository::new(PathBuf)` runs idempotent migrations on open and pins `schema_version = 1`.

### `app-ipc`

Every public type here is a DTO with a `From`/`TryFrom` between the domain type and its wire form, and a matching TypeScript interface. The event-name constants (`DIRECTORY_BATCH_EVENT`, `JOB_*_EVENT`) and the helpers `job_event_name(&JobEvent) -> &'static str`, `job_event_payload(JobEvent) -> serde_json::Value` are the single point of truth for event channel names; the Tauri command and the TS client both depend on them.

## Maintenance

When you add or change anything in the API:

1. **Domain types** — start in `crates/vfs` (or `crates/jobs` for job-level types). Update `code()` if a new error variant.
2. **DTOs** — add the camelCase DTO in `crates/app-ipc` with `From` / `TryFrom` to the domain type, and matching tests.
3. **Tauri handler** — add the function in `apps/desktop-tauri/src-tauri/src/lib.rs` and register it in `tauri::generate_handler!`.
4. **TS types** — mirror the DTO in `packages/ts-api/src/types.ts`.
5. **TS client** — add the method on the right client class in `packages/ts-api/src/client.ts` and update `commandMap` with the dotted-to-snake-case mapping. Wrap the call in `normalizeIpcError`.
6. **This document** — add the command to the [catalog](#tauri-command-catalog), document any new event, and extend the [error model](#error-model) for any new code.
7. **Tests** — add Rust unit tests in the crate, IPC roundtrip tests in `crates/app-ipc`, and a Vitest test in `packages/ts-api/tests` for the new client method.

For new event channels, also pick the constant name in `crates/app-ipc/src/lib.rs` first, then mirror it in `packages/ts-api/src/client.ts`. Update `job_event_name` / `job_event_payload` if the event is part of the job event enum.

Boundary changes must be called out in the PR template's "Security impact" section per `AGENTS.md`.
