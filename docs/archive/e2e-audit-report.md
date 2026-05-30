# FileOctopus — E2E UI Audit Report

> **Staleness notice (2026-05-16):** Sections 2–4 below reflect an early pass on the same day. Many items marked missing or broken were fixed afterward (settings fields, table columns, command palette, preview, watcher, Ctrl+I/Ctrl+H). For current status use **[PROJECT_STATUS_AND_DOC_ALIGNMENT.md](../planning/PROJECT_STATUS_AND_DOC_ALIGNMENT.md)**.

**Дата:** 2026-05-16  
**Среда:** Linux (Ubuntu), Xvfb :99, WebKitGTK 2.52.3, Tauri v2  
**Ветка:** main

---

## 1. ЧТО РАБОТАЕТ ✅

### Title Bar

- ✅ Бренд «FO» + «FileOctopus» + badge «Rust-powered»
- ✅ Кнопка Settings → открывает SettingsDialog (подтверждено скриншотом)
- ✅ Help dropdown → Keyboard Shortcuts + Diagnostics

### Sidebar

- ✅ Favorites (Home, Desktop, Documents, Downloads, Pictures, Music)
- ✅ User folders (стандартные локации)
- ✅ Devices / Volumes
- ✅ Pinned (пользовательские избранное, drag-to-add)
- ✅ Recent (с группировкой Today)
- ✅ Starred (условно показывается)
- ✅ Контекстное меню сайдбара: Rename, Reveal, Remove

### Dual Pane Workspace

- ✅ Левая/правая панели с навигацией (подтверждено: /home/ilya + /home/ilya/Documents)
- ✅ Back / Forward / Up кнопки
- ✅ PathBar — breadcrumb + редактируемый текстовый ввод (Ctrl+L)
- ✅ Active pane highlight (LEFT / RIGHT badge)
- ✅ Layout resizers (sidebar 160–480px, split ratio 0.2–0.8)

### Operation Toolbar

- ✅ Primary: New Folder, New File, Rename, Copy, Move, Paste, Trash, Refresh
- ✅ Overflow/More меню: New File, Rename, Cut, Paste, Copy To…, Move To…, Copy Path, Copy Name, Delete Permanently, Properties, Select All, Show/Hide Hidden, 4 view modes
- ✅ Selection counter

### View Modes

- ✅ Details (сортируемые колонки Name, Modified)
- ✅ List
- ✅ Icons/Grid
- ✅ Columns (macOS Finder-style, MAX_COLUMNS=4)

### File Table

- ✅ Virtualized list (overscan=8)
- ✅ Keyboard navigation (Arrow, PageUp/Down, Home, End)
- ✅ Skeleton loading state
- ✅ Click selection (single/toggle/range)
- ✅ Double-click to activate
- ✅ Right-click context menu
- ✅ Drag support (application/x-fileoctopus-uri)

### Context Menu (22 пункта!)

- ✅ Open, Rename, Copy, Cut, Paste, New Folder, New File
- ✅ Move to Trash, Delete Permanently, Copy Path, Copy Name
- ✅ Properties, Reveal, Add/Remove Star, Refresh
- ✅ Show/Hide Hidden, Select All
- ✅ 4 view modes, Sort Name/Modified

### Operation Dialogs

- ✅ Create Folder (name input + validation)
- ✅ Create File (name input + validation)
- ✅ Rename (pre-filled name + validation)
- ✅ Copy/Move (двухшаговый Plan→Start, conflict policy, summary)
- ✅ Trash (item count + preview + "Don't ask again")
- ✅ Permanent Delete (destructive styling, preview up to 5)
- ✅ Properties (Name, Path, Type, Size, Items, Modified, Created, Accessed, Hidden, Read-only, async folder size job)

### Settings Dialog (4 вкладки)

- ✅ Appearance: Theme (System/Light/Dark) + Density (Compact/Comfortable/Spacious)
- ✅ Files & Folders: Default view, Show hidden, Confirm delete, Confirm permanent delete, Use trash, Default conflict policy
- ✅ Layout: Show activity panel
- ⚠️ General: PLACEHOLDER — только текст «Startup and system preferences will appear here.»

### Other Dialogs

- ✅ Keyboard Shortcuts — 3 группы (Navigation, View, File operations), 19 шорткатов
- ✅ Diagnostics — Version, Build, Commit, Schema, Recovered jobs + dev-only fields + Export bundle

### Activity Panel

- ✅ Collapsed rail (badge с числом активных jobs)
- ✅ Expanded: Jobs & Activity + History tabs
- ✅ JobCard: icon, title, progress bar, speed/ETA, cancel
- ✅ Recent jobs (up to 5 completed/failed/cancelled)
- ✅ History tab: rows up to 12, Refresh, Clear

### Status Bar

- ✅ Readiness indicator (Ready / Loading / Attention)
- ✅ Active panel + path
- ✅ Selection info
- ✅ Entry summary
- ✅ Active job count + error indicator
- ✅ Log path (при открытой Diagnostics)

### Pane State Views

- ✅ Empty folder, Not found, Permission denied, Timeout, Error
- ✅ Retry/Refresh buttons, Technical details (dev builds)

### Toast Notifications

- ✅ Success/error/info, title + detail, action button, dismiss

### Keyboard Shortcuts (19 реализовано)

- ✅ Tab, Enter, Backspace/Alt+Up, Alt+Left/Right
- ✅ Ctrl+L, Ctrl+F, Ctrl+Shift+F, Ctrl+,, Ctrl+/
- ✅ Ctrl+. (hidden), Esc, Ctrl+R/F5, Ctrl+A
- ✅ Ctrl+C/X/V, F2, Ctrl+N, Delete, Shift+Delete

### Filter & Search

- ✅ Filter current folder (inline)
- ✅ Recursive search (job-based, incremental, up to 50 results)
- ✅ Search actions: Open, Reveal, Properties

---

## 2. ЧТО СЛОМАНО / ПРОБЛЕМЫ ⚠️

### X11 + WebKitGTK

- ⚠️ **X11-клики не доходят до webview** — XSendEvent, XTestFakeButtonEvent работают нестабильно с WebKitGTK. Settings удалось открыть 1 раз, переключение вкладок НЕ работает через X11
- ⚠️ **Клавиатурные шорткаты через XTest (Ctrl+,)** не срабатывают — WebKitGTK не получает synthetic key events корректно
- ⚠️ **emit_with_eval() workaround** — Rust→JS event delivery работает, но требует `__FO_EVENT_BUFFER__` + CustomEvent dispatch вместо нативного Tauri `app.emit()` (WebKitGTK bug)

### General Settings Tab

- ⚠️ **Полностью placeholder** — нет ни одного рабочего поля. По спецификации (UI Design Spec) там должны быть: Start on system startup, Remember last used panes, Diagnostics export location

### Ctrl+I (Properties shortcut)

- ⚠️ **Shortcut отображается в OperationToolbar dropdown** («Properties ⌘I»), но **НЕ подключён** в `handleShellKeyDown`. Display-only.

### Ctrl+Shift+. / Ctrl+H для Show Hidden

- ⚠️ В спецификации указаны `Ctrl+Shift+.` и `Ctrl+H` для toggle hidden files. Реализован только `Ctrl+.`. `Ctrl+H` не работает.

---

## 3. ЧТО ПРОПУЩЕНО (specified в спеках, но НЕ реализовано) ❌

### Settings — пропущенные секции и поля

| Элемент                                   | Источник           |
| ----------------------------------------- | ------------------ |
| ❌ General tab: Start on system startup   | UI Design Spec     |
| ❌ General tab: Remember last used panes  | UI Design Spec     |
| ❌ Operations section (отдельная вкладка) | UI Design Spec     |
| ❌ Shortcuts section (внутри Settings)    | UI Design Spec     |
| ❌ Advanced section                       | UI Design Spec     |
| ❌ Accent color setting                   | UI Design Spec     |
| ❌ Font size setting                      | UI Design Spec     |
| ❌ Confirm before overwrite               | UI Design Spec     |
| ❌ Sidebar visibility toggle              | Sprint 5 FO-0216   |
| ❌ Diagnostics visibility toggle          | Sprint 5 FO-0216   |
| ❌ Pane layout preference                 | Sprint 5 FO-0216   |
| ❌ Icon size preference                   | Sprint 4 FO-S4-010 |

### Toolbar — пропущенные secondary/overflow actions

| Элемент                          | Источник                       |
| -------------------------------- | ------------------------------ |
| ❌ Open terminal here            | UI Design Spec §4              |
| ❌ Reveal in system file manager | UI Design Spec §4              |
| ❌ Calculate size                | UI Design Spec §4              |
| ❌ Checksum                      | UI Design Spec §4              |
| ❌ Compress                      | UI Design Spec §4              |
| ❌ Extract archive               | UI Design Spec §4, MVP-ARC-001 |

### File Table — пропущенные колонки

| Элемент                          | Источник          |
| -------------------------------- | ----------------- |
| ❌ Size column (default)         | UI Design Spec §5 |
| ❌ Type column (default)         | UI Design Spec §5 |
| ❌ Created column (optional)     | UI Design Spec §5 |
| ❌ Permissions column (optional) | UI Design Spec §5 |
| ❌ Owner column (optional)       | UI Design Spec §5 |
| ❌ Extension column (optional)   | UI Design Spec §5 |
| ❌ Hash column (optional)        | UI Design Spec §5 |

### MVP Spec — пропущенные крупные фичи

| Элемент                                                 | Источник                                  |
| ------------------------------------------------------- | ----------------------------------------- |
| ❌ Git integration (branch display, file status badges) | MVP-GIT-001/002                           |
| ❌ Archive support (extract zip/tar as job)             | MVP-ARC-001                               |
| ❌ Embedded terminal panel                              | MVP Spec §Embedded Terminal               |
| ❌ File preview panel (Space to preview)                | MVP Spec §UI/UX                           |
| ❌ Command palette                                      | MVP Spec §UI/UX, Sprint 5 Stretch FO-0242 |
| ❌ Filesystem watcher (auto-refresh)                    | Sprint 4 FO-S4-025                        |
| ❌ Sync/health indicator in title bar                   | UI Design Spec §1                         |

### Sidebar

| Элемент                                | Источник           |
| -------------------------------------- | ------------------ |
| ❌ Videos folder                       | Sprint 4 FO-S4-004 |
| ❌ Network locations under Devices     | UI Design Spec §2  |
| ❌ «This Week» group in Recent         | UI Design Spec §2  |
| ❌ Sidebar collapsed state persistence | Sprint 4 FO-S4-004 |

### Other

| Элемент                                          | Источник                             |
| ------------------------------------------------ | ------------------------------------ |
| ❌ First-run welcome overlay                     | Sprint 5 Stretch FO-0244             |
| ❌ Split ratio persistence                       | Sprint 5 Stretch FO-0241             |
| ❌ Last-path restore on startup                  | Sprint 5 Stretch FO-0243             |
| ❌ Accessibility: focus trapping, contrast audit | Sprint 4 FO-S4-023, Sprint 5 FO-0245 |

---

## 4. СВОДНАЯ СТАТИСТИКА

- **Реализовано UI элементов:** ~129 из ~160 specified
- **Placeholder:** 1 (General settings tab)
- **Сломано/баги:** 4 (Ctrl+I не подключён, Ctrl+H не работает, X11+WebKitGTK issues, General tab empty)
- **Пропущено (specified, не реализовано):** ~30+ элементов
- **Stretch/Out of scope (осознанно отложены):** Command palette, First-run overlay, Column view drag-and-drop, Split ratio persistence, Last-path restore, Tabs per panel, Cloud providers, AI search, Plugin marketplace

### Реализация по категориям

- **Core UI shell:** 95% (TitleBar, Sidebar, Dual Pane, Status Bar, Layout)
- **File operations:** 90% (все основные, нет archive/compress/terminal)
- **Settings/Preferences:** 55% (Appearance + Files & Folders + Layout работают; General/Operations/Shortcuts/Advanced — missing)
- **Toolbar secondary:** 40% (6 из 10 overflow actions отсутствуют)
- **File table columns:** 30% (только Name + Modified; нет Size, Type, Created, Permissions, Owner, Extension, Hash)
- **MVP stretch features:** 5% (Git, terminal, preview, command palette, watcher — всё нереализовано)
- **Keyboard shortcuts:** 90% (19 из ~21 specified; Ctrl+I и Ctrl+H missing)

---

## 5. РЕКОМЕНДАЦИИ (по приоритету)

1. **P0 — Подключить Ctrl+I** для Properties (уже есть в UI, просто не wired)
2. **P0 — Добавить Ctrl+H** как алиас для Show Hidden (в спецификации)
3. **P1 — Заполнить General tab** (Start on startup, Remember panes)
4. **P1 — Добавить колонки Size и Type** в Details view (default по спецификации)
5. **P2 — Реализовать Filesystem watcher** (Sprint 4 FO-S4-025, критично для UX)
6. **P2 — Compress/Extract** в overflow toolbar (MVP-ARC-001)
7. **P3 — Git status badges** (MVP-GIT-001/002)
8. **P3 — Embedded terminal** (MVP Spec)
