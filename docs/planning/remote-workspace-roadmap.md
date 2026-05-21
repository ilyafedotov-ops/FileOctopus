# FileOctopus Remote Workspace Roadmap

**Status:** planning artifact  
**Created:** 2026-05-21  
**Primary direction:** Remote Workspace first  
**Baseline branch:** `codex/remote-ssh-terminal-v1`

## Summary

This roadmap defines the next FileOctopus feature direction after the current SSH
Terminal V1 branch. The product priority is Remote Workspace: make SSH and SFTP
feel like first-class daily-use workflows while preserving the local dual-pane
file-manager reliability and RC validation discipline.

The current branch baseline is SSH Terminal V1 in progress:

- Network profiles support `sftp` file-capable profiles and `ssh`
  terminal-only profiles.
- Local and SSH PTY sessions share the frontend terminal reducer, tab UI,
  write/resize/kill commands, output events, and exit events.
- SFTP panes can open pane-bound SSH terminals, and Network can open detached
  SSH terminal tabs.
- Rust `terminal-core` includes a remote SSH PTY backend using saved profile
  credentials and host-key fingerprint checks.
- Terminal input logging has been hardened so terminal write payload bytes are
  not logged.

## Roadmap Phases

### Phase 1: Remote Workspace V1 Stabilization

Goal: make the SSH Terminal V1 branch safe and clear enough to merge and test
against real servers.

Acceptance criteria:

- Password and private-key SSH terminal sessions work in pane-bound and detached
  tab surfaces.
- Resize, input, exit, kill, close tab, reconnect, and error display are
  manually smoke-tested against at least one real SSH host.
- Host-key mismatch and authentication errors show stable, actionable errors.
- SSH-only profiles stay terminal-only and never appear as browsable file
  destinations.
- Existing API/status docs are updated only where IPC or profile contracts have
  drifted.
- Network features remain behind the existing enablement gate.

### Phase 2: Remote File Operations

Goal: move SFTP beyond read/navigation into planned, cancellable, observable file
operations.

Acceptance criteria:

- SFTP supports create folder, rename, delete, upload, download, and local to
  remote / remote to local copy.
- All remote mutations use the existing `plan_file_operation` then
  `start_file_operation` pipeline.
- Operation progress, cancellation, conflict handling, error mapping, and
  persisted operation history work for remote operations.
- Local-only path conversions are removed from remote operation paths.
- Remote file-operation sessions remain independent from SSH terminal sessions.

### Phase 3: Remote Navigation Polish

Goal: make remote state visible and recoverable in everyday navigation.

Acceptance criteria:

- Remote panes display profile, scheme, and connection state clearly.
- Network UI exposes reconnect, disconnect, and forget-fingerprint actions where
  backend support already exists.
- SFTP profiles advertise browse plus terminal capabilities; SSH profiles
  advertise terminal-only capability.
- Sidebar, destination chooser, volume picker, path bar, and Network locations
  agree on profile capability rules.
- Connection failures show profile-specific recovery actions instead of generic
  unsupported-location copy.

### Phase 4: Power-User Workflow Layer

Goal: add high-value local workflow features after Remote Workspace basics are
stable.

Acceptance criteria:

- Git Intelligence V1 discovers repositories asynchronously for local panes and
  shows branch/status badges without blocking directory listing.
- Checksum toolbar action uses the existing hash IPC and exposes clear progress
  and error states.
- Built-in view/edit behavior is polished for common text/code files without
  bypassing the IPC trust boundary.
- Tar archive plan/extract is added only after dependency and security choices
  are settled.
- Remote Git status is deferred until remote file operations are stable.

### Phase 5: Protocol Expansion Readiness

Goal: prepare the architecture for SMB/WebDAV/FTP without scheduling those
providers in the immediate feature slice.

Acceptance criteria:

- Provider capabilities describe browsing, terminal, read, write, delete, copy,
  watch, preview, and auth behavior without hardcoding SFTP assumptions.
- UI actions are capability-driven and gracefully hidden or disabled when a
  protocol cannot support them.
- IPC DTOs can represent future remote schemes without changing local resource
  URI invariants.
- SMB, WebDAV, FTP, cloud providers, plugins, and AI search remain out of scope
  for this roadmap's implementation slices.

## Ordered Implementation Slices

### Slice A: Finish SSH Terminal V1 Readiness

Intent: turn the current SSH Terminal V1 branch into a merge-ready remote
terminal feature.

Implementation plan:

- Reconcile existing API/status docs with the current branch only where public
  IPC or profile DTOs changed.
- Add or update focused tests for terminal-capable profile validation, remote
  spawn rejection cases, auth error mapping, and no terminal input byte logging.
- Add a manual smoke checklist covering SFTP profile terminal launch, SSH-only
  profile terminal launch, password auth, private-key auth, resize, command
  input, exit, close, reconnect, and error display.
- Verify the network enablement gate rejects remote terminal spawn when disabled.
- Keep SSH terminal sessions independent from SFTP browsing sessions.

Public API and interface impacts:

- `TerminalSpawnRequest` continues to accept local `uri` or remote `profileId`.
- `NetworkProfileDto` continues to distinguish file-capable `sftp` profiles from
  terminal-only `ssh` profiles.
- Terminal output and exit events remain shared for local and SSH transports.

Test plan:

- Rust: `cargo test --workspace`, `cargo clippy --workspace --all-targets -- -D warnings`,
  `cargo fmt --all -- --check`.
- Frontend: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
- Manual: real SSH/SFTP smoke with password and private-key profiles.

Manual smoke checklist:

- Add an SFTP profile with password auth, browse it, then open a pane-bound SSH
  terminal from the remote pane.
- Add an SSH-only profile with password auth and open a detached terminal from
  Network.
- Repeat detached terminal launch with private-key auth and passphrase if
  available.
- Verify terminal resize, normal command input, Ctrl+C, Backspace, Delete, exit,
  close tab, kill, and reconnect.
- Verify bad password, missing stored secret, host-key mismatch, and disabled
  network gate errors are visible and actionable.
- Verify SSH-only profiles do not appear in file destination pickers, volume
  lists, or browsable Network drive sections.

### Slice B: Remote Operation Pipeline For SFTP

Intent: make SFTP write workflows safe by routing them through the existing
planned operation model.

Implementation plan:

- Extend provider capability metadata so SFTP declares supported mutation and
  transfer operations.
- Move remote operation planning away from local `to_local_path()` assumptions
  and into VFS-aware source/destination handling.
- Add SFTP provider methods for create directory, rename, delete, upload,
  download, and copy boundaries needed by the operation pipeline.
- Preserve existing conflict planning semantics for destination conflicts,
  missing sources, invalid names, and cancellation.
- Keep operation history and progress event shapes stable.

Public API and interface impacts:

- Existing `plan_file_operation` / `start_file_operation` stay the public
  mutation entrypoints.
- File-operation DTOs may need remote-aware source/destination validation but
  should not introduce a separate SFTP-only command family.
- Error codes must remain stable and cataloged through `IpcError`.

Test plan:

- Rust unit/integration tests for remote plan validation and provider operations
  using test doubles where live SFTP is not available.
- Frontend tests for enabling/disabling remote operation actions based on
  capabilities.
- Manual smoke for local to remote upload, remote to local download, remote
  rename, remote delete, conflict handling, cancel, and operation history.

### Slice C: Remote UX And Safety

Intent: make remote connection state, trust state, and capabilities visible.

Implementation plan:

- Surface host-key fingerprint and last connection status in Network profile UI.
- Add reconnect and forget-fingerprint actions using existing backend support.
- Ensure browse, terminal, file operation, and destination-picker actions are
  all capability-driven.
- Improve remote pane errors so users can distinguish disabled network features,
  disconnected profiles, bad authentication, host-key mismatch, unsupported
  operation, and missing remote paths.
- Keep terminal-only SSH profiles out of browsable destinations and volume lists.

Public API and interface impacts:

- Network profile DTOs may expose capability and status fields if not already
  available at the frontend boundary.
- Network status events should remain profile-scoped and stable for future
  protocols.

Test plan:

- Rust tests for profile status and fingerprint commands.
- Vitest coverage for Network dialog, sidebar, destination chooser, and remote
  pane error rendering.
- Manual smoke for forget fingerprint, reconnect, bad password, disabled
  network gate, and SSH-only profile behavior.

### Slice D: Git Intelligence V1

Intent: add local Git context without blocking file navigation.

Implementation plan:

- Add async Git repository discovery for local pane paths.
- Show branch name in the active pane or path-adjacent status area.
- Add file status badges for modified, added, deleted, untracked, ignored, and
  clean states.
- Cache Git status per repository and refresh asynchronously after navigation or
  filesystem watch updates.
- Defer remote Git status until remote file operation behavior is stable.

Public API and interface impacts:

- Add a Git IPC/domain boundary only after the backend service shape is settled.
- Keep Git status optional; pane listing must render normally if Git status is
  unavailable or slow.

Test plan:

- Rust tests with temporary Git repositories for discovery and status mapping.
- Frontend tests for branch display, badge rendering, and unavailable Git state.
- Manual smoke inside clean, dirty, and non-repository directories.

### Slice E: Archive And Built-In Tools

Intent: finish high-value local tools that complement remote workflows.

Implementation plan:

- Wire checksum toolbar action to existing hash IPC with a visible result and
  clear error state.
- Polish built-in view/edit for common text and code files while preserving the
  frontend filesystem restriction.
- Add tar archive planning/extraction only after dependency, traversal safety,
  and test strategy are settled.
- Keep zip create/extract behavior unchanged while tar support is introduced.

Public API and interface impacts:

- Reuse existing hash IPC for checksum display.
- Prefer existing file-operation archive kinds unless tar requires a narrow DTO
  extension.

Test plan:

- Rust tests for tar traversal rejection before enabling extraction.
- Frontend tests for checksum action visibility, result display, and failures.
- Manual smoke for checksum, text/code view/edit, zip regression, and tar
  extraction once implemented.

## Explicit Non-Goals

- Do not add SMB, WebDAV, FTP, S3, Azure Blob, cloud providers, plugins, AI
  search, or semantic indexing in the immediate Remote Workspace slices.
- Do not bypass the Rust to TypeScript IPC trust boundary for remote or local
  filesystem access.
- Do not create SFTP-only mutation commands when the planned operation pipeline
  can represent the workflow.
- Do not make SSH terminal startup auto-`cd` into a profile default path or an
  active SFTP path in V1.
- Do not couple SSH terminal session lifetime to SFTP file browsing sessions.

## Verification Matrix

For doc-only roadmap updates:

- Run `pnpm format:check`.
- Inspect the roadmap against the current branch and existing planning docs for
  stale statements.

For feature slices:

- Rust: `cargo test --workspace`.
- Rust lint: `cargo clippy --workspace --all-targets -- -D warnings`.
- Rust format: `cargo fmt --all -- --check`.
- Frontend typecheck: `pnpm typecheck`.
- Frontend lint: `pnpm lint`.
- Frontend/unit tests: `pnpm test`.
- Build: `pnpm build`.
- Manual remote smoke whenever SSH/SFTP behavior changes.

## Current Assumptions

- Remote Workspace is the next strategic focus.
- The roadmap belongs under `docs/planning`.
- This roadmap is a phased roadmap plus detailed implementation plan, not a
  GitHub-import issue backlog.
- The current SSH Terminal V1 branch is the starting baseline for the roadmap.
- Future protocols should be capability-driven, but SMB/WebDAV/FTP are not part
  of the immediate implementation plan.
