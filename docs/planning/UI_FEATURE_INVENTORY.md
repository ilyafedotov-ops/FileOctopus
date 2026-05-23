# FileOctopus — Complete UI Feature Inventory

Extracted from: UI Design Spec, MVP Engineering Spec, ui.md, frontend.md, Sprint 4 Backlog, Sprint 5 Backlog, Sprint 5 Release Notes.

**Status alignment:** See [PROJECT_STATUS_AND_DOC_ALIGNMENT.md](./PROJECT_STATUS_AND_DOC_ALIGNMENT.md) for what is implemented in the codebase as of 2026-05-16. Section 13 below reflects that snapshot.

Each item is marked **specified** (explicitly defined in docs with detail) or **suggested** (implied, mentioned as TODO/stretch, or described loosely without full spec).

---

## 1. Menu Items

### Application Menu / Title Bar Menu

- **App title "FileOctopus"** — specified (UI Design Spec §1)
- **Settings button** — specified (UI Design Spec §1)
- **Command palette button** — specified (UI Design Spec §1, "Optional global command palette button")
- **Help → Diagnostics** — specified (Sprint 5 FO-0206: "Add `Help -> Diagnostics` or equivalent diagnostics access point")
- **Help → Shortcuts** — specified (Sprint 5 FO-0225: "Add menu/help entry")
- **Sync/health indicator** — suggested (UI Design Spec §1, "Optional sync/health indicator")

### Context Menus — File/Folder (Right-click on item)

- **Open** — specified (Sprint 4 FO-S4-015)
- **Rename** — specified (Sprint 4 FO-S4-015)
- **Copy** — specified (Sprint 4 FO-S4-015)
- **Cut** — specified (Sprint 4 FO-S4-015)
- **Paste** (when valid) — specified (Sprint 4 FO-S4-015)
- **Move to Trash** — specified (Sprint 4 FO-S4-015)
- **Delete permanently** (with explicit confirmation) — specified (Sprint 4 FO-S4-015)
- **Copy Path** — specified (Sprint 4 FO-S4-015)
- **Copy Name** — suggested (Sprint 5 FO-0228 includes "copy name")
- **Properties** — specified (Sprint 4 FO-S4-015)
- **Reveal/Open containing folder** — specified (Sprint 4 FO-S4-015)

### Context Menus — Empty Space (Right-click on pane background)

- **Paste** — specified (Sprint 4 FO-S4-016)
- **New Folder** — specified (Sprint 4 FO-S4-016)
- **New File** — specified (Sprint 4 FO-S4-016)
- **Refresh** — specified (Sprint 4 FO-S4-016)
- **Select All** — specified (Sprint 4 FO-S4-016)
- **Folder Properties** — specified (Sprint 4 FO-S4-016)
- **View mode selection** — specified (Sprint 4 FO-S4-016)
- **Sort options** — specified (Sprint 4 FO-S4-016)

### Context Menus — Sidebar

- **Rename favorite** — specified (UI Design Spec §2)
- **Remove favorite** — specified (UI Design Spec §2)
- **Reveal path** — specified (UI Design Spec §2)

---

## 2. Dialogs

- **Move to Trash Confirmation** — specified (UI Design Spec: title, explanation, item list preview, "Don't ask again for this session" checkbox, Cancel/Move to Trash buttons)
- **Delete Permanently Confirmation** — specified (UI Design Spec: destructive styling, explicit confirmation, never default focused)
- **Conflict Resolution** — specified (UI Design Spec: Replace, Skip, Keep Both, Compare metadata, Apply to all conflicts)
- **Properties Dialog** — specified (Sprint 4 FO-S4-019: name, full path, type, size, folder item count, timestamps, permissions, hidden/system flags, Copy Path, Reveal action; UI Design Spec component: `PropertiesDialog.tsx`)
- **Create Folder Dialog** — specified (frontend.md: `createFolder` dialog with name validation)
- **Rename Dialog** — specified (frontend.md: `rename` dialog pre-filled with current name)
- **Copy/Move Dialog** — specified (frontend.md: `copyMove` dialog with two-step Plan→Start workflow, conflict policy, plan summary with item count/conflicts/warnings)
- **Trash Dialog** — specified (frontend.md: `trash` dialog with confirmation summary)
- **Create Empty File Dialog** — specified (Sprint 4 FO-S4-018: inline naming workflow or dialog)
- **Settings/Preferences Dialog** — specified (Sprint 5 FO-0221: shell with Appearance, File List, Layout, Diagnostics sections)
- **Keyboard Shortcuts Dialog** — specified (Sprint 5 FO-0225: displays platform-specific shortcuts)
- **Diagnostics Dialog** — specified (Sprint 5 FO-0206: version, commit, schema, recovered count, paths, export action)
- **Command Palette** — suggested (Sprint 5 Stretch FO-0242: prototype for navigation, refresh, settings, diagnostics, shortcut help)
- **First-Run Welcome/Help Overlay** — suggested (Sprint 5 Stretch FO-0244: dual-pane behavior, shortcuts, settings)

---

## 3. Sidebar Sections

- **Favorites** — specified (UI Design Spec §2)
  - Home — specified
  - Desktop — specified
  - Documents — specified
  - Downloads — specified
  - Pictures — specified
  - Music — specified
- **Devices / Volumes** — specified (UI Design Spec §2)
  - Root — specified
  - Mounted disks — specified
  - Network locations — specified
- **Recent** — specified (UI Design Spec §2)
  - Today — specified
  - This Week — specified
  - Starred — specified
- **Sidebar collapsed/expanded state persistence** — specified (Sprint 4 FO-S4-004)
- **Drag folder into Favorites to add** — specified (UI Design Spec §2)
- **Videos** — suggested (Sprint 4 FO-S4-004 mentions "Videos" alongside other user folders)

---

## 4. Toolbar Buttons

### Primary Toolbar Actions (visible)

- **Back** — specified (UI Design Spec §4, Sprint 4 FO-S4-005)
- **Forward** — specified (UI Design Spec §4, Sprint 4 FO-S4-005)
- **Up** — specified (UI Design Spec §4, Sprint 4 FO-S4-005)
- **Refresh** — specified (UI Design Spec §4)
- **New Folder** — specified (UI Design Spec §4)
- **New File** — specified (UI Design Spec §4)
- **Copy** — specified (UI Design Spec §4)
- **Move** — specified (UI Design Spec §4)
- **Rename** — specified (UI Design Spec §4)
- **Trash / Delete** — specified (UI Design Spec §4)

### Secondary / Overflow Toolbar Actions

- **Copy Path** — specified (UI Design Spec §4 overflow)
- **Copy Name** — specified (UI Design Spec §4 overflow)
- **Properties** — specified (UI Design Spec §4 overflow)
- **Show Hidden toggle** — specified (UI Design Spec §4 overflow)
- **Open terminal here** — specified (UI Design Spec §4 overflow)
- **Reveal in system file manager** — specified (UI Design Spec §4 overflow)
- **Calculate size** — specified (UI Design Spec §4 overflow)
- **Checksum** — specified (UI Design Spec §4 overflow)
- **Compress** — specified (UI Design Spec §4 overflow)
- **Extract** — specified (UI Design Spec §4 overflow)
- **View Options** — specified (Sprint 5 FO-0207 secondary actions)

### Grouped Toolbar Layout (Sprint 5 redesign)

- **Grouped primary actions: Back, Forward, Up, Refresh, New, Copy, Move, Delete/Trash** — specified (Sprint 5 FO-0207)
- **Grouped secondary actions: Copy Path, Copy Name, Properties, Show Hidden, View Options** — specified (Sprint 5 FO-0207)
- **Overflow menu for low-frequency actions** — specified (Sprint 5 FO-0207)

---

## 5. Settings Tabs/Fields (Preferences Dialog)

### Sections

- **General** — specified (UI Design Spec §Preferences)
- **Appearance** — specified (UI Design Spec §Preferences, Sprint 5 FO-0221)
- **Files & Folders** — specified (UI Design Spec §Preferences)
- **Operations** — specified (UI Design Spec §Preferences)
- **Shortcuts** — specified (UI Design Spec §Preferences)
- **Advanced** — specified (UI Design Spec §Preferences)
- **Layout** — specified (Sprint 5 FO-0221)
- **Diagnostics** — specified (Sprint 5 FO-0221)
- **File List** — specified (Sprint 5 FO-0221)

### Individual Settings Fields

- **Theme: System / Light / Dark** — specified (UI Design Spec, Sprint 5 FO-0218)
- **Accent color** — specified (UI Design Spec)
- **UI density: Comfortable / Compact / Spacious** — specified (UI Design Spec, Sprint 5 FO-0209)
- **Font size** — specified (UI Design Spec)
- **Show hidden files by default** — specified (UI Design Spec, Sprint 5 FO-0220)
- **Confirm before delete** — specified (UI Design Spec)
- **Confirm before overwrite** — specified (UI Design Spec)
- **Remember last used panes** — specified (UI Design Spec)
- **Start on system startup** — specified (UI Design Spec)
- **Diagnostics export location** — specified (UI Design Spec)
- **Default view mode (details/list/compact)** — specified (Sprint 5 FO-0219)
- **Sidebar visibility** — specified (Sprint 5 FO-0216 schema keys)
- **Diagnostics visibility** — specified (Sprint 5 FO-0216 schema keys)
- **Pane layout** — specified (Sprint 5 FO-0216 schema keys)
- **Split ratio persistence** — suggested (Sprint 5 Stretch FO-0241)
- **Last opened pane paths** — suggested (Sprint 5 Stretch FO-0243)

---

## 6. Keyboard Shortcuts

### Fully Specified Shortcuts (UI Design Spec + Sprint 4 + Sprint 5)

| Shortcut                      | Action                               | Spec Level                                                          |
| ----------------------------- | ------------------------------------ | ------------------------------------------------------------------- |
| `Cmd/Ctrl+Shift+N`            | New Folder                           | specified (UI Design Spec)                                          |
| `Cmd/Ctrl+C`                  | Copy selected items                  | specified (UI Design Spec, Sprint 4 FO-S4-017, Sprint 5 FO-0224)    |
| `Cmd/Ctrl+X`                  | Cut selected items                   | specified (UI Design Spec, Sprint 4 FO-S4-017, Sprint 5 FO-0224)    |
| `Cmd/Ctrl+V`                  | Paste into current folder            | specified (UI Design Spec, Sprint 4 FO-S4-017, Sprint 5 FO-0224)    |
| `F2` or `Return`              | Rename selected item                 | specified (UI Design Spec, Sprint 4 FO-S4-017, Sprint 5 FO-0224)    |
| `Cmd+Backspace` / `Delete`    | Move to Trash                        | specified (UI Design Spec, Sprint 4 FO-S4-017)                      |
| `Shift+Delete`                | Permanent delete (with confirmation) | specified (Sprint 4 FO-S4-017)                                      |
| `Cmd/Ctrl+R` / `F5`           | Refresh active pane                  | specified (UI Design Spec, Sprint 4 FO-S4-017)                      |
| `Cmd/Ctrl+F`                  | Focus filter/search                  | specified (UI Design Spec, Sprint 5 FO-0222)                        |
| `Tab`                         | Switch active pane                   | specified (UI Design Spec, Sprint 5 FO-0222/0223)                   |
| `Cmd/Ctrl+Shift+.` / `Ctrl+H` | Show hidden files                    | specified (UI Design Spec, Sprint 5 FO-0220)                        |
| `Cmd/Ctrl+,`                  | Open Preferences                     | specified (UI Design Spec)                                          |
| `Enter`                       | Open selected item                   | specified (Sprint 4 FO-S4-017)                                      |
| `Cmd/Ctrl+A`                  | Select all                           | specified (Sprint 4 FO-S4-012)                                      |
| `Backspace` / `Alt+Up`        | Go to parent folder                  | specified (Sprint 4 FO-S4-017)                                      |
| `Alt+Left`                    | Back                                 | specified (Sprint 4 FO-S4-017)                                      |
| `Alt+Right`                   | Forward                              | specified (Sprint 4 FO-S4-017)                                      |
| `Cmd/Ctrl+L`                  | Focus path bar                       | specified (Sprint 4 FO-S4-007, Sprint 5 FO-0222)                    |
| `Cmd/Ctrl+N`                  | New file or folder (decision TBD)    | suggested (Sprint 5 FO-0222: "decision to be finalized")            |
| `Space`                       | Open preview                         | suggested (UI Design Spec §5: "Space opens preview if implemented") |

---

## 7. Status Bar Items

- **App readiness state** — specified (UI Design Spec §7)
- **Selected items count** — specified (UI Design Spec §7, Sprint 4 FO-S4-011, Sprint 5 FO-0214)
- **Total entries in active pane** — specified (UI Design Spec §7, Sprint 4 FO-S4-011)
- **Total selected size** — specified (UI Design Spec §7, Sprint 4 FO-S4-011)
- **Current backend/IPC status** — specified (UI Design Spec §7)
- **Error indicator** — specified (UI Design Spec §7)
- **Loading/error state summary** — specified (Sprint 5 FO-0214)
- **Active background job count** — specified (Sprint 5 FO-0214)
- **Active pane path** — specified (Sprint 5 FO-0214)

Example: `Ready · 2 selected · 8 items · 82.3 MB selected · No errors`

---

## 8. View Modes

- **Details view** (table layout with sortable columns) — specified (UI Design Spec, Sprint 4 FO-S4-010)
- **List view** (compact vertical list) — specified (UI Design Spec, Sprint 4 FO-S4-010)
- **Grid/Icons view** (thumbnail-oriented layout) — specified (UI Design Spec, Sprint 4 FO-S4-010)
- **Columns view** (hierarchical column browser) — specified (UI Design Spec)

### File Table Columns

**Default columns:**

- Name — specified (UI Design Spec §5)
- Size — specified (UI Design Spec §5)
- Modified — specified (UI Design Spec §5)
- Type — specified (UI Design Spec §5)

**Optional columns:**

- Created — specified (UI Design Spec §5)
- Permissions — specified (UI Design Spec §5)
- Owner — specified (UI Design Spec §5)
- Extension — specified (UI Design Spec §5)
- Hash — specified (UI Design Spec §5)

**Git status badges on file rows** — specified (MVP Spec §Git Integration v1: modified, added, deleted, untracked, ignored, clean)

---

## 9. Activity Panel

- **Current jobs section** — specified (UI Design Spec §6, frontend.md `JobActivityPanel`)
- **Recent operations section** — specified (UI Design Spec §6, frontend.md)
- **Errors/warnings section** — specified (UI Design Spec §6)

**Per-job card fields:**

- Operation type — specified
- Source/destination summary — specified
- Progress bar — specified
- Files processed / total files — specified
- Bytes processed / total bytes — specified
- Transfer speed — specified
- ETA — specified
- Pause/cancel controls — specified (where supported)

**Collapsible activity panel** — specified (UI Design Spec §6)
**Cancel button** — specified (frontend.md: active jobs with Cancel button)
**Refresh button** — specified (frontend.md: `refreshHistory` on Refresh button click)
**5 most recent terminal jobs** — specified (frontend.md)
**Operation history rows** (last 20) — specified (frontend.md)

---

## 10. Pane States and Special UI

- **Loading state** — specified (Sprint 5 FO-0201)
- **Loaded state** — specified (Sprint 5 FO-0201)
- **Empty directory state** (with path label, refresh action, new folder action) — specified (Sprint 5 FO-0211)
- **Error state** (with short message, expandable technical details, retry action) — specified (Sprint 5 FO-0213)
- **Permission-denied state** (with restricted path, reason, retry, OS-level guidance) — specified (Sprint 5 FO-0212)
- **Timeout state** — specified (Sprint 5 FO-0203)
- **Active pane highlight** (blue outline or accent strip) — specified (UI Design Spec §3, Sprint 5 FO-0210)
- **Pane label (Left/Right)** — specified (UI Design Spec §3)

### Breadcrumb/Path Bar

- **Clickable breadcrumb segments** — specified (UI Design Spec §3, Sprint 4 FO-S4-006)
- **Editable raw path mode** (Ctrl/Cmd+L) — specified (Sprint 4 FO-S4-007, Sprint 5 FO-0208)
- **Truncation for long paths** — specified (Sprint 4 FO-S4-006, Sprint 5 FO-0208)
- **Root/home handling** — specified (Sprint 5 FO-0208)
- **Path entry error display** — specified (Sprint 4 FO-S4-007, Sprint 5 FO-0208)

### Filter/Search

- **Current-folder filter bar** (filter by name/extension) — specified (Sprint 4 FO-S4-027)
- **Non-indexed recursive search** (job-based, cancellable, incremental results) — specified (Sprint 4 FO-S4-028)
- **Search result actions: open, reveal, properties** — specified (Sprint 4 FO-S4-028)

---

## 11. Toast Notifications

- **Success notification** — specified (Sprint 5 FO-0215)
- **Failure notification** — specified (Sprint 5 FO-0215)
- **Cancellation notification** — specified (Sprint 5 FO-0215)
- **"View details" action** on failed operation toasts — specified (Sprint 5 FO-0215)
- **Dismissible** — specified (Sprint 5 FO-0215)
- **Spam avoidance for bulk operations** — specified (Sprint 5 FO-0215)

---

## 12. Additional UI Features

### Git Integration

- **Git branch display in active panel** — specified (MVP Spec, MVP-GIT-001)
- **File status badges** (modified, added, deleted, untracked, ignored, clean) — specified (MVP Spec, MVP-GIT-002)

### Archive Support

- **Extract zip/tar archives** — specified (MVP Spec, MVP-ARC-001)
- **Extraction progress as job** — specified (MVP Spec §Archive Support v1)

### Embedded Terminal

- **Terminal panel** — specified (MVP Spec §Embedded Terminal v1)
- **Default shell spawn** — specified
- **CWD synced to active panel directory** — specified
- **Terminal resize with UI** — specified
- **Close terminal safely** — specified

### File Preview

- **Basic file preview panel for text files** — specified (MVP Spec §UI/UX)
- **Space opens preview** — suggested (UI Design Spec §5: "if implemented")

### Command Palette

- **Command palette** — specified (MVP Spec §UI/UX: "Command palette")
- **Prototype with navigation, refresh, settings, diagnostics, shortcut help** — suggested (Sprint 5 Stretch FO-0242)

### Filesystem Watcher

- **Auto-refresh on external file changes** — specified (Sprint 4 FO-S4-025)
- **Debounced change events** — specified

### Folder Size Calculation

- **Cancellable folder size calculation job** — specified (Sprint 4 FO-S4-020)
- **Partial results with warning** — specified

### Icon/File-Type Mapping

- **Folder, generic file, image, video, audio, archive, document, code, executable, symlink icons** — specified (Sprint 4 FO-S4-032)

### Accessibility

- **Keyboard-reachable primary actions** — specified (Sprint 4 FO-S4-023)
- **Visible focus states** — specified
- **Labels/roles for interactive controls** — specified
- **Modal focus trapping and restoration** — specified
- **Contrast verification (light/dark)** — specified
- **Accessibility audit checklist** — suggested (Sprint 5 Stretch FO-0245)

### Error UX

- **Standardized error presentation** for: permission denied, file not found, folder not found, name collision, disk full, path too long, invalid filename, read-only filesystem, operation cancelled, no default app, external launch failure — specified (Sprint 4 FO-S4-029)
- **Destructive action confirmation policy** — specified (Sprint 4 FO-S4-030)

### Diagnostics

- **Diagnostics dialog** (moved from always-visible panel) — specified (Sprint 5 FO-0206)
- **Export diagnostics** — specified (Sprint 5 FO-0206)
- **Developer-only diagnostics hidden in production** — specified (Sprint 5 FO-0230)
- **Diagnostics bundle** (version, commit, platform, schema, logs, pane state, IPC errors) — specified (Sprint 5 FO-0231)

### Visual Customization

- **Design tokens / color tokens** (light + dark themes with CSS custom properties) — specified (UI Design Spec §Visual Style)
- **Typography scale** — specified (UI Design Spec §Visual Style)
- **Density modes: Compact / Comfortable / Spacious** — specified (Sprint 5 FO-0209)
- **Icon size preference** — specified (Sprint 4 FO-S4-010)

### Cross-Platform

- **Platform-native path handling** (Windows drive roots, Linux root, macOS home) — specified (Sprint 4 FO-S4-031)
- **macOS user folder and volume resolution** — specified (Sprint 5 FO-0204)
- **Per-platform shell detection** — specified (MVP Spec `platform` crate)

---

## 13. Implementation snapshot (2026-05-23)

### Delivered after Sprint 5 (codebase)

- **Command palette** — implemented (`CommandPalette.tsx`, Ctrl/Cmd+P)
- **File preview panel** — implemented (`PreviewPanel.tsx`, Space for text files)
- **Column view** — implemented (macOS-style column browser) + virtualized grid-aware windowing + shared client routing
- **Drag-and-drop** — internal URI drag between panes
- **Split ratio persistence** — `splitRatio` preference
- **Details columns** — Name, Size, Modified, Created, Type, Extension, Permissions, Owner; Hash on selection
- **Filesystem watcher** — `fs_watch_start` / `fs_watch_stop` wired to refresh
- **Overflow toolbar** — Reveal, Calculate Size, Open Terminal (external emulator), Compress/Extract/Checksum menus present
- **Settings** — General (autostart), Appearance (theme, density, accent, font/icon scale), Files & Folders, Layout, Operations (confirm delete/overwrite, conflict policy, trash behavior), Diagnostics, Shortcuts
- **Shortcuts** — Ctrl/Cmd+I (properties), Ctrl/Cmd+H and Ctrl/Cmd+. for hidden files
- **Application menu bar shell** (`MenuBar` in title bar)
- **Zip compress/extract** via toolbar and context menu (`useArchiveHandlers`)
- **Embedded terminal panel** — local + SSH PTY, pane bottom split, tabs, maximize/close, shell prefs (`terminal-core`)
- **Built-in F3 viewer + F4 editor** — shared syntax highlighting
- **SFTP network profiles** — remote VFS, sidebar badges, status events, host-key fingerprint TOFU
- **Performance smoke** — `pnpm perf:smoke` command
- **Command registry refactor** — derive `CommandId` from as-const registry, dispatch exhaustiveness test

### Still not implemented (specified)

- **Embedded terminal panel** — external spawn only (`fs_open_terminal`)
- **Git branch + file badges** — ✅ implemented (`git-intel` crate, `usePaneGitStatus.ts`, FileRow badges M/A/D/R/?/I/U/!, PaneHeader branch name + dirty mark)
- **Remember last panes / last-path restore** — no boot restore
- **First-run overlay** — stretch, not built
- **Videos sidebar entry, network locations, "This Week" recent group** — partial (API has `thisWeek` bucket; UI grouping may vary)
- **Title bar sync/health indicator** — optional, not built
- **VfsProvider write methods** — create_directory, create_file, rename, remove, copy_file, read_file_prefix (done 2026-05-22)
- **Image preview in PreviewPanel** — text only; no image/media/pdf (TBD)

### Previously listed as not implemented, now done (2026-05-17)

- **Application menu bar** (File/Edit/View/Go/…) — ✅ implemented (MenuBar component with full dropdown menus)
- **Tabs per panel** — ✅ implemented (`TabBar` plus `openTab` / `closeTab` / `switchTab`; session restore remains pending)
- **Compress / Extract** — ✅ wired with real IPC (`useArchiveHandlers.ts` → `planOperation("createArchive"/"extractArchive")` → job system)
- **Checksum toolbar** — ✅ wired with real IPC (`handleChecksum` → `client.fs.computeHash` → SHA-256 toast + hash column update)
- **Conflict resolution dialog** — ✅ enhanced with per-item actions, metadata comparison, apply-to-all (§14.8)
- **Operations settings tab** — ✅ added (confirm trash/permdelete/overwrite, conflict policy, use-trash-by-default)
- **Settings dialog tabs** — General, Appearance, Files, Layout, Operations, Diagnostics, Shortcuts (7 tabs)

### Out of MVP scope (unchanged)

- **File content diff/merge**, **plugin marketplace**, **cloud providers**, **AI semantic search**, **advanced ACL editing**

---

## Summary Counts

| Category                             | Specified | Suggested |
| ------------------------------------ | --------- | --------- |
| Menu items (title bar)               | 3         | 1         |
| Context menu items (file)            | 10        | 1         |
| Context menu items (empty space)     | 8         | 0         |
| Context menu items (sidebar)         | 3         | 0         |
| Dialogs                              | 12        | 2         |
| Sidebar sections/entries             | 14        | 1         |
| Toolbar buttons (primary)            | 10        | 0         |
| Toolbar buttons (secondary/overflow) | 10        | 0         |
| Settings sections                    | 9         | 0         |
| Settings fields                      | 14        | 2         |
| Keyboard shortcuts                   | 17        | 2         |
| Status bar items                     | 9         | 0         |
| View modes                           | 4         | 0         |
| File table columns (default)         | 4         | 0         |
| File table columns (optional)        | 5         | 0         |
| Activity panel features              | 12        | 0         |
| Pane states                          | 7         | 0         |
| Toast notification types             | 3         | 0         |
| Additional UI features               | 20+       | 3         |
