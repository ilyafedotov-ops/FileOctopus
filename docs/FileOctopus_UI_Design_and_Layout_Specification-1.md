# FileOctopus UI Design and Layout Specification

**Document status:** Draft for implementation  
**Product:** FileOctopus desktop file manager  
**Target shell:** Tauri v2 desktop application with Rust backend and web frontend  
**Primary audience:** frontend engineers, Rust/Tauri engineers, QA engineers, product/design reviewers, and LLM implementation agents  
**Document purpose:** describe the complete UI design structure, layout architecture, visible application surfaces, component hierarchy, state model, menu/dialog integration, visual system, and acceptance criteria for the FileOctopus application.

---

## 1. Executive Summary

FileOctopus must look and behave like a complete desktop file manager, not like a technical prototype. The main UI must prioritize reliable file navigation, clear active-pane targeting, safe file operations, predictable keyboard workflows, and visible feedback for long-running operations.

The application layout is based on a production desktop shell with:

- a platform-aware top application menu;
- optional custom title/window chrome where supported;
- a left navigation sidebar;
- one-pane or dual-pane file browsing area;
- per-pane toolbar, breadcrumb/path bar, search/filter, and file table;
- bottom status bar;
- non-blocking job activity drawer;
- explicit settings, diagnostics, properties, conflict-resolution, and confirmation dialogs.

The default target layout is a **dual-pane file manager** because the product is intended for efficient file operations. Single-pane mode may exist as a layout preference, but the UI architecture must not assume only one pane.

---

## 2. Design Objectives

### 2.1 Primary objectives

1. Provide a clean, professional, desktop-grade file manager shell.
2. Make common file operations visible but not visually overwhelming.
3. Keep diagnostics and developer information out of the default production layout.
4. Support both mouse and keyboard workflows.
5. Make the active pane obvious at all times.
6. Apply theme, density, font, and view preferences consistently across every UI surface.
7. Surface filesystem errors as useful user-facing states, not raw technical dumps.
8. Ensure destructive operations are guarded by confirmation dialogs.
9. Keep long-running operations observable, cancellable, and non-blocking.
10. Build the UI as a clear component hierarchy that maps cleanly to Tauri IPC commands and backend events.

### 2.2 Non-objectives for this specification

The following are not required for the first complete UI layout unless already implemented elsewhere:

- plugin marketplace;
- advanced preview engine;
- cloud provider UI;
- archive browsing UI;
- git-aware decorations;
- bulk rename template designer;
- custom theme import/export marketplace;
- multi-window orchestration beyond basic app window behavior.

The layout must leave extension points for these features but should not reserve large visible UI areas for them by default.

---

## 3. Product UI Principles

### 3.1 File manager first

The main screen must emphasize files, folders, paths, selection, and operations. Debug panels, raw logs, JSON payloads, schema state, and implementation status must not appear in the normal layout.

### 3.2 Active pane owns commands

In dual-pane mode, global menu commands, toolbar commands, keyboard shortcuts, and paste operations target the **active pane** unless the command explicitly targets a selected item in a context menu.

The active pane must be visible through:

- a refined accent border or focus ring;
- active toolbar state;
- status bar text showing the active side;
- keyboard focus position;
- selected row styling scoped to that pane.

### 3.3 Commands must be discoverable

Frequently used commands should be visible in the toolbar. Secondary commands belong in grouped dropdowns, context menus, or top application menus. Hidden commands must remain discoverable via menu bar, shortcut dialog, or context menu.

### 3.4 Every action needs a visible outcome

Each command must do one of the following:

- execute immediately and show feedback;
- open a modal/dialog;
- open a popover/dropdown;
- open a drawer/panel;
- start inline editing;
- change focus to an existing control;
- show a confirmation;
- show a toast/error state.

No command may fail silently.

### 3.5 Dangerous actions are guarded

Permanent delete, overwrite, destructive conflict resolution, clearing history, resetting layout, and closing while jobs are active must require explicit confirmation. The destructive option must not be the default focused button.

### 3.6 The UI adapts without changing the mental model

Theme, density, font size, icon size, visible columns, and layout mode can change, but the command model must remain stable.

---

## 4. High-Level UI Architecture

### 4.1 Shell hierarchy

```text
FileOctopusApp
├─ PlatformMenuBridge
├─ AppWindow
│  ├─ WindowChrome / NativeTitlebarArea
│  ├─ AppCommandBar                          [optional, not a debug toolbar]
│  ├─ MainLayout
│  │  ├─ Sidebar
│  │  ├─ PaneWorkspace
│  │  │  ├─ FilePane[left]
│  │  │  │  ├─ PaneHeader
│  │  │  │  ├─ PaneToolbar
│  │  │  │  ├─ PathBar
│  │  │  │  ├─ PaneFilterBar
│  │  │  │  ├─ FileView
│  │  │  │  └─ PaneLocalStatus
│  │  │  ├─ Splitter
│  │  │  └─ FilePane[right]
│  │  ├─ OptionalPreviewPanel                [future/disabled by default]
│  │  └─ JobActivityDrawer                   [hidden by default]
│  ├─ StatusBar
│  ├─ ToastViewport
│  └─ ModalLayer
│     ├─ SettingsDialog
│     ├─ PropertiesDialog
│     ├─ OperationDialogs
│     ├─ ConflictResolutionDialog
│     ├─ DiagnosticsDialog
│     └─ KeyboardShortcutsDialog
└─ GlobalEventListeners
```

### 4.2 Frontend state areas

```text
UI state
├─ layout preferences
│  ├─ pane mode: single | dual
│  ├─ split ratio
│  ├─ sidebar visibility
│  ├─ job drawer visibility
│  └─ diagnostics visibility
├─ visual preferences
│  ├─ theme: system | light | dark
│  ├─ density: compact | comfortable | spacious
│  ├─ font scale
│  ├─ icon size
│  └─ file view mode
├─ pane state
│  ├─ current path
│  ├─ navigation history
│  ├─ loading/error/empty states
│  ├─ sorting/filtering
│  ├─ selection
│  └─ focused row
├─ clipboard state
│  ├─ operation: copy | cut
│  └─ source items
├─ job state
│  ├─ active jobs
│  ├─ completed jobs
│  ├─ failed jobs
│  └─ operation history
└─ modal state
   ├─ active modal
   ├─ modal payload
   └─ confirmation result
```

### 4.3 Backend integration boundaries

The UI must communicate with the backend through typed Tauri IPC commands and subscribed event streams. The UI should not directly perform filesystem mutations. All file operations must be initiated through the backend job engine or safe backend commands.

Expected command categories:

| Category           | UI surfaces                             | Backend responsibility                                         |
| ------------------ | --------------------------------------- | -------------------------------------------------------------- |
| Directory listing  | Pane load, refresh, navigation          | read folder contents, return structured entries/errors         |
| Navigation support | Sidebar, path bar, breadcrumb           | resolve standard folders, drives, volumes, canonical paths     |
| File opening       | File table, menus, context menus        | open file with OS default app or reveal in system file manager |
| File operations    | Toolbar, menus, dialogs, shortcuts      | copy, move, rename, create folder, create file, trash, delete  |
| Job engine         | Job drawer, status bar, toasts          | progress, cancellation, completion, failure events             |
| Preferences        | Settings dialog, startup initialization | read/write persisted preferences and migrations                |
| Diagnostics        | Help menu, diagnostics dialog           | collect app/backend diagnostics and export bundle              |

---

## 5. Main Window Layout

### 5.1 Default desktop layout

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Native/Menu Bar: File  Edit  View  Go  Tools  Window  Help                  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Optional Window Chrome / App Title Area                                     │
├──────────────┬──────────────────────────────────────────────┬───────────────┤
│              │ LEFT FILE PANE                               │ RIGHT FILE PANE│
│ Sidebar      │ ┌──────────────────────────────────────────┐ │ ┌───────────┐ │
│              │ │ Pane Toolbar                             │ │ │ Toolbar   │ │
│ Favorites    │ ├──────────────────────────────────────────┤ │ ├───────────┤ │
│ User Folders │ │ Breadcrumb / Editable Path               │ │ │ Path      │ │
│ Devices      │ ├──────────────────────────────────────────┤ │ ├───────────┤ │
│ Recent       │ │ Filter/Search row                        │ │ │ Filter    │ │
│              │ ├──────────────────────────────────────────┤ │ ├───────────┤ │
│              │ │ File table / list / grid                 │ │ │ File view │ │
│              │ │                                          │ │ │           │ │
│              │ ├──────────────────────────────────────────┤ │ ├───────────┤ │
│              │ │ Pane local status                        │ │ │ Status    │ │
├──────────────┴──────────────────────────────────────────────┴───────────────┤
│ Global Status Bar: selected items | size | path | jobs | errors             │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Layout regions

| Region                   |               Required | Purpose                             | Visibility                          |
| ------------------------ | ---------------------: | ----------------------------------- | ----------------------------------- |
| Platform menu bar        |                    Yes | Global command discoverability      | Always, platform-specific rendering |
| Window chrome/title area |               Optional | Window drag/title/search affordance | Depends on platform/window mode     |
| Sidebar                  |         Yes by default | Fast navigation to common locations | Toggleable                          |
| Pane workspace           |                    Yes | Main file browsing and operations   | Always                              |
| Splitter                 |      In dual-pane mode | Resize panes                        | Visible when dual-pane enabled      |
| Job drawer               | Yes, hidden by default | Active/completed file operations    | Opens on demand or when job starts  |
| Status bar               |                    Yes | Selection/path/job summary          | Always; compact in small windows    |
| Modal layer              |                    Yes | Blocking workflows                  | On demand                           |
| Toast viewport           |                    Yes | Non-blocking feedback               | On demand                           |

### 5.3 Recommended layout dimensions

| Element            | Compact | Comfortable | Spacious | Notes                                                            |
| ------------------ | ------: | ----------: | -------: | ---------------------------------------------------------------- |
| Sidebar width      |  220 px |      248 px |   280 px | User-resizable later                                             |
| Minimum pane width |  360 px |      420 px |   480 px | Below this, dual-pane should collapse or allow horizontal scroll |
| Toolbar height     |   34 px |       40 px |    48 px | Driven by density tokens                                         |
| Path bar height    |   32 px |       38 px |    44 px | Must support long paths                                          |
| File row height    |   26 px |       32 px |    40 px | Applies to details/list views                                    |
| Status bar height  |   24 px |       28 px |    34 px | Must remain readable                                             |
| Splitter width     |    5 px |        6 px |     8 px | Larger hit target than visual line                               |
| Toast width        |  320 px |      360 px |   420 px | Not modal                                                        |
| Job drawer width   |  380 px |      420 px |   480 px | May be bottom drawer on narrow windows                           |

### 5.4 Responsive behavior

|   Window width | Behavior                                                                           |
| -------------: | ---------------------------------------------------------------------------------- |
|   `>= 1400 px` | Full sidebar + dual pane + optional job drawer overlay/side drawer                 |
| `1100–1399 px` | Full sidebar + dual pane; compact toolbar grouping                                 |
|  `900–1099 px` | Collapsible sidebar; dual pane allowed but secondary metadata columns may compress |
|   `700–899 px` | Single-pane mode recommended; right pane collapses behind layout toggle            |
|     `< 700 px` | Single-pane, sidebar drawer, compact density, minimal toolbar labels               |

FileOctopus is a desktop app, so responsive behavior is for resizable windows rather than mobile-first design.

---

## 6. Platform Menu Bar

### 6.1 Windows/Linux order

```text
File
Edit
View
Go
Tools
Window
Help
```

### 6.2 macOS order

```text
FileOctopus
File
Edit
View
Go
Tools
Window
Help
```

The macOS application menu must contain standard app-level items such as About, Settings, Services, Hide, Show All, and Quit where available.

### 6.3 Menu role in layout architecture

The menu bar is not decorative. It must act as the complete command map for keyboard and accessibility workflows. Every command that appears in toolbars or context menus should have a logical home in the top menu unless it is purely contextual.

Menu commands should target:

- the active pane;
- the clicked item/context target;
- the whole application;
- an explicitly selected job/history item;
- a modal workflow.

---

## 7. Sidebar Design

### 7.1 Sidebar purpose

The sidebar is the main navigation map. It should remove the need to type paths for common workflows.

### 7.2 Sidebar sections

```text
Sidebar
├─ Favorites
│  ├─ Home
│  ├─ Desktop
│  ├─ Documents
│  ├─ Downloads
│  └─ Custom favorites
├─ User Folders
│  ├─ Pictures
│  ├─ Music
│  └─ Videos
├─ Devices / Volumes
│  ├─ Windows drives
│  ├─ macOS volumes
│  ├─ Linux mount points
│  └─ removable devices
├─ Recent Locations
└─ Network / Remote Providers        [future extension]
```

### 7.3 Sidebar item anatomy

Each sidebar item should contain:

- icon;
- label;
- optional path tooltip;
- optional status badge: unavailable, locked, removable, favorite;
- optional eject/unmount affordance for supported devices in the future;
- hover state;
- selected/current-path state;
- context menu.

### 7.4 Sidebar behavior

| Action                      | Expected behavior                                                       |
| --------------------------- | ----------------------------------------------------------------------- |
| Single click item           | Navigate active pane to target path                                     |
| Double click item           | Same as single click; no duplicate navigation                           |
| Right click standard folder | Open sidebar context menu                                               |
| Right click favorite        | Open favorite management context menu                                   |
| Right click device/volume   | Open device context menu                                                |
| Collapse section            | Persist collapsed state if preferences layer is available               |
| Path unavailable            | Show disabled or warning state; do not navigate to broken path silently |

### 7.5 Sidebar visual rules

- Sidebar must not use the same visual weight as the file table.
- Section headings should be small, muted, and uppercase or semibold depending on theme.
- Current folder or nearest parent location should be highlighted.
- Disabled/unavailable entries must remain readable but visually distinct.
- The sidebar must respect density, font scale, theme, and icon size settings.

---

## 8. Pane Workspace

### 8.1 Pane modes

FileOctopus should support the following pane modes:

| Mode                       | Description                       |         Default |
| -------------------------- | --------------------------------- | --------------: |
| Single pane                | One file pane fills the workspace |        Optional |
| Dual pane horizontal split | Left and right panes side by side |             Yes |
| Dual pane vertical split   | Top and bottom panes              | Future/optional |

The default design target is **dual pane side-by-side**.

### 8.2 Pane anatomy

```text
FilePane
├─ PaneHeader
│  ├─ PaneTitle / LocationName
│  ├─ ActivePaneIndicator
│  └─ OptionalPathSummary
├─ PaneToolbar
├─ PathBar
├─ PaneFilterBar
├─ FileView
│  ├─ LoadingState
│  ├─ EmptyState
│  ├─ ErrorState
│  ├─ PermissionDeniedState
│  ├─ DetailsTable
│  ├─ ListView
│  └─ CompactView
└─ PaneLocalStatus
```

### 8.3 Active pane styling

The active pane must have:

- accent-colored top or side indicator;
- visible but non-aggressive focus treatment;
- toolbar state that indicates active command target;
- status bar text identifying it as active when needed;
- keyboard focus ring on the focused row or path control.

The inactive pane may keep its selection visible but less prominent. Selection must not appear to belong to the active pane when it does not.

### 8.4 Splitter behavior

The splitter between panes must:

- support pointer drag;
- expose keyboard resizing later if feasible;
- preserve split ratio in preferences;
- enforce minimum pane widths;
- visually separate panes without excessive borders.

---

## 9. Pane Toolbar Design

### 9.1 Toolbar purpose

The pane toolbar provides high-frequency actions for the active pane. It must not become a dumping ground for every command.

### 9.2 Toolbar groups

```text
Pane Toolbar
├─ Navigation group
│  ├─ Back
│  ├─ Forward
│  ├─ Up
│  └─ Refresh
├─ Creation group
│  └─ New ▼
├─ Operation group
│  ├─ Copy To…
│  ├─ Move To…
│  └─ Trash
├─ View group
│  └─ View ▼
└─ More group
   └─ More ▼
```

### 9.3 Primary actions

| Action       | Visible by default | Target                            | Notes                                             |
| ------------ | -----------------: | --------------------------------- | ------------------------------------------------- |
| Back         |                Yes | Pane navigation history           | Disabled at beginning                             |
| Forward      |                Yes | Pane navigation history           | Disabled when unavailable                         |
| Up           |                Yes | Parent path                       | Disabled at filesystem/provider root              |
| Refresh      |                Yes | Current pane path                 | Must not reset selection unnecessarily            |
| New          |                Yes | Current folder                    | Dropdown: folder, file                            |
| Copy To      |                Yes | Current selection                 | Opens destination dialog                          |
| Move To      |                Yes | Current selection                 | Opens destination dialog                          |
| Trash/Delete |                Yes | Current selection                 | Trash by default; permanent delete hidden/guarded |
| View Options |           Dropdown | Current pane or global preference | Columns, sort, hidden files, density shortcuts    |
| More         |           Dropdown | Current pane                      | Secondary operations                              |

### 9.4 Secondary actions

Secondary actions belong under `More` or relevant dropdowns:

- Rename;
- Properties;
- Copy full path;
- Copy file name;
- Reveal in system file manager;
- Open with default app;
- Clear selection;
- Invert selection;
- Diagnostics for current path only if appropriate.

### 9.5 Toolbar button states

Each toolbar button must support:

- default;
- hover;
- active/pressed;
- disabled;
- focus-visible;
- loading/pending where applicable;
- destructive variant for delete actions.

Disabled buttons should expose a tooltip explaining why unavailable when practical.

---

## 10. Breadcrumb and Path Bar

### 10.1 Purpose

The path bar must make the current location clear and allow fast navigation to parent folders or manual path entry.

### 10.2 Modes

| Mode               | Trigger                                          | Behavior                                     |
| ------------------ | ------------------------------------------------ | -------------------------------------------- |
| Breadcrumb mode    | Default                                          | Shows clickable path segments                |
| Editable path mode | `Ctrl/Cmd+L`, click edit affordance, menu action | Text input with current path                 |
| Error path mode    | Invalid path entered                             | Shows path-level error and allows correction |

### 10.3 Breadcrumb structure

```text
PathBar
├─ Root segment
├─ Parent segment(s)
├─ Overflow segment menu          [for long paths]
├─ Current folder segment
└─ Edit-path affordance
```

### 10.4 Long path behavior

Long paths must not break pane layout. The path bar should:

- preserve root and current folder segments;
- collapse middle segments into an overflow menu;
- show full path in tooltip;
- support copying full path from context menu;
- switch to editable input without losing text.

### 10.5 Breadcrumb context menu

Right-clicking a breadcrumb segment should expose:

- open this location in active pane;
- open this location in other pane;
- copy path;
- reveal in system file manager;
- add to favorites;
- properties.

---

## 11. File View Design

### 11.1 Supported view modes

| View mode      | Purpose                                |    MVP priority |
| -------------- | -------------------------------------- | --------------: |
| Details table  | Primary professional file-manager view |        Required |
| List view      | More compact name-focused browsing     |     Recommended |
| Compact view   | High-density browsing                  |     Recommended |
| Icon/grid view | Visual browsing                        | Future/optional |

### 11.2 Details table columns

Default columns:

| Column      | Required | Behavior                                                   |
| ----------- | -------: | ---------------------------------------------------------- |
| Name        |      Yes | Primary flexible column; icon + name + badges              |
| Size        |      Yes | Right-aligned; folders may show blank or calculated status |
| Type        |      Yes | Human-readable file/folder type                            |
| Modified    |      Yes | Locale-aware date/time                                     |
| Permissions | Optional | Useful for advanced mode                                   |
| Owner       | Optional | Future/advanced                                            |
| Created     | Optional | User-selectable column                                     |
| Extension   | Optional | User-selectable column                                     |

### 11.3 Row anatomy

```text
FileRow
├─ selection checkbox/implicit selection area    [optional depending mode]
├─ icon
├─ name label
├─ inline rename input                           [when renaming]
├─ badges                                        [hidden, symlink, locked, read-only]
├─ size cell
├─ type cell
├─ modified cell
└─ row action/context trigger                    [optional, mostly hidden]
```

### 11.4 Sorting

Sorting must support:

- click column header;
- ascending/descending indicator;
- stable ordering;
- folders-first preference if configured;
- sorting persistence per pane or global preference.

Recommended default sort:

1. folders first;
2. name ascending;
3. locale-aware/natural numeric sorting.

### 11.5 Selection behavior

| Interaction                 | Expected behavior                                                     |
| --------------------------- | --------------------------------------------------------------------- |
| Single click row            | Select item and focus row                                             |
| Double click folder         | Navigate internally                                                   |
| Double click file           | Open with OS default application                                      |
| Enter                       | Open selected item                                                    |
| Shift click                 | Range selection                                                       |
| Ctrl/Cmd click              | Add/remove from selection                                             |
| Ctrl/Cmd+A                  | Select all in active pane                                             |
| Escape                      | Clear transient menus/dialogs; clear selection only where appropriate |
| Click empty area            | Clear selection unless modifier workflow says otherwise               |
| Right click selected item   | Keep selection and open context menu                                  |
| Right click unselected item | Select that item and open context menu                                |

### 11.6 File badges

Recommended badges:

| Badge       | Meaning                                                  |
| ----------- | -------------------------------------------------------- |
| Hidden      | Hidden/system item is visible because setting is enabled |
| Locked      | Permission or system restriction                         |
| Symlink     | Symbolic link or shortcut                                |
| Read-only   | Item cannot be modified                                  |
| Warning     | Metadata unavailable or partial error                    |
| New/changed | Future filesystem watcher decoration                     |

Badges must be subtle and must not replace real error states.

---

## 12. Pane States

### 12.1 State lifecycle

```text
idle
→ loading
→ ready
→ refreshing
→ ready

loading
→ error
→ retrying
→ ready | error

ready
→ empty
ready
→ permission_denied
ready
→ timeout
```

### 12.2 Required states

| State             | UI representation                       | Required actions                             |
| ----------------- | --------------------------------------- | -------------------------------------------- |
| Loading           | Skeleton rows or spinner with path text | Cancel/ignore superseded requests internally |
| Ready             | File view rendered                      | Normal commands enabled                      |
| Empty folder      | Empty-state message                     | New Folder, New File, Paste where valid      |
| Permission denied | Clear error state                       | Retry, open parent, diagnostics/details      |
| Path not found    | Error state                             | Retry, edit path, open parent if possible    |
| Timeout/slow path | Timeout state                           | Retry, cancel, diagnostics/details           |
| Generic error     | User-friendly error state               | Retry, details                               |
| Offline/unmounted | Device unavailable state                | Retry, remove favorite if relevant           |

### 12.3 Empty state design

Empty folder state should show:

- simple folder/empty icon;
- text: “This folder is empty”;
- available actions: New Folder, New File, Paste if clipboard valid;
- no debug text by default.

### 12.4 Error state design

Error states should show:

- human-readable title;
- short explanation;
- current path;
- primary action: Retry;
- secondary action: Show details;
- optional action: Open parent;
- no raw stack trace unless user opens details.

---

## 13. Search and Filter Row

### 13.1 Purpose

The pane filter/search row supports quick filtering within the current folder and later expansion to recursive search.

### 13.2 Layout

```text
PaneFilterBar
├─ Search/filter input
├─ Match count
├─ Clear button
├─ Filter options dropdown
└─ Recursive search button/panel trigger        [optional]
```

### 13.3 Behavior

| Behavior         | Requirement                                  |
| ---------------- | -------------------------------------------- |
| Focus shortcut   | `Ctrl/Cmd+F` focuses search/filter           |
| Empty query      | File list returns to normal                  |
| Active query     | Filtered list and match count visible        |
| No results       | No-results empty state                       |
| Recursive search | Opens dialog/panel rather than blocking pane |

---

## 14. Status Bar

### 14.1 Purpose

The status bar gives persistent summary information without competing with the file table.

### 14.2 Content zones

```text
StatusBar
├─ Left: active pane/path summary
├─ Center: selection count and selected size
└─ Right: job indicator, hidden files indicator, errors/warnings
```

### 14.3 Required status information

- active pane indicator;
- current item count;
- selected item count;
- total selected size when available;
- current filter result count if filter active;
- active job count;
- last error/warning indicator;
- hidden files visible indicator if enabled.

### 14.4 Status bar rules

- Do not show raw debug values.
- Do not overflow with long paths; truncate with tooltip.
- Job indicator opens Job Activity drawer.
- Error indicator opens latest error details or diagnostics path.

---

## 15. Job Activity Drawer

### 15.1 Purpose

The job drawer provides non-blocking visibility into file operations: copy, move, delete, trash, rename batches, folder size calculations, and future indexing.

### 15.2 Drawer layout

```text
JobActivityDrawer
├─ Header
│  ├─ title: Activity
│  ├─ active job count
│  └─ close button
├─ Active jobs section
│  └─ JobCard[]
├─ Recently completed section
│  └─ JobCard[]
└─ Footer actions
   ├─ Open Operation History
   └─ Clear completed
```

### 15.3 Job card anatomy

```text
JobCard
├─ operation icon
├─ operation title
├─ source/destination summary
├─ progress bar
├─ current file text
├─ speed/remaining estimate             [optional]
├─ pause/resume                          [future]
├─ cancel button
└─ details/error link
```

### 15.4 Drawer behavior

| Event          | Behavior                                                      |
| -------------- | ------------------------------------------------------------- |
| Job starts     | Show toast; optionally open drawer depending preference       |
| Job progresses | Update card without blocking navigation                       |
| Job succeeds   | Show completion toast; move card to completed                 |
| Job fails      | Show error card and toast; allow details/retry where possible |
| User cancels   | Confirm if job is destructive or partly complete              |

---

## 16. Toasts and Notifications

### 16.1 Toast purpose

Toasts provide short, non-blocking feedback for completed or failed actions.

### 16.2 Toast types

| Type    | Examples                       | Behavior                                     |
| ------- | ------------------------------ | -------------------------------------------- |
| Info    | Copied path, selection cleared | Auto-dismiss                                 |
| Success | Copy completed, folder created | Auto-dismiss; optional reveal/open action    |
| Warning | Some files skipped             | Longer duration; action to details           |
| Error   | Open failed, permission denied | Persistent until dismissed or details opened |

### 16.3 Toast rules

- Do not stack excessive duplicate toasts.
- Combine repetitive operation notifications.
- Error toasts must include a way to view details.
- Toasts must not trap focus.

---

## 17. Context Menus

### 17.1 File row context menu

```text
Open
Open With Default App
Reveal in System File Manager
---
Cut
Copy
Paste                     [if valid]
Copy Path
Copy Name
---
Rename…
Copy To…
Move To…
Move to Trash…
Delete Permanently…       [guarded]
---
Properties…
```

### 17.2 Folder row context menu

```text
Open
Open in Other Pane
Reveal in System File Manager
Add to Favorites
---
Cut
Copy
Paste Into Folder         [if valid]
Copy Path
Copy Name
---
Rename…
Copy To…
Move To…
Move to Trash…
Delete Permanently…       [guarded]
---
Properties…
```

### 17.3 Multi-selection context menu

```text
Open Selected             [only when safe/meaningful]
---
Cut
Copy
Copy Paths
---
Copy To…
Move To…
Move to Trash…
Delete Permanently…       [guarded]
---
Properties…
```

### 17.4 Empty-space context menu

```text
Paste                     [if file clipboard valid]
New Folder…
New File…
---
Refresh
Show Hidden Files
View Options
---
Properties for Current Folder
```

### 17.5 Sidebar context menu

Standard folder:

```text
Open in Active Pane
Open in Other Pane
Reveal in System File Manager
Copy Path
Properties…
```

Favorite:

```text
Open in Active Pane
Open in Other Pane
Rename Favorite…
Remove from Favorites
Copy Path
Properties…
```

Device/volume:

```text
Open in Active Pane
Open in Other Pane
Refresh Device
Reveal in System File Manager
Properties…
Eject / Unmount           [future, if supported]
```

---

## 18. Modal and Dialog Catalog

### 18.1 Shared modal requirements

All dialogs must:

- use the same design tokens as the app shell;
- trap focus while open;
- close with Escape when safe;
- preserve form state while validation errors are shown;
- clearly identify destructive actions;
- avoid raw technical errors unless the user expands details;
- support keyboard navigation;
- have accessible title and description.

### 18.2 Required dialogs

| Dialog                               | Purpose                                         | Opens from                           |
| ------------------------------------ | ----------------------------------------------- | ------------------------------------ |
| New Folder                           | Create folder in active pane                    | File menu, toolbar New, context menu |
| New File                             | Create empty file in active pane                | File menu, toolbar New, context menu |
| Rename / Inline Rename               | Rename selected item                            | F2, menu, context menu               |
| Copy To                              | Plan copy operation to selected destination     | Toolbar/menu/context                 |
| Move To                              | Plan move operation to selected destination     | Toolbar/menu/context                 |
| Paste Confirmation / Conflict        | Confirm paste conflicts/warnings                | Paste command                        |
| Conflict Resolution                  | Choose overwrite/skip/rename behavior           | File operation planning              |
| Move to Trash Confirmation           | Confirm trash operation where needed            | Delete/trash command                 |
| Permanent Delete Confirmation        | Always confirm irreversible delete              | Shift+Delete/menu/context            |
| Properties                           | View metadata for one item/current folder       | Menu/context                         |
| Selection Properties                 | View summary of selected items                  | Menu/context                         |
| Settings / Preferences               | Visual, layout, file list, diagnostics settings | File/Tools menu                      |
| Reset Layout Confirmation            | Confirm layout reset                            | Settings dialog                      |
| Go to Location                       | Manual path navigation                          | Go menu/path bar                     |
| Volume Picker                        | Select drive/volume/root                        | Go menu/sidebar                      |
| Add Favorite                         | Add current or selected path to favorites       | Sidebar/breadcrumb/context           |
| Manage Favorites                     | Edit/reorder/remove favorites                   | Go/sidebar/settings                  |
| Recent Locations                     | Browse recent paths                             | Go menu/sidebar                      |
| Clear Recent Locations Confirmation  | Guard destructive history clearing              | Recent dialog                        |
| Recursive Search                     | Search below current folder                     | Tools/search row                     |
| Job Activity Drawer                  | View operation progress                         | Status bar/job events                |
| Operation History                    | View previous operations                        | Tools/job drawer                     |
| Cancel Job Confirmation              | Confirm job cancellation if risky               | Job drawer                           |
| Clear Operation History Confirmation | Guard operation history clearing                | Operation history dialog             |
| Diagnostics                          | View application diagnostic summary             | Help menu                            |
| Export Diagnostics                   | Save/share diagnostics bundle                   | Diagnostics dialog                   |
| Keyboard Shortcuts                   | Discover shortcut map                           | Help menu                            |
| About                                | Product/version/license info                    | Help/menu/app menu                   |
| Report Issue                         | Prepare issue report with diagnostics           | Help menu                            |
| Running Jobs Close Confirmation      | Prevent accidental close during operations      | App close                            |
| Error Details                        | Expand structured error details                 | Error state/toast/dialog             |

### 18.3 Destination chooser design

Copy/Move/Paste destination workflows should use a destination chooser with:

- current destination path;
- breadcrumb/path input;
- folder tree or recent locations;
- create folder action;
- available space/permission warning where possible;
- conflict preview before starting;
- primary action: Copy / Move / Paste;
- secondary action: Cancel.

### 18.4 Properties dialog design

Properties should include:

- item name and icon;
- full path with copy action;
- type;
- size / calculated size state;
- created/modified/accessed timestamps where available;
- permissions/read-only/hidden information;
- owner/group where supported;
- provider/source information;
- reveal/open parent actions;
- errors for unavailable metadata.

---

## 19. Settings and Preferences UI

### 19.1 Settings dialog structure

```text
SettingsDialog
├─ Sidebar navigation
│  ├─ General
│  ├─ Display
│  ├─ Colors
│  ├─ Layout
│  ├─ Layout Profiles
│  ├─ File List
│  ├─ Operations
│  ├─ Terminal
│  ├─ Keyboard
│  ├─ Network
│  ├─ Editor
│  ├─ Viewer
│  ├─ Advanced
│  └─ Diagnostics
└─ Settings page content
```

> **Implementation note:** See `docs/plans/2026-05-26-settings-ui-improvement.md` for the active plan
> wiring Network, Editor, Viewer, and Advanced tabs. General, Display, Colors, Layout, Layout Profiles,
> File List, Operations, Terminal, and Keyboard are already implemented.

### 19.2 General settings

| Setting                 | Values           | Notes                                      |
| ----------------------- | ---------------- | ------------------------------------------ |
| Start on system startup | Boolean          | Registers/removes autostart entry          |
| Diagnostics export path | File path string | Default `/tmp/fileoctopus-diagnostics.zip` |

### 19.3 Display settings

| Setting      | Values                                        | Applies to                          |
| ------------ | --------------------------------------------- | ----------------------------------- |
| Theme        | System, Light, Dark                           | Whole app, menus, dialogs, toasts   |
| Density      | Compact, Comfortable, Spacious                | Rows, toolbar, sidebar, status bar  |
| Font size    | Small, Default, Large or numeric scale        | Whole app                           |
| Icon size    | Small, Default, Large                         | Sidebar, file rows, toolbar         |
| Accent style | Default/system or future configurable accents | Focus, active pane, primary buttons |

### 19.4 Colors settings

| Setting          | Values                                    | Notes                                    |
| ---------------- | ----------------------------------------- | ---------------------------------------- |
| Accent color     | 8 preset swatches                         | Primary UI accent                        |
| File type colors | Rules with pattern, color, enabled toggle | Add/edit/delete/reorder; preset palettes |

### 19.5 Layout settings

| Setting             | Values                                   | Notes                         |
| ------------------- | ---------------------------------------- | ----------------------------- |
| Pane mode           | Single, Dual                             | Dual default                  |
| Split ratio         | Numeric/persisted                        | Updated by dragging splitter  |
| Split direction     | Horizontal, Vertical                     | Vertical split supported      |
| Sidebar visible     | Boolean                                  | Toggleable from View menu     |
| Status bar visible  | Boolean or always-on                     | Recommended always-on for MVP |
| Toolbar visible     | Boolean                                  | Toggleable from View menu     |
| Job drawer behavior | Manual, open on job start, open on error | User preference               |
| Remember last panes | Boolean                                  | Persisted via backend         |
| Reset layout        | Action                                   | Requires confirmation         |

### 19.6 Layout Profiles

| Setting  | Values | Notes                                                  |
| -------- | ------ | ------------------------------------------------------ |
| Profiles | List   | Save/apply/delete/export/import named layout snapshots |

### 19.7 File List settings

| Setting                | Values                                                      |
| ---------------------- | ----------------------------------------------------------- |
| Default view mode      | Details, List, Icons, Columns                               |
| Show hidden files      | Boolean                                                     |
| Folders first          | Boolean                                                     |
| Default sort column    | Name, Size, Type, Modified                                  |
| Default sort direction | Ascending, Descending                                       |
| Visible columns        | Name, Size, Type, Modified, Created, Extension, Permissions |
| Column presets         | Save/apply/delete named column configurations               |

### 19.8 Operations settings

| Setting                            | Values                                              |
| ---------------------------------- | --------------------------------------------------- |
| Confirm move to trash              | Always, Multi-selection only, Never for single item |
| Confirm permanent delete           | Always; not disableable for MVP                     |
| Use trash by default               | Boolean                                             |
| Confirm overwrite                  | Boolean                                             |
| Default conflict policy            | Fail, Skip, Overwrite, Rename New, Rename Existing  |
| Show advanced copy options         | Boolean                                             |
| Open job drawer on operation start | Boolean                                             |
| Restore last session paths         | Boolean                                             |
| Preserve selection after refresh   | Boolean where safe                                  |

### 19.9 Terminal settings

| Setting                          | Values  | Notes                        |
| -------------------------------- | ------- | ---------------------------- |
| Shell program                    | String  | Default: system shell        |
| Launch arguments                 | String  | Extra args for shell process |
| Open pane terminal expanded      | Boolean |                              |
| Cd on navigate                   | Boolean | Sync cwd with active pane    |
| Confirm close pane with terminal | Boolean | Warn before closing          |

### 19.10 Keyboard settings

| Setting           | Values                                | Notes                                        |
| ----------------- | ------------------------------------- | -------------------------------------------- |
| Shortcut list     | Filterable, grouped by category       | Navigation, operation, view, clipboard, etc. |
| Per-shortcut edit | Key recording with conflict detection | Custom badge for user-modified shortcuts     |
| Reset shortcuts   | Per-shortcut or reset all             |                                              |

### 19.11 Network settings

> **Status:** Stub component exists (`SettingsNetwork.tsx`); wiring planned (SET-NET).

| Setting               | Values           | Notes                                    |
| --------------------- | ---------------- | ---------------------------------------- |
| Connection timeout    | Numeric (ms)     | Default timeout for remote connections   |
| Auto-reconnect        | Boolean          | Automatically reconnect dropped sessions |
| Default protocol      | SFTP, SMB, S3    | Preferred protocol for new connections   |
| SSH key path override | File path string | Custom identity file for SSH             |

### 19.12 Editor settings

> **Status:** Stub component exists (`SettingsEditor.tsx`); wiring planned (SET-EDIT).

| Setting             | Values  | Notes             |
| ------------------- | ------- | ----------------- |
| Font family         | String  | Monospace default |
| Font size           | Numeric | In pixels         |
| Tab size            | 2, 4, 8 | Spaces per tab    |
| Word wrap           | Boolean | Wrap long lines   |
| Auto-save           | Boolean | Save on change    |
| Syntax highlighting | String  | Theme name        |
| Line numbers        | Boolean | Show line gutter  |

### 19.13 Viewer settings

> **Status:** Stub component exists (`SettingsViewer.tsx`); wiring planned (SET-VIEW).

| Setting               | Values            | Notes                             |
| --------------------- | ----------------- | --------------------------------- |
| Default view mode     | Text, Hex         | F3 viewer default                 |
| Image zoom behavior   | Fit, Fill, Actual | How images scale in preview       |
| Media autoplay        | Boolean           | Autoplay audio/video on open      |
| Max preview file size | Numeric (MB)      | Skip preview above this threshold |

### 19.14 Advanced settings

> **Status:** No component yet; planned (SET-ADV).

| Setting                      | Values                   | Notes                            |
| ---------------------------- | ------------------------ | -------------------------------- |
| Log level                    | Error, Warn, Info, Debug | Production default: Warn         |
| Enable experimental features | Boolean                  | Unlock pre-release functionality |
| Cache size limit             | Numeric (MB)             | Max size for thumbnail/metadata  |
| File operation thread count  | Numeric                  | Parallel operation workers       |

### 19.15 Diagnostics settings

Diagnostics settings must not expose raw development controls by default. The settings page may include:

- diagnostics export button;
- app version and build channel;
- database/schema version;
- log level only in development builds;
- reset diagnostics state where safe.

---

## 20. Visual Design System

### 20.1 Design language

FileOctopus should use a calm, modern desktop utility aesthetic:

- restrained color usage;
- strong readability;
- subtle borders and separators;
- clear hierarchy between navigation, commands, content, and status;
- minimal decoration;
- consistent spacing;
- visible affordances for keyboard users.

### 20.2 Token categories

```text
DesignTokens
├─ color
│  ├─ background
│  ├─ surface
│  ├─ surfaceElevated
│  ├─ border
│  ├─ textPrimary
│  ├─ textSecondary
│  ├─ textMuted
│  ├─ accent
│  ├─ danger
│  ├─ warning
│  └─ success
├─ typography
│  ├─ fontFamily
│  ├─ fontSizeSmall
│  ├─ fontSizeBase
│  ├─ fontSizeLarge
│  └─ lineHeight
├─ spacing
│  ├─ xs
│  ├─ sm
│  ├─ md
│  ├─ lg
│  └─ xl
├─ radius
│  ├─ sm
│  ├─ md
│  └─ lg
├─ elevation
│  ├─ popover
│  ├─ modal
│  └─ drawer
└─ density
   ├─ compact
   ├─ comfortable
   └─ spacious
```

### 20.3 Example CSS variables

```css
:root {
  --fo-bg: #0f1115;
  --fo-surface: #171a21;
  --fo-surface-elevated: #20242d;
  --fo-border: #2d3340;
  --fo-text: #eef1f6;
  --fo-text-muted: #9ca3af;
  --fo-accent: #4f8cff;
  --fo-danger: #ef4444;
  --fo-warning: #f59e0b;
  --fo-success: #22c55e;

  --fo-sidebar-width: 248px;
  --fo-toolbar-height: 40px;
  --fo-pathbar-height: 38px;
  --fo-row-height: 32px;
  --fo-statusbar-height: 28px;
  --fo-radius-sm: 6px;
  --fo-radius-md: 10px;
}
```

Actual color values should be defined in the design system and adjusted for light/dark contrast. The example above is illustrative, not final branding.

### 20.4 Theme behavior

| Theme mode | Behavior                              |
| ---------- | ------------------------------------- |
| System     | Follows OS preference where available |
| Light      | Forces light palette                  |
| Dark       | Forces dark palette                   |

Theme must apply to:

- app shell;
- native-integrated menu surfaces where possible;
- toolbar dropdowns;
- context menus;
- dialogs;
- toasts;
- status bar;
- job drawer;
- error states;
- focus rings.

### 20.5 Density behavior

| Density     | Intended user             | Characteristics                                |
| ----------- | ------------------------- | ---------------------------------------------- |
| Compact     | Power users               | Shorter rows, smaller gaps, more visible files |
| Comfortable | Default                   | Balanced readability and information density   |
| Spacious    | Accessibility/readability | Larger rows, larger hit targets, more padding  |

Density must affect the sidebar, toolbar, path bar, file rows, menus, context menus, dialog form spacing, and status bar.

---

## 21. Keyboard and Accessibility

### 21.1 Baseline shortcuts

| Shortcut               | Action                                                   |
| ---------------------- | -------------------------------------------------------- |
| `Tab`                  | Switch active pane or move focus depending focus context |
| `Enter`                | Open selected file/folder                                |
| `Backspace` / `Alt+Up` | Go to parent folder                                      |
| `Ctrl/Cmd+C`           | Copy selected items                                      |
| `Ctrl/Cmd+X`           | Cut selected items                                       |
| `Ctrl/Cmd+V`           | Paste into active pane                                   |
| `Delete`               | Move selected items to trash                             |
| `Shift+Delete`         | Permanent delete, guarded                                |
| `F2`                   | Rename selected item                                     |
| `Ctrl/Cmd+N`           | New item workflow                                        |
| `Ctrl/Cmd+R`           | Refresh active pane                                      |
| `Ctrl/Cmd+L`           | Focus editable path bar                                  |
| `Ctrl/Cmd+F`           | Focus search/filter                                      |
| `Ctrl/Cmd+,`           | Settings where platform-appropriate                      |
| `?` or Help menu       | Keyboard shortcuts dialog                                |

Platform-specific Command/Control behavior must be finalized per OS.

### 21.2 Accessibility requirements

- All interactive controls must be keyboard reachable.
- Focus order must follow visual order.
- Modals must trap focus and restore focus to the trigger on close.
- Active pane must not be indicated by color alone.
- File rows need accessible names including file name, type, size, and modified date where practical.
- Context menus must be keyboard navigable.
- Toasts must not steal focus.
- Error states must be readable by assistive technologies.
- Contrast must be sufficient in light and dark themes.

---

## 22. Menu Integration Summary

### 22.1 File menu

```text
File
├─ New
│  ├─ Folder…
│  └─ Empty File…
├─ Open
│  ├─ Open Selected
│  ├─ Open With Default App
│  └─ Reveal in System File Manager
├─ File Actions
│  ├─ Rename…
│  ├─ Copy To…
│  ├─ Move To…
│  ├─ Move to Trash…
│  └─ Delete Permanently…
├─ Properties…
├─ Settings…                  [Windows/Linux]
└─ Exit                       [Windows/Linux]
```

### 22.2 Edit menu

```text
Edit
├─ Clipboard
│  ├─ Cut
│  ├─ Copy
│  ├─ Paste
│  └─ Clear File Clipboard
├─ Selection
│  ├─ Select All
│  ├─ Clear Selection
│  └─ Invert Selection
├─ Copy Text
│  ├─ Copy Full Path
│  ├─ Copy File Name
│  ├─ Copy Parent Folder Path
│  └─ Copy Resource URI
└─ Preferences…               [optional alias]
```

### 22.3 View menu

Expected groups:

- layout mode;
- sidebar visibility;
- status bar visibility;
- job drawer visibility;
- file view mode;
- visible columns;
- sorting;
- hidden files;
- density;
- reset layout.

### 22.4 Go menu

Expected groups:

- back/forward/up;
- home and standard folders;
- drives/volumes;
- recent locations;
- go to location;
- add/manage favorites.

### 22.5 Tools menu

Expected groups:

- operation history;
- recursive search;
- settings/preferences alias where appropriate;
- diagnostics access only if Help menu is not preferred.

### 22.6 Help menu

Expected groups:

- keyboard shortcuts;
- documentation/user guide;
- diagnostics;
- report issue;
- about.

---

## 23. Implementation Component Map

### 23.1 Recommended frontend folders

```text
src/
├─ app/
│  ├─ App.tsx
│  ├─ AppShell.tsx
│  ├─ providers/
│  └─ startup.ts
├─ components/
│  ├─ shell/
│  │  ├─ WindowChrome.tsx
│  │  ├─ Sidebar.tsx
│  │  ├─ StatusBar.tsx
│  │  └─ ToastViewport.tsx
│  ├─ pane/
│  │  ├─ FilePane.tsx
│  │  ├─ PaneToolbar.tsx
│  │  ├─ PathBar.tsx
│  │  ├─ PaneFilterBar.tsx
│  │  ├─ FileView.tsx
│  │  ├─ FileTable.tsx
│  │  ├─ FileRow.tsx
│  │  └─ PaneStates.tsx
│  ├─ menus/
│  │  ├─ AppMenus.ts
│  │  ├─ ContextMenus.tsx
│  │  └─ ToolbarDropdowns.tsx
│  ├─ dialogs/
│  │  ├─ SettingsDialog.tsx
│  │  ├─ PropertiesDialog.tsx
│  │  ├─ OperationDialogs.tsx
│  │  ├─ ConflictResolutionDialog.tsx
│  │  ├─ DiagnosticsDialog.tsx
│  │  └─ KeyboardShortcutsDialog.tsx
│  ├─ jobs/
│  │  ├─ JobActivityDrawer.tsx
│  │  ├─ JobCard.tsx
│  │  └─ OperationHistoryDialog.tsx
│  └─ primitives/
│     ├─ Button.tsx
│     ├─ Menu.tsx
│     ├─ Dialog.tsx
│     ├─ Tooltip.tsx
│     └─ Table.tsx
├─ state/
│  ├─ layoutStore.ts
│  ├─ paneStore.ts
│  ├─ selectionStore.ts
│  ├─ clipboardStore.ts
│  ├─ jobStore.ts
│  ├─ preferencesStore.ts
│  └─ modalStore.ts
├─ ipc/
│  ├─ commands.ts
│  ├─ events.ts
│  ├─ types.ts
│  └─ errors.ts
├─ styles/
│  ├─ tokens.css
│  ├─ themes.css
│  ├─ density.css
│  └─ app.css
└─ tests/
   ├─ visual/
   ├─ interaction/
   └─ accessibility/
```

### 23.2 Component responsibilities

| Component           | Responsibility                                             |
| ------------------- | ---------------------------------------------------------- |
| `AppShell`          | Root layout, theme/density application, global layers      |
| `Sidebar`           | Standard locations, favorites, volumes, recent locations   |
| `PaneWorkspace`     | Pane mode, splitter, active pane coordination              |
| `FilePane`          | Path state, pane-local loading/error/selection integration |
| `PaneToolbar`       | High-frequency pane actions and dropdowns                  |
| `PathBar`           | Breadcrumb and editable path input                         |
| `PaneFilterBar`     | Current-folder filter/search                               |
| `FileView`          | Chooses loading/empty/error/table/list states              |
| `FileTable`         | Details view rendering and column management               |
| `FileRow`           | Row selection, focus, context targeting, inline rename     |
| `StatusBar`         | Global summary and job/error indicators                    |
| `JobActivityDrawer` | Active/completed job visibility and cancellation           |
| `SettingsDialog`    | Preferences editing and persistence                        |
| `DiagnosticsDialog` | Deliberate diagnostics access                              |
| `ToastViewport`     | Non-blocking feedback                                      |
| `ContextMenus`      | Right-click command surfaces                               |

### 23.3 Store responsibilities

| Store              | Responsibility                                                  |
| ------------------ | --------------------------------------------------------------- |
| `preferencesStore` | Loaded preferences, update actions, persistence sync            |
| `layoutStore`      | Sidebar, pane mode, split ratio, drawer visibility              |
| `paneStore`        | Per-pane path, request IDs, lifecycle states, sorting/filtering |
| `selectionStore`   | Selected items per pane and selection operations                |
| `clipboardStore`   | Cut/copy file clipboard state                                   |
| `jobStore`         | Active/completed/failed jobs from backend events                |
| `modalStore`       | Current modal type and payload                                  |
| `toastStore`       | Toast queue and deduplication                                   |

---

## 24. IPC and Error UI Mapping

### 24.1 Structured error display

Backend errors must be mapped to user-facing states.

| Error category          | UI surface                     | User-facing response                                |
| ----------------------- | ------------------------------ | --------------------------------------------------- |
| Not found               | Pane error, toast, dialog      | Path/item no longer exists; offer retry/open parent |
| Permission denied       | Pane state or operation dialog | Explain access issue; offer retry/details           |
| Already exists/conflict | Conflict dialog                | Offer overwrite/skip/rename/cancel                  |
| Read-only destination   | Operation dialog               | Disable start or show blocking warning              |
| Timeout                 | Pane timeout state             | Offer retry/details                                 |
| No default app          | Toast/error dialog             | Explain file cannot be opened by OS default app     |
| Operation cancelled     | Job card/toast                 | Mark cancelled; do not show as failure              |
| Unknown/internal        | Error details dialog           | Friendly summary plus expandable details            |

### 24.2 Request correlation

Directory listing requests should use correlation IDs. The UI must ignore stale responses that do not match the latest request for a pane.

### 24.3 Loading and cancellation

When a user quickly navigates between paths, superseded requests should not flash stale content. The pane may show loading, but the final rendered content must correspond to the latest path.

---

## 25. Critical User Flows

### 25.1 Open folder/file

```text
User double-clicks row or presses Enter
├─ If folder: navigate active pane internally
├─ If file: call backend open-with-default-app command
├─ On success: optional toast or no interruption
└─ On failure: error toast/dialog with details action
```

### 25.2 Copy or move selection

```text
User selects one or more items
├─ Clicks Copy To… / Move To…
├─ Destination chooser opens
├─ Backend plans operation
├─ Conflict/warning preview appears if needed
├─ User confirms
├─ Job starts
├─ Toast appears and job drawer updates
└─ Completion/failure updates drawer, toast, operation history
```

### 25.3 Paste from file clipboard

```text
User copies/cuts files
├─ Active pane changes or remains current
├─ User triggers Paste
├─ UI validates active pane writable state
├─ Backend plans paste operation
├─ If no conflicts and preference allows: start job
├─ If conflicts/warnings: show paste confirmation/conflict dialog
└─ Job events update drawer/status/toasts
```

### 25.4 Rename

```text
User selects exactly one item
├─ Presses F2 or chooses Rename…
├─ Inline rename input appears where possible
├─ User submits
├─ UI validates empty/reserved/collision basics
├─ Backend performs rename/move operation
├─ Row updates or error is shown
└─ Focus returns to renamed item
```

### 25.5 Delete/trash

```text
User selects items
├─ Delete: move to trash workflow
│  ├─ confirm when configured/high-risk
│  └─ start trash job
└─ Shift+Delete: permanent delete workflow
   ├─ always show destructive confirmation
   ├─ require explicit user confirmation
   └─ start guarded delete job
```

### 25.6 Change theme/density

```text
User opens Settings
├─ Changes theme or density
├─ Preference updates through IPC
├─ Frontend applies token class immediately
├─ UI surfaces update consistently
└─ Preference persists after restart
```

---

## 26. Visual Regression and QA States

### 26.1 Required visual snapshots

Create visual snapshots for:

1. Light theme, comfortable density, dual pane.
2. Dark theme, comfortable density, dual pane.
3. Compact density file table.
4. Spacious density file table.
5. Sidebar collapsed.
6. Single-pane mode.
7. Active left pane.
8. Active right pane.
9. Empty folder state.
10. Permission-denied state.
11. Generic error state.
12. Timeout state.
13. Loading state.
14. Long path breadcrumb truncation.
15. Narrow window toolbar overflow.
16. File row context menu.
17. Empty-space context menu.
18. Settings dialog.
19. Properties dialog.
20. Conflict resolution dialog.
21. Job activity drawer with active jobs.
22. Operation failed toast.
23. Keyboard shortcuts dialog.
24. Diagnostics dialog.

### 26.2 Manual QA checklist

- App opens without showing diagnostics by default.
- Sidebar shows valid standard locations for the OS.
- Clicking sidebar entries navigates the active pane.
- Back, Forward, Up, and Refresh work correctly.
- Breadcrumb segments navigate correctly.
- Editable path mode accepts valid paths and rejects invalid paths visibly.
- Active pane is always visually obvious.
- File table columns remain readable after pane resizing.
- Single, range, and additive selection work.
- Context menus target the correct item or folder.
- Copy, move, rename, trash, and paste workflows open correct dialogs.
- Permanent delete is always guarded.
- Job drawer shows progress and cancellation.
- Completed operations produce useful toasts.
- Settings change theme and density without restart where practical.
- Preferences persist after restart.
- Keyboard shortcuts do not trigger while typing in text fields.
- Error states include Retry and Details where appropriate.
- Dialog focus is trapped and restored on close.
- Light and dark themes are both readable.

---

## 27. Acceptance Criteria for This UI/Layout Specification

The implementation should be considered aligned with this specification when:

1. The main layout contains sidebar, pane workspace, status bar, toast layer, modal layer, and hidden-by-default job/diagnostics surfaces.
2. Diagnostics are not permanently visible in the production main UI.
3. Pane toolbar actions are grouped into navigation, creation, operation, view, and more sections.
4. Breadcrumb/path bar is visually distinct from command buttons.
5. Dual-pane active-pane targeting is visually obvious and functionally consistent.
6. File table supports stable columns, sorting, and desktop-like selection behavior.
7. Empty, loading, error, permission, and timeout states are standardized.
8. Context menus exist for file rows, folders, multi-selection, empty pane area, sidebar entries, breadcrumbs, and jobs where applicable.
9. Required dialogs exist or have implementation tickets.
10. Theme, density, view mode, hidden-file visibility, and layout preferences are represented in settings.
11. Keyboard shortcuts are documented and discoverable.
12. Destructive actions require explicit confirmation.
13. Long-running operations are visible in the job drawer and do not block navigation.
14. The component map is reflected in the frontend code structure or an equivalent maintainable structure.
15. Visual regression states cover normal, edge, and failure states.

---

## 28. Implementation Priority

### Phase 1 — Shell cleanup and layout baseline

1. Remove always-visible diagnostics from main layout.
2. Build stable `AppShell`, `Sidebar`, `PaneWorkspace`, `FilePane`, and `StatusBar` composition.
3. Implement active pane styling.
4. Define design tokens, theme classes, and density classes.

### Phase 2 — Pane usability

1. Redesign pane toolbar groups.
2. Improve breadcrumb/path bar.
3. Stabilize file table columns.
4. Implement standardized pane states.
5. Implement status bar accuracy.

### Phase 3 — Command surfaces

1. Add file row context menu.
2. Add empty-space context menu.
3. Add sidebar and breadcrumb context menus.
4. Wire toolbar dropdowns.
5. Ensure top menu commands target active pane correctly.

### Phase 4 — Preferences and dialogs

1. Add settings dialog.
2. Add theme/density/view/hidden-file preferences.
3. Add keyboard shortcuts dialog.
4. Add diagnostics dialog.
5. Add properties and operation dialogs if missing.

### Phase 5 — Polish and QA

1. Add visual regression coverage.
2. Add keyboard interaction tests.
3. Add accessibility pass.
4. Validate layouts on Windows, macOS, and Linux.
5. Validate narrow and wide window behavior.

---

## 29. Open Decisions

| Decision                      | Options                                    | Recommendation                                                                                                  |
| ----------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Frontend framework            | React, Vue, Svelte                         | Use current project frontend stack; component map assumes React-style naming but concepts are framework-neutral |
| Default pane mode             | Single, dual                               | Dual pane by default, with single-pane preference                                                               |
| Permanent delete availability | Enabled, disabled, advanced setting        | Enabled only with explicit confirmation and safe backend guardrails                                             |
| Sidebar recent locations      | Always visible, collapsible, hidden        | Collapsible section, capped list                                                                                |
| Job drawer opening            | Always on job start, only on error, manual | User preference; default to toast + status indicator, drawer opens on click or error                            |
| Preview panel                 | Include now, future                        | Future/optional; do not reserve default space                                                                   |
| Custom titlebar               | Native, custom                             | Prefer native where simpler; custom only if needed for integrated shell                                         |
| Single click folder open      | Select only, open                          | Select only; double click/Enter opens                                                                           |

---

## 30. Source Alignment Notes

This document consolidates the existing FileOctopus direction:

- Tauri v2 desktop architecture with Rust backend, web frontend, typed IPC, SQLite preferences/history, VFS/job-engine separation, and structured errors.
- Sprint 4 baseline file-manager completeness: OS open/reveal, sidebar, breadcrumb, navigation stack, file table, context menus, keyboard shortcuts, metadata, search/filter, visual customization, and user-facing errors.
- Sprint 5 UI hardening: pane lifecycle stability, grouped toolbar, breadcrumb redesign, density modes, active pane styling, standardized pane states, settings/preferences, keyboard discoverability, file table polish, diagnostics cleanup, and visual QA.
- Menu/modal specification: top menu taxonomy, toolbar dropdowns, context menus, modal catalog, enablement rules, long-menu rules, and safe destructive operation flows.
