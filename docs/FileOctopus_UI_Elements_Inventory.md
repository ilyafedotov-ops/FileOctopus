# FileOctopus UI Elements — Complete Inventory

> **Note:** This file is a **spec extract** from `FileOctopus_UI_Design_Spec.md` (element → spec text). For implementation status (done / stub / not built), use **[UI_FEATURE_INVENTORY.md](planning/UI_FEATURE_INVENTORY.md)** and **[PROJECT_STATUS_AND_DOC_ALIGNMENT.md](planning/PROJECT_STATUS_AND_DOC_ALIGNMENT.md)**.

> Extracted from `FileOctopus_UI_Design_Spec.md`. Every explicitly-specified element is listed with its exact spec text.

---

## 1. Title Bar

| Element                       | Spec Text                                 |
| ----------------------------- | ----------------------------------------- |
| Window controls               | "Window controls where applicable."       |
| App title                     | "App title: `FileOctopus`."               |
| Sync/health indicator         | "Optional sync/health indicator."         |
| Settings button               | "Settings button."                        |
| Global command palette button | "Optional global command palette button." |

---

## 2. Sidebar

### 2.1 Sidebar Sections & Items

#### Favorites

| Item      | Spec Text              |
| --------- | ---------------------- |
| Home      | Listed under Favorites |
| Desktop   | Listed under Favorites |
| Documents | Listed under Favorites |
| Downloads | Listed under Favorites |
| Pictures  | Listed under Favorites |
| Music     | Listed under Favorites |

#### Devices / Volumes

| Item              | Spec Text                      |
| ----------------- | ------------------------------ |
| Root              | Listed under Devices / Volumes |
| Mounted disks     | Listed under Devices / Volumes |
| Network locations | Listed under Devices / Volumes |

#### Recent

| Item      | Spec Text           |
| --------- | ------------------- |
| Today     | Listed under Recent |
| This Week | Listed under Recent |
| Starred   | Listed under Recent |

### 2.2 Sidebar Context Menu

| Action          | Spec Text                             |
| --------------- | ------------------------------------- |
| Rename favorite | "Context menu allows rename favorite" |
| Remove favorite | "remove favorite"                     |
| Reveal path     | "reveal path"                         |

### 2.3 Sidebar Behaviors

| Behavior                 | Spec Text                                                  |
| ------------------------ | ---------------------------------------------------------- |
| Click opens location     | "Clicking opens the selected location in the active pane." |
| Drag folder to Favorites | "Dragging a folder into Favorites adds it as a favorite."  |

---

## 3. Dual-Pane Workspace — Per-Pane Elements

| Element                | Spec Text                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Pane label             | "Pane label: `Left` or `Right`."                                                                                     |
| Active pane highlight  | "Active pane highlight." / "The active pane should be visually obvious using a subtle blue outline or accent strip." |
| Navigation: Back       | "Navigation controls: Back, Forward, Up."                                                                            |
| Navigation: Forward    | "Navigation controls: Back, Forward, Up."                                                                            |
| Navigation: Up         | "Navigation controls: Back, Forward, Up."                                                                            |
| Breadcrumb path bar    | "Breadcrumb path bar."                                                                                               |
| Primary toolbar        | "Primary toolbar."                                                                                                   |
| Filter/search field    | "Filter/search field."                                                                                               |
| View mode selector     | "View mode selector."                                                                                                |
| File table or grid     | "File table or grid."                                                                                                |
| Pane-local status line | "Pane-local status line."                                                                                            |

---

## 4. Toolbar — Primary Actions

| Action     | Spec Text    |
| ---------- | ------------ |
| New Folder | "New Folder" |
| New File   | "New File"   |
| Rename     | "Rename"     |
| Copy       | "Copy"       |
| Move       | "Move"       |
| Trash      | "Trash"      |
| Refresh    | "Refresh"    |
| More       | "More"       |

## 5. Toolbar — Overflow / Secondary Actions

| Action                        | Spec Text                       |
| ----------------------------- | ------------------------------- |
| Copy path                     | "Copy path"                     |
| Copy name                     | "Copy name"                     |
| Properties                    | "Properties"                    |
| Show hidden toggle            | "Show hidden toggle"            |
| Open terminal here            | "Open terminal here"            |
| Reveal in system file manager | "Reveal in system file manager" |
| Calculate size                | "Calculate size"                |
| Checksum                      | "Checksum"                      |
| Compress                      | "Compress"                      |
| Extract                       | "Extract"                       |

---

## 6. File Table

### 6.1 Default Columns

| Column   | Spec Text  |
| -------- | ---------- |
| Name     | "Name"     |
| Size     | "Size"     |
| Modified | "Modified" |
| Type     | "Type"     |

### 6.2 Optional Columns

| Column      | Spec Text     |
| ----------- | ------------- |
| Created     | "Created"     |
| Permissions | "Permissions" |
| Owner       | "Owner"       |
| Extension   | "Extension"   |
| Hash        | "Hash"        |

### 6.3 Row Behaviors

| Behavior                     | Spec Text                                            |
| ---------------------------- | ---------------------------------------------------- |
| Single click selects         | "Single click selects."                              |
| Double click opens           | "Double click opens folder or file."                 |
| Enter opens                  | "Enter opens selected item."                         |
| Space opens preview          | "Space opens preview if implemented."                |
| Right click context menu     | "Right click opens context menu."                    |
| Multi-selection (Shift/Ctrl) | "Multi-selection supported with Shift and Ctrl/Cmd." |

---

## 7. Activity Panel

### 7.1 Panel Sections

| Section           | Spec Text           |
| ----------------- | ------------------- |
| Current jobs      | "Current jobs"      |
| Recent operations | "Recent operations" |
| Errors / warnings | "Errors / warnings" |

### 7.2 Job Card Fields

| Field                         | Spec Text                               |
| ----------------------------- | --------------------------------------- |
| Operation type                | "Operation type"                        |
| Source/destination summary    | "Source/destination summary"            |
| Progress bar                  | "Progress bar"                          |
| Files processed / total files | "Files processed / total files"         |
| Bytes processed / total bytes | "Bytes processed / total bytes"         |
| Transfer speed                | "Transfer speed"                        |
| ETA                           | "ETA"                                   |
| Pause control                 | "Pause/cancel controls where supported" |
| Cancel control                | "Pause/cancel controls where supported" |

### 7.3 Panel Behavior

| Behavior    | Spec Text                                   |
| ----------- | ------------------------------------------- |
| Collapsible | "The activity panel should be collapsible." |

---

## 8. Status Bar Items

| Item                         | Spec Text                            |
| ---------------------------- | ------------------------------------ |
| App readiness state          | "App readiness state"                |
| Selected items count         | "Selected items count"               |
| Total entries in active pane | "Total entries in active pane"       |
| Total selected size          | "Total selected size when available" |
| Current backend/IPC status   | "Current backend/IPC status"         |
| Error indicator              | "Error indicator"                    |

Example format: `Ready · 2 selected · 8 items · 82.3 MB selected · No errors`

---

## 9. View Modes

| Mode         | Spec Text                                                                               |
| ------------ | --------------------------------------------------------------------------------------- |
| Details      | "Table layout with sortable columns. Best for power users."                             |
| List         | "Compact vertical list. Good for small windows."                                        |
| Grid / Icons | "Thumbnail-oriented layout. Useful for images and media folders."                       |
| Columns      | "Hierarchical navigation, similar to column browser. Useful for fast folder traversal." |

---

## 10. Dialogs

### 10.1 Move to Trash Confirmation

| Element                  | Spec Text                                                 |
| ------------------------ | --------------------------------------------------------- |
| Title                    | "Clear title: `Move 3 items to Trash?`"                   |
| Explanation              | "Explanation that items can be restored where supported." |
| Item list preview        | "List preview of affected items for small selections."    |
| Don't ask again checkbox | "Checkbox: `Don't ask again for this session`."           |
| Cancel button            | "Buttons: `Cancel`, `Move to Trash`."                     |
| Move to Trash button     | "Buttons: `Cancel`, `Move to Trash`."                     |

### 10.2 Delete Permanently Confirmation

| Element               | Spec Text                                                            |
| --------------------- | -------------------------------------------------------------------- |
| Destructive styling   | "Use destructive styling."                                           |
| Explicit confirmation | "Require explicit confirmation for multiple items or large folders." |
| Never default focus   | "Never make this the default focused action."                        |

### 10.3 Conflict Resolution Dialog

| Option                 | Spec Text                |
| ---------------------- | ------------------------ |
| Replace                | "Replace"                |
| Skip                   | "Skip"                   |
| Keep both              | "Keep both"              |
| Compare metadata       | "Compare metadata"       |
| Apply to all conflicts | "Apply to all conflicts" |

---

## 11. Preferences — Sections & Settings

### 11.1 Preference Sections

| Section         | Spec Text         |
| --------------- | ----------------- |
| General         | "General"         |
| Appearance      | "Appearance"      |
| Files & Folders | "Files & Folders" |
| Operations      | "Operations"      |
| Shortcuts       | "Shortcuts"       |
| Advanced        | "Advanced"        |

### 11.2 Important Settings Fields

| Setting                      | Spec Text                           |
| ---------------------------- | ----------------------------------- |
| Theme                        | "Theme: System / Light / Dark"      |
| Accent color                 | "Accent color"                      |
| UI density                   | "UI density: Comfortable / Compact" |
| Font size                    | "Font size"                         |
| Show hidden files by default | "Show hidden files by default"      |
| Confirm before delete        | "Confirm before delete"             |
| Confirm before overwrite     | "Confirm before overwrite"          |
| Remember last used panes     | "Remember last used panes"          |
| Start on system startup      | "Start on system startup"           |
| Diagnostics export location  | "Diagnostics export location"       |

---

## 12. Keyboard Shortcuts

| Action            | macOS         | Windows/Linux |
| ----------------- | ------------- | ------------- |
| New Folder        | Cmd+Shift+N   | Ctrl+Shift+N  |
| Copy              | Cmd+C         | Ctrl+C        |
| Cut / Move intent | Cmd+X         | Ctrl+X        |
| Paste             | Cmd+V         | Ctrl+V        |
| Rename            | Return or F2  | F2            |
| Delete / Trash    | Cmd+Backspace | Delete        |
| Refresh           | Cmd+R         | F5            |
| Search            | Cmd+F         | Ctrl+F        |
| Switch Pane       | Tab           | Tab           |
| Show Hidden Files | Cmd+Shift+.   | Ctrl+H        |
| Preferences       | Cmd+,         | Ctrl+,        |

---

## 13. Visual Style — Typography Scale

| Element        | Spec Text                 |
| -------------- | ------------------------- |
| Window title   | "13–14px semibold"        |
| Section labels | "11px uppercase semibold" |
| File rows      | "13px"                    |
| Status text    | "12px"                    |
| Dialog titles  | "18–20px semibold"        |

---

## 14. Color Tokens

### Light Theme

| Token            | Value   | Spec Text       |
| ---------------- | ------- | --------------- |
| --bg-app         | #f5f7fb | exact from spec |
| --bg-surface     | #ffffff | exact from spec |
| --bg-muted       | #f1f4f9 | exact from spec |
| --border         | #d9e0ec | exact from spec |
| --text-primary   | #172033 | exact from spec |
| --text-secondary | #5e6b80 | exact from spec |
| --accent         | #3578ff | exact from spec |
| --accent-soft    | #e8f0ff | exact from spec |
| --danger         | #e5484d | exact from spec |
| --success        | #24a148 | exact from spec |

### Dark Theme

| Token            | Value   | Spec Text       |
| ---------------- | ------- | --------------- |
| --bg-app         | #111827 | exact from spec |
| --bg-surface     | #182235 | exact from spec |
| --bg-muted       | #202b3f | exact from spec |
| --border         | #314158 | exact from spec |
| --text-primary   | #f4f7fb | exact from spec |
| --text-secondary | #aab6ca | exact from spec |
| --accent         | #6ea8ff | exact from spec |
| --accent-soft    | #17315d | exact from spec |
| --danger         | #ff6b6b | exact from spec |
| --success        | #4ade80 | exact from spec |

---

## 15. Component Structure (React/Tauri)

| Component Path                              | Spec Text                                 |
| ------------------------------------------- | ----------------------------------------- |
| src/ui/AppShell.tsx                         | Listed in recommended component structure |
| src/ui/Sidebar.tsx                          | Listed in recommended component structure |
| src/ui/Pane.tsx                             | Listed in recommended component structure |
| src/ui/PaneToolbar.tsx                      | Listed in recommended component structure |
| src/ui/BreadcrumbBar.tsx                    | Listed in recommended component structure |
| src/ui/FileTable.tsx                        | Listed in recommended component structure |
| src/ui/ActivityPanel.tsx                    | Listed in recommended component structure |
| src/ui/StatusBar.tsx                        | Listed in recommended component structure |
| src/ui/dialogs/ConfirmTrashDialog.tsx       | Listed in recommended component structure |
| src/ui/dialogs/ConflictResolutionDialog.tsx | Listed in recommended component structure |
| src/ui/dialogs/PropertiesDialog.tsx         | Listed in recommended component structure |
| src/ui/preferences/PreferencesWindow.tsx    | Listed in recommended component structure |

---

## 16. Sprint 5 UX Acceptance Criteria (Specified Behaviors)

| Criterion                                          | Spec Text                                                                                 |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Diagnostics panel hidden                           | "Diagnostics panel is no longer permanently visible in the main window."                  |
| Layout at laptop resolutions                       | "The main layout works at common laptop resolutions without toolbar wrapping."            |
| Active pane visually clear                         | "The active pane is visually clear."                                                      |
| Loading/empty/error/permission states              | "Loading, empty, error, and permission-denied states are implemented."                    |
| Operations from toolbar + context menu + shortcuts | "File operations are accessible from toolbar, context menu, and keyboard shortcuts."      |
| Job progress in collapsible activity panel         | "Job progress is visible in a collapsible activity panel."                                |
| Preferences persist across restarts                | "Theme, density, view mode, and show-hidden preferences persist across restarts."         |
| Reference screenshot/mockup committed              | "The UI has at least one reference screenshot or SVG mockup committed to the repository." |

---

## Summary Counts

| Category                            | Count                                  |
| ----------------------------------- | -------------------------------------- |
| Title Bar elements                  | 5                                      |
| Sidebar sections                    | 3 (Favorites, Devices/Volumes, Recent) |
| Sidebar items                       | 12                                     |
| Sidebar context menu actions        | 3                                      |
| Sidebar behaviors                   | 2                                      |
| Per-pane elements                   | 10                                     |
| Toolbar primary actions             | 8                                      |
| Toolbar overflow actions            | 10                                     |
| File table default columns          | 4                                      |
| File table optional columns         | 5                                      |
| File table row behaviors            | 6                                      |
| Activity panel sections             | 3                                      |
| Activity panel job card fields      | 9                                      |
| Status bar items                    | 6                                      |
| View modes                          | 4                                      |
| Dialog: Trash confirmation elements | 6                                      |
| Dialog: Delete permanently elements | 3                                      |
| Dialog: Conflict resolution options | 5                                      |
| Preference sections                 | 6                                      |
| Preference settings fields          | 10                                     |
| Keyboard shortcuts                  | 11                                     |
| Typography scale entries            | 5                                      |
| Color tokens (light)                | 10                                     |
| Color tokens (dark)                 | 10                                     |
| React components                    | 12                                     |
| Sprint 5 acceptance criteria        | 8                                      |
