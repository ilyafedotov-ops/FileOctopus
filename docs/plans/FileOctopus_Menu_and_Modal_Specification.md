# FileOctopus Menu and Modal Specification

**Document status:** Draft for implementation  
**Product:** FileOctopus desktop file manager  
**Target shell:** Tauri v2 + web frontend  
**Primary audience:** frontend engineers, Rust/Tauri IPC engineers, QA, and LLM implementation agents  
**Purpose:** define the application menu structure, toolbar menus, context menus, submenu rules, action enablement, and every modal/dialog/drawer opened from menu actions.

**Implementation status (2026-05-16):** Pane toolbars, context menus, and most modals from this spec exist in `packages/frontend`. The **application menu bar** (§4 File/Edit/View/Go/Tools/Window/Help) is **not implemented** — discoverability today is via title-bar Settings/Help, toolbar overflow, context menus, and Ctrl/Cmd+P command palette. Align delivery tracking with [PROJECT_STATUS_AND_DOC_ALIGNMENT.md](../planning/PROJECT_STATUS_AND_DOC_ALIGNMENT.md).

---

## 1. Scope

This document defines the menu and dialog contract for FileOctopus. It covers:

1. Desktop application menu bar.
2. Pane toolbar action groups and overflow menus.
3. File/folder context menus.
4. Empty-space context menu.
5. Sidebar and breadcrumb context menus.
6. Dynamic submenu behavior for long menus.
7. Dialog, modal, drawer, popover, toast, and inline-edit behavior opened by each menu action.
8. Enablement rules for single selection, multi-selection, active pane, read-only folders, clipboard state, and running jobs.
9. Accessibility, keyboard, theme, density, and error-state requirements.

The goal is to make the FileOctopus UI feel like a complete desktop file manager, not a debug prototype. Menu actions must be discoverable, grouped, keyboard reachable, and mapped to predictable modals or direct actions.

---

## 2. Design principles

### 2.1 Menus are for commands, not status dumps

Menus must contain user actions. Diagnostic status, debug output, raw JSON, and developer-only controls must not be permanently visible in the main layout. Diagnostics belong under **Help > Diagnostics** or a deliberate developer drawer.

### 2.2 Long menus must be grouped or nested

A menu is considered too long when it has more than 10 visible items or more than 4 conceptual groups. Long menus must use separators and submenus. Dynamic lists such as favorites, recent locations, drives, and operation history must cap visible items and provide a management dialog.

### 2.3 Every menu item must have one clear UI outcome

Each menu item must do one of the following:

- execute a direct action,
- open a modal dialog,
- open a non-modal drawer/panel,
- open a small popover/dropdown,
- start inline editing,
- focus an existing UI control,
- show a confirmation dialog,
- show a toast/error state.

No command may silently fail. Disabled items must show their disabled state and, where practical, expose a tooltip explaining why the action is unavailable.

### 2.4 Dangerous actions are never one-click actions

Permanent delete, overwrite, destructive rename conflicts, clearing history, resetting settings, and cancelling active jobs must require explicit confirmation. The confirmation text must list affected item count and, where relevant, destination path and conflict details.

### 2.5 The active pane is the command target

In the dual-pane layout, menu bar actions apply to the **active pane** unless the action explicitly says otherwise. The active pane must have visible focus styling. Context menu actions apply to the item, selection, folder background, sidebar entry, or breadcrumb segment that opened the context menu.

### 2.6 Menus and modals follow appearance settings

All menus, context menus, popovers, dialogs, confirmation windows, drawers, and toasts must use the same design tokens as the rest of the shell. Theme, density, font size, icon size, and focus ring styling must apply consistently.

---

## 3. Menu taxonomy

| UI surface               | Purpose                                       | Example trigger                           | Expected behavior                                    |
| ------------------------ | --------------------------------------------- | ----------------------------------------- | ---------------------------------------------------- |
| Application menu bar     | Global discoverability and keyboard workflows | File, Edit, View, Go, Tools, Window, Help | Applies to active pane unless stated otherwise       |
| Pane toolbar             | High-frequency pane actions                   | Back, Up, Refresh, New, Copy, Move, Trash | Compact, grouped, no debug controls                  |
| Toolbar dropdown         | Secondary actions for the active pane         | New, View Options, More                   | Small popover, not full modal unless required        |
| Item context menu        | Actions for selected files/folders            | Right-click item                          | Uses selection model; selects item first when needed |
| Empty-space context menu | Actions for current folder                    | Right-click folder background             | Targets current folder, not previous selection       |
| Sidebar context menu     | Actions for navigation roots/favorites        | Right-click sidebar entry                 | Target is clicked location/favorite/device           |
| Breadcrumb context menu  | Navigation and path actions                   | Right-click path segment                  | Target is breadcrumb segment path                    |
| Modal dialog             | Blocking decision or form                     | Preferences, Properties, Delete confirm   | Traps focus; Escape closes when safe                 |
| Drawer/panel             | Non-blocking operational details              | Job Activity                              | Can remain open while user navigates                 |
| Toast                    | Non-blocking feedback                         | File opened, copy path done, failed open  | Auto-dismiss unless error needs action               |

---

## 4. Top-level application menu bar

### 4.1 Windows/Linux menu order

```text
File
Edit
View
Go
Tools
Window
Help
```

### 4.2 macOS menu order

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

The macOS **FileOctopus** application menu must contain platform-standard app items:

```text
FileOctopus
├─ About FileOctopus…
├─ Settings…
├─ Services                 [platform-managed, if available]
├─ Hide FileOctopus
├─ Hide Others
├─ Show All
└─ Quit FileOctopus
```

On Windows/Linux, **Settings…** belongs under **File > Settings…** or **Tools > Settings…**. The canonical location for this specification is **File > Settings…**.

---

## 5. File menu

### 5.1 Structure

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
├─ Settings…                  [Windows/Linux only]
└─ Exit                       [Windows/Linux only]
```

### 5.2 File menu action matrix

| Menu path                                   | Enabled when                                                | UI outcome                           | Modal/dialog opened                                  | Backend/IPC intent                            | Notes                                                                                        |
| ------------------------------------------- | ----------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| File > New > Folder…                        | Active pane points to writable folder                       | Opens naming form                    | **New Folder dialog** or inline naming row           | create folder operation                       | Prefer inline row for desktop feel; dialog allowed for MVP                                   |
| File > New > Empty File…                    | Active pane points to writable folder                       | Opens naming form                    | **New File dialog** or inline naming row             | create file command/job                       | Must validate reserved names and collisions                                                  |
| File > Open > Open Selected                 | Exactly one item selected                                   | Direct action                        | Error dialog/toast on failure                        | folder navigate or open path with default app | Folder opens internally; file opens externally                                               |
| File > Open > Open With Default App         | One or more files selected                                  | Direct action                        | Error dialog/toast on failure                        | open path with OS default handler             | Disabled for folders unless OS open folder externally is explicitly supported                |
| File > Open > Reveal in System File Manager | One item selected or properties/search result target exists | Direct action                        | Error toast/dialog on failure                        | reveal path in native file manager            | Falls back to internal parent navigation and select target                                   |
| File > File Actions > Rename…               | Exactly one selected item and parent writable               | Inline edit or modal                 | **Rename dialog** if inline edit unavailable         | rename/move operation                         | F2 shortcut equivalent                                                                       |
| File > File Actions > Copy To…              | One or more items selected                                  | Opens destination chooser            | **Copy To dialog**                                   | plan file operation, then start job           | Shows plan preview before start                                                              |
| File > File Actions > Move To…              | One or more items selected and source writable              | Opens destination chooser            | **Move To dialog**                                   | plan file operation, then start job           | Shows plan preview before start                                                              |
| File > File Actions > Move to Trash…        | One or more items selected                                  | Confirmation if configured/high-risk | **Move to Trash confirmation** when needed           | trash operation                               | Should be lower friction than permanent delete but still show item count for multi-selection |
| File > File Actions > Delete Permanently…   | One or more items selected and permanent delete enabled     | Blocking destructive confirmation    | **Permanent Delete confirmation**                    | permanent delete operation                    | Always confirm; never default button to destructive action                                   |
| File > Properties…                          | Selection exists or active folder target                    | Opens metadata view                  | **Properties dialog**                                | stat metadata, optional folder size job       | For multi-selection, open **Selection Properties dialog**                                    |
| File > Settings…                            | Always                                                      | Opens preferences                    | **Settings dialog**                                  | get_preferences / set_preference              | Windows/Linux only; macOS uses app menu                                                      |
| File > Exit                                 | Always                                                      | Closes application                   | **Unsaved/running jobs confirmation** if jobs active | app close                                     | Windows/Linux only                                                                           |

---

## 6. Edit menu

### 6.1 Structure

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
└─ Preferences…               [optional alias on Windows/Linux only]
```

### 6.2 Edit menu action matrix

| Menu path                                  | Enabled when                                     | UI outcome                        | Modal/dialog opened                                                       | Backend/IPC intent                | Notes                                                                        |
| ------------------------------------------ | ------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------- |
| Edit > Clipboard > Cut                     | Selection exists and sources can be moved        | Direct state update               | Toast: “Marked N items to move”                                           | frontend clipboard state          | Does not mutate filesystem                                                   |
| Edit > Clipboard > Copy                    | Selection exists                                 | Direct state update               | Toast: “Copied N items”                                                   | frontend clipboard state          | Does not mutate filesystem                                                   |
| Edit > Clipboard > Paste                   | File clipboard exists and active folder writable | Opens plan/confirmation if needed | **Paste confirmation/conflict dialog** only when conflicts/warnings exist | plan/start copy or move operation | If no conflicts and user preference allows, start immediately with job toast |
| Edit > Clipboard > Clear File Clipboard    | Clipboard exists                                 | Direct state update               | Toast                                                                     | frontend clipboard state          | Disabled when clipboard empty                                                |
| Edit > Selection > Select All              | Active pane has visible items                    | Direct action                     | None                                                                      | frontend selection state          | Ctrl/Cmd+A equivalent                                                        |
| Edit > Selection > Clear Selection         | Selection exists                                 | Direct action                     | None                                                                      | frontend selection state          | Escape may also clear selection when no modal open                           |
| Edit > Selection > Invert Selection        | Active pane has visible items                    | Direct action                     | None                                                                      | frontend selection state          | Works against currently filtered visible list                                |
| Edit > Copy Text > Copy Full Path          | Selection exists                                 | Direct OS clipboard write         | Toast/error toast                                                         | system clipboard                  | Multi-selection writes newline-separated paths                               |
| Edit > Copy Text > Copy File Name          | Selection exists                                 | Direct OS clipboard write         | Toast/error toast                                                         | system clipboard                  | Multi-selection writes newline-separated names                               |
| Edit > Copy Text > Copy Parent Folder Path | Selection exists                                 | Direct OS clipboard write         | Toast/error toast                                                         | system clipboard                  | Useful for logs and terminals                                                |
| Edit > Copy Text > Copy Resource URI       | Selection exists                                 | Direct OS clipboard write         | Toast/error toast                                                         | system clipboard                  | Example: `local:///home/user/file.txt`                                       |
| Edit > Preferences…                        | Always                                           | Opens preferences                 | **Settings dialog**                                                       | get_preferences / set_preference  | Optional alias; avoid duplicate if UI feels crowded                          |

---

## 7. View menu

### 7.1 Structure

```text
View
├─ View Mode
│  ├─ Details
│  ├─ List
│  └─ Icons
├─ Sort By
│  ├─ Name
│  ├─ Type
│  ├─ Size
│  ├─ Date Modified
│  ├─ Date Created
│  └─ Direction
│     ├─ Ascending
│     └─ Descending
├─ Appearance
│  ├─ Theme
│  │  ├─ System
│  │  ├─ Light
│  │  └─ Dark
│  ├─ Density
│  │  ├─ Compact
│  │  ├─ Comfortable
│  │  └─ Spacious
│  └─ Icon Size
│     ├─ Small
│     ├─ Medium
│     └─ Large
├─ Layout
│  ├─ Show Sidebar
│  ├─ Show Toolbar
│  ├─ Show Status Bar
│  ├─ Dual Pane
│  └─ Reset Layout…
├─ Show Hidden/System Files
├─ Refresh
└─ View Options…
```

### 7.2 View menu action matrix

| Menu path                                 | Enabled when            | UI outcome                             | Modal/dialog opened             | Backend/IPC intent                                      | Notes                                                                        |
| ----------------------------------------- | ----------------------- | -------------------------------------- | ------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| View > View Mode > Details                | Always                  | Direct preference/runtime update       | None                            | set_preference `defaultViewMode=details` when persisted | Shows columns: name, size, type, modified, permissions as available          |
| View > View Mode > List                   | Always                  | Direct preference/runtime update       | None                            | set_preference                                          | Condensed item list                                                          |
| View > View Mode > Icons                  | Always                  | Direct preference/runtime update       | None                            | set_preference                                          | Icon grid view                                                               |
| View > Sort By > Name                     | Active pane has listing | Direct sort update                     | None                            | frontend state/preference                               | Persist if sort preference exists                                            |
| View > Sort By > Type                     | Active pane has listing | Direct sort update                     | None                            | frontend state/preference                               | Uses normalized file type/category                                           |
| View > Sort By > Size                     | Active pane has listing | Direct sort update                     | None                            | frontend state/preference                               | Folders sort by policy: before files, size unknown, or computed if available |
| View > Sort By > Date Modified            | Active pane has listing | Direct sort update                     | None                            | frontend state/preference                               | Default secondary sort by name                                               |
| View > Sort By > Date Created             | Metadata available      | Direct sort update                     | None                            | frontend state/preference                               | Disable or hide where unsupported                                            |
| View > Sort By > Direction > Ascending    | Active pane has listing | Direct sort update                     | None                            | frontend state/preference                               | Radio/check state                                                            |
| View > Sort By > Direction > Descending   | Active pane has listing | Direct sort update                     | None                            | frontend state/preference                               | Radio/check state                                                            |
| View > Appearance > Theme > System        | Always                  | Immediate theme update                 | None                            | set_preference `theme=system`                           | Follows OS when available                                                    |
| View > Appearance > Theme > Light         | Always                  | Immediate theme update                 | None                            | set_preference `theme=light`                            | Must not restart app                                                         |
| View > Appearance > Theme > Dark          | Always                  | Immediate theme update                 | None                            | set_preference `theme=dark`                             | Must not restart app                                                         |
| View > Appearance > Density > Compact     | Always                  | Immediate density update               | None                            | set_preference `density=compact`                        | Affects rows, menus, toolbar, sidebar, dialogs                               |
| View > Appearance > Density > Comfortable | Always                  | Immediate density update               | None                            | set_preference `density=comfortable`                    | Default recommended                                                          |
| View > Appearance > Density > Spacious    | Always                  | Immediate density update               | None                            | set_preference `density=spacious`                       | Accessibility-friendly spacing                                               |
| View > Appearance > Icon Size > Small     | Always                  | Immediate icon update                  | None                            | set_preference if key exists                            | Applies to file list and sidebar where appropriate                           |
| View > Appearance > Icon Size > Medium    | Always                  | Immediate icon update                  | None                            | set_preference if key exists                            | Default                                                                      |
| View > Appearance > Icon Size > Large     | Always                  | Immediate icon update                  | None                            | set_preference if key exists                            | Especially for icon view                                                     |
| View > Layout > Show Sidebar              | Always                  | Toggle layout                          | None                            | set_preference `sidebarVisibility`                      | Checkable menu item                                                          |
| View > Layout > Show Toolbar              | Always                  | Toggle layout                          | None                            | set_preference                                          | Toolbar hidden state must still allow menu access                            |
| View > Layout > Show Status Bar           | Always                  | Toggle layout                          | None                            | set_preference                                          | Checkable menu item                                                          |
| View > Layout > Dual Pane                 | Always                  | Toggle single/dual pane                | None                            | set_preference `paneLayout`                             | Dual-pane state persists                                                     |
| View > Layout > Reset Layout…             | Always                  | Confirmation                           | **Reset Layout confirmation**   | reset layout preferences                                | Must not reset file operation history                                        |
| View > Show Hidden/System Files           | Always                  | Toggle + reload pane(s)                | None, toast on failure          | set_preference `showHiddenFiles`; list refresh          | Checkable; refreshes affected listing immediately                            |
| View > Refresh                            | Active pane has path    | Direct reload                          | Error pane/toast on failure     | fs_list_start                                           | F5/Ctrl/Cmd+R equivalent                                                     |
| View > View Options…                      | Always                  | Opens preferences focused to File List | **Settings dialog > File List** | get_preferences / set_preference                        | Useful when menu becomes too dense                                           |

---

## 8. Go menu

### 8.1 Structure

```text
Go
├─ Back
├─ Forward
├─ Up to Parent
├─ Home
├─ Location…
├─ Standard Locations
│  ├─ Desktop
│  ├─ Documents
│  ├─ Downloads
│  ├─ Pictures
│  ├─ Music
│  └─ Videos
├─ Devices and Volumes
│  ├─ [dynamic mounted volume 1]
│  ├─ [dynamic mounted volume 2]
│  └─ More Volumes…
├─ Favorites
│  ├─ Add Current Folder to Favorites
│  ├─ [dynamic favorite 1]
│  ├─ [dynamic favorite 2]
│  └─ Manage Favorites…
└─ Recent Locations
   ├─ [dynamic recent location 1]
   ├─ [dynamic recent location 2]
   ├─ Show All Recent Locations…
   └─ Clear Recent Locations…
```

### 8.2 Dynamic submenu rules for Go

- **Standard Locations** contains only available folders. Missing folders are hidden, not disabled.
- **Devices and Volumes** shows up to 8 mounted locations. If more exist, show **More Volumes…** which opens a searchable picker modal.
- **Favorites** shows up to 10 favorites. If more exist, show **Manage Favorites…**.
- **Recent Locations** shows up to 10 recent locations, newest first. If more exist, show **Show All Recent Locations…**.

### 8.3 Go menu action matrix

| Menu path                                          | Enabled when                             | UI outcome                              | Modal/dialog opened                               | Backend/IPC intent                   | Notes                                              |
| -------------------------------------------------- | ---------------------------------------- | --------------------------------------- | ------------------------------------------------- | ------------------------------------ | -------------------------------------------------- |
| Go > Back                                          | Back stack exists for active pane        | Direct navigation                       | Error pane/toast on failure                       | fs_list_start                        | Disabled when no back entry                        |
| Go > Forward                                       | Forward stack exists for active pane     | Direct navigation                       | Error pane/toast on failure                       | fs_list_start                        | Disabled when no forward entry                     |
| Go > Up to Parent                                  | Active path has parent                   | Direct navigation                       | Error pane/toast on failure                       | fs_list_start                        | Disabled at root/drive root                        |
| Go > Home                                          | Home path detected                       | Direct navigation                       | Error pane/toast on failure                       | fs_list_start                        | Platform-aware home                                |
| Go > Location…                                     | Always                                   | Focus path entry or open location modal | **Go to Location dialog** if path bar unavailable | fs_stat/fs_list_start                | Ctrl/Cmd+L equivalent                              |
| Go > Standard Locations > Desktop                  | Desktop available                        | Direct navigation                       | Error pane/toast on failure                       | fs_list_start                        | Hidden if not detected                             |
| Go > Standard Locations > Documents                | Documents available                      | Direct navigation                       | Error pane/toast on failure                       | fs_list_start                        | Hidden if not detected                             |
| Go > Standard Locations > Downloads                | Downloads available                      | Direct navigation                       | Error pane/toast on failure                       | fs_list_start                        | Hidden if not detected                             |
| Go > Standard Locations > Pictures/Music/Videos    | Folder available                         | Direct navigation                       | Error pane/toast on failure                       | fs_list_start                        | Hidden if not detected                             |
| Go > Devices and Volumes > [volume]                | Volume available                         | Direct navigation                       | Error pane/toast on failure                       | fs_list_start                        | Inaccessible volumes display permission/error pane |
| Go > Devices and Volumes > More Volumes…           | More than 8 volumes                      | Opens picker                            | **Volume Picker dialog**                          | platform volume discovery/list start | Searchable list                                    |
| Go > Favorites > Add Current Folder to Favorites   | Active path exists                       | Direct add or small form                | **Add Favorite dialog** if name/edit needed       | preferences/favorites store          | Toast on success                                   |
| Go > Favorites > [favorite]                        | Favorite exists                          | Direct navigation                       | Error dialog if missing                           | fs_list_start                        | Missing favorite offers remove option              |
| Go > Favorites > Manage Favorites…                 | Always                                   | Opens manager                           | **Manage Favorites dialog**                       | preferences/favorites store          | Reorder/remove/rename favorites                    |
| Go > Recent Locations > [recent]                   | Recent target exists or can be attempted | Direct navigation                       | Error dialog if missing                           | fs_list_start                        | Missing target offers remove from recent           |
| Go > Recent Locations > Show All Recent Locations… | Recent list not empty                    | Opens manager                           | **Recent Locations dialog**                       | recent locations store               | Searchable list                                    |
| Go > Recent Locations > Clear Recent Locations…    | Recent list not empty                    | Confirmation                            | **Clear Recent Locations confirmation**           | recent locations store               | Non-filesystem destructive action                  |

---

## 9. Tools menu

### 9.1 Structure

```text
Tools
├─ Search
│  ├─ Filter Current Folder
│  └─ Search Recursively…
├─ Operations
│  ├─ Job Activity…
│  ├─ Recent Operations…
│  ├─ Cancel Active Job…
│  └─ Clear Operation History…
├─ Diagnostics
│  ├─ Diagnostics…
│  └─ Export Diagnostics Bundle…
└─ Developer Tools               [dev builds only]
   ├─ Open WebView Inspector
   └─ Toggle Debug Overlay
```

### 9.2 Tools menu action matrix

| Menu path                                        | Enabled when            | UI outcome              | Modal/dialog opened                      | Backend/IPC intent              | Notes                                                        |
| ------------------------------------------------ | ----------------------- | ----------------------- | ---------------------------------------- | ------------------------------- | ------------------------------------------------------------ |
| Tools > Search > Filter Current Folder           | Active pane has listing | Focus filter bar        | None                                     | frontend filter state           | Ctrl/Cmd+F equivalent if search bar is current-folder filter |
| Tools > Search > Search Recursively…             | Active pane has folder  | Opens search form/panel | **Recursive Search dialog/panel**        | job-backed recursive search     | Must be cancellable and incremental                          |
| Tools > Operations > Job Activity…               | Always                  | Opens drawer            | **Job Activity drawer**                  | get_job_status/list active jobs | Non-modal; can stay open                                     |
| Tools > Operations > Recent Operations…          | Always                  | Opens history           | **Operation History dialog**             | list_recent_operations          | Search/filter inside dialog if list grows                    |
| Tools > Operations > Cancel Active Job…          | Active job exists       | Confirmation            | **Cancel Job confirmation**              | cancel_job                      | Disabled if no cancellable job                               |
| Tools > Operations > Clear Operation History…    | Terminal history exists | Confirmation            | **Clear Operation History confirmation** | clear_operation_history         | Active jobs must be preserved                                |
| Tools > Diagnostics > Diagnostics…               | Always                  | Opens diagnostics       | **Diagnostics dialog**                   | diagnostics_app_data_health     | Production-safe data only by default                         |
| Tools > Diagnostics > Export Diagnostics Bundle… | Always                  | Opens save/export flow  | **Export Diagnostics dialog**            | export_diagnostics_bundle       | Redact sensitive paths where required                        |
| Tools > Developer Tools > Open WebView Inspector | Dev build only          | Direct action           | None                                     | Tauri/WebView devtool hook      | Hidden in production                                         |
| Tools > Developer Tools > Toggle Debug Overlay   | Dev build only          | Direct toggle           | None                                     | frontend debug state            | Hidden in production                                         |

---

## 10. Window menu

### 10.1 Structure

```text
Window
├─ Switch Active Pane
├─ Focus Left Pane
├─ Focus Right Pane
├─ Toggle Dual Pane
├─ Swap Panes
├─ Equalize Pane Widths
├─ Increase Left Pane Width
├─ Increase Right Pane Width
├─ Minimize                 [platform-managed where available]
└─ Close Window             [platform-managed where available]
```

### 10.2 Window menu action matrix

| Menu path                          | Enabled when      | UI outcome             | Modal/dialog opened                          | Backend/IPC intent              | Notes                                                    |
| ---------------------------------- | ----------------- | ---------------------- | -------------------------------------------- | ------------------------------- | -------------------------------------------------------- |
| Window > Switch Active Pane        | Dual pane enabled | Direct focus change    | None                                         | frontend pane state             | Tab equivalent                                           |
| Window > Focus Left Pane           | Left pane exists  | Direct focus change    | None                                         | frontend pane state             | Disabled in single-pane mode if left pane not relevant   |
| Window > Focus Right Pane          | Dual pane enabled | Direct focus change    | None                                         | frontend pane state             | Disabled in single-pane mode                             |
| Window > Toggle Dual Pane          | Always            | Toggle layout          | None                                         | set_preference `paneLayout`     | Preserves last path of hidden pane                       |
| Window > Swap Panes                | Dual pane enabled | Direct swap            | None                                         | frontend pane state             | Swaps paths, selection, sort/filter if model supports it |
| Window > Equalize Pane Widths      | Dual pane enabled | Direct layout update   | None                                         | set_preference `splitRatio=0.5` | Immediate visual update                                  |
| Window > Increase Left Pane Width  | Dual pane enabled | Direct layout update   | None                                         | set_preference `splitRatio`     | Keyboard accessible                                      |
| Window > Increase Right Pane Width | Dual pane enabled | Direct layout update   | None                                         | set_preference `splitRatio`     | Keyboard accessible                                      |
| Window > Minimize                  | Platform supports | Direct platform action | None                                         | window API                      | Optional/platform standard                               |
| Window > Close Window              | Always            | Close flow             | **Running Jobs confirmation** if jobs active | window API                      | Must protect active operations                           |

---

## 11. Help menu

### 11.1 Structure

```text
Help
├─ Keyboard Shortcuts…
├─ Documentation
├─ Report Issue
├─ Diagnostics…
├─ Export Diagnostics Bundle…
└─ About FileOctopus…
```

### 11.2 Help menu action matrix

| Menu path                         | Enabled when | UI outcome                            | Modal/dialog opened                                     | Backend/IPC intent                   | Notes                                                 |
| --------------------------------- | ------------ | ------------------------------------- | ------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------- |
| Help > Keyboard Shortcuts…        | Always       | Opens reference                       | **Keyboard Shortcuts dialog**                           | frontend static data                 | Must show platform-specific Cmd/Ctrl labels           |
| Help > Documentation              | Always       | Opens external docs URL or local help | Error toast on failure                                  | open external URL                    | If no docs URL exists, open local help modal          |
| Help > Report Issue               | Always       | Opens issue URL or diagnostics prompt | **Report Issue dialog** if diagnostics bundle suggested | open external URL/export diagnostics | Should encourage exporting diagnostics bundle         |
| Help > Diagnostics…               | Always       | Opens diagnostics                     | **Diagnostics dialog**                                  | diagnostics_app_data_health          | Alias to Tools menu                                   |
| Help > Export Diagnostics Bundle… | Always       | Opens export flow                     | **Export Diagnostics dialog**                           | export_diagnostics_bundle            | Alias to Tools menu                                   |
| Help > About FileOctopus…         | Always       | Opens about box                       | **About dialog**                                        | app_get_info                         | Shows app version, build profile, OS, license notices |

---

## 12. Pane toolbar menus

The toolbar must stay compact. Primary actions are visible; low-frequency actions move to dropdowns.

### 12.1 Toolbar layout

```text
[Back] [Forward] [Up]   [Path/Breadcrumb]   [Refresh]
[New ▾] [Copy] [Move] [Trash]   [View ▾] [More ▾]
```

In narrow widths, collapse actions into **More ▾** in this order:

1. Copy Path
2. Copy Name
3. Properties
4. Show Hidden/System Files
5. View Options
6. Move To
7. Copy To

### 12.2 New dropdown

```text
New
├─ Folder…
└─ Empty File…
```

Both open the same UI as **File > New**.

### 12.3 View dropdown

```text
View
├─ Details
├─ List
├─ Icons
├─ Sort By
│  ├─ Name
│  ├─ Type
│  ├─ Size
│  └─ Date Modified
├─ Show Hidden/System Files
└─ View Options…
```

### 12.4 More dropdown

```text
More
├─ Rename…
├─ Copy Path
├─ Copy Name
├─ Properties…
├─ Reveal in System File Manager
├─ Open in Terminal                  [optional/future]
└─ Diagnostics for This Pane…         [dev/support builds only]
```

**More** must not become a dumping ground. If more than 10 actions are needed, split into submenus:

```text
More
├─ File Actions
├─ Copy Text
├─ Navigation
└─ Support
```

---

## 13. Context menus

### 13.1 File item context menu

Shown when right-clicking a file row/card. If the clicked item is not selected, it becomes the sole selection before opening the menu.

```text
Open
Open With Default App
Reveal in System File Manager
---
Cut
Copy
Paste                         [only if valid target; usually disabled for files]
---
Rename…
Copy To…
Move To…
Move to Trash…
Delete Permanently…
---
Copy Text
├─ Copy Full Path
├─ Copy File Name
├─ Copy Parent Folder Path
└─ Copy Resource URI
---
Properties…
```

### 13.2 Folder item context menu

Shown when right-clicking a folder row/card.

```text
Open
Open in New Pane               [optional if dual-pane behavior supports it]
Reveal in System File Manager
---
Cut
Copy
Paste Into Folder              [enabled when clipboard valid]
---
Rename…
Copy To…
Move To…
Move to Trash…
Delete Permanently…
---
Add to Favorites
Copy Text
├─ Copy Full Path
├─ Copy Folder Name
├─ Copy Parent Folder Path
└─ Copy Resource URI
---
Properties…
```

### 13.3 Multi-selection context menu

Shown when right-clicking a selected item while multiple items are selected.

```text
Open Selected                  [only if safe; otherwise disabled]
Reveal First Item in System File Manager
---
Cut
Copy
---
Copy To…
Move To…
Move to Trash…
Delete Permanently…
---
Copy Text
├─ Copy Full Paths
├─ Copy Names
└─ Copy Resource URIs
---
Properties…
```

Rules:

- **Rename…** is hidden or disabled for multi-selection until bulk rename exists.
- **Properties…** opens **Selection Properties dialog**.
- **Open Selected** should be disabled for very large selections or mixed unsupported targets.
- Text-copy actions produce newline-separated values.

### 13.4 Empty-space context menu

Shown when right-clicking empty file-list background. It targets the current folder, not the current selection.

```text
New
├─ Folder…
└─ Empty File…
Paste
Refresh
---
Select All
Clear Selection
---
View Mode
├─ Details
├─ List
└─ Icons
Sort By
├─ Name
├─ Type
├─ Size
├─ Date Modified
└─ Direction
   ├─ Ascending
   └─ Descending
Show Hidden/System Files
---
Folder Properties…
```

### 13.5 Sidebar context menu

Shown when right-clicking a sidebar location, favorite, or volume.

#### Standard folder entry

```text
Open
Open in Other Pane
Reveal in System File Manager
Add to Favorites               [if not already favorite]
Copy Path
Properties…
```

#### Favorite entry

```text
Open
Open in Other Pane
Rename Favorite…
Remove from Favorites…
Reveal in System File Manager
Copy Path
Properties…
```

#### Device/volume entry

```text
Open
Open in Other Pane
Reveal in System File Manager
Copy Path
Properties…
Eject/Unmount…                 [future/platform-supported only]
```

### 13.6 Breadcrumb context menu

Shown when right-clicking a breadcrumb segment.

```text
Open This Location
Open in Other Pane
Copy Path
Reveal in System File Manager
Add to Favorites
Properties…
```

### 13.7 Job item context menu

Shown inside the Job Activity drawer or Operation History dialog.

```text
Show Details…
Reveal Source                  [when available]
Reveal Destination             [when available]
Cancel Job…                    [active jobs only]
Copy Job ID                    [support builds only]
Copy Error Details             [failed jobs only]
```

---

## 14. Modal and dialog catalog

All dialogs must use a shared `ModalShell` or equivalent component.

### 14.1 Shared modal requirements

Every modal must:

- trap focus while open,
- restore focus to the invoking control when closed,
- close on Escape unless a job is currently in a non-cancellable critical section,
- support Enter for the primary safe action,
- never focus a destructive action by default,
- use theme/density/font tokens,
- be keyboard accessible,
- expose accessible title and description,
- show validation errors inline,
- use non-technical error messages by default,
- provide expandable technical details only when useful for support.

### 14.2 New Folder dialog

**Opened by:**

- File > New > Folder…
- Toolbar > New > Folder…
- Empty-space context menu > New > Folder…

**Fields:**

- Parent folder path, read-only display.
- Folder name input.

**Buttons:**

- Create Folder
- Cancel

**Validation:**

- Name cannot be empty.
- Name cannot contain path separators.
- Name cannot be reserved by platform rules.
- Name cannot conflict with existing item unless overwrite/merge support is explicitly implemented.

**Success behavior:**

- Create folder.
- Refresh current pane.
- Select new folder.
- Show success toast only if operation is not visually obvious.

### 14.3 New File dialog

**Opened by:**

- File > New > Empty File…
- Toolbar > New > Empty File…
- Empty-space context menu > New > Empty File…

**Fields:**

- Parent folder path, read-only display.
- File name input.

**Buttons:**

- Create File
- Cancel

**Validation:** same as New Folder, with file-specific collision handling.

### 14.4 Rename dialog / inline rename

**Opened by:**

- File > File Actions > Rename…
- Context menu > Rename…
- F2 shortcut

**Preferred UI:** inline edit in file list.  
**Fallback UI:** Rename dialog.

**Fields:**

- Current name, read-only.
- New name input.

**Buttons:**

- Rename
- Cancel

**Validation:**

- New name cannot be empty.
- New name cannot equal existing sibling unless case-only rename is supported by platform semantics.
- New name cannot include path separators.
- Extension changes may show a warning if enabled by UX policy.

### 14.5 Copy To dialog

**Opened by:**

- File > File Actions > Copy To…
- Context menu > Copy To…
- Toolbar/More > Copy To…

**Fields and sections:**

- Source summary: item count and total size when known.
- Destination picker: path input, sidebar shortcuts, recent destinations.
- Conflict policy: Ask, Skip, Replace, Keep Both. MVP default: Ask.
- Plan preview area.

**Buttons:**

- Review / Copy
- Cancel

**Behavior:**

1. User chooses destination.
2. Frontend requests operation plan.
3. If no warnings/conflicts, user can start copy.
4. If conflicts exist, open **Conflict Resolution dialog** or show conflict section inside the same dialog.

### 14.6 Move To dialog

Same as Copy To dialog, except:

- action label is Move,
- source writability must be checked,
- dialog warns if moving across volumes may fall back to copy+delete semantics,
- successful move clears relevant cut clipboard state.

### 14.7 Paste confirmation/conflict dialog

**Opened by:**

- Edit > Clipboard > Paste
- Context menu > Paste
- Toolbar paste action if added

**Shown when:**

- destination conflicts exist,
- destination is protected/read-only,
- operation crosses provider boundary,
- operation has warnings,
- user preference requires paste confirmation.

**Content:**

- Operation type: Copy or Move.
- Destination path.
- Item count and total size when known.
- Conflict list with per-item choices where feasible.

**Buttons:**

- Start Operation
- Cancel

### 14.8 Conflict Resolution dialog

**Opened by:** Copy, Move, Paste, Rename when conflicts are detected.

**Required conflict actions:**

```text
For this item:
├─ Replace
├─ Skip
├─ Keep Both
└─ Cancel Operation

Apply to all conflicts [checkbox]
```

**Rules:**

- Default selection is safe: Skip or Cancel, not Replace.
- For folders, clarify whether replace means merge or replace. MVP should avoid ambiguous folder replace and prefer Skip/Keep Both/Cancel unless merge semantics are implemented.
- Show source and destination metadata: name, path, size, modified date.

### 14.9 Move to Trash confirmation

**Opened by:**

- File > File Actions > Move to Trash…
- Context menu > Move to Trash…
- Delete key when configured to confirm

**Content:**

- “Move N item(s) to Trash?”
- List first 5 item names, then “and N more”.
- Destination: system Trash, if available.

**Buttons:**

- Move to Trash
- Cancel

**Rules:**

- Primary destructive button may be visually dangerous but is less severe than permanent delete.
- If platform trash is unavailable, show error dialog and offer permanent delete only as a separate explicit action.

### 14.10 Permanent Delete confirmation

**Opened by:**

- File > File Actions > Delete Permanently…
- Context menu > Delete Permanently…
- Shift+Delete

**Content:**

- Clear irreversible warning.
- Item count.
- First 5 item names and “and N more”.
- Optional total size.

**Required safety:**

- Default focused button is Cancel.
- Destructive button label: **Delete Permanently**.
- For large/multi-folder deletes, require typing `DELETE` or the item name if product policy enables extra safety.

**Buttons:**

- Delete Permanently
- Cancel

### 14.11 Properties dialog

**Opened by:**

- File > Properties…
- Context menu > Properties…
- Empty-space context menu > Folder Properties…
- Breadcrumb/sidebar context menu > Properties…

**Tabs/sections:**

```text
General
├─ Name
├─ Type
├─ Full path
├─ Resource URI
├─ Size
├─ Contains [folders/files count, for folders]
├─ Created
├─ Modified
├─ Accessed
├─ Permissions summary
├─ Hidden/System flags
└─ Provider capabilities

Actions
├─ Copy Path
├─ Copy Resource URI
├─ Reveal in System File Manager
└─ Calculate Size / Cancel Size Calculation [folders]
```

**Buttons:**

- Close

**Rules:**

- Folder size calculation must be cancellable and must not freeze UI.
- Missing metadata displays as “Not available” instead of blank or raw null.
- Multi-selection opens **Selection Properties dialog**.

### 14.12 Selection Properties dialog

**Opened by:** Properties action with multiple selected items.

**Content:**

- Item count.
- File count.
- Folder count.
- Total size calculation status.
- Common parent path.
- Mixed permissions/flags summary.

**Buttons:**

- Calculate Total Size / Cancel
- Copy Paths
- Close

### 14.13 Settings dialog

**Opened by:**

- File > Settings…
- macOS FileOctopus > Settings…
- View > View Options…
- Edit > Preferences… optional alias

**Navigation sections:**

```text
Appearance
├─ Theme: System / Light / Dark
├─ Density: Compact / Comfortable / Spacious
├─ Font size
└─ Icon size

File List
├─ Default view mode: Details / List / Icons
├─ Show hidden/system files
├─ Sort default
└─ Show file extensions [future/optional]

Layout
├─ Single pane / Dual pane
├─ Sidebar visibility
├─ Status bar visibility
├─ Toolbar visibility
└─ Reset layout…

Operations
├─ Confirm move to trash
├─ Confirm paste with conflicts
├─ Show job activity automatically
└─ Operation history retention [future]

Diagnostics
├─ Diagnostics visibility
├─ Export diagnostics bundle…
└─ Include technical details in error dialogs [support/dev option]
```

**Buttons:**

- Close
- Reset Section… where appropriate

**Behavior:**

- Preferences apply immediately where practical.
- Invalid values are rejected with structured errors.
- The dialog should not require Save unless batching settings becomes necessary. Use immediate persistence with clear feedback.

### 14.14 Reset Layout confirmation

**Opened by:** View > Layout > Reset Layout… or Settings > Layout > Reset Layout…

**Content:**

- Explains that pane split, sidebar visibility, toolbar/status visibility, and default view layout will reset.
- Explicitly says files and operation history are not deleted.

**Buttons:**

- Reset Layout
- Cancel

### 14.15 Go to Location dialog

**Opened by:** Go > Location… when not focusing existing path bar.

**Fields:**

- Path/URI input.
- Recent locations suggestions.

**Buttons:**

- Go
- Cancel

**Validation:**

- Invalid URI/path shows inline error.
- Permission denied opens pane error state, not a crash.

### 14.16 Volume Picker dialog

**Opened by:** Go > Devices and Volumes > More Volumes…

**Content:**

- Search box.
- List of mounted volumes/drives.
- State indicators: available, inaccessible, permission required, disconnected.

**Buttons:**

- Open
- Cancel

### 14.17 Add Favorite dialog

**Opened by:**

- Go > Favorites > Add Current Folder to Favorites
- Folder/sidebar/breadcrumb context menu > Add to Favorites

**Fields:**

- Favorite name.
- Path, read-only.

**Buttons:**

- Add Favorite
- Cancel

### 14.18 Manage Favorites dialog

**Opened by:** Go > Favorites > Manage Favorites…

**Content:**

- Search/filter favorites.
- Reorder handles.
- Rename action.
- Remove action.
- Open action.

**Buttons:**

- Done

**Removal behavior:**

- Removing a favorite should confirm only if accidental removal is likely; it does not delete files.

### 14.19 Recent Locations dialog

**Opened by:** Go > Recent Locations > Show All Recent Locations…

**Content:**

- Search/filter recent locations.
- Open selected.
- Remove selected from recent list.
- Clear all.

**Buttons:**

- Open
- Close

### 14.20 Clear Recent Locations confirmation

**Opened by:** Go > Recent Locations > Clear Recent Locations…

**Content:**

- Explains that only navigation history is cleared.
- Files are not changed.

**Buttons:**

- Clear Recent Locations
- Cancel

### 14.21 Recursive Search dialog/panel

**Opened by:** Tools > Search > Search Recursively…

**Fields:**

- Search root path.
- Name pattern input.
- Include hidden/system files toggle.
- Optional file type filter.
- Optional modified date filter.

**Results:**

- Incremental result list.
- Reveal in folder action.
- Open action.
- Properties action.

**Buttons:**

- Search
- Cancel Search
- Close

**Rules:**

- Search must be job-backed or otherwise cancellable.
- Large searches must stream results progressively.

### 14.22 Job Activity drawer

**Opened by:** Tools > Operations > Job Activity… or status bar job indicator.

**Type:** non-modal drawer/panel.

**Content:**

- Active jobs.
- Queued jobs.
- Recent completed/failed jobs.
- Per-job progress.
- Cancel button for cancellable jobs.
- Details expansion.

**Rules:**

- Must not block navigation.
- Failed jobs show human-readable reason and expandable details.

### 14.23 Operation History dialog

**Opened by:** Tools > Operations > Recent Operations…

**Content:**

- Recent operations table.
- Columns: time, operation, status, item count, source, destination.
- Filters: status, operation type, date.
- Actions: reveal source/destination, show details, copy error details.

**Buttons:**

- Close
- Clear History…

### 14.24 Cancel Job confirmation

**Opened by:**

- Tools > Operations > Cancel Active Job…
- Job Activity drawer > Cancel
- Job item context menu > Cancel Job…

**Content:**

- Job type.
- Current progress.
- Warning that completed items may remain changed.

**Buttons:**

- Cancel Job
- Keep Running

### 14.25 Clear Operation History confirmation

**Opened by:** Tools > Operations > Clear Operation History…

**Content:**

- Explains that completed/failed operation history rows will be removed.
- Active jobs are preserved.

**Buttons:**

- Clear History
- Cancel

### 14.26 Diagnostics dialog

**Opened by:**

- Tools > Diagnostics > Diagnostics…
- Help > Diagnostics…

**Content:**

- App version.
- Build profile.
- Commit SHA when available.
- Target OS.
- App data path health.
- Log path health.
- Schema/database health.
- Recovered jobs count if applicable.
- Export Diagnostics Bundle button.

**Rules:**

- Production mode hides developer-only details by default.
- Technical paths may be copyable but should avoid leaking unnecessary sensitive data in screenshots.

### 14.27 Export Diagnostics dialog

**Opened by:**

- Tools > Diagnostics > Export Diagnostics Bundle…
- Help > Export Diagnostics Bundle…
- Diagnostics dialog > Export

**Fields:**

- Destination path.
- Include logs checkbox.
- Include operation history summary checkbox.
- Redact usernames/absolute paths checkbox, default enabled if implemented.

**Buttons:**

- Export
- Cancel

**Success behavior:**

- Show export path.
- Offer Reveal in System File Manager.

### 14.28 Keyboard Shortcuts dialog

**Opened by:** Help > Keyboard Shortcuts…

**Content groups:**

```text
Navigation
Selection
File Operations
View and Layout
Search
Window/Panes
```

**Rules:**

- Show `Cmd` labels on macOS and `Ctrl` labels on Windows/Linux.
- Include only implemented shortcuts.
- Search/filter inside dialog if the list grows.

### 14.29 About dialog

**Opened by:** Help > About FileOctopus… or macOS app menu.

**Content:**

- Product name.
- Version.
- Build profile.
- Commit SHA when available.
- Target OS.
- License/legal notices link or section.

**Buttons:**

- Close
- Copy Version Info

### 14.30 Report Issue dialog

**Opened by:** Help > Report Issue when product policy wants an intermediate prompt.

**Content:**

- Short explanation that diagnostics can help with support.
- Buttons to export diagnostics or open issue tracker without diagnostics.

**Buttons:**

- Export Diagnostics
- Open Issue Tracker
- Cancel

### 14.31 Running Jobs close confirmation

**Opened by:** File > Exit, Window > Close Window, platform close event when active jobs exist.

**Content:**

- Number of active jobs.
- Current top job summary.
- Warning that closing may cancel or leave operation state uncertain, depending on runtime behavior.

**Buttons:**

- Keep FileOctopus Open
- Cancel Jobs and Exit, if supported
- Exit After Jobs Finish, future/optional

Default button must keep the app open.

### 14.32 Error details dialog

**Opened by:** Error toast “Details”, pane error action, operation failure details.

**Content:**

- Human-readable error.
- Suggested recovery action.
- Affected path/resource.
- Error code.
- Expandable technical details.

**Buttons:**

- Copy Details
- Close

---

## 15. Keyboard shortcuts and menu labels

Menu labels must show shortcuts where implemented.

| Shortcut           | Action                          | Menu path                                 |
| ------------------ | ------------------------------- | ----------------------------------------- |
| Enter              | Open selected item              | File > Open > Open Selected               |
| F2                 | Rename selected item            | File > File Actions > Rename…             |
| Delete             | Move to Trash                   | File > File Actions > Move to Trash…      |
| Shift+Delete       | Delete Permanently              | File > File Actions > Delete Permanently… |
| Ctrl/Cmd+C         | Copy selected items             | Edit > Clipboard > Copy                   |
| Ctrl/Cmd+X         | Cut selected items              | Edit > Clipboard > Cut                    |
| Ctrl/Cmd+V         | Paste into active folder        | Edit > Clipboard > Paste                  |
| Ctrl/Cmd+A         | Select All                      | Edit > Selection > Select All             |
| Backspace / Alt+Up | Up to Parent                    | Go > Up to Parent                         |
| Alt+Left           | Back                            | Go > Back                                 |
| Alt+Right          | Forward                         | Go > Forward                              |
| F5 / Ctrl/Cmd+R    | Refresh                         | View > Refresh                            |
| Ctrl/Cmd+L         | Focus path bar / Go to Location | Go > Location…                            |
| Ctrl/Cmd+F         | Filter Current Folder           | Tools > Search > Filter Current Folder    |
| Tab                | Switch Active Pane              | Window > Switch Active Pane               |

Shortcut handling must not fire while the user is typing in text fields, rename inputs, path entry, search fields, or modal form controls unless the shortcut is explicitly scoped to that control.

---

## 16. Enablement rules

### 16.1 Selection-based enablement

| State                 |        Open |                     Rename |     Copy |                                Cut |                                 Paste |                 Copy To |                 Move To |    Trash |          Permanent Delete |                                        Properties |
| --------------------- | ----------: | -------------------------: | -------: | ---------------------------------: | ------------------------------------: | ----------------------: | ----------------------: | -------: | ------------------------: | ------------------------------------------------: |
| No selection          |    Disabled |                   Disabled | Disabled |                           Disabled |           Depends on folder clipboard |                Disabled |                Disabled | Disabled |                  Disabled | Folder properties available from empty-space menu |
| Single file           |     Enabled |                    Enabled |  Enabled | Enabled if writable/source movable |                      Usually disabled |                 Enabled |                 Enabled |  Enabled | Enabled with confirmation |                                           Enabled |
| Single folder         |     Enabled |                    Enabled |  Enabled | Enabled if writable/source movable |  Paste Into Folder if clipboard valid |                 Enabled |                 Enabled |  Enabled | Enabled with confirmation |                                           Enabled |
| Multiple selection    | Conditional | Disabled until bulk rename |  Enabled |             Enabled if all movable | Disabled unless current folder target |                 Enabled |                 Enabled |  Enabled | Enabled with confirmation |                              Selection properties |
| Read-only source      |     Enabled |                   Disabled |  Enabled |                           Disabled |                                   N/A |                 Enabled |                Disabled | Disabled |                  Disabled |                                           Enabled |
| Read-only destination |         N/A |                        N/A |      N/A |                                N/A |                              Disabled | Disabled as destination | Disabled as destination |      N/A |                       N/A |                                           Enabled |

### 16.2 Clipboard enablement

Paste is enabled only when:

- file clipboard contains at least one source,
- active target folder exists,
- active target folder is writable,
- operation kind is valid for provider combination,
- source and target do not create recursive move/copy into itself,
- current security policy allows the operation.

### 16.3 Job enablement

- **Cancel Active Job…** is enabled only when at least one active job is cancellable.
- **Clear Operation History…** is enabled only when terminal history rows exist.
- Closing the app with active jobs opens Running Jobs close confirmation.

---

## 17. Long menu and submenu rules

### 17.1 Static menus

For static menus:

- Maximum recommended visible items before separators/submenus: 10.
- Maximum recommended groups: 4.
- Every group must have a clear purpose.
- Do not mix destructive actions into the same group as safe actions.
- Destructive actions belong near the bottom of relevant menus, separated from normal actions.

### 17.2 Dynamic menus

For dynamic menus:

| Menu                                   | Visible cap | Overflow behavior                 |
| -------------------------------------- | ----------: | --------------------------------- |
| Devices and Volumes                    |           8 | More Volumes… dialog              |
| Favorites                              |          10 | Manage Favorites… dialog          |
| Recent Locations                       |          10 | Show All Recent Locations… dialog |
| Recent Operations quick menu, if added |           5 | Operation History dialog          |
| Open With apps, if added               |           8 | Choose Application… dialog        |

### 17.3 Sorting dynamic entries

- Favorites use user-defined order.
- Recent locations use most recently used order.
- Volumes use platform order, with internal/system volumes grouped before removable/network volumes if metadata allows.
- Inaccessible entries remain visible only if useful and must show disabled or warning state.

---

## 18. Error handling model for menu actions

| Error class                    | UI behavior                                                                 |
| ------------------------------ | --------------------------------------------------------------------------- |
| Invalid path/name              | Inline validation in the active dialog                                      |
| Not found                      | Error dialog or pane error with Remove from Recent/Favorites where relevant |
| Permission denied              | Pane error or modal error with Reveal Parent / Retry if useful              |
| Destination conflict           | Conflict Resolution dialog                                                  |
| Unsupported provider/action    | Disabled action where predictable; otherwise error dialog                   |
| Operation cancelled            | Non-error toast/status update                                               |
| OS open/reveal failure         | Error toast with Details                                                    |
| Preferences validation failure | Inline Settings dialog error                                                |
| Diagnostics export failure     | Export Diagnostics dialog error section                                     |

Errors shown from a menu action must identify the attempted action and the affected target. Example: “Could not rename `report.pdf` because a file with that name already exists.” Avoid raw backend messages as primary text.

---

## 19. Implementation component map

Recommended frontend components:

```text
AppMenuBar
├─ FileMenu
├─ EditMenu
├─ ViewMenu
├─ GoMenu
├─ ToolsMenu
├─ WindowMenu
└─ HelpMenu

PaneToolbar
├─ NavigationGroup
├─ PathBar
├─ PrimaryActionGroup
├─ NewMenuButton
├─ ViewMenuButton
└─ OverflowMenuButton

ContextMenus
├─ ItemContextMenu
├─ MultiSelectionContextMenu
├─ EmptySpaceContextMenu
├─ SidebarContextMenu
├─ BreadcrumbContextMenu
└─ JobContextMenu

Dialogs
├─ ModalShell
├─ ConfirmationDialog
├─ NewFolderDialog
├─ NewFileDialog
├─ RenameDialog
├─ CopyMoveDialog
├─ ConflictResolutionDialog
├─ PropertiesDialog
├─ SettingsDialog
├─ GoToLocationDialog
├─ FavoritesDialog
├─ RecentLocationsDialog
├─ SearchDialog
├─ OperationHistoryDialog
├─ DiagnosticsDialog
├─ ExportDiagnosticsDialog
├─ KeyboardShortcutsDialog
├─ AboutDialog
└─ ErrorDetailsDialog

Drawers
└─ JobActivityDrawer
```

Recommended state stores:

```text
navigationStore
selectionStore
clipboardStore
preferencesStore
jobStore
modalStore
contextMenuStore
favoritesStore
recentLocationsStore
```

---

## 20. Backend/API mapping

Menu implementations should use typed frontend client methods rather than raw Tauri calls.

| UI action                        | Backend/API mapping                          |
| -------------------------------- | -------------------------------------------- |
| List folder / refresh / navigate | `fs.listStart(...)`                          |
| Read metadata / properties       | `fs.stat(...)`                               |
| Plan copy/move/paste/delete      | `fileOperations.planFileOperation(...)`      |
| Start planned operation          | `fileOperations.startFileOperation(...)`     |
| Cancel job                       | `jobs.cancelJob(...)`                        |
| Read job status                  | `jobs.getJobStatus(...)`                     |
| List operation history           | `operationHistory.listRecentOperations(...)` |
| Clear operation history          | `operationHistory.clearOperationHistory()`   |
| Read preferences                 | `preferences.get()`                          |
| Update preference                | `preferences.set(...)`                       |
| Diagnostics health               | `diagnostics.appDataHealth()`                |
| Export diagnostics               | `diagnostics.exportBundle(...)`              |
| App info/about                   | `getAppInfo()`                               |

Additional backend commands likely needed if not already present:

| Needed command                                            | Purpose                                                  |
| --------------------------------------------------------- | -------------------------------------------------------- |
| `open_path_with_default_app(path)`                        | Open file in OS default application                      |
| `reveal_path_in_file_manager(path)`                       | Reveal file/folder in native file manager                |
| `create_empty_file(path)`                                 | Create empty file                                        |
| `create_folder(path)`                                     | Create folder if not already covered by operation engine |
| `rename_path(source, new_name)` or move operation wrapper | Rename item                                              |
| `discover_standard_locations()`                           | Home/Desktop/Documents/Downloads/etc.                    |
| `discover_volumes()`                                      | Drives, mount points, removable volumes                  |
| `calculate_folder_size(path)`                             | Cancellable folder size job                              |
| `search_recursive(root, query, options)`                  | Cancellable recursive search                             |

---

## 21. Acceptance criteria

The menu/modal implementation is complete when:

1. The top-level menu bar exists with File, Edit, View, Go, Tools, Window, and Help.
2. macOS has a platform-appropriate application menu.
3. File/folder context menus exist and respect selection state.
4. Empty-space context menu exists and targets the current folder.
5. Sidebar and breadcrumb context menus exist for navigation targets.
6. Toolbar actions are grouped and secondary actions are moved to dropdowns/overflow menus.
7. Every menu item has a documented UI outcome: direct action, modal, drawer, popover, inline edit, focus action, confirmation, or toast.
8. Dangerous operations require confirmation.
9. Long dynamic menus use caps and management dialogs.
10. Settings dialog exposes theme, density, view mode, hidden-file visibility, and layout preferences.
11. Diagnostics are not permanently visible in the main layout and are accessible through Help/Tools.
12. Modals trap focus and restore focus after close.
13. Shortcuts are visible in menus and documented in Keyboard Shortcuts dialog.
14. Theme, density, and font settings apply to all menus, dialogs, popovers, drawers, and toasts.
15. Disabled actions are visibly disabled and do not silently fail.
16. Error states are human-readable and provide technical details only as secondary expandable information.

---

## 22. Suggested implementation backlog

### Epic M1 — Menu infrastructure

- Build shared menu item model with label, shortcut, icon, enabled state, visibility, role, and action handler.
- Build `AppMenuBar` and platform menu variants.
- Build shared context menu component.
- Build shared modal shell and confirmation dialog.

### Epic M2 — File/Edit/View/Go menus

- Implement File menu actions and dialogs.
- Implement Edit clipboard/selection/text-copy actions.
- Implement View mode, sort, appearance, layout, and hidden-file toggles.
- Implement Go navigation, standard locations, favorites, and recent locations menus.

### Epic M3 — Context menus

- Implement item, folder, multi-selection, and empty-space context menus.
- Implement sidebar and breadcrumb context menus.
- Wire enablement rules to selection, clipboard, provider capabilities, and active pane state.

### Epic M4 — Settings and diagnostics dialogs

- Implement Settings dialog sections.
- Implement Diagnostics dialog.
- Implement Export Diagnostics flow.
- Move developer diagnostics out of the main layout.

### Epic M5 — Operations and safety dialogs

- Implement Copy To / Move To dialogs.
- Implement conflict resolution dialog.
- Implement delete/trash confirmations.
- Implement job activity drawer and operation history dialog.

### Epic M6 — Accessibility and QA

- Add keyboard navigation tests for menus and modals.
- Add focus trap/restore tests.
- Add visual regression tests for light/dark and density modes.
- Add state matrix tests for action enablement.
- Add manual QA checklist covering all menu paths.

---

## 23. Manual QA checklist

For each supported OS:

1. Open every top-level menu with mouse.
2. Open every top-level menu with keyboard.
3. Verify disabled actions for no selection.
4. Verify single-file context menu.
5. Verify single-folder context menu.
6. Verify multi-selection context menu.
7. Verify empty-space context menu.
8. Verify sidebar context menu.
9. Verify breadcrumb context menu.
10. Verify every modal opens from at least one menu path.
11. Verify Escape closes safe modals and restores focus.
12. Verify destructive confirmations do not default focus the destructive button.
13. Verify theme changes apply to menus and dialogs immediately.
14. Verify density changes affect menus and dialogs.
15. Verify hidden-file toggle refreshes listing.
16. Verify copy/cut/paste enablement follows clipboard state.
17. Verify operation conflict opens conflict dialog.
18. Verify diagnostics are accessible but not permanently visible.
19. Verify keyboard shortcuts match visible menu labels.
20. Verify no menu action silently fails.

---

## 24. Open decisions

| Decision                            | Recommendation                                                             |
| ----------------------------------- | -------------------------------------------------------------------------- |
| Inline rename vs modal rename       | Prefer inline rename; keep modal fallback for accessibility/error cases    |
| New file/folder inline row vs modal | Prefer inline row; modal acceptable for initial implementation             |
| Confirm Move to Trash always?       | Make configurable; always confirm multi-selection until confidence is high |
| Open With submenu                   | Defer until OS application discovery is implemented                        |
| Undo file operation                 | Defer; do not show Undo menu item until reliable implementation exists     |
| Bulk rename                         | Defer; hide/disable Rename for multi-selection                             |
| Eject/unmount volumes               | Defer unless platform-safe implementation exists                           |
| Open terminal here                  | Optional/future; must avoid arbitrary shell execution risk                 |
