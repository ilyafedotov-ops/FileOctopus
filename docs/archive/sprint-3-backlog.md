# FileOctopus Sprint 3 Implementation Backlog

## Sprint 3 Theme

**MVP Hardening, Packaging, Diagnostics, and Release Candidate Readiness**

Sprint 3 turns the Sprint 1 and Sprint 2 vertical slices into a credible MVP release candidate. Sprint 1 delivered local filesystem navigation. Sprint 2 delivered safe local file operations, backend jobs, progress, cancellation, conflict handling, operation history, frontend dialogs, and destructive-operation guardrails. Sprint 3 focuses on stability, cross-platform behavior, packaging, test coverage, performance validation, diagnostics, and final MVP acceptance.

Sprint 3 continues issue numbering after Sprint 2, which ended at `FO-0155`.

---

## Sprint 3 Goals

1. Produce installable application builds for the primary target platforms.
2. Harden local filesystem behavior across common edge cases.
3. Add diagnostics, structured logging, and user-facing error reporting.
4. Validate performance with large directories and large file operations.
5. Improve crash/cancel/restart resilience around file operation jobs.
6. Complete MVP QA, regression tests, and release-candidate checklist.
7. Prepare the app for internal dogfooding.

---

## Sprint 3 Non-Goals

The following are intentionally out of scope for Sprint 3:

- Cloud storage providers.
- SFTP / SMB / WebDAV providers.
- Git-aware file operations beyond local filesystem safety.
- Archive browsing or extraction.
- Plugin system.
- Full settings synchronization.
- Multi-window architecture.
- Advanced dual-pane file manager workflows.
- Public production release.

---

## Milestone

### `M3 - MVP Release Candidate Hardening`

Sprint 3 should be tracked under milestone:

```text
M3 - MVP Release Candidate Hardening
```

---

## Labels Used

Reuse the labels established in Sprint 0 / Sprint 1 / Sprint 2, plus the following if not already present:

```text
type:feature
type:bug
type:test
type:docs
type:chore
area:tauri
area:rust
area:frontend
area:vfs
area:jobs
area:database
area:testing
area:packaging
area:release
area:diagnostics
area:ux
priority:critical
priority:high
priority:medium
priority:low
sprint:3
```

---

# Sprint 3 Backlog

---

## FO-0156 — Configure Tauri production build profiles

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:chore`, `area:tauri`, `area:packaging`, `priority:critical`, `sprint:3`  
**Estimate:** 3 points

### Description

Configure production-grade Tauri build settings for the MVP release candidate.

### Tasks

- Review current Tauri v2 configuration.
- Define dev, debug, and release build behavior.
- Ensure release builds use optimized Rust settings.
- Ensure frontend assets are built before Tauri packaging.
- Disable development-only frontend diagnostics in production builds.
- Confirm app identifier, product name, version, and window metadata.

### Acceptance Criteria

- `cargo tauri dev` still works for development.
- Release build command produces a packaged app artifact.
- Production build does not expose dev-only debugging UI.
- Version metadata is visible in the built application.
- Build configuration is documented in `docs/build.md`.

### Dependencies

- Sprint 0 Tauri shell.
- Sprint 1 frontend shell.
- Sprint 2 operational UI.

---

## FO-0157 — Add application version and build metadata endpoint

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:feature`, `area:rust`, `area:frontend`, `area:diagnostics`, `priority:medium`, `sprint:3`  
**Estimate:** 2 points

### Description

Expose app version and build metadata through a backend command and display it in the UI.

### Tasks

- Add Rust command `get_app_info`.
- Return app name, semantic version, build profile, commit SHA if available, and target OS.
- Add TypeScript type for app info.
- Display metadata in an About dialog or diagnostics panel.
- Add backend unit test for app info response shape.

### Acceptance Criteria

- User can view app version from the UI.
- Backend returns stable metadata fields.
- Missing commit SHA is handled gracefully.
- App info does not require filesystem permissions.

### Dependencies

- FO-0156.

---

## FO-0158 — Implement structured backend logging

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:feature`, `area:rust`, `area:diagnostics`, `priority:critical`, `sprint:3`  
**Estimate:** 5 points

### Description

Add structured logging for backend commands, VFS calls, job lifecycle events, and critical failures.

### Tasks

- Introduce `tracing`-based logging if not already present.
- Add spans for IPC commands.
- Add spans for VFS operations.
- Add spans for job start, progress, cancellation, completion, and failure.
- Redact sensitive path details where appropriate.
- Configure log level by build profile.
- Persist logs to an application log directory.

### Acceptance Criteria

- Backend logs include timestamp, level, target, message, and correlation/job ID where relevant.
- Failed file operations are logged with error category and operation type.
- Logs are written to a predictable app-specific directory.
- Logs do not include unnecessary file contents or secret values.
- Logging does not significantly slow down file copy/move operations.

### Dependencies

- Sprint 2 job engine.
- Sprint 2 file operation commands.

---

## FO-0159 — Add frontend error boundary and crash fallback UI

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:feature`, `area:frontend`, `area:ux`, `area:diagnostics`, `priority:high`, `sprint:3`  
**Estimate:** 3 points

### Description

Add a frontend error boundary so unexpected React errors show a controlled fallback instead of a blank window.

### Tasks

- Add top-level error boundary component.
- Show user-friendly fallback message.
- Include reset/reload action.
- Include optional copy diagnostics action.
- Log caught frontend errors to console and backend diagnostics command if available.
- Add component test for fallback rendering.

### Acceptance Criteria

- Uncaught render error shows fallback UI.
- User can recover by reloading the app window.
- Error details are not overexposed in production UI.
- Test coverage exists for the boundary.

### Dependencies

- Sprint 1 frontend shell.

---

## FO-0160 — Add diagnostics export package

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:feature`, `area:diagnostics`, `area:rust`, `area:frontend`, `priority:high`, `sprint:3`  
**Estimate:** 5 points

### Description

Allow users/testers to export a diagnostics bundle for bug reports.

### Tasks

- Add backend command `export_diagnostics_bundle`.
- Include app info, OS info, recent log file excerpts, database schema version, and configuration summary.
- Exclude personal file contents.
- Redact home directory path where possible.
- Write bundle as `.zip` or `.tar.zst` to a user-selected destination.
- Add frontend action in diagnostics/about area.

### Acceptance Criteria

- Diagnostics bundle can be generated from the UI.
- Bundle excludes file contents from user directories.
- Bundle contains enough metadata for troubleshooting.
- Failure to generate bundle produces a clear user-facing error.
- Manual QA verifies the bundle on at least one target OS.

### Dependencies

- FO-0157.
- FO-0158.

---

## FO-0161 — Harden permission-denied and inaccessible-path handling

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:bug`, `area:vfs`, `area:rust`, `area:ux`, `priority:critical`, `sprint:3`  
**Estimate:** 5 points

### Description

Improve behavior when the app encounters protected directories, permission-denied errors, inaccessible removable media, or OS-restricted paths.

### Tasks

- Audit current error taxonomy for permission and access errors.
- Normalize OS-specific permission errors into stable app errors.
- Ensure directory listing failure does not crash navigation.
- Ensure file operation failure records operation history correctly.
- Show actionable frontend messages.
- Add tests using temporary directories with restricted permissions where supported.

### Acceptance Criteria

- Permission-denied during navigation shows a controlled error state.
- Permission-denied during copy/move/rename/trash fails safely.
- Operation history records failed operation with reason category.
- App remains usable after an inaccessible-path error.
- Tests cover at least one inaccessible path scenario.

### Dependencies

- Sprint 1 navigation.
- Sprint 2 operation history.

---

## FO-0162 — Harden missing, renamed, and concurrently changed paths

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:bug`, `area:vfs`, `area:jobs`, `area:rust`, `priority:critical`, `sprint:3`  
**Estimate:** 5 points

### Description

Handle filesystem race conditions where files or folders are changed outside FileOctopus while the app is listing, copying, moving, or deleting them.

### Tasks

- Add tests for source missing before operation starts.
- Add tests for destination removed during operation.
- Add tests for file changed during metadata read.
- Ensure job transitions to failed or partial state consistently.
- Refresh affected UI views after operation failure.
- Avoid panics from stale metadata assumptions.

### Acceptance Criteria

- Missing source produces clear error.
- Removed destination parent produces clear error.
- App does not panic on stale metadata.
- UI can recover by refreshing the directory.
- Operation history records final state accurately.

### Dependencies

- Sprint 2 job engine.
- Sprint 2 operation history.

---

## FO-0163 — Add symlink and junction behavior policy

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:feature`, `area:vfs`, `area:rust`, `area:docs`, `priority:high`, `sprint:3`  
**Estimate:** 5 points

### Description

Define and implement explicit behavior for symbolic links, Windows junctions, and recursive traversal safety.

### Tasks

- Document symlink policy for listing and operations.
- Decide whether copy follows symlinks or copies link objects for MVP.
- Detect basic symlink loops during recursive operations.
- Represent symlink metadata in file entries.
- Add UI indicator for symlink entries if feasible.
- Add tests for symlink listing and recursive copy safety.

### Acceptance Criteria

- Symlink behavior is documented.
- Directory listing distinguishes symlinks from regular files/directories.
- Recursive operations do not enter infinite loops.
- Unsupported symlink operations fail with explicit error.
- Tests cover symlink handling on platforms that support it.

### Dependencies

- Sprint 1 VFS listing.
- Sprint 2 copy/move operations.

---

## FO-0164 — Harden long path and Unicode path support

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:test`, `area:vfs`, `area:rust`, `area:frontend`, `priority:high`, `sprint:3`  
**Estimate:** 5 points

### Description

Validate and harden behavior for long paths, non-ASCII names, emoji filenames, combining characters, and OS-specific path normalization.

### Tasks

- Add path test fixtures with Unicode names.
- Add test cases for spaces, punctuation, emoji, and mixed scripts.
- Add long path test where supported.
- Ensure frontend renders names without corruption.
- Ensure IPC serialization preserves path strings.
- Document known platform limitations.

### Acceptance Criteria

- Unicode filenames list correctly.
- Unicode filenames can be copied, moved, renamed, and trashed where OS permits.
- Frontend does not mangle path display.
- Long path behavior is tested or documented per platform.
- No lossy string conversions are introduced in backend code.

### Dependencies

- Sprint 1 listing.
- Sprint 2 operations.

---

## FO-0165 — Add locked-file and in-use-file behavior tests

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:test`, `area:vfs`, `area:jobs`, `area:testing`, `priority:high`, `sprint:3`  
**Estimate:** 3 points

### Description

Validate behavior when files are locked, open by another process, or otherwise unavailable during operations.

### Tasks

- Create platform-appropriate locked-file test helper.
- Test rename of locked file where supported.
- Test move/copy behavior for locked file.
- Normalize error result into stable app error category.
- Document platform-specific behavior.

### Acceptance Criteria

- Locked-file operation does not crash the app.
- User sees an understandable failure message.
- Operation history captures failure state.
- Tests are skipped gracefully on unsupported platforms.

### Dependencies

- Sprint 2 operations.
- FO-0161.

---

## FO-0166 — Implement app startup recovery checks

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:feature`, `area:jobs`, `area:database`, `area:rust`, `priority:critical`, `sprint:3`  
**Estimate:** 5 points

### Description

Detect incomplete or interrupted jobs from the previous app session and present a safe recovery state.

### Tasks

- Add job state audit during app startup.
- Detect jobs left in running/cancelling state.
- Mark interrupted jobs as `interrupted` or `unknown` according to schema policy.
- Add recovery note to operation history.
- Show startup notification if interrupted jobs are found.
- Add tests using pre-seeded SQLite state.

### Acceptance Criteria

- App starts cleanly after being closed during a file operation.
- Previously running jobs are not resumed silently.
- Operation history indicates the job was interrupted.
- User can inspect interrupted operation in history.
- Startup recovery is idempotent.

### Dependencies

- Sprint 2 job engine.
- Sprint 2 SQLite operation history.

---

## FO-0167 — Add operation history cleanup and retention policy

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:feature`, `area:database`, `area:ux`, `priority:medium`, `sprint:3`  
**Estimate:** 3 points

### Description

Define and implement MVP retention behavior for operation history to prevent unbounded growth.

### Tasks

- Define retention policy for MVP.
- Add backend cleanup function.
- Add optional manual clear-history action.
- Confirm cleanup does not remove active jobs.
- Add database tests.
- Document retention behavior.

### Acceptance Criteria

- History retention is documented.
- User can clear operation history if implemented in UI.
- Cleanup never deletes active/incomplete jobs.
- Database tests verify retention logic.

### Dependencies

- Sprint 2 operation history.

---

## FO-0168 — Add job cancellation regression tests

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:test`, `area:jobs`, `area:testing`, `priority:critical`, `sprint:3`  
**Estimate:** 5 points

### Description

Strengthen test coverage around cancellation behavior for copy and move jobs.

### Tasks

- Add copy cancellation tests for many small files.
- Add copy cancellation tests for large file fixture.
- Add move cancellation behavior test.
- Verify partial outputs are recorded or cleaned according to policy.
- Verify final job state is deterministic.
- Verify frontend receives cancellation event.

### Acceptance Criteria

- Cancellation produces deterministic final job state.
- No job remains stuck in running state after cancellation.
- UI updates to cancelled state.
- Partial output behavior is documented.
- Tests are stable in CI.

### Dependencies

- Sprint 2 cancellation.
- Sprint 2 progress events.

---

## FO-0169 — Add conflict resolution regression tests

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:test`, `area:jobs`, `area:vfs`, `area:testing`, `priority:critical`, `sprint:3`  
**Estimate:** 5 points

### Description

Strengthen test coverage for existing destination conflicts during copy, move, and rename operations.

### Tasks

- Test conflict detection for files.
- Test conflict detection for directories.
- Test overwrite policy if supported.
- Test auto-rename policy if supported.
- Test cancel-on-conflict behavior.
- Verify frontend dialog state maps correctly to backend decisions.

### Acceptance Criteria

- Conflicts are detected before destructive overwrite.
- Backend and frontend agree on conflict resolution options.
- Operation history records conflict outcome.
- Tests cover file and directory conflicts.
- No unsupported conflict option is exposed in UI.

### Dependencies

- Sprint 2 conflict handling.

---

## FO-0170 — Add large directory listing performance benchmark

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:test`, `area:vfs`, `area:testing`, `priority:high`, `sprint:3`  
**Estimate:** 3 points

### Description

Measure and document local directory listing performance for large directories.

### Tasks

- Create benchmark fixture generator for many entries.
- Benchmark listing 1k, 10k, and 50k entries where practical.
- Capture latency and memory usage notes.
- Identify UI bottlenecks for rendering large lists.
- Document baseline performance numbers.

### Acceptance Criteria

- Benchmark can be run locally by developers.
- Results are documented in `docs/performance.md`.
- Large directory listing does not freeze backend.
- Any known frontend rendering limit is documented.

### Dependencies

- Sprint 1 listing.

---

## FO-0171 — Add large file operation performance benchmark

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:test`, `area:jobs`, `area:vfs`, `area:testing`, `priority:high`, `sprint:3`  
**Estimate:** 5 points

### Description

Measure copy/move progress behavior and throughput for large files and mixed file sets.

### Tasks

- Create benchmark fixture generator for large files.
- Benchmark single large file copy.
- Benchmark many-small-files copy.
- Benchmark nested directory copy.
- Record progress event frequency and overhead.
- Document expected baseline.

### Acceptance Criteria

- Benchmarks produce repeatable output.
- Progress updates remain responsive during large operations.
- Backend does not allocate entire large files into memory.
- Baseline results are documented.

### Dependencies

- Sprint 2 copy/move jobs.
- Sprint 2 progress events.

---

## FO-0172 — Add frontend virtualization for large file lists

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:feature`, `area:frontend`, `area:ux`, `priority:high`, `sprint:3`  
**Estimate:** 5 points

### Description

Prevent frontend slowdown when rendering directories with thousands of entries.

### Tasks

- Evaluate current file list rendering performance.
- Add virtualized list/table rendering.
- Preserve keyboard and mouse selection behavior.
- Preserve sorting behavior.
- Add loading and empty states for large directories.
- Add frontend tests for selection behavior with virtualization.

### Acceptance Criteria

- UI remains responsive with at least 10k entries in a test fixture.
- Selection still works correctly.
- Sorting still works correctly.
- Scroll behavior is stable.
- No visual regressions for small directories.

### Dependencies

- Sprint 1 file list UI.
- FO-0170.

---

## FO-0173 — Improve loading, empty, and error states across navigation

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:feature`, `area:frontend`, `area:ux`, `priority:medium`, `sprint:3`  
**Estimate:** 3 points

### Description

Polish user-facing states for directory loading, empty folders, denied access, missing paths, and operation failures.

### Tasks

- Audit navigation UI states.
- Add consistent loading indicator.
- Add empty directory state.
- Add access denied state.
- Add missing path state.
- Add retry/refresh action where appropriate.

### Acceptance Criteria

- Empty directory is visually distinct from loading.
- Permission errors do not look like empty folders.
- Retry/refresh is available for recoverable failures.
- UI copy is consistent across states.

### Dependencies

- Sprint 1 navigation.
- FO-0161.
- FO-0162.

---

## FO-0174 — Polish file operation confirmation dialogs

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:feature`, `area:frontend`, `area:ux`, `priority:high`, `sprint:3`  
**Estimate:** 3 points

### Description

Improve UX clarity and safety for copy, move, rename, create folder, and trash confirmations.

### Tasks

- Review dialog copy for destructive and non-destructive actions.
- Ensure selected item count is shown.
- Show destination path for copy/move.
- Require explicit confirmation for trashing multiple items.
- Disable submit button during pending backend call.
- Add tests for disabled/pending state.

### Acceptance Criteria

- Dialogs clearly state action, source count, and destination when relevant.
- Destructive actions are visually and textually distinct.
- Duplicate submissions are prevented.
- Tests cover at least one destructive confirmation flow.

### Dependencies

- Sprint 2 frontend dialogs.

---

## FO-0175 — Add keyboard shortcut baseline

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:feature`, `area:frontend`, `area:ux`, `priority:medium`, `sprint:3`  
**Estimate:** 3 points

### Description

Add a minimal keyboard shortcut set for MVP usability.

### Tasks

- Add Enter to open folder.
- Add Backspace or Alt+Up to go to parent directory where appropriate.
- Add F5 or Ctrl+R to refresh current directory.
- Add Delete to move selected items to trash with confirmation.
- Add Escape to close dialogs or clear transient UI state.
- Document shortcuts.

### Acceptance Criteria

- Keyboard shortcuts do not trigger while typing in text inputs.
- Shortcuts map to existing safe UI actions.
- Delete always requires confirmation.
- Shortcuts are documented in the app or docs.

### Dependencies

- Sprint 1 navigation.
- Sprint 2 file operation UI.

---

## FO-0176 — Add accessibility pass for MVP UI

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:test`, `area:frontend`, `area:ux`, `priority:medium`, `sprint:3`  
**Estimate:** 5 points

### Description

Perform a practical accessibility hardening pass for the MVP interface.

### Tasks

- Audit focus states.
- Ensure dialogs trap focus correctly.
- Add labels for icon-only buttons.
- Verify keyboard navigation through file list and toolbar.
- Check contrast of critical states.
- Add automated accessibility checks where feasible.

### Acceptance Criteria

- Core navigation and operations are keyboard-accessible.
- Dialogs have accessible names and descriptions.
- Icon-only buttons have labels.
- Focus does not get lost after closing dialogs.
- Basic accessibility findings are documented.

### Dependencies

- Sprint 1/Sprint 2 frontend UI.

---

## FO-0177 — Add smoke test script for packaged app

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:test`, `area:testing`, `area:packaging`, `priority:critical`, `sprint:3`  
**Estimate:** 3 points

### Description

Create a manual smoke test script for validating the installed/packaged MVP app.

### Tasks

- Define smoke test environment setup.
- Include launch test.
- Include local navigation test.
- Include copy/move/rename/create-folder/trash tests in temp fixture.
- Include cancellation test.
- Include diagnostics export test.
- Include uninstall/cleanup notes where relevant.

### Acceptance Criteria

- Script can be followed by a tester without developer assistance.
- Script uses disposable test folders only.
- Script verifies app version/build metadata.
- Script records pass/fail result per scenario.
- Script is committed as `docs/qa/sprint-3-smoke-test.md`.

### Dependencies

- FO-0156.
- FO-0157.
- FO-0160.

---

## FO-0178 — Add automated backend regression suite command

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:chore`, `area:rust`, `area:testing`, `priority:high`, `sprint:3`  
**Estimate:** 3 points

### Description

Create one reliable command that runs the full backend regression suite expected before a release candidate.

### Tasks

- Add workspace-level test command or script.
- Include unit tests.
- Include integration tests.
- Include database migration/schema tests.
- Include VFS/file operation tests.
- Document command in contributor docs.

### Acceptance Criteria

- One command runs backend release-candidate tests.
- Command exits non-zero on failure.
- Command works from repository root.
- CI can call the same command.

### Dependencies

- Existing Rust workspace.
- Sprint 2 tests.

---

## FO-0179 — Add automated frontend regression suite command

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:chore`, `area:frontend`, `area:testing`, `priority:high`, `sprint:3`  
**Estimate:** 3 points

### Description

Create one reliable command that runs the full frontend regression suite expected before a release candidate.

### Tasks

- Add command for linting frontend.
- Add command for TypeScript typecheck.
- Add command for frontend unit/component tests.
- Add command for production build validation.
- Document command in contributor docs.

### Acceptance Criteria

- One command validates frontend release readiness.
- Command exits non-zero on failure.
- Command works from repository root.
- CI can call the same command.

### Dependencies

- Sprint 1/Sprint 2 frontend tests.

---

## FO-0180 — Add CI release-candidate validation workflow

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:chore`, `area:testing`, `area:packaging`, `area:release`, `priority:critical`, `sprint:3`  
**Estimate:** 5 points

### Description

Add CI workflow that validates the app as a release candidate.

### Tasks

- Run backend regression suite.
- Run frontend regression suite.
- Run formatting/lint checks.
- Build frontend assets.
- Build Tauri app in release mode for at least one target platform.
- Upload build artifacts where feasible.

### Acceptance Criteria

- CI blocks merge on regression failure.
- Release-candidate workflow can be triggered manually.
- Build artifacts are retained for testers if supported.
- Workflow status is visible in pull requests.

### Dependencies

- FO-0178.
- FO-0179.
- FO-0156.

---

## FO-0181 — Add database migration/version validation

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:test`, `area:database`, `area:rust`, `priority:high`, `sprint:3`  
**Estimate:** 3 points

### Description

Ensure the SQLite schema can be initialized and versioned safely across app runs.

### Tasks

- Add schema version table if not already present.
- Validate migrations from empty database.
- Validate app startup with existing database.
- Handle unsupported future schema version gracefully.
- Add tests for migration idempotency.

### Acceptance Criteria

- Fresh app profile initializes database successfully.
- Existing app profile opens without destructive reset.
- Schema migration is idempotent.
- Unsupported future schema produces controlled error.

### Dependencies

- Sprint 2 SQLite operation history.

---

## FO-0182 — Add app data directory inspection command for diagnostics

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:feature`, `area:diagnostics`, `area:rust`, `area:database`, `priority:medium`, `sprint:3`  
**Estimate:** 2 points

### Description

Add a safe diagnostics command that reports app data locations and health without exposing user file contents.

### Tasks

- Report app config directory path.
- Report app data directory path.
- Report log directory path.
- Report database presence and schema version.
- Add frontend display in diagnostics/about area.

### Acceptance Criteria

- Diagnostics panel shows app data locations.
- Command does not enumerate user documents.
- Missing app data subdirectories are reported clearly.
- Data is included in diagnostics export.

### Dependencies

- FO-0160.
- FO-0181.

---

## FO-0183 — Add user-facing release notes for MVP RC

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:docs`, `area:release`, `priority:medium`, `sprint:3`  
**Estimate:** 2 points

### Description

Create concise release notes for the MVP release candidate.

### Tasks

- Summarize supported features.
- Document known limitations.
- Document supported platforms.
- Document safety expectations for file operations.
- Document how to report bugs and attach diagnostics.

### Acceptance Criteria

- Release notes exist in `docs/release-notes/mvp-rc.md`.
- Known limitations are explicit.
- Diagnostics export instructions are included.
- Notes are understandable by non-developer testers.

### Dependencies

- FO-0160.
- FO-0177.

---

## FO-0184 — Create MVP release checklist

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:docs`, `area:release`, `priority:critical`, `sprint:3`  
**Estimate:** 3 points

### Description

Create the final checklist required before declaring the MVP release candidate ready for dogfooding.

### Tasks

- Include build checks.
- Include automated test checks.
- Include manual QA checks.
- Include diagnostics export check.
- Include performance baseline check.
- Include known issues review.
- Include go/no-go decision section.

### Acceptance Criteria

- Checklist is committed as `docs/release/mvp-rc-checklist.md`.
- Checklist references smoke test and performance docs.
- Checklist can be completed by release owner.
- Checklist clearly distinguishes blocker and non-blocker issues.

### Dependencies

- FO-0177.
- FO-0170.
- FO-0171.
- FO-0183.

---

## FO-0185 — Perform Sprint 3 final QA pass and bug triage

**Milestone:** `M3 - MVP Release Candidate Hardening`  
**Labels:** `type:test`, `area:testing`, `area:release`, `priority:critical`, `sprint:3`  
**Estimate:** 5 points

### Description

Execute final Sprint 3 QA pass, triage findings, and decide whether the MVP RC is ready for internal dogfooding.

### Tasks

- Run backend regression suite.
- Run frontend regression suite.
- Run packaged-app smoke test.
- Run large directory benchmark.
- Run large file operation benchmark.
- Export diagnostics bundle.
- Review known issues.
- Classify findings as blocker, high, medium, or low.
- Create follow-up issues for unresolved findings.

### Acceptance Criteria

- Final QA result is documented.
- Blockers are either fixed or explicitly accepted by project owner.
- Follow-up issues exist for unresolved defects.
- MVP RC go/no-go decision is recorded.

### Dependencies

- FO-0156 through FO-0184.

---

# Suggested Implementation Order

1. `FO-0156` — Configure Tauri production build profiles.
2. `FO-0157` — Add application version and build metadata endpoint.
3. `FO-0158` — Implement structured backend logging.
4. `FO-0161` / `FO-0162` — Harden filesystem error/race handling.
5. `FO-0166` — Add startup recovery checks.
6. `FO-0168` / `FO-0169` — Add cancellation and conflict regression tests.
7. `FO-0170` / `FO-0171` — Add performance benchmarks.
8. `FO-0172` — Add frontend virtualization if benchmarks show UI bottleneck.
9. `FO-0173` / `FO-0174` / `FO-0175` / `FO-0176` — UX and accessibility polish.
10. `FO-0160` / `FO-0182` — Diagnostics export and app data inspection.
11. `FO-0178` / `FO-0179` / `FO-0180` — Regression commands and CI validation.
12. `FO-0177` / `FO-0183` / `FO-0184` — QA script, release notes, release checklist.
13. `FO-0185` — Final QA pass and go/no-go decision.

---

# Sprint 3 Definition of Done

Sprint 3 is done when:

- The app can be packaged in release mode.
- A tester can install or run the packaged app artifact.
- Navigation and local file operations pass smoke testing.
- Permission, missing-path, locked-file, Unicode-path, symlink, and cancellation cases are handled safely or documented as known limitations.
- Backend and frontend regression commands pass.
- CI release-candidate workflow passes.
- Operation history survives app restart and interrupted jobs are handled safely.
- Diagnostics export is available for bug reports.
- Performance baselines are documented.
- MVP release notes exist.
- MVP release checklist is completed.
- A go/no-go decision is recorded for internal dogfooding.

---

# Sprint 3 Technical Risks

## Risk 1 — Cross-platform filesystem semantics differ significantly

Windows, macOS, and Linux differ around symlinks, locked files, trash behavior, permissions, and long paths.

**Mitigation:** Document platform-specific behavior, add conditional tests, and avoid pretending unsupported behavior is portable.

## Risk 2 — Large directory rendering may require frontend architecture changes

A naive file table may degrade with thousands of entries.

**Mitigation:** Add benchmark first, then introduce virtualization if the UI cannot meet responsiveness expectations.

## Risk 3 — Packaging issues may surface late

Tauri packaging, signing, icons, app metadata, and OS-specific build dependencies can consume time.

**Mitigation:** Start packaging work first in Sprint 3, not at the end.

## Risk 4 — Cancellation and crash recovery can expose partial-state bugs

File operations are inherently stateful and may leave partial outputs.

**Mitigation:** Define explicit partial-output policy and test cancellation/restart paths.

## Risk 5 — Diagnostics may accidentally expose personal data

Logs and diagnostics can leak sensitive paths or filenames.

**Mitigation:** Redact where practical, exclude file contents, and document diagnostics contents clearly.

---

# Sprint 4 Preview

Sprint 4 is optional and depends on the Sprint 3 go/no-go result.

Potential Sprint 4 themes:

- Public beta hardening.
- Search and filtering.
- Advanced file preview panel.
- Configurable settings page.
- More complete keyboard navigation.
- Additional providers or archive operations.
- Installer signing/notarization pipeline.
- Crash reporting integration.
- Telemetry opt-in design.
