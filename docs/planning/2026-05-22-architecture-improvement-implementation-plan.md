# FileOctopus Architecture Improvement Implementation Plan

**Date:** 2026-05-22
**Status:** All phases implemented
**Goal:** Turn the architecture review findings into a concrete task backlog that improves correctness, contract safety, maintainability, and release readiness without changing product scope unnecessarily.

## Phase 1: Contract And Boundary Guardrails

### Task 1.1: Guard IPC Command Catalog Drift

**Status:** Done

Add automated tests that compare the Rust Tauri command registry against the TypeScript command map and the advertised command count in the API reference.

Implementation notes:

- Compare `tauri::generate_handler!` entries in `apps/desktop-tauri/src-tauri/src/lib.rs` to `packages/ts-api/src/commandMap.ts`.
- Keep `docs/architecture/api-reference.md` count aligned with the live registry.
- Fail fast when a handler is registered without a TS command map row.

Acceptance criteria:

- `packages/ts-api/tests/catalogs.test.ts` fails if Rust and TS command catalogs drift.
- API reference advertises the same command count as the live registry.

### Task 1.2: Guard Event Channel Drift

**Status:** Done

Make `packages/ts-api/src/events.ts` the single TypeScript source for event names and mirror all Rust event constants.

Implementation notes:

- Move `NETWORK_STATUS_EVENT` out of `types.ts` into `events.ts`.
- Update `NetworkClient` to import event constants from `events.ts`.
- Add a catalog test comparing all Rust `*_EVENT` constants to TS event exports.

Acceptance criteria:

- Event constants in `crates/app-ipc/src/lib.rs` and `packages/ts-api/src/events.ts` match exactly.
- New event channels require a failing test update if only one side changes.

### Task 1.3: Gate Remote Providers Behind Network Enablement

**Status:** Done

Prevent generic VFS paths from bypassing the network feature flag.

Implementation notes:

- Register `SftpConnector` and `SftpProvider` only when `app_core::is_network_enabled()` is true.
- Keep local provider registration unconditional.
- Add a regression test for disabled-network boot.

Acceptance criteria:

- With `FILEOCTOPUS_ENABLE_NETWORK=0`, `sftp://` provider lookup returns `unsupported_provider`.
- Network commands and generic FS/VFS paths observe the same network-disabled boundary.

### Task 1.4: Expand CI Coverage For Backend Changes

**Status:** Done

Make backend changes trigger CI and run Rust release-candidate checks.

Implementation notes:

- Include `crates/**`, root `Cargo.toml`, and `Cargo.lock` in CI path filters.
- Add a `backend` job that installs Tauri Linux dependencies and runs `pnpm test:backend:rc`.
- Keep the existing frontend job for TS typecheck and tests.

Acceptance criteria:

- Rust-only pull requests run backend CI.
- Backend CI covers `cargo fmt --all --check`, `cargo check --workspace`, `cargo test --workspace`, and `cargo clippy --workspace --all-targets -- -D warnings`.

## Phase 2: Frontend Lifecycle Correctness

### Task 2.1: Fix Directory Listing Race

**Status:** Done

Allow the frontend to accept directory batches that arrive after `fs.list_start` begins but before the returned `sessionId` is committed to panel state.

Implementation notes:

- Add a `startRequest` reducer action that records `activeRequestId` before invoking `fs.list_start`.
- Route batches by `sessionId` first, then by matching `requestId`.
- Preserve stale-session and stale-request rejection.

Acceptance criteria:

- Early batches with matching `requestId` are applied.
- Old sessions and old request ids are ignored.
- Existing panel independence behavior remains unchanged.

### Task 2.2: Remove Developer-Specific First-Run Defaults

**Status:** Done

Stop defaulting first-run pane paths to a hardcoded developer username.

Implementation notes:

- Use generic root defaults (`local:///` or Windows drive root) when backend locations are not available yet.
- During app initialization, replace fallback defaults with backend `standardLocations` for `home` and `documents`.
- Do not persist fallback defaults before the user or backend-confirmed initialization moves beyond them.

Acceptance criteria:

- `homeUri()` does not include a developer-specific username.
- First-run navigation uses backend-provided standard locations when available.
- Session path persistence does not poison local storage with fallback defaults.

### Task 2.3: Start And Stop Active Pane Watchers

**Status:** Done

Make the existing watch-event subscription useful by starting a backend watcher for the active local pane.

Implementation notes:

- Start `fs.watch_start` for the active local pane URI.
- Stop the previous watcher during effect cleanup.
- Keep remote URIs out of this local-only watch path.

Acceptance criteria:

- App shell starts watching the active local pane location.
- Watch changed events still refresh only the matching active pane.

### Task 2.4: Route Columns View Through Shared Listing Lifecycle

**Status:** Done

Remove the independent `ColumnsView` IPC client and event subscription path.

Implementation notes:

- Pass the shell `FileOctopusClient` into `ColumnsView`, or better route columns mode through shared panel listing state.
- Subscribe before starting any listing request if a local column cache remains.
- Add error and timeout handling consistent with regular pane listing.

Acceptance criteria:

- `ColumnsView` does not create a new `FileOctopusClient`.
- Columns listing cannot miss early directory batches.
- Columns mode shares the same stale-request semantics as normal panes.

### Task 2.5: Virtualize Icons View

**Status:** Done

Avoid mounting every item in large directories when icons mode is active.

Implementation notes:

- Replace the non-virtual icons branch with a virtualized grid.
- Preserve keyboard selection and range selection behavior.
- Add a large synthetic-entry test for icons mode.

Acceptance criteria:

- Icons mode keeps mounted DOM nodes bounded for 100k entries.
- Existing details/list virtualization behavior remains unchanged.

## Phase 3: Command Architecture Cleanup

### Task 3.1: Add Registry Coverage For Every Command ID

**Status:** Done

Catch drift between `CommandId` and `COMMAND_DEFINITIONS`.

Implementation notes:

- Add a registry test that verifies command registry metadata is present and unique.
- Add missing `nav.connectServer` metadata.

Acceptance criteria:

- Every command id has registry metadata.
- The registry test fails when a command id is added without metadata.

### Task 3.2: Derive CommandId From Registry

**Status:** Done

Remove the manually maintained command-id union as the primary source.

Implementation notes:

- Convert `COMMAND_DEFINITIONS` to a registry backed by `COMMAND_REGISTRY`.
- Derive `CommandId` from registry keys or item ids.
- Keep shortcut/help/palette generation based on the same registry.

Acceptance criteria:

- There is one authoritative command catalog.
- Type-level command ids, palette entries, shortcut help, toolbar entries, and dispatch coverage derive from the same source.

### Task 3.3: Add Dispatch Exhaustiveness Coverage

**Status:** Done

Catch commands that have metadata but no behavior or explicit no-op policy.

Implementation notes:

- Add an explicit dispatch coverage map or handler registry.
- For commands that intentionally open external links or remain hidden, mark the behavior explicitly.
- Avoid relying on a large unguarded switch as the only coverage mechanism.

Acceptance criteria:

- Adding a command requires either a handler or an explicit unsupported/hidden state.
- Tests fail for command metadata with no dispatch behavior.

## Phase 4: File Operation And Runtime Reliability

### Task 4.1: Move Editor Save Into Planned Operation Semantics

**Status:** Done

Resolve the architecture exception where `fs.write_text_file` mutates files outside the plan/start operation pipeline.

Implementation options:

- Add a `writeTextFile` operation kind with atomic temp-and-rename behavior.
- Or document `fs.write_text_file` as an explicit exception and add audit/history/error parity.

Recommended implementation:

- Add a planned `writeTextFile` operation kind for local text writes.
- Keep the existing max-size validation and atomic write behavior.
- Record operation history and return job progress/status through existing job events.
- Implemented as a dedicated runtime operation behind `fs.write_text_file` so editor content is not stored in reusable plan DTOs.

Acceptance criteria:

- Editor saves either use operation history or are explicitly documented as a bounded exception.
- File mutations remain visible to the user through job/history surfaces.

### Task 4.2: Add Metadata Job Retention

**Status:** Done

Bound in-memory metadata job state for folder size and recursive search jobs.

Implementation notes:

- Add TTL or fixed-size retention for completed, failed, and cancelled metadata jobs.
- Preserve enough time for `job.status` reads immediately after terminal events.
- Add tests for cleanup and status behavior after cleanup.

Acceptance criteria:

- Metadata jobs do not grow unbounded for the process lifetime.
- Recently completed metadata jobs remain inspectable for a short retention window.

### Task 4.3: Improve SFTP Listing Cancellation

**Status:** Done

Make SFTP listings responsive to cancellation and timeout.

Implementation notes:

- Avoid collecting the full remote directory before emitting batches.
- Check `ListOptions.cancel` between remote reads and emitted batches.
- Ensure dropping the async timeout does not leave a long-running blocking listing without cancellation visibility.
- Implemented incremental SFTP batching with cancellation checks before remote reads and before blocking batch sends.

Acceptance criteria:

- Fast navigation away from a slow SFTP directory stops old listing work.
- SFTP listing emits batches incrementally.
- Cancellation behaves consistently with local listing.

### Task 4.4: Reuse Connect Locks For Session Acquisition

**Status:** Done

Prevent parallel connection races when generic VFS paths ask for a remote session.

Implementation notes:

- Make `session_for_profile()` reuse the same per-profile connection lock as explicit `connect()`.
- Add a concurrent session acquisition test.

Acceptance criteria:

- Parallel calls for the same profile do not create duplicate connection attempts.
- Explicit connect and lazy VFS session acquisition share connection status behavior.

### Task 4.5: Cache Owner Resolution In Large Local Listings

**Status:** Done

Avoid spawning an external owner lookup per directory entry.

Implementation notes:

- Cache UID to owner-name lookups during listing.
- Prefer native lookup where practical.
- Consider deferring owner resolution outside the hot listing path.

Acceptance criteria:

- Large directory listing does not spawn one `id` process per entry.
- Owner display remains accurate enough for details/properties views.

## Phase 5: State And Controller Refactor

### Task 5.1: Extract Navigation Controller

**Status:** Done

Consolidate duplicate navigation/listing logic between production hooks and test-only hooks.

Implementation notes:

- Move `navigatePanel`, `startListing`, history navigation, refresh, and visit recording into one controller.
- Make production and tests use the same controller.
- Remove or rewrite `useNavigation` if it remains test-only duplication.
- Implemented in `packages/frontend/src/navigation/navigationController.ts` as a pure factory (`createNavigationController`). `useEventHandlers` instantiates the controller and re-exports its methods. Test-only `useNavigation` hook removed; `tests/networkNavigation.test.ts` now exercises the controller directly.

Acceptance criteria:

- One navigation path owns listing request correlation.
- Network navigation tests cover production behavior.

### Task 5.2: Split Shell Context Into Feature Controllers

**Status:** Done

Reduce broad prop/setter coupling across the shell.

Implementation notes:

- Split `ShellContextValue` into smaller feature contexts or controller hooks:
  - pane/navigation
  - commands
  - jobs/activity
  - dialogs
  - terminal
  - preferences/layout
- Keep public component props stable during the transition.
- Implemented by splitting the monolithic `ShellProvider` into focused providers: `ShellProvider` (core: client/state/dispatch/refs), `PreferencesProvider` (preferences/density/derived visibility), `NavigationDataProvider` (locations/favorites/recents/starred/network/appInfo/appHealth/autostart), and `WorkspaceProvider` (toasts/clipboard/contextMenu/search/focus tokens/diagnostics). `AppProviders` composes them; `FileOctopusAppInner` consumes via `useShell`, `usePreferences`, `useNavigationData`, and `useWorkspace`. `TerminalProvider` switched to `useNavigationData()` for network profile lookups.

Acceptance criteria:

- `FileOctopusAppInner` no longer orchestrates unrelated feature state directly.
- Dialogs, jobs, panes, and terminal can evolve with fewer cross-context re-renders.

### Task 5.3: Move Job Metrics Into JobsProvider

**Status:** Done

Remove stale `jobMetrics` ownership split.

Implementation notes:

- Move live job speed/ETA metrics from `useAppInit` into `JobsProvider`, or remove the unused context field.
- Keep metrics update behavior tied to progress events.
- Implemented by moving `jobMetrics` state and setter ownership into `JobsProvider`; progress listeners still update metrics on job progress events.

Acceptance criteria:

- There is one owner for job metrics.
- Consumers cannot read stale metrics from context.

## Phase 6: Security, Observability, And Release Readiness

### Task 6.1: Add Security And Dependency Automation

**Status:** Done

Move local pre-push audit coverage into CI or scheduled automation.

Implementation notes:

- Add scheduled and PR dependency audit jobs for Rust and pnpm.
- Consider Dependabot or Renovate configuration.
- Consider CodeQL or equivalent static analysis for supported languages.

Acceptance criteria:

- Security audit signal is visible without relying on local git hooks.
- Dependency updates are tracked automatically.

### Task 6.2: Harden Release Profile

**Status:** Done

Review Tauri devtools and CSP settings for production builds.

Implementation notes:

- Remove or conditionally gate `devtools` for release.
- Review CSP use of localhost and `unsafe-eval`.
- Document development-only exceptions.

Acceptance criteria:

- Release builds do not expose development-only browser tooling unless explicitly enabled.
- CSP is as narrow as current runtime behavior allows.

### Task 6.3: Fix Telemetry Default Filters

**Status:** Done

Make default debug logging match actual crate/module targets.

Implementation notes:

- Update default filters to include actual crate names.
- Or change helper macros/functions so caller targets are preserved.

Acceptance criteria:

- Command/runtime debug logs documented as available are visible by default in development.

### Task 6.4: Automate A Small Performance Smoke

**Status:** Done

Add a small automated performance check for large listing behavior.

Implementation notes:

- Use synthetic entries for frontend virtualization checks.
- Add backend large-list fixture checks where runtime cost is bounded.
- Expose the combined smoke as `pnpm test:perf-smoke`.
- Keep manual hardware captures for final RC sign-off.

Acceptance criteria:

- A regression that mounts all rows or blocks large listing paths fails in automated checks.
- Manual performance docs remain release evidence, not the only signal.

## Recommended Sequencing

1. Finish Phase 2 by fixing `ColumnsView` and icons virtualization.
2. Finish Phase 3 by deriving commands from one registry and adding dispatch coverage.
3. Take Phase 4 in reliability order: editor save, metadata retention, SFTP cancellation, session lock reuse, owner cache.
4. Do Phase 5 as a refactor-only branch after lifecycle bugs are fixed.
5. Do Phase 6 before RC sign-off.

## Validation Matrix

Run these checks as tasks land:

- Contract work: `pnpm --filter @fileoctopus/ts-api test -- tests/catalogs.test.ts`
- Frontend lifecycle work: `pnpm --filter @fileoctopus/frontend exec vitest run tests/panelStore.test.ts tests/appShell.test.tsx`
- Command work: `pnpm --filter @fileoctopus/frontend exec vitest run tests/commands.registry.test.ts tests/commands.dispatch.test.ts`
- Rust runtime work: `cargo test -p app-core`, `cargo test -p fs-core`, and focused crate tests
- Broad readiness: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm rc:validate`
