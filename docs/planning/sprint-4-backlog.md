# FileOctopus Sprint 4 — Baseline File Manager Completeness Backlog

## Sprint purpose

Sprint 4 closes the gap between a working file-operation application and a complete minimum file manager. Earlier sprints establish architecture, local navigation, safe file operations, job execution, conflict handling, and current visual customization/theme work. Sprint 4 focuses on the standard features users expect before trusting the application as their daily file manager.

This sprint should be treated as **MVP hardening**, not as optional polish.

## Sprint goal

By the end of Sprint 4, FileOctopus should support the baseline interaction model of a normal desktop file manager:

- open files with the OS default application
- navigate using sidebar, breadcrumb, path entry, back/forward/up
- list files with complete columns and stable sorting
- support predictable selection, clipboard, context menus, and keyboard shortcuts
- show properties and metadata
- handle hidden/system files
- refresh automatically when folders change
- provide current-folder search/filter
- apply visual customization consistently across the full file-manager shell
- expose useful, non-technical errors for common filesystem failures

## Sprint assumptions

- Sprint 0/1 foundation and local navigation shell exist.
- Sprint 2 safe local operations exist or are in progress: copy, move, rename, create folder, trash, jobs, progress, cancellation, conflict handling, and operation history.
- Sprint 3 visual customization/theme work is considered implemented in the current state.
- Sprint 4 does not replace Sprint 3; it validates that theme/customization behavior applies consistently to all missing baseline surfaces introduced here.
- Issue IDs use `FO-S4-*` to avoid collision with prior sprint issue numbering.

## Out of scope for Sprint 4

These are useful but should not block Sprint 4 completion:

- tabs
- dual-pane mode
- file previews
- archive browsing
- remote/cloud providers
- plugin architecture
- custom theme import/export
- icon pack marketplace
- advanced recursive indexed search
- git-aware decorations
- bulk rename templates

> **Note (2026-05-30):** Many of these items have since been implemented on `main`. See [PROJECT_STATUS_AND_DOC_ALIGNMENT.md](PROJECT_STATUS_AND_DOC_ALIGNMENT.md) for current status.

---

# Epic A — OS integration and file opening

## FO-S4-001 — Add backend command to open file with OS default application

**Milestone:** Sprint 4  
**Labels:** backend, tauri, os-integration, mvp-baseline  
**Estimate:** 3 points

### Description

Implement a secure backend IPC command that opens a file using the operating system's default associated application.

### Tasks

- Add `open_path_with_default_app(path)` command.
- Validate that the path exists before opening.
- Reject unsupported virtual/provider paths until provider-specific opening is implemented.
- Normalize path handling for Windows, macOS, and Linux.
- Return structured errors for missing file, permission denied, no default handler, and OS launch failure.

### Acceptance criteria

- Double-clicking a normal file can call this command successfully.
- The command does not expose arbitrary shell execution.
- Missing files return a friendly structured error.
- Backend unit tests cover success and common error cases.

### Dependencies

- Existing IPC error taxonomy.
- Existing local filesystem provider.

---

## FO-S4-002 — Open folders internally and files externally from the file list

**Milestone:** Sprint 4  
**Labels:** frontend, navigation, os-integration, mvp-baseline  
**Estimate:** 3 points

### Description

Wire double-click and Enter behavior so folders navigate inside FileOctopus while files open through the OS default application.

### Tasks

- Add double-click behavior for file-list rows/items.
- Add Enter key behavior for selected item.
- Route directories to internal navigation.
- Route files to `open_path_with_default_app`.
- Show non-blocking error toast/dialog when opening fails.

### Acceptance criteria

- Double-click folder navigates into folder.
- Double-click file opens external default application.
- Enter behaves the same for a selected item.
- Failed open action does not crash the app.

### Dependencies

- FO-S4-001.

---

## FO-S4-003 — Add “Open containing folder” and “Reveal in file manager” support

**Milestone:** Sprint 4  
**Labels:** frontend, backend, os-integration, context-menu  
**Estimate:** 2 points

### Description

Support revealing an item in its parent folder from search results, operation history, errors, and properties dialogs.

### Tasks

- Add backend command to reveal a path in the native file manager where supported.
- Fall back to internal navigation to parent folder and select item.
- Add frontend action surface.
- Handle missing parent folders gracefully.

### Acceptance criteria

- User can reveal an item from properties.
- User can reveal an item from search/filter results where applicable.
- If native reveal is unavailable, FileOctopus navigates internally to the parent folder.

### Dependencies

- Navigation state model.

---

# Epic B — Navigation baseline

## FO-S4-004 — Implement sidebar standard locations

**Milestone:** Sprint 4  
**Labels:** frontend, backend, navigation, sidebar, mvp-baseline  
**Estimate:** 5 points

### Description

Add a sidebar with common user locations and platform roots so users do not need to type paths manually.

### Tasks

- Detect Home, Desktop, Documents, Downloads, Pictures, Music, Videos where available.
- Detect filesystem roots/drives/mounted volumes.
- Add sidebar section grouping: Favorites, User folders, Devices/Volumes.
- Gracefully hide unavailable standard folders.
- Persist sidebar collapsed/expanded state if settings layer already exists.

### Acceptance criteria

- Sidebar shows Home and available standard user folders.
- Windows drive letters are visible on Windows.
- Linux/macOS mounted/root volumes are visible where available.
- Clicking a sidebar item navigates the main file list.
- Missing locations do not produce broken sidebar entries.

### Dependencies

- Local provider path discovery.
- Existing settings/theme system for visual integration.

---

## FO-S4-005 — Add back, forward, and up navigation stack

**Milestone:** Sprint 4  
**Labels:** frontend, navigation, mvp-baseline  
**Estimate:** 3 points

### Description

Implement browser-like navigation controls for folder history.

### Tasks

- Add back stack and forward stack to navigation state.
- Add toolbar buttons for Back, Forward, and Up.
- Disable controls when unavailable.
- Preserve current selection where reasonable.
- Avoid duplicate stack entries when refreshing current folder.

### Acceptance criteria

- Back returns to previous folder.
- Forward returns after Back.
- Up navigates to parent folder.
- Root folders disable Up.
- Navigation does not corrupt current path state.

### Dependencies

- Existing folder navigation implementation.

---

## FO-S4-006 — Add clickable breadcrumb path bar

**Milestone:** Sprint 4  
**Labels:** frontend, navigation, pathbar, mvp-baseline  
**Estimate:** 5 points

### Description

Add a breadcrumb path bar that allows users to jump to any parent segment of the current path.

### Tasks

- Render platform-aware breadcrumb segments.
- Allow clicking parent segments.
- Handle root, drive, UNC/network-like paths where supported.
- Integrate with back/forward navigation stack.
- Add truncation behavior for very long paths.

### Acceptance criteria

- Breadcrumb reflects current folder.
- Clicking a parent segment navigates to that folder.
- Long paths remain usable without breaking layout.
- Breadcrumb styling follows current theme and density settings.

### Dependencies

- FO-S4-005.

---

## FO-S4-007 — Add editable raw path mode

**Milestone:** Sprint 4  
**Labels:** frontend, navigation, pathbar, keyboard  
**Estimate:** 3 points

### Description

Allow users to switch from breadcrumb mode to editable path entry, navigate by typing/pasting a path, and copy the current path.

### Tasks

- Add Ctrl/Cmd+L shortcut to focus path entry.
- Support clicking breadcrumb empty area or command to edit path.
- Validate typed path on Enter.
- Show friendly error for invalid/missing/inaccessible path.
- Add copy current path action.

### Acceptance criteria

- User can paste a valid path and navigate to it.
- Invalid path shows an error without losing current folder.
- Ctrl/Cmd+L focuses/selects the path text.
- Escape exits edit mode without navigating.

### Dependencies

- FO-S4-006.

---

# Epic C — File list, columns, and view controls

## FO-S4-008 — Complete details-view columns

**Milestone:** Sprint 4  
**Labels:** frontend, file-list, mvp-baseline  
**Estimate:** 3 points

### Description

Ensure the file list exposes the minimum details-view columns expected from a desktop file manager.

### Tasks

- Add Name column.
- Add Size column with folder-aware display.
- Add Type/Extension column.
- Add Modified Date column.
- Add Created Date where supported or reserve for properties only if provider support is inconsistent.
- Add column width handling and truncation.

### Acceptance criteria

- Details view shows name, size, type/extension, and modified date.
- Folder rows display folder type clearly.
- Missing metadata does not break rendering.
- Columns remain readable in compact and comfortable density modes.

### Dependencies

- Existing file listing metadata.

---

## FO-S4-009 — Implement stable sorting by name, type, size, and modified date

**Milestone:** Sprint 4  
**Labels:** frontend, file-list, sorting, mvp-baseline  
**Estimate:** 5 points

### Description

Add predictable sorting for core columns with ascending/descending toggle behavior.

### Tasks

- Sort by name using natural/case-insensitive comparison where appropriate.
- Sort by type/extension.
- Sort by size.
- Sort by modified date.
- Keep folders grouped before files unless user preference says otherwise.
- Persist selected sort mode if settings persistence exists.

### Acceptance criteria

- Clicking a column header sorts by that column.
- Clicking the same header toggles ascending/descending.
- Sort is stable and deterministic.
- Folders remain grouped consistently.
- Sorting large folders does not visibly freeze the UI.

### Dependencies

- FO-S4-008.

---

## FO-S4-010 — Add view mode controls: details, list, icons

**Milestone:** Sprint 4  
**Labels:** frontend, file-list, visual-customization, mvp-baseline  
**Estimate:** 5 points

### Description

Expose standard file-manager view modes and apply existing visual customization settings to each mode.

### Tasks

- Add Details view.
- Add List view.
- Add Icons/Grid view.
- Connect icon size preference to icon/grid rendering.
- Connect density preference to row height/list spacing.
- Persist default view mode if settings layer exists.

### Acceptance criteria

- User can switch between details, list, and icon views.
- View mode changes do not change current folder.
- Selection state remains valid across view changes.
- Theme, font size, density, and icon size settings apply consistently.

### Dependencies

- Existing Sprint 3 appearance/theme settings.
- FO-S4-008.

---

## FO-S4-011 — Add status bar with folder and selection summary

**Milestone:** Sprint 4  
**Labels:** frontend, status-bar, selection, mvp-baseline  
**Estimate:** 2 points

### Description

Add a status bar that communicates current folder item count and selected item count/size.

### Tasks

- Display total item count for current folder.
- Display selected item count.
- Display aggregate selected size when available.
- Display current operation/job summary if useful.
- Respect compact density mode.

### Acceptance criteria

- Status bar updates when folder contents change.
- Status bar updates when selection changes.
- Empty folder and no-selection states are clear.
- Text remains readable in light and dark themes.

### Dependencies

- Selection model.

---

# Epic D — Selection and clipboard behavior

## FO-S4-012 — Harden single, multi, and range selection model

**Milestone:** Sprint 4  
**Labels:** frontend, selection, mvp-baseline  
**Estimate:** 5 points

### Description

Implement a predictable selection model across all file-list view modes.

### Tasks

- Support click selection.
- Support Ctrl/Cmd multi-select.
- Support Shift range-select.
- Support Ctrl/Cmd+A select all.
- Preserve anchor item for range selection.
- Handle selection after refresh, rename, delete, and navigation.

### Acceptance criteria

- Selection behavior matches desktop conventions.
- Multi-select works in details, list, and icon views.
- Selection clears appropriately when navigating to another folder.
- Selection is not corrupted by sorting changes.

### Dependencies

- Existing file list component.

---

## FO-S4-013 — Implement internal clipboard model for copy/cut/paste

**Milestone:** Sprint 4  
**Labels:** frontend, backend, clipboard, file-operations  
**Estimate:** 5 points

### Description

Add a file-operation clipboard model that supports copying and cutting selected files/folders before invoking backend copy/move jobs.

### Tasks

- Add clipboard state: operation type, source paths, source provider, timestamp.
- Add Copy action.
- Add Cut action.
- Add Paste action into current folder.
- Disable Paste when invalid.
- Clear or update clipboard after successful move where appropriate.

### Acceptance criteria

- Ctrl/Cmd+C stores selected items for copy.
- Ctrl/Cmd+X stores selected items for move.
- Ctrl/Cmd+V starts copy/move job into current folder.
- Paste integrates with existing conflict handling.
- Paste into same folder behaves safely and predictably.

### Dependencies

- Sprint 2 copy/move job engine.
- FO-S4-012.

---

## FO-S4-014 — Add Copy Path and Copy Name actions

**Milestone:** Sprint 4  
**Labels:** frontend, clipboard, context-menu, productivity  
**Estimate:** 2 points

### Description

Allow users to copy file/folder paths and names as text to the system clipboard.

### Tasks

- Add Copy Path action for selected item(s).
- Add Copy Name action for selected item(s).
- Use newline separation for multiple items.
- Handle platform path separators correctly.

### Acceptance criteria

- Copy Path writes full path text to the OS clipboard.
- Copy Name writes basename text to the OS clipboard.
- Multiple selected items produce predictable newline-delimited output.

### Dependencies

- FO-S4-012.

---

# Epic E — Context menus and keyboard shortcuts

## FO-S4-015 — Add file/folder context menu

**Milestone:** Sprint 4  
**Labels:** frontend, context-menu, mvp-baseline  
**Estimate:** 5 points

### Description

Add right-click context menu actions for selected files and folders.

### Tasks

- Open.
- Rename.
- Copy.
- Cut.
- Paste when valid.
- Move to Trash.
- Delete permanently only if explicitly enabled/confirmed.
- Copy Path.
- Properties.
- Reveal/Open containing folder.

### Acceptance criteria

- Right-clicking selected item opens context menu for selection.
- Right-clicking unselected item selects it and opens context menu.
- Disabled actions are visibly disabled.
- Dangerous actions require confirmation.
- Context menu follows theme and density settings.

### Dependencies

- FO-S4-001, FO-S4-013, FO-S4-014.

---

## FO-S4-016 — Add empty-space context menu

**Milestone:** Sprint 4  
**Labels:** frontend, context-menu, file-operations, mvp-baseline  
**Estimate:** 3 points

### Description

Add context menu actions for the current folder background.

### Tasks

- Paste.
- New Folder.
- New File.
- Refresh.
- Select All.
- Folder Properties.
- View mode selection.
- Sort options.

### Acceptance criteria

- Right-clicking empty file-list space opens folder context menu.
- Paste is enabled only when clipboard target is valid.
- New Folder and New File use current folder as target.
- View and sort changes are immediately reflected.

### Dependencies

- FO-S4-013, FO-S4-020.

---

## FO-S4-017 — Implement baseline keyboard shortcuts

**Milestone:** Sprint 4  
**Labels:** frontend, keyboard, accessibility, mvp-baseline  
**Estimate:** 5 points

### Description

Add standard file-manager keyboard shortcuts.

### Required shortcuts

| Shortcut           | Action                                        |
| ------------------ | --------------------------------------------- |
| Enter              | Open selected item                            |
| F2                 | Rename selected item                          |
| Delete             | Move selected item(s) to trash                |
| Shift+Delete       | Permanently delete with explicit confirmation |
| Ctrl/Cmd+C         | Copy selected item(s)                         |
| Ctrl/Cmd+X         | Cut selected item(s)                          |
| Ctrl/Cmd+V         | Paste into current folder                     |
| Ctrl/Cmd+A         | Select all                                    |
| Backspace / Alt+Up | Go to parent folder                           |
| Alt+Left           | Back                                          |
| Alt+Right          | Forward                                       |
| F5 / Ctrl/Cmd+R    | Refresh                                       |
| Ctrl/Cmd+L         | Focus path bar                                |

### Acceptance criteria

- Shortcuts work consistently when file list has focus.
- Shortcuts do not interfere with text input fields.
- Dangerous shortcuts require confirmation.
- macOS Command key behavior is respected.

### Dependencies

- FO-S4-005, FO-S4-007, FO-S4-013, FO-S4-015.

---

# Epic F — File/folder creation and metadata

## FO-S4-018 — Add create empty file operation

**Milestone:** Sprint 4  
**Labels:** backend, frontend, file-operations, mvp-baseline  
**Estimate:** 3 points

### Description

Add a standard “New File” operation for creating an empty file in the current folder.

### Tasks

- Add backend command `create_file(path)` or job-backed equivalent.
- Validate name and target folder.
- Prevent accidental overwrite unless explicitly confirmed.
- Add frontend menu/toolbar/context-menu action.
- Add inline naming workflow or dialog.

### Acceptance criteria

- User can create a new empty file in current folder.
- Name collisions are handled safely.
- Invalid names show clear validation errors.
- File list refreshes/selects new file after creation.

### Dependencies

- Existing create folder operation.
- Existing error taxonomy.

---

## FO-S4-019 — Add properties dialog for files and folders

**Milestone:** Sprint 4  
**Labels:** frontend, backend, metadata, mvp-baseline  
**Estimate:** 5 points

### Description

Add a properties dialog that exposes essential file/folder metadata.

### Tasks

- Show name.
- Show full path.
- Show item type.
- Show size.
- Show folder item count where feasible.
- Show created/modified/accessed timestamps where supported.
- Show read-only/permission summary.
- Show hidden/system flags where supported.
- Add Copy Path action.
- Add Reveal/Open containing folder action.

### Acceptance criteria

- Properties can be opened from context menu and shortcut/menu action.
- File properties show correct size and timestamps.
- Folder properties show size/item count or clearly indicate calculation status.
- Missing metadata is displayed gracefully.
- Dialog follows theme, density, and font size settings.

### Dependencies

- Metadata provider APIs.
- FO-S4-003.

---

## FO-S4-020 — Add folder size calculation job for properties and status bar

**Milestone:** Sprint 4  
**Labels:** backend, jobs, metadata, performance  
**Estimate:** 5 points

### Description

Add cancellable folder size calculation using the existing job engine so folder properties do not block the UI.

### Tasks

- Add job type for folder size/count calculation.
- Emit progress events.
- Support cancellation.
- Handle permission denied and symlink loops safely.
- Return partial results with warning status when traversal is incomplete.

### Acceptance criteria

- Opening folder properties does not freeze the UI.
- Large folder calculation can be cancelled.
- Permission errors are summarized without failing the entire operation.
- Symlink cycles do not cause infinite traversal.

### Dependencies

- Existing job engine.
- FO-S4-019.

---

# Epic G — Hidden/system files and visual consistency

## FO-S4-021 — Implement hidden/system files toggle

**Milestone:** Sprint 4  
**Labels:** frontend, backend, settings, mvp-baseline  
**Estimate:** 3 points

### Description

Add a setting and UI control to show or hide hidden/system files.

### Tasks

- Detect dotfiles on Linux/macOS.
- Detect hidden/system attributes on Windows where available.
- Add show/hide hidden files command or frontend filter.
- Persist preference.
- Add keyboard/menu toggle if desired.

### Acceptance criteria

- Hidden files are hidden by default unless user setting says otherwise.
- User can toggle hidden files without restarting the app.
- Preference persists across launches.
- Current folder refreshes immediately after toggle.

### Dependencies

- Settings persistence.
- Local provider metadata support.

---

## FO-S4-022 — Apply Sprint 3 themes/customization to all Sprint 4 surfaces

**Milestone:** Sprint 4  
**Labels:** frontend, visual-customization, theme, accessibility  
**Estimate:** 5 points

### Description

Ensure visual customization implemented in Sprint 3 applies consistently to every new Sprint 4 UI surface.

### Surfaces to validate

- sidebar
- breadcrumb/path bar
- details/list/icon views
- status bar
- context menus
- properties dialog
- search/filter bar
- error dialogs/toasts
- confirmation dialogs
- keyboard focus states

### Acceptance criteria

- Light, dark, and system themes apply to all new surfaces.
- Font size setting applies to all relevant text.
- Density setting affects row height, menus, and dialogs predictably.
- Icon size setting affects file-list icons and view modes.
- No hardcoded colors bypass the theme token system.
- Focus states remain visible in light and dark mode.

### Dependencies

- Sprint 3 appearance system.
- Sprint 4 UI surfaces.

---

## FO-S4-023 — Add baseline accessibility pass for keyboard and contrast

**Milestone:** Sprint 4  
**Labels:** frontend, accessibility, qa, mvp-baseline  
**Estimate:** 5 points

### Description

Perform a baseline accessibility pass focused on keyboard usability, visible focus, and contrast.

### Tasks

- Ensure all primary actions are keyboard reachable.
- Ensure focus states are visible.
- Add labels/roles for interactive controls.
- Verify contrast in light/dark themes.
- Verify modals trap and restore focus correctly.
- Verify context menus are keyboard accessible where feasible.

### Acceptance criteria

- Core workflows can be completed without mouse.
- Focus order is logical.
- Dialogs restore focus when closed.
- Visual customization does not create unreadable states.

### Dependencies

- FO-S4-017, FO-S4-022.

---

# Epic H — Refresh, filesystem watcher, and stale state handling

## FO-S4-024 — Add manual refresh behavior

**Milestone:** Sprint 4  
**Labels:** frontend, backend, navigation, mvp-baseline  
**Estimate:** 2 points

### Description

Add explicit refresh action for the current folder.

### Tasks

- Add Refresh toolbar/menu/context-menu action.
- Add F5 and Ctrl/Cmd+R shortcut integration.
- Reload current folder contents.
- Preserve selection where possible.
- Handle current folder disappearing.

### Acceptance criteria

- Refresh updates current folder listing.
- Refresh does not add a new navigation history entry.
- If current folder no longer exists, user receives clear recovery options.

### Dependencies

- Existing folder listing command.

---

## FO-S4-025 — Add filesystem watcher for current folder

**Milestone:** Sprint 4  
**Labels:** backend, frontend, watcher, mvp-baseline  
**Estimate:** 8 points

### Description

Automatically update the visible folder when files are created, renamed, deleted, or modified externally.

### Tasks

- Add backend watcher abstraction for current local folder.
- Emit debounced change events to frontend.
- Refresh affected listing rows or reload folder when necessary.
- Stop watcher when navigating away.
- Handle watcher errors and unsupported platforms gracefully.

### Acceptance criteria

- External file creation appears in current folder without manual refresh.
- External deletion disappears from current folder.
- Rapid changes are debounced.
- Watcher is cleaned up on navigation.
- Unsupported watcher cases fall back to manual refresh.

### Dependencies

- Existing IPC event system.
- Local provider.

---

## FO-S4-026 — Handle stale paths and deleted current folder gracefully

**Milestone:** Sprint 4  
**Labels:** frontend, backend, error-handling, mvp-baseline  
**Estimate:** 3 points

### Description

Define behavior when the selected item, current folder, or operation target disappears because of external changes.

### Tasks

- Detect current folder no longer exists.
- Detect selected item no longer exists before action.
- Offer navigation to nearest existing parent when possible.
- Clear invalid selection safely.
- Add user-friendly errors.

### Acceptance criteria

- Deleted current folder does not crash the app.
- Actions on deleted selected items produce clear errors.
- User can recover by navigating to parent/home.

### Dependencies

- FO-S4-024, FO-S4-025.

---

# Epic I — Search and filtering

## FO-S4-027 — Add current-folder filter bar

**Milestone:** Sprint 4  
**Labels:** frontend, search, filtering, mvp-baseline  
**Estimate:** 3 points

### Description

Add a fast current-folder filter that narrows visible items without recursive filesystem traversal.

### Tasks

- Add filter input in toolbar or file-list header.
- Filter by name and extension.
- Highlight or otherwise show active filter state.
- Keep sorting applied after filtering.
- Clear filter on navigation or persist per folder only if intentionally designed.

### Acceptance criteria

- Typing filters current visible folder immediately.
- Filtering does not mutate folder contents or selection incorrectly.
- Empty result state is clear.
- Filter works in details, list, and icon views.

### Dependencies

- File list state model.

---

## FO-S4-028 — Add non-indexed recursive search MVP

**Milestone:** Sprint 4  
**Labels:** backend, frontend, search, jobs  
**Estimate:** 8 points

### Description

Add a basic cancellable recursive search for the current folder using the job engine. This is not a full indexed search engine.

### Tasks

- Add search job for current subtree.
- Search by filename substring/pattern.
- Emit incremental results.
- Support cancellation.
- Handle permission denied gracefully.
- Add result row actions: open, reveal, properties.

### Acceptance criteria

- User can search recursively from current folder.
- Results stream in without blocking UI.
- Search can be cancelled.
- Permission errors are summarized.
- Search results support open/reveal/properties.

### Dependencies

- Existing job engine.
- FO-S4-001, FO-S4-003, FO-S4-019.

---

# Epic J — Error UX and confirmations

## FO-S4-029 — Standardize filesystem error presentation

**Milestone:** Sprint 4  
**Labels:** frontend, backend, error-handling, mvp-baseline  
**Estimate:** 5 points

### Description

Map backend filesystem errors to consistent user-facing messages and recovery actions.

### Error cases

- permission denied
- file not found
- folder not found
- name collision
- disk full
- path too long
- invalid filename
- read-only filesystem
- operation cancelled
- no default app
- external application launch failure

### Acceptance criteria

- Common filesystem errors produce understandable messages.
- Error dialogs/toasts include useful recovery action where possible.
- Technical details are available in expandable diagnostics.
- Error UI follows theme and accessibility rules.

### Dependencies

- Existing error taxonomy.

---

## FO-S4-030 — Add destructive action confirmation policy

**Milestone:** Sprint 4  
**Labels:** frontend, safety, delete, mvp-baseline  
**Estimate:** 3 points

### Description

Define consistent confirmation behavior for destructive operations.

### Tasks

- Confirm permanent delete.
- Confirm deleting multiple items.
- Confirm deleting folders with contents where appropriate.
- Keep move-to-trash less intrusive but still clear.
- Add clear labels that distinguish Trash from permanent delete.

### Acceptance criteria

- Permanent delete is never one accidental keypress.
- Trash and permanent delete are visually and textually distinct.
- Confirmation dialogs list the affected item count.
- Dialogs are keyboard accessible.

### Dependencies

- Sprint 2 trash/delete operations.
- FO-S4-017.

---

# Epic K — Cross-platform behavior

## FO-S4-031 — Normalize path behavior across Windows, Linux, and macOS

**Milestone:** Sprint 4  
**Labels:** backend, frontend, cross-platform, mvp-baseline  
**Estimate:** 5 points

### Description

Validate core navigation, display, and path-entry behavior across supported desktop operating systems.

### Tasks

- Verify Windows drive roots.
- Verify Linux root and mounted volumes.
- Verify macOS home and mounted volumes.
- Verify path separators in UI and clipboard actions.
- Verify invalid filename handling per platform.
- Verify case sensitivity behavior is not incorrectly assumed.

### Acceptance criteria

- Manual path entry works for platform-native paths.
- Breadcrumb renders roots correctly.
- Copy Path uses native path format.
- Invalid names are rejected with platform-appropriate messaging.

### Dependencies

- FO-S4-004, FO-S4-006, FO-S4-007, FO-S4-014.

---

## FO-S4-032 — Add baseline icon and file-type mapping

**Milestone:** Sprint 4  
**Labels:** frontend, icons, file-list, visual-customization  
**Estimate:** 3 points

### Description

Provide recognizable icons for common file/folder types without depending on advanced icon-pack support.

### Tasks

- Add folder icon.
- Add generic file icon.
- Add common types: image, video, audio, archive, document, code, executable, symlink/shortcut if supported.
- Respect icon size setting.
- Ensure icons are legible in light and dark themes.

### Acceptance criteria

- Common file types have recognizable icons.
- Unknown files use generic icon.
- Folder icon is distinct from file icon.
- Icons scale according to icon size setting.

### Dependencies

- Sprint 3 visual customization settings.
- FO-S4-010.

---

# Epic L — Testing and QA

## FO-S4-033 — Add backend tests for baseline commands

**Milestone:** Sprint 4  
**Labels:** backend, tests, qa  
**Estimate:** 5 points

### Description

Add backend test coverage for new commands and baseline filesystem behavior.

### Test coverage

- open path validation
- reveal/open containing folder fallback behavior
- create empty file
- metadata/properties retrieval
- hidden/system detection where testable
- folder size job cancellation
- watcher setup/teardown where testable
- recursive search cancellation
- structured filesystem errors

### Acceptance criteria

- Backend tests run in CI.
- Tests avoid destructive behavior outside temporary directories.
- Platform-specific tests are gated appropriately.

### Dependencies

- Relevant backend issues in Sprint 4.

---

## FO-S4-034 — Add frontend tests for baseline UI behavior

**Milestone:** Sprint 4  
**Labels:** frontend, tests, qa  
**Estimate:** 5 points

### Description

Add frontend coverage for core file-manager interactions.

### Test coverage

- navigation controls
- breadcrumb/path entry
- sorting
- selection model
- context menu availability
- keyboard shortcuts
- filter bar
- properties dialog rendering
- destructive confirmation dialogs
- theme/density/font-size application to Sprint 4 surfaces

### Acceptance criteria

- Frontend tests cover primary baseline workflows.
- Keyboard shortcut tests verify focus-sensitive behavior.
- Theme/customization tests prevent hardcoded visual regressions.

### Dependencies

- Relevant frontend issues in Sprint 4.

---

## FO-S4-035 — Create Sprint 4 manual QA script

**Milestone:** Sprint 4  
**Labels:** qa, documentation, release-readiness  
**Estimate:** 3 points

### Description

Create a manual QA script that validates FileOctopus against the baseline desktop file-manager contract.

### QA sections

- navigation
- sidebar and mounted volumes
- breadcrumb and path entry
- file opening
- sorting and view modes
- selection and clipboard
- context menus
- keyboard shortcuts
- create file/folder
- rename/copy/move/trash/delete
- properties
- hidden files
- refresh and external changes
- search/filter
- visual customization across all surfaces
- accessibility smoke test
- common error cases

### Acceptance criteria

- QA script is committed to repository docs.
- QA script includes Windows, Linux, and macOS notes.
- QA script includes pass/fail checklist.
- QA script identifies blockers vs minor defects.

### Dependencies

- Most Sprint 4 implementation issues.

---

## FO-S4-036 — Update MVP documentation and definition of done

**Milestone:** Sprint 4  
**Labels:** documentation, product, release-readiness  
**Estimate:** 3 points

### Description

Update project documentation so the MVP baseline explicitly includes the standard file-manager feature set added in Sprint 4.

### Tasks

- Add “MVP Core File Manager Baseline” section.
- Update sprint roadmap.
- Update MVP acceptance criteria.
- Update known exclusions.
- Add visual customization baseline expectations.
- Link QA script.

### Acceptance criteria

- Documentation no longer describes MVP as only navigation plus operations.
- Baseline file-manager features are explicit and testable.
- Sprint 4 completion criteria are reflected in MVP definition of done.

### Dependencies

- FO-S4-035.

---

# Recommended implementation order

1. FO-S4-001 — Open file with default app backend
2. FO-S4-004 — Sidebar standard locations
3. FO-S4-005 — Back/forward/up navigation
4. FO-S4-006 — Breadcrumb path bar
5. FO-S4-007 — Editable path mode
6. FO-S4-008 — Details-view columns
7. FO-S4-009 — Stable sorting
8. FO-S4-012 — Selection model
9. FO-S4-013 — Clipboard model
10. FO-S4-015 — File/folder context menu
11. FO-S4-016 — Empty-space context menu
12. FO-S4-017 — Keyboard shortcuts
13. FO-S4-018 — Create empty file
14. FO-S4-019 — Properties dialog
15. FO-S4-020 — Folder size calculation job
16. FO-S4-021 — Hidden/system files toggle
17. FO-S4-024 — Manual refresh
18. FO-S4-025 — Filesystem watcher
19. FO-S4-027 — Current-folder filter
20. FO-S4-028 — Recursive search MVP
21. FO-S4-022 — Theme/customization coverage
22. FO-S4-023 — Accessibility pass
23. FO-S4-029 — Error presentation
24. FO-S4-030 — Destructive confirmation policy
25. FO-S4-031 — Cross-platform path normalization
26. FO-S4-032 — Icon/file-type mapping
27. FO-S4-033 — Backend tests
28. FO-S4-034 — Frontend tests
29. FO-S4-035 — Manual QA script
30. FO-S4-036 — MVP documentation update

## Sprint 4 definition of done

Sprint 4 is done when:

- Users can navigate through standard locations without typing paths.
- Users can open files and folders using expected desktop behaviors.
- Users can sort, select, copy, cut, paste, rename, create, trash, and inspect items using mouse and keyboard.
- Context menus exist for items and empty folder space.
- Current-folder filtering and basic recursive search exist.
- Hidden/system files can be toggled.
- Current folder updates through manual refresh and filesystem watcher events.
- Properties dialog exposes useful metadata.
- Visual customization from Sprint 3 applies consistently to all Sprint 4 UI surfaces.
- Common filesystem errors are understandable to non-developers.
- Core workflows are keyboard accessible.
- Backend and frontend tests cover the new baseline features.
- Manual QA checklist passes on at least one primary development OS, with cross-platform test notes captured for the others.

## Sprint 4 risk register

| Risk                                                                          | Impact | Mitigation                                                                     |
| ----------------------------------------------------------------------------- | -----: | ------------------------------------------------------------------------------ |
| Filesystem watcher behavior differs across platforms                          |   High | Use abstraction, debounce events, and fall back to manual refresh              |
| Opening external files can become unsafe if implemented through shell strings |   High | Use safe OS APIs/Tauri shell plugin patterns; never concatenate shell commands |
| Recursive search can freeze UI on large folders                               |   High | Make search job-based, incremental, and cancellable                            |
| Folder size calculation can be expensive                                      | Medium | Use cancellable job and partial results                                        |
| Selection model becomes inconsistent across view modes                        | Medium | Centralize selection state; test across details/list/icon views                |
| Theme work regresses when new surfaces are added                              | Medium | Enforce design tokens and add visual/theme tests                               |
| Platform-specific paths produce edge cases                                    | Medium | Add platform-gated tests and manual QA notes                                   |

## Product note

After Sprint 4, FileOctopus should feel like a legitimate minimum desktop file manager rather than a technical file-operation prototype. Advanced productivity features can follow later, but Sprint 4 is the point where the application becomes baseline-complete.
