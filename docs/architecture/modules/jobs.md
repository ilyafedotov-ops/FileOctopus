# `jobs` — Job identity, state, events, cancellation

`crates/jobs` is a tiny crate that owns the **vocabulary for asynchronous work** in FileOctopus. It defines the job id, the snapshot of a job's current state, the discriminated union of events a job emits, and the cancellation primitive used to abort one. It has no I/O and no runtime — `app-core::OperationRuntime` does the scheduling, this crate just supplies the types.

- Source: `crates/jobs/src/lib.rs`
- Depends on: `vfs` (for `FileOperationKind`), `chrono`, `serde`.
- Used by: `fs-core`, `app-core`, `app-ipc`.

## Types

| Type                | Purpose                                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `JobId(String)`     | Opaque newtype. `app-core` constructs UUIDs.                                                                                 |
| `JobStatus`         | `Queued`, `Running`, `Paused`, `Cancelled`, `Completed`, `Failed`. `Paused` is reserved; no path currently produces it.      |
| `JobSnapshot`       | Read-side view of a job (id, kind, status, progress counters, error fields, timestamps).                                     |
| `JobStartedEvent`   | Emitted once when work begins.                                                                                               |
| `JobProgressEvent`  | Emitted periodically while items are processed.                                                                              |
| `JobCompletedEvent` | Emitted once on success.                                                                                                     |
| `JobFailedEvent`    | Emitted once on failure with `error_code` and `message`.                                                                     |
| `JobCancelledEvent` | Emitted once when cooperative cancellation is observed.                                                                      |
| `JobEvent`          | `enum { Started, Progress, Completed, Failed, Cancelled }`, tagged with `#[serde(tag = "event", rename_all = "camelCase")]`. |
| `CancellationToken` | `Clone` wrapper around `Arc<AtomicBool>`.                                                                                    |

All event types and `JobSnapshot` serialize with camelCase. `JobEvent`'s tag is `event`, so the wire form is `{"event":"progress", …}`. `app-ipc::job_event_name` maps each variant to the channel name (`fileOperation:job:progress`, etc.); `app-ipc::job_event_payload` strips the tag for the channel payload.

## Job lifecycle

```
                  ┌─────────► Completed
queued ─► running ┤
                  ├─────────► Failed   (carries error_code + message)
                  └─────────► Cancelled
```

Transitions are owned by `OperationRuntime` in `app-core`:

1. `start` inserts a `Queued` snapshot, emits `JobStarted`, then flips the snapshot to `Running`.
2. The executor (`fs-core::file_ops`) calls the sink with `JobProgressEvent` on byte/item milestones; `OperationRuntime` updates the in-memory snapshot.
3. Terminal events (`Completed` / `Failed` / `Cancelled`) update both the snapshot and the SQLite history row.

`JobStatus::Paused` exists for future use (resumable jobs, throttling) and currently never appears.

## `JobSnapshot`

```rust
pub struct JobSnapshot {
    pub job_id: JobId,
    pub operation_kind: FileOperationKind,
    pub status: JobStatus,
    pub current_item: Option<String>,
    pub completed_items: u64,
    pub total_items: u64,
    pub completed_bytes: u64,
    pub total_bytes: Option<u64>,
    pub error_code: Option<String>,
    pub message: Option<String>,
    pub started_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

`total_bytes` is `None` when the plan could not compute a byte total (directories, missing metadata). The frontend renders an indeterminate progress in that case (see `packages/frontend/src/index.tsx`, `JobActivityPanel`).

`error_code` mirrors `FileOperationError::code()` for failed jobs and is the value the UI branches on. `message` is the human-readable `user_message()`.

## `CancellationToken`

```rust
#[derive(Clone, Default)]
pub struct CancellationToken { cancelled: Arc<AtomicBool> }

impl CancellationToken {
    pub fn new() -> Self;
    pub fn cancel(&self);
    pub fn is_cancelled(&self) -> bool;
}
```

`OperationRuntime` clones the token into the worker thread, and `fs-core::file_ops` polls it between items and inside copy loops (see [fs-core.md](fs-core.md)). Cancellation is **cooperative**: a short-running operation can complete before the token is observed. Callers must treat `cancel_job` as best-effort.

## Wire-format invariants

- Event-name strings (`fileOperation:job:*`) are owned by `crates/app-ipc`. Do **not** hardcode them in this crate.
- New event variants must be added simultaneously here, in `app_ipc::job_event_name`, in `packages/ts-api/src/client.ts`, and in [api-reference.md](../api-reference.md).
- New `JobStatus` values that can actually be emitted must propagate to `OperationHistoryRepository::status_string` so the SQLite row stays consistent.

## Tests

Co-located in `crates/jobs/src/lib.rs`: cancellation-token behaviour and a serde round-trip on `JobEvent::Progress`. Run with `cargo test -p jobs`.
