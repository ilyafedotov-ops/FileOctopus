# FileOctopus Sprint 2 Implementation Backlog

## Sprint 2 Theme

**Safe local file operations vertical slice**

Sprint 2 turns FileOctopus from a read-only local navigator into a cautious local file manager capable of executing basic file operations through the Rust backend job engine.

The sprint focuses on:

- Local filesystem copy, move, rename, delete-to-trash, and create-folder flows.
- Job lifecycle: queued, running, paused where feasible, cancelled, completed, failed.
- Progress reporting from Rust to the web frontend through Tauri IPC events.
- Conflict detection and explicit conflict-resolution policy selection.
- Basic operation history persisted in SQLite.
- Guardrails against destructive or ambiguous behavior.

Sprint 2 deliberately avoids:

- Permanent delete.
- Remote/cloud providers.
- Multi-pane synchronization.
- Recursive diff/merge.
- Advanced ACL preservation.
- Archive handling.
- Background service / daemon mode.
- Cross-device move optimization beyond safe copy-then-delete semantics.

---

## Sprint 2 Goal

By the end of Sprint 2, a user can select one or more local files/folders in the UI and perform safe local operations with visible progress, cancellation, conflict handling, and persisted operation history.

---

## Sprint 2 Milestone

### `M2 — Safe Local File Operations`

**Target outcome:**

A working end-to-end local file operation pipeline:

```text
React UI
  -> typed TypeScript API client
  -> Tauri command
  -> Rust command handler
  -> operation planner
  -> job engine
  -> local filesystem provider
  -> progress events
  -> operation history persistence
  -> UI job panel
```

---

## Sprint 2 Labels

Reuse labels from Sprint 0 / Sprint 1 and add these where needed:

- `area:file-ops`
- `area:job-engine`
- `area:vfs`
- `area:ipc`
- `area:frontend`
- `area:sqlite`
- `area:testing`
- `area:ux`
- `type:feature`
- `type:refactor`
- `type:test`
- `type:docs`
- `priority:p0`
- `priority:p1`
- `priority:p2`
- `risk:destructive-operation`
- `risk:cross-platform`
- `risk:performance`

---

# Sprint 2 Backlog

## FO-0126 — Define file operation domain model

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:file-ops`, `area:vfs`, `type:feature`, `priority:p0`  
**Estimate:** 3 points

### Description

Create the Rust domain model for local file operations. This model must be independent from Tauri command DTOs so that the operation planner, job engine, tests, and future providers can reuse it.

### Tasks

- Define `FileOperationKind`:
  - `Copy`
  - `Move`
  - `Rename`
  - `DeleteToTrash`
  - `CreateDirectory`
- Define `FileOperationRequest`.
- Define `FileOperationPlan`.
- Define `FileOperationItem`.
- Define `ConflictPolicy`:
  - `Fail`
  - `Skip`
  - `Overwrite`
  - `RenameNew`
  - `RenameExisting`
- Define `FileOperationError` variants.
- Add serialization where required for IPC-facing DTO conversion.
- Keep domain types free of frontend-specific naming.

### Acceptance Criteria

- Domain model compiles in the Rust workspace.
- Unit tests cover model construction for each operation kind.
- Domain model does not import Tauri types.
- Domain model is documented with Rust doc comments.

### Dependencies

- Sprint 1 Rust workspace structure.
- Sprint 1 local VFS provider interfaces.

---

## FO-0127 — Add operation planning service

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:file-ops`, `area:vfs`, `type:feature`, `priority:p0`, `risk:destructive-operation`  
**Estimate:** 5 points

### Description

Implement an operation planner that validates requested file operations before jobs are executed. Planning must catch obvious errors early and produce a deterministic plan.

### Tasks

- Validate source existence.
- Validate destination parent existence.
- Reject copy/move into itself.
- Reject recursive move into descendant.
- Detect destination conflicts.
- Determine whether an operation is single-file or recursive.
- Estimate item count where feasible.
- Estimate total byte count where feasible.
- Return structured warnings for partial metadata failures.
- Add planner unit tests using temporary directories.

### Acceptance Criteria

- Planner prevents self-copy and move-into-descendant cases.
- Planner reports destination conflicts before execution.
- Planner returns stable item ordering for deterministic tests.
- Planner never mutates filesystem state.
- Planner errors are mapped into the shared error taxonomy.

### Dependencies

- `FO-0126`

---

## FO-0128 — Implement local copy executor

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:file-ops`, `area:vfs`, `area:job-engine`, `type:feature`, `priority:p0`, `risk:performance`  
**Estimate:** 8 points

### Description

Implement recursive local copy execution through the Rust backend. The executor must integrate with the job engine and emit progress events.

### Tasks

- Implement file copy for a single file.
- Implement recursive directory copy.
- Preserve basic file timestamps where supported.
- Create destination directories as needed.
- Stream large files using buffered I/O.
- Emit per-item progress.
- Emit aggregate byte progress.
- Support cancellation checks between chunks and items.
- Handle partial copy cleanup policy for cancelled jobs.
- Add integration tests with nested test directories.

### Acceptance Criteria

- Copying a file produces identical byte content.
- Copying a directory preserves directory structure.
- Large file copy emits more than one progress update.
- Cancellation stops the copy without panics.
- Destination conflict behavior follows `ConflictPolicy`.

### Dependencies

- `FO-0126`
- `FO-0127`
- Sprint 1 job engine foundation.

---

## FO-0129 — Implement local move executor

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:file-ops`, `area:vfs`, `area:job-engine`, `type:feature`, `priority:p0`, `risk:destructive-operation`, `risk:cross-platform`  
**Estimate:** 8 points

### Description

Implement local move execution. Same-volume moves should prefer atomic rename where possible. Cross-volume moves must use safe copy-then-delete semantics.

### Tasks

- Attempt fast-path filesystem rename.
- Detect or gracefully handle cross-device rename failure.
- Fall back to copy-then-delete for cross-device moves.
- Ensure source is deleted only after successful copy.
- Support recursive directory move.
- Emit job progress events.
- Support cancellation.
- Add tests for same-directory rename-like move.
- Add tests for fallback behavior using an injectable filesystem abstraction or mocked failure.

### Acceptance Criteria

- Same-volume move completes through fast path when supported.
- Fallback move does not delete source until copy succeeds.
- Failed move leaves source intact.
- Cancellation does not produce silent data loss.
- Move into descendant is rejected by planner.

### Dependencies

- `FO-0127`
- `FO-0128`

---

## FO-0130 — Implement rename operation

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:file-ops`, `area:vfs`, `type:feature`, `priority:p0`, `risk:destructive-operation`  
**Estimate:** 3 points

### Description

Implement explicit rename support for files and folders. Rename is modeled separately from move in the UI even if the backend implementation can reuse move/rename primitives.

### Tasks

- Add backend rename command handler.
- Validate new name is not empty.
- Validate new name does not contain path separators.
- Validate target path conflict.
- Use filesystem rename primitive.
- Emit operation history entry.
- Add tests for file rename.
- Add tests for directory rename.
- Add tests for invalid names.

### Acceptance Criteria

- Rename changes only the basename, not the parent directory.
- Invalid names are rejected before filesystem mutation.
- Conflict behavior is explicit and deterministic.
- UI receives structured error on failure.

### Dependencies

- `FO-0126`
- `FO-0127`

---

## FO-0131 — Implement create directory operation

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:file-ops`, `area:vfs`, `type:feature`, `priority:p0`  
**Estimate:** 2 points

### Description

Allow users to create a new folder in the currently selected local directory.

### Tasks

- Add backend create-directory command.
- Validate parent directory exists.
- Validate new folder name.
- Reject path separators in folder name.
- Detect conflicts.
- Return created item metadata.
- Refresh frontend listing after creation.
- Add unit and integration tests.

### Acceptance Criteria

- User can create a folder from the current directory view.
- Duplicate folder name produces a conflict error.
- Created folder appears in the file list without app restart.
- Invalid names are rejected before mutation.

### Dependencies

- Sprint 1 local navigation vertical slice.

---

## FO-0132 — Implement delete-to-trash operation

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:file-ops`, `area:vfs`, `type:feature`, `priority:p0`, `risk:destructive-operation`, `risk:cross-platform`  
**Estimate:** 5 points

### Description

Implement safe delete using the OS trash/recycle-bin mechanism instead of permanent deletion.

### Tasks

- Select Rust crate or platform abstraction for trash support.
- Implement delete-to-trash for files.
- Implement delete-to-trash for directories.
- Return structured failure when trash operation is unsupported.
- Never fall back to permanent delete.
- Add confirmation requirement in frontend.
- Add operation history entry.
- Add tests where platform permits.
- Add platform notes for Windows, macOS, and Linux.

### Acceptance Criteria

- Delete action moves items to OS trash/recycle bin where supported.
- Permanent deletion is not implemented in Sprint 2.
- Unsupported trash operation returns a clear error.
- UI confirmation explicitly says “Move to Trash” or platform-equivalent wording.

### Dependencies

- `FO-0126`

---

## FO-0133 — Add Tauri IPC commands for file operations

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:ipc`, `area:file-ops`, `type:feature`, `priority:p0`  
**Estimate:** 5 points

### Description

Expose file operation planning and execution through typed Tauri commands.

### Tasks

- Add `plan_file_operation` command.
- Add `start_file_operation` command.
- Add `cancel_job` command if not already present.
- Add `get_job_status` command.
- Add `list_recent_operations` command.
- Define IPC request DTOs.
- Define IPC response DTOs.
- Map Rust errors to stable frontend error codes.
- Add command-level tests where feasible.

### Acceptance Criteria

- Frontend can plan and start file operations without direct filesystem access.
- IPC DTOs are versionable and documented.
- Command errors do not leak raw Rust debug strings.
- All new commands are registered in the Tauri builder.

### Dependencies

- `FO-0126`
- `FO-0127`
- `FO-0128`
- `FO-0129`
- `FO-0130`
- `FO-0131`
- `FO-0132`

---

## FO-0134 — Define file operation progress event contract

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:ipc`, `area:job-engine`, `type:feature`, `priority:p0`  
**Estimate:** 3 points

### Description

Define the backend-to-frontend event payloads for file operation progress, completion, cancellation, and failure.

### Tasks

- Define `JobProgressEvent`.
- Define `JobCompletedEvent`.
- Define `JobFailedEvent`.
- Define `JobCancelledEvent`.
- Include job ID, operation kind, current item, item counts, byte counts, and timestamps.
- Add TypeScript mirror types.
- Document event names and payload examples.

### Acceptance Criteria

- Event payloads are stable and typed on both Rust and TypeScript sides.
- Events include enough data to render a job panel.
- Failed events include stable error code and user-safe message.
- Payload examples are included in docs or comments.

### Dependencies

- `FO-0126`
- Sprint 1 IPC foundation.

---

## FO-0135 — Wire job engine progress event emission

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:job-engine`, `area:ipc`, `type:feature`, `priority:p0`  
**Estimate:** 5 points

### Description

Connect the job engine to Tauri event emission so frontend components can subscribe to real-time operation progress.

### Tasks

- Add event sink abstraction to job engine.
- Implement Tauri event sink adapter.
- Emit job started event.
- Emit throttled progress events.
- Emit terminal events.
- Avoid event storms for large recursive operations.
- Add tests for event sequencing.

### Acceptance Criteria

- Each job emits exactly one started event.
- Each job emits exactly one terminal event.
- Progress events are throttled to a reasonable interval.
- Frontend can subscribe and update state without polling.

### Dependencies

- `FO-0134`

---

## FO-0136 — Add operation history SQLite schema

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:sqlite`, `area:file-ops`, `type:feature`, `priority:p1`  
**Estimate:** 3 points

### Description

Persist a compact operation history for completed, failed, and cancelled file operations.

### Tasks

- Add `operation_history` table migration.
- Store operation ID / job ID.
- Store operation kind.
- Store source count.
- Store representative source path.
- Store destination path where applicable.
- Store status.
- Store started and completed timestamps.
- Store error code when applicable.
- Add repository functions.
- Add migration tests.

### Acceptance Criteria

- Operation history survives app restart.
- History records do not store excessive path lists for large jobs.
- Failed operations include error code.
- Schema migration is idempotent in tests.

### Dependencies

- Sprint 1 SQLite foundation.
- `FO-0126`

---

## FO-0137 — Persist operation history from job lifecycle

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:sqlite`, `area:job-engine`, `type:feature`, `priority:p1`  
**Estimate:** 5 points

### Description

Write operation history records when jobs start and update them when jobs reach terminal states.

### Tasks

- Insert operation history record on job start.
- Update status on completion.
- Update status on cancellation.
- Update status and error code on failure.
- Ensure history write failure does not crash file operation execution.
- Add integration tests.

### Acceptance Criteria

- Successful operation appears in history as completed.
- Failed operation appears in history as failed.
- Cancelled operation appears in history as cancelled.
- History failures are logged and surfaced as non-fatal diagnostics.

### Dependencies

- `FO-0136`
- `FO-0135`

---

## FO-0138 — Add frontend TypeScript file-operation client

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:frontend`, `area:ipc`, `type:feature`, `priority:p0`  
**Estimate:** 5 points

### Description

Create a typed frontend API layer for file operation commands and events.

### Tasks

- Add TypeScript types for operation requests.
- Add TypeScript types for operation plans.
- Add TypeScript types for conflict policies.
- Add TypeScript types for job events.
- Implement `planFileOperation()`.
- Implement `startFileOperation()`.
- Implement `cancelJob()`.
- Implement event subscription helpers.
- Add unit tests for DTO mapping.

### Acceptance Criteria

- UI code does not call raw `invoke()` directly for file operations.
- All command names are centralized.
- Event unsubscription is handled safely.
- TypeScript compile catches missing operation fields.

### Dependencies

- `FO-0133`
- `FO-0134`

---

## FO-0139 — Add selection model for file list

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:frontend`, `area:ux`, `type:feature`, `priority:p0`  
**Estimate:** 5 points

### Description

Implement robust single and multi-selection in the file list so operations can act on selected files and folders.

### Tasks

- Add selected item state.
- Support single-click selection.
- Support Ctrl/Cmd multi-select.
- Support Shift range selection.
- Support clear selection on background click.
- Preserve selection sensibly after refresh.
- Expose selected paths to operation toolbar/context menu.
- Add frontend tests where practical.

### Acceptance Criteria

- User can select one or more items.
- Selection works for keyboard and mouse basics.
- Selected count is visible in the UI.
- Operations are disabled when selection is empty.

### Dependencies

- Sprint 1 file list UI.

---

## FO-0140 — Add operation toolbar actions

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:frontend`, `area:ux`, `area:file-ops`, `type:feature`, `priority:p0`  
**Estimate:** 5 points

### Description

Add visible UI actions for copy, move, rename, create folder, and move to trash.

### Tasks

- Add toolbar or command bar actions.
- Add disabled states based on selection and current directory.
- Add create-folder action.
- Add rename action for single selection only.
- Add copy action for one or more selected items.
- Add move action for one or more selected items.
- Add move-to-trash action for one or more selected items.
- Add basic keyboard shortcuts where appropriate.

### Acceptance Criteria

- Actions are discoverable without context menu dependence.
- Rename is disabled for multi-selection.
- Delete action uses safe trash wording.
- Toolbar state updates with selection state.

### Dependencies

- `FO-0138`
- `FO-0139`

---

## FO-0141 — Add destination picker flow for copy and move

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:frontend`, `area:ux`, `area:file-ops`, `type:feature`, `priority:p0`  
**Estimate:** 8 points

### Description

Implement a simple destination selection flow for copy and move operations.

### Tasks

- Provide destination picker modal or panel.
- Show current local directory tree or path input.
- Validate destination path using backend planner.
- Display planning warnings.
- Display conflict summary.
- Allow user to choose conflict policy.
- Start operation after explicit confirmation.
- Refresh affected directories after completion.

### Acceptance Criteria

- User can choose destination for copy and move.
- Operation is planned before execution.
- Conflicts are shown before mutation.
- User explicitly confirms the operation.
- UI does not assume operation success before terminal event.

### Dependencies

- `FO-0127`
- `FO-0138`
- `FO-0140`

---

## FO-0142 — Add rename dialog

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:frontend`, `area:ux`, `area:file-ops`, `type:feature`, `priority:p0`  
**Estimate:** 3 points

### Description

Implement the frontend rename dialog for a selected file or folder.

### Tasks

- Open dialog from toolbar action.
- Pre-fill current basename.
- Validate non-empty input.
- Prevent path separators client-side.
- Submit to backend rename command.
- Show backend validation errors.
- Refresh current directory after success.

### Acceptance Criteria

- Rename dialog works for one selected item.
- Invalid input is blocked client-side and server-side.
- Conflict error is shown clearly.
- Directory listing updates after successful rename.

### Dependencies

- `FO-0130`
- `FO-0138`
- `FO-0140`

---

## FO-0143 — Add create-folder dialog

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:frontend`, `area:ux`, `area:file-ops`, `type:feature`, `priority:p0`  
**Estimate:** 2 points

### Description

Implement the frontend create-folder dialog.

### Tasks

- Open dialog from toolbar action.
- Validate folder name client-side.
- Submit to backend create-directory command.
- Show conflict errors.
- Refresh current directory after success.
- Optionally select newly created folder.

### Acceptance Criteria

- User can create a folder in current directory.
- Duplicate names are reported clearly.
- Created folder is visible immediately after success.

### Dependencies

- `FO-0131`
- `FO-0138`
- `FO-0140`

---

## FO-0144 — Add move-to-trash confirmation flow

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:frontend`, `area:ux`, `area:file-ops`, `type:feature`, `priority:p0`, `risk:destructive-operation`  
**Estimate:** 3 points

### Description

Add an explicit confirmation flow before moving selected items to trash.

### Tasks

- Show selected item count.
- Show representative selected item names.
- Use platform-neutral wording: “Move to Trash”.
- Submit delete-to-trash command only after confirmation.
- Show unsupported-platform error when needed.
- Refresh current directory after success.

### Acceptance Criteria

- Trash operation cannot be triggered accidentally by single click alone.
- Confirmation clearly states that items will be moved to trash, not permanently deleted.
- UI handles backend failure without removing items optimistically.

### Dependencies

- `FO-0132`
- `FO-0138`
- `FO-0140`

---

## FO-0145 — Add job activity panel

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:frontend`, `area:job-engine`, `area:ux`, `type:feature`, `priority:p0`  
**Estimate:** 8 points

### Description

Create a frontend job activity panel that displays active and recent file operations.

### Tasks

- Add job store/state container.
- Subscribe to job events.
- Render active jobs.
- Render progress percentage where known.
- Render current item path or basename.
- Render terminal status.
- Add cancel button for cancellable jobs.
- Keep recent completed jobs visible during session.
- Handle event subscription cleanup.

### Acceptance Criteria

- Active copy/move jobs show progress.
- Completed jobs show success state.
- Failed jobs show error message.
- Cancel button invokes backend cancellation.
- UI remains responsive during large copy operation.

### Dependencies

- `FO-0135`
- `FO-0138`

---

## FO-0146 — Add conflict summary UI

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:frontend`, `area:ux`, `area:file-ops`, `type:feature`, `priority:p1`  
**Estimate:** 5 points

### Description

Display conflict information returned by the operation planner and allow the user to choose an explicit conflict policy.

### Tasks

- Render conflict count.
- Render representative conflicts.
- Provide conflict policy selector.
- Explain behavior of each policy in user-safe language.
- Disable unsupported policies per operation kind if needed.
- Pass selected policy into start operation request.

### Acceptance Criteria

- User sees conflicts before execution.
- Default policy is safe: `Fail` or `Skip`, not overwrite.
- Overwrite requires explicit user selection.
- Selected policy reaches backend request correctly.

### Dependencies

- `FO-0127`
- `FO-0141`

---

## FO-0147 — Add operation history UI

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:frontend`, `area:sqlite`, `area:ux`, `type:feature`, `priority:p1`  
**Estimate:** 5 points

### Description

Show recent persisted file operations in a compact history view.

### Tasks

- Add `listRecentOperations()` frontend API.
- Add recent operations section in job panel or separate drawer.
- Show operation kind.
- Show status.
- Show timestamp.
- Show representative source/destination.
- Add refresh on app start.
- Add empty state.

### Acceptance Criteria

- Recent operation history appears after app restart.
- Failed operations show failure status.
- History view does not block active job rendering.

### Dependencies

- `FO-0136`
- `FO-0137`
- `FO-0138`

---

## FO-0148 — Add backend cancellation support for file-operation jobs

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:job-engine`, `area:file-ops`, `type:feature`, `priority:p0`, `risk:destructive-operation`  
**Estimate:** 5 points

### Description

Ensure copy and move jobs can be cancelled safely from the frontend.

### Tasks

- Add cancellation token to job context.
- Check cancellation between files.
- Check cancellation during large file copy chunks.
- Define cancelled terminal state.
- Emit cancellation event.
- Persist cancellation in history.
- Add cancellation tests.

### Acceptance Criteria

- Cancelling active copy stops further writes.
- Cancelling active move does not silently remove original source.
- Cancelled job emits terminal cancellation event.
- Cancelled job does not later emit completed event.

### Dependencies

- `FO-0128`
- `FO-0129`
- `FO-0135`
- `FO-0137`

---

## FO-0149 — Add filesystem refresh after mutations

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:frontend`, `area:vfs`, `area:file-ops`, `type:feature`, `priority:p1`  
**Estimate:** 3 points

### Description

Refresh affected file listings after successful file operations.

### Tasks

- Track current visible directory.
- Refresh current directory after create-folder.
- Refresh current directory after rename.
- Refresh source directory after move/trash.
- Refresh destination directory after copy/move when visible.
- Avoid redundant full reloads where possible.

### Acceptance Criteria

- UI reflects successful mutations without app restart.
- Failed operations do not optimistically remove items.
- Refresh behavior does not break navigation state.

### Dependencies

- `FO-0141`
- `FO-0142`
- `FO-0143`
- `FO-0144`

---

## FO-0150 — Add operation error UX mapping

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:frontend`, `area:ux`, `area:file-ops`, `type:feature`, `priority:p1`  
**Estimate:** 3 points

### Description

Map backend operation errors to user-readable frontend messages while preserving diagnostic detail for logs.

### Tasks

- Define frontend error message map.
- Handle permission denied.
- Handle not found.
- Handle destination conflict.
- Handle invalid name.
- Handle unsupported trash.
- Handle cancellation.
- Handle unknown backend failure.
- Add tests for mapping.

### Acceptance Criteria

- User sees actionable error messages.
- Raw Rust debug output is not shown to users.
- Error code remains available for diagnostics.

### Dependencies

- `FO-0133`
- `FO-0138`

---

## FO-0151 — Add path safety checks for frontend-submitted operations

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:file-ops`, `area:security`, `type:feature`, `priority:p0`, `risk:destructive-operation`  
**Estimate:** 5 points

### Description

Add backend-side path validation guardrails for all frontend-submitted operation requests.

### Tasks

- Canonicalize paths where appropriate.
- Reject malformed paths.
- Reject unsupported URI schemes for local operations.
- Ensure operation requests target local provider only in Sprint 2.
- Validate parent directories.
- Normalize path handling across Windows, macOS, and Linux.
- Add cross-platform-oriented tests.

### Acceptance Criteria

- Backend does not trust frontend path strings.
- Invalid local paths return stable validation errors.
- Remote/provider paths are rejected for Sprint 2 file operations.
- Tests cover common Windows and POSIX path edge cases where practical.

### Dependencies

- `FO-0126`
- `FO-0133`

---

## FO-0152 — Add integration test suite for file operations

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:testing`, `area:file-ops`, `type:test`, `priority:p0`  
**Estimate:** 8 points

### Description

Create a backend integration test suite covering safe local operations across temporary directory fixtures.

### Tasks

- Add test fixture helpers.
- Test file copy.
- Test directory copy.
- Test move.
- Test rename.
- Test create directory.
- Test conflict detection.
- Test cancellation where deterministic.
- Test failed permission scenario where feasible.
- Test no mutation after failed planning.

### Acceptance Criteria

- Tests run locally with `cargo test`.
- Tests do not touch user directories.
- Tests clean up temporary directories.
- Core operation failure modes are covered.

### Dependencies

- `FO-0128`
- `FO-0129`
- `FO-0130`
- `FO-0131`
- `FO-0148`

---

## FO-0153 — Add frontend tests for operation flows

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:testing`, `area:frontend`, `type:test`, `priority:p1`  
**Estimate:** 5 points

### Description

Add frontend tests for user-facing operation flows using mocked IPC responses and events.

### Tasks

- Test selection model.
- Test toolbar disabled/enabled states.
- Test rename dialog validation.
- Test create-folder dialog validation.
- Test trash confirmation.
- Test job panel progress updates.
- Test conflict policy selection.

### Acceptance Criteria

- Frontend tests run in CI.
- Tests do not require real filesystem mutation.
- Mocked IPC contracts match TypeScript client types.

### Dependencies

- `FO-0138`
- `FO-0139`
- `FO-0140`
- `FO-0145`

---

## FO-0154 — Add manual QA script for Sprint 2 vertical slice

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:testing`, `type:docs`, `priority:p1`  
**Estimate:** 2 points

### Description

Create a repeatable manual QA checklist for Sprint 2 operations across supported desktop platforms.

### Tasks

- Add QA fixture setup instructions.
- Add copy test cases.
- Add move test cases.
- Add rename test cases.
- Add create-folder test cases.
- Add trash test cases.
- Add conflict test cases.
- Add cancellation test cases.
- Add expected results.

### Acceptance Criteria

- QA script can be followed by a developer or tester without code knowledge.
- Script avoids destructive operations outside a temporary test folder.
- Script includes platform notes.

### Dependencies

- `FO-0140`
- `FO-0141`
- `FO-0145`

---

## FO-0155 — Add telemetry-free diagnostic logging for file operations

**Milestone:** `M2 — Safe Local File Operations`  
**Labels:** `area:file-ops`, `area:job-engine`, `type:feature`, `priority:p2`  
**Estimate:** 3 points

### Description

Add local diagnostic logs for operation planning and execution without sending telemetry externally.

### Tasks

- Log operation start with job ID and operation kind.
- Log planner failures.
- Log executor failures.
- Log cancellation.
- Redact or minimize sensitive full path exposure where possible.
- Document logging behavior.

### Acceptance Criteria

- Logs help debug failed operations.
- No external telemetry is added.
- Sensitive path handling is intentional and documented.

### Dependencies

- `FO-0133`
- `FO-0135`

---

# Sprint 2 Suggested Implementation Order

1. `FO-0126` — Define file operation domain model.
2. `FO-0127` — Add operation planning service.
3. `FO-0134` — Define progress event contract.
4. `FO-0135` — Wire job engine event emission.
5. `FO-0128` — Implement copy executor.
6. `FO-0148` — Add cancellation support.
7. `FO-0129` — Implement move executor.
8. `FO-0130` — Implement rename operation.
9. `FO-0131` — Implement create directory operation.
10. `FO-0132` — Implement delete-to-trash operation.
11. `FO-0133` — Add Tauri IPC commands.
12. `FO-0138` — Add frontend TypeScript file-operation client.
13. `FO-0139` — Add selection model.
14. `FO-0140` — Add operation toolbar actions.
15. `FO-0142` — Add rename dialog.
16. `FO-0143` — Add create-folder dialog.
17. `FO-0144` — Add move-to-trash confirmation.
18. `FO-0141` — Add destination picker flow.
19. `FO-0146` — Add conflict summary UI.
20. `FO-0145` — Add job activity panel.
21. `FO-0136` — Add operation history schema.
22. `FO-0137` — Persist operation history.
23. `FO-0147` — Add operation history UI.
24. `FO-0149` — Add filesystem refresh after mutations.
25. `FO-0150` — Add operation error UX mapping.
26. `FO-0151` — Add path safety checks.
27. `FO-0152` — Add backend integration tests.
28. `FO-0153` — Add frontend tests.
29. `FO-0154` — Add manual QA script.
30. `FO-0155` — Add diagnostic logging.

---

# Sprint 2 Definition of Done

Sprint 2 is done when:

- Users can create a folder in the current local directory.
- Users can rename a selected local file or folder.
- Users can copy selected local files/folders to another local directory.
- Users can move selected local files/folders to another local directory.
- Users can move selected local files/folders to OS trash/recycle bin where supported.
- Copy and move operations run as backend jobs.
- Long-running jobs emit progress events to the frontend.
- Users can cancel active copy/move jobs.
- Destination conflicts are detected before execution.
- Conflict policy is explicit and safe by default.
- Operation history is persisted locally.
- UI refreshes affected file listings after successful mutations.
- Backend integration tests cover core operations.
- Frontend tests cover core operation flows.
- Manual QA script passes on at least the primary development platform.

---

# Sprint 2 Technical Risks

## Risk: accidental data loss

File operations mutate user data. Sprint 2 must prioritize safety over speed.

**Mitigations:**

- No permanent delete.
- Trash only for delete semantics.
- Plan before execute.
- Safe default conflict policy.
- Source deletion only after verified copy for cross-device move.
- Backend-side path validation.

## Risk: cross-platform filesystem differences

Windows, macOS, and Linux differ in path rules, trash behavior, rename semantics, permissions, and file locking.

**Mitigations:**

- Keep platform behavior explicit.
- Add platform notes to QA script.
- Use temporary directory tests.
- Avoid unsupported guarantees in MVP.

## Risk: progress accuracy

Recursive operation byte totals may be expensive or partially unavailable.

**Mitigations:**

- Treat totals as best effort.
- Support unknown total progress state.
- Report item-level progress even when byte total is unknown.

## Risk: UI optimistic updates

Optimistically removing or moving items before backend confirmation can misrepresent failed operations.

**Mitigations:**

- Do not mutate UI state as if operation succeeded until terminal success event.
- Refresh affected directories after successful terminal event.
- Show failed status in job panel.

---

# Sprint 2 Out of Scope

- Permanent delete.
- Undo/redo for file operations.
- File synchronization.
- Remote providers.
- Cloud storage operations.
- Git-aware operations.
- Archive extraction/compression.
- Checksum verification for every copy by default.
- Advanced metadata preservation.
- ACL/xattr preservation guarantees.
- Batch conflict resolution per individual item.

---

# Sprint 3 Preview

Sprint 3 should focus on **search, indexing, and metadata enrichment** or **advanced file operation hardening**, depending on Sprint 2 outcomes.

Candidate Sprint 3 themes:

- Fast local search by name and metadata.
- SQLite-backed directory cache and recent locations.
- Hash calculation jobs.
- Operation retry/resume model.
- More advanced conflict resolution.
- Drag-and-drop operations.
- Keyboard-first command palette.

