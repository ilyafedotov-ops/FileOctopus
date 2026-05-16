# FileOctopus UI Design Specification

## Purpose

This document defines the target interface direction for FileOctopus after Sprint 5: a polished, dual-pane, cross-platform file manager with a clean visual hierarchy, safe file operations, progress visibility, and user-customizable appearance.

**Implementation status (2026-05-16):** Most shell regions (sidebar, dual pane, toolbar, activity panel, status bar, dialogs, preferences) are implemented. Gaps vs this spec include the full application menu bar, embedded terminal, archive compress/extract jobs, Git badges, and some preference sections (Operations/Shortcuts/Advanced as separate tabs). See [planning/PROJECT_STATUS_AND_DOC_ALIGNMENT.md](planning/PROJECT_STATUS_AND_DOC_ALIGNMENT.md).

## Product UI Principles

- **Dual-pane first**: the left and right panes are the core workspace.
- **Visible but not noisy**: primary file operations should be one click away; secondary actions should live in overflow menus or context menus.
- **Safe destructive actions**: delete, trash, overwrite, and move operations require clear confirmation and recoverability where possible.
- **Keyboard-friendly**: all frequent operations should have shortcuts.
- **Cross-platform native feel**: the app should feel comfortable on macOS, Windows, and Linux without copying one platform too literally.
- **Progress transparency**: long-running copy, move, delete, scan, and search jobs must show progress, speed, remaining time, and cancel/pause actions when supported.

## Main Window Layout

Recommended layout:

```text
┌────────────────────────────────────────────────────────────────────┐
│ Title bar / app chrome                                              │
├───────────────┬────────────────────────────────────────┬────────────┤
│ Sidebar       │ Dual-pane workspace                    │ Activity   │
│               │                                        │ Panel      │
│ Favorites     │ ┌────────────────┐ ┌────────────────┐ │ Jobs       │
│ User folders  │ │ Left pane      │ │ Right pane     │ │ History    │
│ Volumes       │ │                │ │                │ │            │
│ Recent        │ │ File table     │ │ File table     │ │            │
├───────────────┴────────────────────────────────────────┴────────────┤
│ Status bar                                                           │
└────────────────────────────────────────────────────────────────────┘
```

## Main Regions

### 1. Title Bar

Contains:

- Window controls where applicable.
- App title: `FileOctopus`.
- Optional sync/health indicator.
- Settings button.
- Optional global command palette button.

Avoid showing diagnostics here unless the app is in a development build.

### 2. Sidebar

Sections:

- Favorites
  - Home
  - Desktop
  - Documents
  - Downloads
  - Pictures
  - Music
- Devices / Volumes
  - Root
  - Mounted disks
  - Network locations
- Recent
  - Today
  - This Week
  - Starred

Behavior:

- Clicking opens the selected location in the active pane.
- Dragging a folder into Favorites adds it as a favorite.
- Context menu allows rename favorite, remove favorite, reveal path.

### 3. Dual-pane Workspace

Each pane should include:

- Pane label: `Left` or `Right`.
- Active pane highlight.
- Navigation controls: Back, Forward, Up.
- Breadcrumb path bar.
- Primary toolbar.
- Filter/search field.
- View mode selector.
- File table or grid.
- Pane-local status line.

The active pane should be visually obvious using a subtle blue outline or accent strip.

### 4. Toolbar

Primary toolbar actions:

- New Folder
- New File
- Rename
- Copy
- Move
- Trash
- Refresh
- More

Secondary actions should move to the overflow menu:

- Copy path
- Copy name
- Properties
- Show hidden toggle
- Open terminal here
- Reveal in system file manager
- Calculate size
- Checksum
- Compress
- Extract

### 5. File Table

Default columns:

- Name
- Size
- Modified
- Type

Optional columns:

- Created
- Permissions
- Owner
- Extension
- Hash

Row behavior:

- Single click selects.
- Double click opens folder or file.
- Enter opens selected item.
- Space opens preview if implemented.
- Right click opens context menu.
- Multi-selection supported with Shift and Ctrl/Cmd.

### 6. Activity Panel

Contains:

- Current jobs
- Recent operations
- Errors / warnings

Each job card should show:

- Operation type
- Source/destination summary
- Progress bar
- Files processed / total files
- Bytes processed / total bytes
- Transfer speed
- ETA
- Pause/cancel controls where supported

The activity panel should be collapsible.

### 7. Status Bar

Displays:

- App readiness state
- Selected items count
- Total entries in active pane
- Total selected size when available
- Current backend/IPC status
- Error indicator

Example:

```text
Ready · 2 selected · 8 items · 82.3 MB selected · No errors
```

## View Modes

Required view modes:

1. **Details**
   - Table layout with sortable columns.
   - Best for power users.

2. **List**
   - Compact vertical list.
   - Good for small windows.

3. **Grid / Icons**
   - Thumbnail-oriented layout.
   - Useful for images and media folders.

4. **Columns**
   - Hierarchical navigation, similar to column browser.
   - Useful for fast folder traversal.

## Dialogs

### Move to Trash Confirmation

Required content:

- Clear title: `Move 3 items to Trash?`
- Explanation that items can be restored where supported.
- List preview of affected items for small selections.
- Checkbox: `Don't ask again for this session`.
- Buttons: `Cancel`, `Move to Trash`.

### Delete Permanently Confirmation

More severe than trash:

- Use destructive styling.
- Require explicit confirmation for multiple items or large folders.
- Never make this the default focused action.

### Conflict Resolution

When destination exists:

- Replace
- Skip
- Keep both
- Compare metadata
- Apply to all conflicts

## Preferences

Sections:

- General
- Appearance
- Files & Folders
- Operations
- Shortcuts
- Advanced

Important settings:

- Theme: System / Light / Dark
- Accent color
- UI density: Comfortable / Compact
- Font size
- Show hidden files by default
- Confirm before delete
- Confirm before overwrite
- Remember last used panes
- Start on system startup
- Diagnostics export location

## Keyboard Shortcuts

Recommended defaults:

| Action            |         macOS | Windows/Linux |
| ----------------- | ------------: | ------------: |
| New Folder        |   Cmd+Shift+N |  Ctrl+Shift+N |
| Copy              |         Cmd+C |        Ctrl+C |
| Cut / Move intent |         Cmd+X |        Ctrl+X |
| Paste             |         Cmd+V |        Ctrl+V |
| Rename            |  Return or F2 |            F2 |
| Delete / Trash    | Cmd+Backspace |        Delete |
| Refresh           |         Cmd+R |            F5 |
| Search            |         Cmd+F |        Ctrl+F |
| Switch Pane       |           Tab |           Tab |
| Show Hidden Files |   Cmd+Shift+. |        Ctrl+H |
| Preferences       |         Cmd+, |        Ctrl+, |

## Visual Style

### Typography

Use system UI fonts by default:

```css
font-family:
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

Recommended scale:

- Window title: 13–14px semibold
- Section labels: 11px uppercase semibold
- File rows: 13px
- Status text: 12px
- Dialog titles: 18–20px semibold

### Color Tokens

Light theme:

```css
--bg-app: #f5f7fb;
--bg-surface: #ffffff;
--bg-muted: #f1f4f9;
--border: #d9e0ec;
--text-primary: #172033;
--text-secondary: #5e6b80;
--accent: #3578ff;
--accent-soft: #e8f0ff;
--danger: #e5484d;
--success: #24a148;
```

Dark theme:

```css
--bg-app: #111827;
--bg-surface: #182235;
--bg-muted: #202b3f;
--border: #314158;
--text-primary: #f4f7fb;
--text-secondary: #aab6ca;
--accent: #6ea8ff;
--accent-soft: #17315d;
--danger: #ff6b6b;
--success: #4ade80;
```

## Implementation Notes for React/Tauri

Recommended component structure:

```text
src/ui/
  AppShell.tsx
  Sidebar.tsx
  Pane.tsx
  PaneToolbar.tsx
  BreadcrumbBar.tsx
  FileTable.tsx
  ActivityPanel.tsx
  StatusBar.tsx
  dialogs/
    ConfirmTrashDialog.tsx
    ConflictResolutionDialog.tsx
    PropertiesDialog.tsx
  preferences/
    PreferencesWindow.tsx
```

Recommended state boundaries:

- Rust backend owns filesystem truth, jobs, and operation safety.
- Frontend owns presentation state, selected rows, active pane, visible columns, sorting, filtering, and theme.
- Persist UI preferences in app config or SQLite depending on final architecture.

## Sprint 5 UX Acceptance Criteria

- Diagnostics panel is no longer permanently visible in the main window.
- The main layout works at common laptop resolutions without toolbar wrapping.
- The active pane is visually clear.
- Loading, empty, error, and permission-denied states are implemented.
- File operations are accessible from toolbar, context menu, and keyboard shortcuts.
- Job progress is visible in a collapsible activity panel.
- Theme, density, view mode, and show-hidden preferences persist across restarts.
- The UI has at least one reference screenshot or SVG mockup committed to the repository.
