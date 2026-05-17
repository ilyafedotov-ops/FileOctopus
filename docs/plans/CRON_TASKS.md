# FileOctopus — UI Wiring & Feature Gap Tasks

> Auto-generated from comprehensive audit: menu (72 items), file ops (14), dialogs (13), interactions (15), spec gaps (23).
> Last updated: 2026-05-17

---

## Priority Legend

- **P0**: User-visible broken/missing features — things that look broken or don't work at all
- **P1**: Core UX patterns — expected in any file manager, noticeably absent
- **P2**: Spec compliance — features described in spec but not yet implemented
- **P3**: Polish & accessibility — important but not blocking daily use

---

## P0 — Critical (Broken / Missing Core Features)

### P0-1: Wire Filter Input — component exists but never rendered

**Status**: done ✅ (commit `25c77c5`)
**Files**: `packages/frontend/src/pane/PaneFilterBar.tsx` (FilterInput defined), `FilePanel.tsx` (now renders it)
**Problem**: `FilterInput` component was fully implemented with focus token support, value binding, placeholder. But it was **never imported or rendered**. `Ctrl+F` triggers `setFilterFocusToken` increment but nothing appeared.
**Action**: ✅ Imported and rendered `FilterInput` in `FilePanel` header area (above file table, below breadcrumb). Wired `value`/`onChange` to `tab.filter` state via `onFilter` prop. Wired `focusToken` to `filterFocusToken` prop.
**Tests**: ✅ 2 tests added in `tests/filterInput.test.tsx`: filter input renders inside file panel; typing filters entries. 170/170 tests pass.

### P0-2: Fix Toolbar Search Input — dead element

**Status**: done ✅ (already resolved — dead search input was removed in prior refactoring)
**Files**: `packages/frontend/src/shell/ShellToolbar.tsx`
**Problem**: Static `<input type="search">` with placeholder "Command or search…" — no `onChange`, no `value`, no `onKeyDown`. Pure dead UI.
**Action**: ✅ Already resolved. ShellToolbar was refactored to render OperationToolbar + location chips. No dead search input exists anymore. Ctrl+F focus filter is now handled via P0-1.
**Tests**: N/A — dead element removed in prior refactoring.

### P0-3: Implement Drag & Drop File Operations

**Status**: pending
**Files**: `packages/frontend/src/pane/FilePanel.tsx` (useFileOctopusDragTarget), `FileRow.tsx` (draggable)
**Problem**: Drag source works (sets URI + name). Drop target calls `onNavigate(uri)` — **navigates** instead of copy/move. No drop-on-folder support.
**Action**:

- Change `onDrop` handler to detect drag source → offer Copy/Move choice (or use modifier keys: default=copy, Shift=move)
- Add drop-on-folder support (detect if target is directory → move into it)
- Add drop-on-other-pane support (cross-pane copy/move)
- Add visual feedback: drop target highlight, drag cursor change
  **Tests**: E2E: drag file from pane A to pane B → file copied; drag with Shift → file moved.

### P0-4: Enable Show Toolbar / Show Status Bar menu items

### P0-4: Enable Toggle Toolbar/Statusbar

**Status**: done ✅ (commit `dffbf11`)
**Files**: `packages/frontend/src/shell/MenuBar.tsx` (lines 427-438)
**Action**: Remove `disabled: true` from toggle-toolbar and toggle-statusbar items. Handlers (`onToggleToolbar`, `onToggleStatusBar`) already wired through layout store.
**Action**: Remove `disabled: true` from both menu items. Verify toggle state reflects in menu checkbox.
**Tests**: Click menu item → toolbar/statusbar hides; click again → shows.

### P0-5: Implement Swap Panes

**Status**: done ✅ (commit `fb55230`)
**Files**: `panelStore.ts`, `commands/types.ts`, `commands/dispatch.ts`, `useMenuBarProps.ts`, `MenuBar.tsx`
**Action**: Added `swapPanes` action to reducer (swaps panels.left ↔ panels.right), `layout.swapPanes` command dispatch, removed `disabled: true` from menu item.
**Tests**: 3 unit tests: swap URIs, preserve activePanelId, swap selection state.

---

## P1 — Core UX Patterns

### P1-1: Tab System UI — TabBar component

**Status**: pending
**Files**: `packages/frontend/src/store/panelStore.ts` (PanelTabState, tabs, activeTabId exist)
**Problem**: Full tab state infrastructure exists (`tabs: Record<string, PanelTabState>`, `activeTabId`, `openTab`, `closeTab`, `switchTab`) but **zero UI**. No TabBar component.
**Action**:

- Create `TabBar.tsx` component: renders tab buttons, close button, "+" button
- Render in `PaneHeader` area (above breadcrumb)
- Wire tab actions: click to switch, middle-click or ✕ to close, "+" to open new tab
- Persist tabs in panel state
  **Tests**: Open 2 tabs → switch between them → each shows its own path. Close tab → returns to previous.

### P1-2: Column Resizing

**Status**: pending
**Files**: `packages/frontend/src/pane/FileTable.tsx` (ColumnHeader components)
**Problem**: No resize handles on column borders. Fixed column widths only.
**Action**:

- Add resize handle between column headers (mousedown → mousemove → mouseup)
- Store column widths in panel state/preferences
- Show resize cursor on column borders
  **Tests**: Drag column border → width changes. Persist across sessions.

### P1-3: Destination Chooser Dialog (Copy To / Move To)

**Status**: pending
**Files**: Spec §18.3. Current: `OperationDialogView` with simple path input.
**Problem**: Spec requires rich destination chooser: breadcrumb path input, folder tree browser, create folder action, available space warning, conflict preview.
**Action**:

- Create `DestinationChooserDialog.tsx` with directory tree browser
- Integrate with `fs.listDirectory` for browsing
- Add "New Folder" button, space display, conflict preview
- Replace simple `copyMove` dialog for Copy To/Move To operations
  **Tests**: Open Copy To → browse tree → select destination → copy starts.

### P1-4: Preview Panel — Image Support

**Status**: pending  
**Files**: `packages/frontend/src/components/PreviewPanel.tsx` (text-only)
**Problem**: Preview only works for text files (~55 extensions). No image preview.
**Action**:

- Add image detection (jpg, png, gif, svg, webp, bmp, ico)
- Render `<img>` with Tauri asset protocol (`asset://localhost/` or `convertFileSrc`)
- Add zoom controls (fit/fill/100%)
- Show image dimensions in header
  **Tests**: Select image file → Space → shows image preview. Select PDF → shows "not supported" message.

### P1-5: Breadcrumb Overflow Menu

**Status**: pending
**Files**: `packages/frontend/src/pane/PanePathBar.tsx`, `@fileoctopus/ui` BreadcrumbPath
**Problem**: Long paths overflow with no truncation. Spec §10.4: collapse middle segments into "…" overflow menu.
**Action**: Detect overflow → collapse middle segments → render "…" dropdown with collapsed segments.
**Tests**: Navigate to deep path → breadcrumb shows first + … + last segments. Click … → shows all.

---

## P2 — Spec Compliance

### P2-1: Tooltips System

**Status**: pending
**Files**: None — no tooltip component exists
**Spec**: §9.5 — disabled buttons should show tooltip explaining why unavailable
**Action**: Create `Tooltip` wrapper component (CSS-only or portal-based). Add to toolbar buttons, sidebar items, disabled menu items.

### P2-2: Focus Trap in Dialogs

**Status**: pending
**Files**: All dialog components (13 dialogs)
**Spec**: §18.1, §21.2 — all dialogs must trap focus, restore focus on close
**Action**: Create `useFocusTrap` hook. Apply to all modal dialogs. Verify Tab/Shift+Tab cycles within dialog.

### P2-3: Keyboard-Navigable Context Menus

**Status**: pending
**Files**: `ContextMenu.tsx`
**Spec**: §21.2 — context menus must be keyboard navigable (arrow keys, Enter, Escape)
**Action**: Add arrow key handlers (up/down to move focus, Enter to select, Escape to close).

### P2-4: Session Restore

**Status**: pending
**Spec**: §19.5 — restore last session paths on app restart
**Action**: Save panel paths, tab state, sidebar width to preferences on close. Restore on launch.

### P2-5: Running Jobs Close Confirmation

**Status**: pending
**Spec**: §18.2 — prevent accidental close while jobs are active
**Action**: Add `onCloseRequested` handler in Tauri config. If active jobs > 0, show confirmation dialog.

### P2-6: Column Visibility Toggle

**Status**: pending
**Spec**: §19.4 — user-selectable visible columns
**Action**: Add column visibility toggle in View menu or column header context menu. Store in preferences.

### P2-7: Volume Picker Dialog

**Status**: pending
**Spec**: §18.2 — drive/volume/root picker
**Action**: Create `VolumePickerDialog` showing available drives/mounts. Add to Go menu.

### P2-8: Recent Locations

**Status**: pending
**Spec**: §7.2, §18.2, §22.4
**Action**: Track navigation history. Add "Recent" sidebar section. Add "Recent Locations" dialog.

### P2-9: Selection Properties Dialog

**Status**: pending
**Spec**: §18.2
**Action**: Multi-file properties: count, total size, type breakdown. Show when multiple files selected → Properties.

### P2-10: Accessible Row Names

**Status**: pending
**Spec**: §21.2
**Action**: Add `aria-label` to FileRow with "{name}, {type}, {size}, {modified}" text.

### P2-11: Offline/Unmounted Pane State

**Status**: pending
**Spec**: §12.2
**Action**: Add `offline`/`unmounted` state to `PaneStateView`. Show when device becomes unavailable.

---

## P3 — Polish & Future

### P3-1: Column Reordering

**Status**: pending
**Action**: Drag column headers to reorder. Store order in preferences.

### P3-2: Eject/Unmount Device

**Status**: pending (spec marks future)
**Action**: Add eject button for removable devices in sidebar.

### P3-3: Job Pause/Resume

**Status**: pending (spec marks future)
**Action**: Add pause/resume to job cards.

### P3-4: Dual Pane Vertical Split

**Status**: pending (spec marks future)
**Action**: Top/bottom pane layout option.

### P3-5: Storage/Capacity Gauge

**Status**: pending
**Action**: Show disk usage bar in sidebar next to devices, in destination chooser.

### P3-6: Reset Layout Confirmation

**Status**: pending
**Action**: Confirmation dialog before resetting layout preferences.

### P3-7: Rubber-Band/Lasso Selection

**Status**: pending
**Action**: Click+drag on empty area to lasso-select files.

---

## Completed (from previous phases)

- ✅ Compress/Extract archives
- ✅ Conflict Resolution Dialog (per-item, apply-to-all)
- ✅ Settings Dialog (7 tabs including Operations)
- ✅ Sidebar menu integration
- ✅ Properties Dialog
- ✅ Visual Regression Testing
- ✅ IPC Tests (37+ commands)
- ✅ E2E Test Harness (WebdriverIO)
- ✅ Checksum computation
- ✅ Git Status indicators
- ✅ Drag source (partial — no file ops on drop)
- ✅ Tabs (state only — no UI)
- ✅ Terminal integration (open in OS terminal)
- ✅ P0 Layout Stabilization (density, debug overlay, accents)
- ✅ Activity Panel (collapsible rail)
- ✅ Dark theme token migration (base tokens)
- ✅ MenuBar (72 items, 69 wired)
- ✅ All 14 file operations (Rust IPC → TS → UI)
