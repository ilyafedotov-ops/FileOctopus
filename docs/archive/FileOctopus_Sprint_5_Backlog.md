# FileOctopus Sprint 5 Backlog

> **Status (2026-05-30): Historical.** Most Sprint 5 `FO-*` items have shipped on `main` (see [PROJECT_STATUS_AND_DOC_ALIGNMENT.md](../planning/PROJECT_STATUS_AND_DOC_ALIGNMENT.md)). Sprint 5's "Layout Polish" and "visual coherence" goals are **superseded and extended** by the **[UI Premium Polish & Improvement Plan](../ui-premium-polish-improvement-plan.md)**, which is now the source of truth for premium UI finish. Any remaining or follow-on visual-polish work (toolbar clutter/grouping, loading/empty/error states, theme/density consistency, status-bar accuracy, keyboard discoverability) should be tracked against that plan's `UPP-*` backlog rather than re-opened here. The premium-polish epics map onto the Sprint 5 goals as: toolbar grouping → `UPP-B1/B2`; loading/empty/error states → `UPP-C*`/`PaneStateView` polish; preferences/visual consistency → `UPP-A1`/`UPP-H1`/`UPP-H3`; status bar → §3.6 + status-bar tokenization; keyboard discoverability → `UPP-D2`/§7.

## Sprint 5 Theme

**Usability, Layout Polish, and Runtime Stabilization**

Sprint 5 converts the Sprint 4 baseline-feature build from a functional developer-oriented interface into a more stable, usable, and maintainable daily-use file manager. The sprint intentionally avoids adding many new file operation primitives. The focus is on making the existing dual-pane workflow reliable, readable, discoverable, and visually coherent.

## Sprint Goals

1. Fix directory loading reliability and pane state handling.
2. Move diagnostics and developer-only controls out of the primary file-manager layout.
3. Reduce toolbar clutter by grouping actions and introducing overflow menus.
4. Improve loading, empty, error, permission-denied, and no-selection states.
5. Add persistent user preferences for visual and layout behavior.
6. Improve macOS path, volume, and permission handling.
7. Add keyboard shortcut discoverability and baseline shortcut coverage.
8. Add frontend visual regression coverage for key file-manager states.

## Non-Goals

The following are explicitly out of scope for Sprint 5:

- Cloud provider integrations.
- Archive browsing as a virtual filesystem.
- Plugin system.
- Full-text content indexing.
- Advanced file synchronization.
- Network protocol providers such as SFTP, SMB, or WebDAV.
- Major new file operation types beyond stabilization of existing operations.
- Large visual redesign unrelated to the existing dual-pane model.

## Expected User-Visible Outcome

After Sprint 5, FileOctopus should feel less like a debug prototype and more like a controlled MVP:

- Both panes should load directories reliably or show actionable error states.
- The main toolbar should be compact and logically grouped.
- Diagnostics should no longer occupy permanent screen space.
- Users should be able to change theme, density, view mode, hidden-file visibility, and layout preferences with persistence.
- Keyboard shortcuts should be visible and usable for common operations.
- The app should handle macOS user folders, volumes, and denied permissions predictably.
- The status bar should communicate selection, item count, job activity, and current pane state accurately.

## Issue Numbering

Sprint 5 continues after Sprint 4. If Sprint 4 ended with a different final issue number, adjust these IDs before importing into GitHub.

Sprint 5 issue range: **FO-0201 through FO-0245**.

---

# Epic 1 — Directory Loading and Pane State Stability

## FO-0201 — Normalize pane loading state lifecycle

**Milestone:** Sprint 5  
**Labels:** frontend, state-management, bug, high-priority  
**Estimate:** 3 points

### Description

The current UI can remain in a `Loading` state even when no entries are displayed. Normalize pane state transitions so each pane has explicit states for idle, loading, loaded, empty, error, and permission denied.

### Tasks

- Define a frontend `PaneLoadState` model.
- Replace boolean loading flags with explicit pane state.
- Ensure successful directory reads always transition to `loaded` or `empty`.
- Ensure failed directory reads always transition to `error` or `permissionDenied`.
- Ensure stale responses do not overwrite newer pane state.
- Add tests for rapid path changes.

### Acceptance Criteria

- A pane never remains indefinitely in `Loading` after a completed backend response.
- Empty directories show an empty-state message instead of a permanent loader.
- Permission failures show a specific permission-denied state.
- Rapid navigation does not show entries from an older path.

### Dependencies

None.

---

## FO-0202 — Add request correlation IDs for directory listing IPC

**Milestone:** Sprint 5  
**Labels:** backend, frontend, ipc, reliability  
**Estimate:** 3 points

### Description

Directory listing requests should include a request ID so the frontend can ignore stale responses when the user navigates quickly.

### Tasks

- Add request ID to the directory listing IPC command payload.
- Echo request ID in success and error responses.
- Update frontend pane store to track the latest active request ID per pane.
- Ignore stale responses.
- Add backend and frontend tests.

### Acceptance Criteria

- Rapid navigation does not produce stale directory entries.
- Each pane tracks its own request lifecycle independently.
- Stale responses are safely ignored and logged at debug level.

### Dependencies

FO-0201.

---

## FO-0203 — Add backend timeout and cancellation handling for directory reads

**Milestone:** Sprint 5  
**Labels:** backend, rust, reliability  
**Estimate:** 5 points

### Description

Long-running directory reads should not block pane interaction indefinitely. Add cancellable directory read tasks with timeout behavior where practical.

### Tasks

- Review current directory listing implementation.
- Add cancellation support for superseded pane listing requests.
- Add timeout guardrails for slow or inaccessible paths.
- Return structured timeout errors.
- Log slow path diagnostics.
- Add tests using simulated slow providers.

### Acceptance Criteria

- Superseded directory read requests can be cancelled or ignored safely.
- Slow paths produce a user-visible state instead of an endless loader.
- Timeout errors are structured and mapped to frontend states.

### Dependencies

FO-0202.

---

## FO-0204 — Improve macOS user folder and volume resolution

**Milestone:** Sprint 5  
**Labels:** backend, macos, filesystem, high-priority  
**Estimate:** 5 points

### Description

Improve handling of macOS home folders, standard user folders, mounted volumes, Time Machine entries, and restricted locations.

### Tasks

- Audit sidebar path resolution on macOS.
- Normalize `/Users/<name>` folder shortcuts.
- Filter or annotate inaccessible system volumes.
- Detect restricted locations and return permission-specific errors.
- Add path canonicalization safeguards.
- Add manual QA cases for Desktop, Documents, Downloads, Pictures, Music, `/`, `/Volumes`, and Time Machine-related entries.

### Acceptance Criteria

- Standard user folders open reliably on macOS.
- Inaccessible volumes do not break the sidebar or pane loading.
- Restricted paths show a clear error state.
- Volume entries are displayed consistently.

### Dependencies

FO-0201.

---

## FO-0205 — Add pane-level retry action

**Milestone:** Sprint 5  
**Labels:** frontend, ux, reliability  
**Estimate:** 2 points

### Description

When a pane fails to load, users should be able to retry the current path directly from the pane error state.

### Tasks

- Add retry action to pane error component.
- Reuse the latest pane path and filters.
- Preserve active pane focus.
- Add tests.

### Acceptance Criteria

- Error and timeout states include a visible retry action.
- Retry reissues the directory listing request.
- Retry does not reset the other pane.

### Dependencies

FO-0201.

---

# Epic 2 — Layout, Toolbar, and Visual Hierarchy

## FO-0206 — Move diagnostics panel out of the main layout

**Milestone:** Sprint 5  
**Labels:** frontend, ux, diagnostics, high-priority  
**Estimate:** 3 points

### Description

The diagnostics panel is currently permanently visible and consumes valuable vertical space. Move it into a dedicated diagnostics dialog or developer drawer.

### Tasks

- Remove always-visible diagnostics panel from the main shell.
- Add `Help -> Diagnostics` or equivalent diagnostics access point.
- Create diagnostics dialog with version, commit, schema, recovered count, paths, and export action.
- Preserve diagnostics export functionality.
- Hide developer-only diagnostics by default in production builds if applicable.

### Acceptance Criteria

- Main file-manager layout no longer shows diagnostics by default.
- Diagnostics remain accessible through a deliberate user action.
- Export diagnostics still works.
- Production UI does not look like a debug build.

### Dependencies

None.

---

## FO-0207 — Redesign pane toolbar into grouped action sections

**Milestone:** Sprint 5  
**Labels:** frontend, ux, design-system  
**Estimate:** 5 points

### Description

The current pane toolbar exposes too many actions with equal visual weight. Redesign the toolbar into grouped sections with primary actions visible and secondary actions moved to menus.

### Tasks

- Define primary actions: Back, Forward, Up, Refresh, New, Copy, Move, Delete/Trash.
- Define secondary actions: Copy Path, Copy Name, Properties, Show Hidden, View Options.
- Add grouped toolbar layout.
- Add overflow menu for low-frequency actions.
- Ensure keyboard and screen-reader accessibility.
- Add visual tests.

### Acceptance Criteria

- Toolbar fits on one row at common desktop widths.
- Secondary actions are available but do not dominate the layout.
- Toolbar grouping is consistent between left and right panes.
- Existing file actions remain reachable.

### Dependencies

None.

---

## FO-0208 — Improve breadcrumb/path bar layout

**Milestone:** Sprint 5  
**Labels:** frontend, ux, navigation  
**Estimate:** 3 points

### Description

The current breadcrumb/path area is cramped and visually similar to command buttons. Improve path navigation readability and editability.

### Tasks

- Separate path breadcrumbs from command toolbar.
- Add clear editable path mode.
- Add truncation for long paths.
- Add root and home handling.
- Add keyboard support for focusing path input.

### Acceptance Criteria

- Current path is easy to distinguish from toolbar actions.
- Long paths do not break pane layout.
- Users can switch between breadcrumb and editable path modes.
- Path entry errors produce a visible pane error.

### Dependencies

FO-0201.

---

## FO-0209 — Add compact, comfortable, and spacious density modes

**Milestone:** Sprint 5  
**Labels:** frontend, preferences, visual-customization  
**Estimate:** 3 points

### Description

Add UI density settings so users can choose row height, toolbar spacing, and padding density.

### Tasks

- Define density tokens for compact, comfortable, and spacious modes.
- Apply density to table rows, toolbar controls, sidebar entries, and status bar.
- Store selected density in preferences.
- Add settings UI.
- Add visual regression snapshots for each density.

### Acceptance Criteria

- Density can be changed without restarting the app.
- Preference persists across app restarts.
- Table row height and toolbar spacing visibly change.

### Dependencies

FO-0221.

---

## FO-0210 — Improve active pane and focus styling

**Milestone:** Sprint 5  
**Labels:** frontend, ux, accessibility  
**Estimate:** 2 points

### Description

The active pane indicator is useful but should be visually refined and accessible.

### Tasks

- Keep a clear active pane indicator.
- Reduce overly harsh focus borders.
- Ensure focus style meets contrast requirements.
- Add keyboard focus traversal validation.
- Add tests for active pane switching.

### Acceptance Criteria

- Active pane remains obvious.
- Focus styling does not visually overwhelm the file table.
- Keyboard users can identify the active pane and active row.

### Dependencies

None.

---

# Epic 3 — Empty, Error, Permission, and Status States

## FO-0211 — Add standardized pane empty state

**Milestone:** Sprint 5  
**Labels:** frontend, ux  
**Estimate:** 2 points

### Description

Empty directories should show a clear empty state with path context and optional actions.

### Tasks

- Add pane empty-state component.
- Include current path label.
- Include refresh action.
- Include new folder action where allowed.

### Acceptance Criteria

- Empty directories no longer look like failed loads.
- Empty state shows at least one useful action.
- Empty state respects active pane focus.

### Dependencies

FO-0201.

---

## FO-0212 — Add standardized permission-denied state

**Milestone:** Sprint 5  
**Labels:** frontend, backend, permissions, macos  
**Estimate:** 3 points

### Description

Permission errors should be distinguishable from generic failures.

### Tasks

- Map backend permission errors to a specific frontend state.
- Show restricted path and concise reason.
- Add retry action.
- Add optional guidance for OS-level permissions where applicable.
- Add tests for permission error mapping.

### Acceptance Criteria

- Permission-denied errors are not shown as generic failures.
- User sees which path failed.
- Retry is available.

### Dependencies

FO-0201, FO-0204.

---

## FO-0213 — Add standardized generic error state

**Milestone:** Sprint 5  
**Labels:** frontend, errors  
**Estimate:** 2 points

### Description

Unexpected pane errors should be rendered consistently with safe technical detail disclosure.

### Tasks

- Add pane error component.
- Include short user-facing message.
- Include expandable technical details in development builds.
- Include retry action.
- Ensure errors are logged.

### Acceptance Criteria

- Generic errors are readable and actionable.
- Technical details do not overwhelm normal users.
- Error state does not break pane layout.

### Dependencies

FO-0201.

---

## FO-0214 — Improve status bar content and accuracy

**Milestone:** Sprint 5  
**Labels:** frontend, ux, state-management  
**Estimate:** 3 points

### Description

The status bar should accurately show selected items, loaded entries, active pane path, and job activity.

### Tasks

- Define status bar data model.
- Show active pane selection count.
- Show active pane entry count.
- Show loading/error state summary.
- Show active background job count.
- Add tests for selection and loading changes.

### Acceptance Criteria

- Status bar updates when selection changes.
- Status bar updates when pane loading completes.
- Status bar does not display misleading stale counts.

### Dependencies

FO-0201.

---

## FO-0215 — Add non-blocking toast notifications for completed operations

**Milestone:** Sprint 5  
**Labels:** frontend, ux, jobs  
**Estimate:** 3 points

### Description

Completed, failed, and cancelled file operations should produce brief, non-blocking feedback.

### Tasks

- Add toast notification component.
- Emit success, failure, and cancellation notifications from job state changes.
- Include `View details` action for failed operations.
- Avoid notification spam for bulk operations.

### Acceptance Criteria

- Users receive visible feedback after file operations.
- Failed operations expose details without blocking normal work.
- Notifications are dismissible.

### Dependencies

Existing job engine from Sprint 2/Sprint 4.

---

# Epic 4 — Preferences and Visual Customization

## FO-0216 — Define preferences schema v2

**Milestone:** Sprint 5  
**Labels:** backend, sqlite, preferences  
**Estimate:** 3 points

### Description

Extend persisted settings to include layout and visual preferences introduced in Sprint 5.

### Tasks

- Define preferences schema version update.
- Add keys for theme, density, view mode, show hidden, pane layout, sidebar visibility, and diagnostics visibility.
- Add migration from current schema.
- Add read/write APIs.
- Add tests for default values and migration.

### Acceptance Criteria

- Preferences persist across app restarts.
- Missing preferences resolve to safe defaults.
- Existing user data migrates without reset.

### Dependencies

Current SQLite/storage layer.

---

## FO-0217 — Add preferences IPC API

**Milestone:** Sprint 5  
**Labels:** backend, frontend, ipc, preferences  
**Estimate:** 3 points

### Description

Expose preferences through typed IPC commands.

### Tasks

- Add `get_preferences` IPC command.
- Add `set_preference` or `update_preferences` IPC command.
- Validate preference values in backend.
- Add TypeScript types.
- Add frontend store integration.

### Acceptance Criteria

- Frontend can load preferences at startup.
- Frontend can update preferences safely.
- Invalid preference values are rejected with structured errors.

### Dependencies

FO-0216.

---

## FO-0218 — Add theme preference support

**Milestone:** Sprint 5  
**Labels:** frontend, preferences, visual-customization  
**Estimate:** 3 points

### Description

Add user-selectable theme mode.

### Tasks

- Support system, light, and dark theme modes.
- Apply theme at startup before main layout renders where possible.
- Add settings UI.
- Persist preference.
- Add visual snapshots for light and dark modes.

### Acceptance Criteria

- Theme can be changed from settings.
- Theme persists after restart.
- System theme mode follows OS preference where available.

### Dependencies

FO-0217.

---

## FO-0219 — Add default view mode preference

**Milestone:** Sprint 5  
**Labels:** frontend, preferences, file-list  
**Estimate:** 2 points

### Description

Persist the user’s preferred file view mode.

### Tasks

- Persist details/list/compact view selection.
- Apply preference to both panes by default.
- Allow per-pane override during runtime if existing design supports it.
- Add tests.

### Acceptance Criteria

- Selected view mode survives restart.
- View mode applies consistently to left and right panes.

### Dependencies

FO-0217.

---

## FO-0220 — Add show-hidden-files preference

**Milestone:** Sprint 5  
**Labels:** frontend, backend, preferences, filesystem  
**Estimate:** 2 points

### Description

Persist the show-hidden-files setting and apply it consistently.

### Tasks

- Store show-hidden-files preference.
- Apply it to directory listing requests.
- Add toolbar/menu toggle.
- Ensure both panes refresh when preference changes, or define per-pane behavior explicitly.

### Acceptance Criteria

- Hidden-file visibility persists after restart.
- Toggle behavior is predictable and documented.
- Directory listing reflects the setting.

### Dependencies

FO-0217.

---

## FO-0221 — Add settings/preferences dialog

**Milestone:** Sprint 5  
**Labels:** frontend, preferences, ux  
**Estimate:** 5 points

### Description

Add a user-facing settings dialog for visual and layout preferences.

### Tasks

- Create settings dialog shell.
- Add Appearance section.
- Add File List section.
- Add Layout section.
- Add Diagnostics section if relevant.
- Wire settings to preferences IPC.
- Add tests.

### Acceptance Criteria

- Users can change theme, density, view mode, and hidden-file visibility from settings.
- Changed preferences apply immediately where practical.
- Preferences persist across restart.

### Dependencies

FO-0217, FO-0218, FO-0219, FO-0220.

---

# Epic 5 — Keyboard Shortcuts and Discoverability

## FO-0222 — Define baseline keyboard shortcut map

**Milestone:** Sprint 5  
**Labels:** frontend, keyboard, ux  
**Estimate:** 2 points

### Description

Define and document baseline keyboard shortcuts for common dual-pane file-manager operations.

### Proposed Shortcuts

- `Tab` — switch active pane.
- `Enter` — open selected file or folder.
- `Backspace` or `Alt+Up` — go up one directory.
- `Cmd/Ctrl+C` — copy selected items.
- `Cmd/Ctrl+X` — cut selected items.
- `Cmd/Ctrl+V` — paste into active pane.
- `Delete` — move selected items to trash.
- `Shift+Delete` — permanent delete, if already supported and guarded.
- `F2` — rename.
- `Cmd/Ctrl+N` — new file or folder decision to be finalized.
- `Cmd/Ctrl+R` — refresh active pane.
- `Cmd/Ctrl+L` — focus path bar.
- `Cmd/Ctrl+F` — focus filter/search.

### Tasks

- Finalize shortcut list per platform.
- Resolve macOS Command vs Control behavior.
- Document shortcuts in source.
- Identify conflicts with browser/WebView defaults.

### Acceptance Criteria

- Shortcut map is documented.
- Platform differences are explicit.
- No critical shortcut conflicts remain unresolved.

### Dependencies

None.

---

## FO-0223 — Implement active pane keyboard navigation

**Milestone:** Sprint 5  
**Labels:** frontend, keyboard, navigation  
**Estimate:** 3 points

### Description

Keyboard navigation should work naturally inside the active pane.

### Tasks

- Implement active pane switching with `Tab` or configured shortcut.
- Implement arrow-key row movement.
- Implement Enter to open item.
- Implement Up-directory shortcut.
- Add tests.

### Acceptance Criteria

- Keyboard users can switch panes and open folders/files.
- Active pane is visually obvious after switching.
- Keyboard behavior does not break text input fields.

### Dependencies

FO-0210, FO-0222.

---

## FO-0224 — Implement file operation shortcuts

**Milestone:** Sprint 5  
**Labels:** frontend, keyboard, file-operations  
**Estimate:** 3 points

### Description

Common file operations should be accessible via keyboard shortcuts.

### Tasks

- Implement copy, cut, paste, rename, refresh, trash/delete shortcuts.
- Ensure shortcuts target active pane selection.
- Disable shortcuts when text fields or dialogs require input.
- Add tests.

### Acceptance Criteria

- Shortcuts operate on active pane selection only.
- Disabled states are respected.
- Text input fields do not accidentally trigger file operations.

### Dependencies

FO-0222, existing file operation commands.

---

## FO-0225 — Add keyboard shortcuts dialog

**Milestone:** Sprint 5  
**Labels:** frontend, ux, keyboard  
**Estimate:** 2 points

### Description

Users should be able to discover shortcuts from inside the app.

### Tasks

- Add shortcuts dialog.
- Add menu/help entry.
- Display platform-specific modifier names.
- Add visual test.

### Acceptance Criteria

- Shortcut help is accessible from the UI.
- Displayed shortcuts match implemented behavior.
- macOS uses Command terminology where applicable.

### Dependencies

FO-0222, FO-0223, FO-0224.

---

# Epic 6 — File Table Polish and Selection Behavior

## FO-0226 — Stabilize file table column sizing

**Milestone:** Sprint 5  
**Labels:** frontend, file-list, ux  
**Estimate:** 3 points

### Description

File table columns should remain readable and predictable across pane sizes.

### Tasks

- Define default widths for Name, Size, Modified, and Type.
- Add min/max widths.
- Support horizontal overflow only where necessary.
- Preserve sorting indicators.
- Add visual tests for narrow and wide panes.

### Acceptance Criteria

- File names receive the most available width.
- Metadata columns do not collapse into unreadable states.
- Sorting indicators remain visible.

### Dependencies

None.

---

## FO-0227 — Improve row selection and multi-selection behavior

**Milestone:** Sprint 5  
**Labels:** frontend, file-list, selection  
**Estimate:** 5 points

### Description

Selection behavior should match desktop file-manager expectations.

### Tasks

- Support single click selection.
- Support range selection with Shift.
- Support additive selection with Cmd/Ctrl.
- Preserve selection where possible after refresh.
- Clear selection predictably on path change.
- Add tests.

### Acceptance Criteria

- Single, range, and additive selection work consistently.
- Selection count in status bar is accurate.
- Selection does not leak between panes.

### Dependencies

FO-0214.

---

## FO-0228 — Add file row context menu

**Milestone:** Sprint 5  
**Labels:** frontend, ux, file-operations  
**Estimate:** 3 points

### Description

Common file operations should be available from a right-click context menu.

### Tasks

- Add context menu for selected file rows.
- Include open, rename, copy, cut, paste, move to trash, delete, properties, copy path, copy name.
- Disable invalid actions.
- Ensure context menu targets active pane.
- Add tests.

### Acceptance Criteria

- Right-clicking a row opens a context menu.
- Actions apply to the intended selection.
- Disabled actions communicate unavailable state.

### Dependencies

Existing file operation commands.

---

## FO-0229 — Add background context menu for pane empty area

**Milestone:** Sprint 5  
**Labels:** frontend, ux, file-operations  
**Estimate:** 2 points

### Description

Right-clicking empty pane area should expose actions relevant to the current directory.

### Tasks

- Add background context menu.
- Include paste, new folder, new file, refresh, properties for current folder.
- Disable unavailable actions.
- Add tests.

### Acceptance Criteria

- Empty-area context menu appears in active pane.
- Actions target the current directory.
- Invalid actions are disabled.

### Dependencies

FO-0228.

---

# Epic 7 — Diagnostics, Logging, and Production Readiness

## FO-0230 — Separate development diagnostics from production diagnostics

**Milestone:** Sprint 5  
**Labels:** diagnostics, frontend, backend  
**Estimate:** 3 points

### Description

Some diagnostics are useful for support, while others are developer-only. Separate them clearly.

### Tasks

- Classify diagnostics as user-support or developer-only.
- Hide developer-only diagnostics unless dev mode is enabled.
- Keep support diagnostics export available.
- Add build-mode checks where applicable.

### Acceptance Criteria

- Production UI does not expose noisy developer internals by default.
- Support bundle export remains available.
- Developer diagnostics can still be accessed during development.

### Dependencies

FO-0206.

---

## FO-0231 — Improve diagnostics bundle contents

**Milestone:** Sprint 5  
**Labels:** backend, diagnostics, supportability  
**Estimate:** 3 points

### Description

Diagnostics bundles should contain enough information to debug loading and filesystem issues without exposing unnecessary sensitive data.

### Tasks

- Include app version, commit, platform, schema version, and recent structured logs.
- Include sanitized pane state history.
- Include recent IPC error summaries.
- Exclude raw file contents.
- Sanitize home directory paths where appropriate.
- Add tests for bundle creation.

### Acceptance Criteria

- Diagnostics bundle helps troubleshoot pane loading issues.
- Bundle does not include file contents.
- Sensitive paths are minimized or sanitized where possible.

### Dependencies

FO-0201, FO-0206.

---

## FO-0232 — Add structured logging for pane navigation lifecycle

**Milestone:** Sprint 5  
**Labels:** backend, frontend, logging, reliability  
**Estimate:** 3 points

### Description

Pane navigation should produce structured logs to aid troubleshooting.

### Tasks

- Log navigation request start.
- Log successful directory load with item count and duration.
- Log errors with structured error codes.
- Log stale response ignored events.
- Avoid logging sensitive filenames beyond current path policy.

### Acceptance Criteria

- Logs allow reconstruction of pane loading lifecycle.
- Slow and failed loads are identifiable.
- Logs are not excessively noisy during normal navigation.

### Dependencies

FO-0202.

---

# Epic 8 — Testing and QA

## FO-0233 — Add frontend visual regression states

**Milestone:** Sprint 5  
**Labels:** frontend, testing, visual-regression  
**Estimate:** 5 points

### Description

Add visual regression coverage for the main file-manager states.

### Required States

- Normal dual-pane loaded state.
- Left pane loading, right pane loaded.
- Empty directory state.
- Permission-denied state.
- Generic error state.
- Settings dialog.
- Diagnostics dialog.
- Shortcuts dialog.
- Dark theme.
- Compact density.

### Tasks

- Add story/test fixtures for pane states.
- Add snapshot generation command.
- Document update workflow.
- Integrate into CI if feasible.

### Acceptance Criteria

- Key UI states can be visually reviewed.
- Regression snapshots are deterministic enough for CI or manual review.
- Screenshot fixtures do not depend on local filesystem contents.

### Dependencies

FO-0201, FO-0206, FO-0218, FO-0221, FO-0225.

---

## FO-0234 — Add macOS manual QA checklist

**Milestone:** Sprint 5  
**Labels:** qa, macos, documentation  
**Estimate:** 2 points

### Description

Create a manual QA checklist for macOS-specific filesystem behavior.

### Tasks

- Test user folders.
- Test root filesystem.
- Test mounted volumes.
- Test inaccessible/restricted folders.
- Test Time Machine-related entries where present.
- Test diagnostics export.
- Test app restart preference persistence.

### Acceptance Criteria

- QA checklist exists in repository documentation.
- Checklist covers the screenshot-observed macOS layout and volume cases.
- Results can be recorded per build.

### Dependencies

FO-0204, FO-0216.

---

## FO-0235 — Add pane state unit tests

**Milestone:** Sprint 5  
**Labels:** frontend, testing, state-management  
**Estimate:** 3 points

### Description

Add unit tests for pane state transitions.

### Tasks

- Test idle to loading.
- Test loading to loaded.
- Test loading to empty.
- Test loading to permission denied.
- Test loading to generic error.
- Test stale response ignored.
- Test path change clears selection.

### Acceptance Criteria

- Pane state transitions are covered by automated tests.
- Stale response behavior is explicitly tested.
- Selection reset behavior is explicitly tested.

### Dependencies

FO-0201, FO-0202, FO-0227.

---

## FO-0236 — Add preferences persistence tests

**Milestone:** Sprint 5  
**Labels:** backend, frontend, testing, preferences  
**Estimate:** 3 points

### Description

Verify that user preferences persist and migrate correctly.

### Tasks

- Test default preference creation.
- Test preference updates.
- Test restart/load behavior.
- Test schema migration.
- Test invalid preference rejection.

### Acceptance Criteria

- Preferences are reliable across restarts.
- Invalid settings cannot corrupt the preference store.
- Migration preserves existing data.

### Dependencies

FO-0216, FO-0217.

---

## FO-0237 — Add keyboard shortcut tests

**Milestone:** Sprint 5  
**Labels:** frontend, testing, keyboard  
**Estimate:** 3 points

### Description

Add automated coverage for implemented keyboard shortcuts.

### Tasks

- Test active pane switching.
- Test path bar focus shortcut.
- Test search/filter focus shortcut.
- Test copy/cut/paste dispatch.
- Test rename shortcut.
- Test shortcut suppression while typing.

### Acceptance Criteria

- Keyboard shortcuts are covered by automated tests.
- Shortcuts do not trigger inside text input fields unless intended.
- Active pane targeting is verified.

### Dependencies

FO-0223, FO-0224.

---

# Epic 9 — Documentation and Developer Workflow

## FO-0238 — Update user-facing MVP feature documentation

**Milestone:** Sprint 5  
**Labels:** documentation, product  
**Estimate:** 2 points

### Description

Update user-facing documentation to reflect the stabilized MVP feature set.

### Tasks

- Document dual-pane navigation.
- Document file operations.
- Document preferences.
- Document shortcuts.
- Document diagnostics export.

### Acceptance Criteria

- Documentation matches current app behavior.
- Known limitations are listed.
- Screenshots are updated if available.

### Dependencies

FO-0221, FO-0225, FO-0230.

---

## FO-0239 — Update developer architecture notes for pane lifecycle

**Milestone:** Sprint 5  
**Labels:** documentation, architecture  
**Estimate:** 2 points

### Description

Document the pane loading lifecycle, request correlation, and stale response handling.

### Tasks

- Document pane state machine.
- Document IPC request ID lifecycle.
- Document cancellation and timeout behavior.
- Document frontend/backend responsibility split.

### Acceptance Criteria

- Developers can understand pane loading without reading all implementation code.
- Stale response and timeout behavior are explicitly described.

### Dependencies

FO-0201, FO-0202, FO-0203.

---

## FO-0240 — Add Sprint 5 release notes draft

**Milestone:** Sprint 5  
**Labels:** documentation, release  
**Estimate:** 1 point

### Description

Create release notes summarizing Sprint 5 improvements.

### Tasks

- Add release notes markdown file.
- Summarize loading reliability fixes.
- Summarize UI layout improvements.
- Summarize preferences and shortcut additions.
- List known limitations.

### Acceptance Criteria

- Release notes are ready before Sprint 5 closure.
- Known limitations are explicit.

### Dependencies

All user-visible Sprint 5 items.

---

# Stretch Issues

## FO-0241 — Add split ratio persistence

**Milestone:** Sprint 5 Stretch  
**Labels:** frontend, preferences, layout  
**Estimate:** 2 points

### Description

Persist the sidebar width and left/right pane split ratio.

### Acceptance Criteria

- User-resized layout persists after restart.
- Invalid saved ratios are clamped to safe values.

### Dependencies

FO-0216, FO-0217.

---

## FO-0242 — Add command palette prototype

**Milestone:** Sprint 5 Stretch  
**Labels:** frontend, ux, productivity  
**Estimate:** 5 points

### Description

Prototype a command palette for common actions.

### Acceptance Criteria

- Users can open a command palette.
- At least navigation, refresh, settings, diagnostics, and shortcut help commands are available.
- Commands respect active pane context.

### Dependencies

FO-0222.

---

## FO-0243 — Add startup restore for last opened pane paths

**Milestone:** Sprint 5 Stretch  
**Labels:** frontend, backend, preferences, navigation  
**Estimate:** 3 points

### Description

Persist and restore the last opened left and right pane paths.

### Acceptance Criteria

- Last pane paths are restored after restart.
- Missing or inaccessible restored paths fall back safely to the home directory.

### Dependencies

FO-0216, FO-0204.

---

## FO-0244 — Add first-run welcome/help overlay

**Milestone:** Sprint 5 Stretch  
**Labels:** frontend, onboarding, ux  
**Estimate:** 3 points

### Description

Add a lightweight first-run overlay explaining dual-pane behavior, shortcuts, and settings.

### Acceptance Criteria

- Overlay appears only on first run or when manually reopened.
- Users can dismiss it permanently.
- Overlay does not block critical file-manager functionality after dismissal.

### Dependencies

FO-0216.

---

## FO-0245 — Add basic accessibility audit checklist

**Milestone:** Sprint 5 Stretch  
**Labels:** accessibility, qa, documentation  
**Estimate:** 2 points

### Description

Create and run a basic accessibility checklist for keyboard navigation, focus states, contrast, and dialogs.

### Acceptance Criteria

- Checklist exists in repository documentation.
- Main shell, settings dialog, diagnostics dialog, and shortcuts dialog are covered.
- Critical accessibility issues are filed as follow-up bugs.

### Dependencies

FO-0210, FO-0221, FO-0225.

---

# Suggested Implementation Order

1. FO-0201 — Normalize pane loading state lifecycle.
2. FO-0202 — Add request correlation IDs for directory listing IPC.
3. FO-0204 — Improve macOS user folder and volume resolution.
4. FO-0206 — Move diagnostics panel out of the main layout.
5. FO-0207 — Redesign pane toolbar into grouped action sections.
6. FO-0216 — Define preferences schema v2.
7. FO-0217 — Add preferences IPC API.
8. FO-0221 — Add settings/preferences dialog.
9. FO-0218 / FO-0219 / FO-0220 — Add theme, view mode, and hidden-file preferences.
10. FO-0222 / FO-0223 / FO-0224 / FO-0225 — Add shortcut map, implementation, and help dialog.
11. FO-0211 / FO-0212 / FO-0213 / FO-0214 — Standardize pane states and status bar.
12. FO-0226 / FO-0227 / FO-0228 / FO-0229 — Polish file table and context menus.
13. FO-0230 / FO-0231 / FO-0232 — Improve diagnostics and logs.
14. FO-0233 through FO-0237 — Complete test coverage.
15. FO-0238 through FO-0240 — Update documentation and release notes.

# Sprint 5 Definition of Done

Sprint 5 is complete when:

- Directory panes no longer remain indefinitely stuck in `Loading`.
- Empty, error, permission-denied, and timeout states are explicit and actionable.
- Diagnostics are removed from the default main layout.
- Toolbar actions are grouped and no longer dominate the pane header.
- User preferences persist across restart.
- Theme, density, view mode, and hidden-file visibility can be changed from settings.
- Keyboard shortcuts exist for core navigation and file operations.
- A shortcut help dialog is available.
- macOS user folders and volumes have been manually QA-tested.
- Visual regression fixtures cover major pane states and dialogs.
- Documentation and release notes are updated.

# Sprint 5 Risks

## Risk 1 — Pane loading bugs may originate in backend provider behavior

Mitigation: add request IDs, structured logging, timeout states, and macOS-specific QA before assuming the issue is only frontend state management.

## Risk 2 — Toolbar redesign may accidentally hide important functionality

Mitigation: define primary and secondary actions explicitly, preserve all existing commands, and add context menus plus shortcuts.

## Risk 3 — Preferences may introduce migration instability

Mitigation: use safe defaults, explicit schema migration tests, and rejection of invalid preference values.

## Risk 4 — Keyboard shortcuts may conflict with WebView/browser defaults

Mitigation: define platform-specific shortcut behavior and test suppression inside text inputs.

## Risk 5 — Visual customization can become unbounded

Mitigation: limit Sprint 5 to theme mode, density, view mode, hidden-file visibility, and layout persistence. Avoid arbitrary CSS/font customization in this sprint unless already implemented.

# Sprint 6 Preview

Sprint 6 should be selected based on Sprint 5 results. Likely candidates:

- Performance optimization for large directories.
- Advanced search and filtering.
- File preview panel.
- Operation queue UX improvements.
- Archive operations.
- Plugin/provider foundation.
- Cross-platform packaging and signing hardening.
