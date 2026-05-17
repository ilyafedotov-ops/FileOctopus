# UI Design Spec Migration Plan

**Date:** 2026-05-17  
**Source:** `docs/FileOctopus_UI_Design_and_Layout_Specification-1.md` (1710 lines, 30 sections)  
**Goal:** Migrate existing UI to fully comply with the UI Design and Layout Specification

---

## Current State Summary

- **Frontend:** 48 TypeScript/TSX files across `packages/frontend/src/`
- **CSS:** `apps/desktop-tauri/src/App.css` — 2586 lines, 289 `--fo-*` variables
- **Tests:** 97 Vitest + 152 Playwright E2E
- **Themes:** Dark/Light with `data-theme` attribute
- **Density:** 3 modes (`compact`/`comfortable`/`spacious`) — only `--fo-row-height` varies
- **Decomposition:** index.tsx reduced from 3628 → 515 lines (-86%)

### Already Implemented (from spec §30)

✅ Dual-pane layout with sidebar, splitter, panes  
✅ Sidebar with favorites, volumes, recent  
✅ Breadcrumb path bar  
✅ File table with 9 columns (Name, Size, Modified, Created, Type, Extension, Permissions, Owner, Hash)  
✅ Context menus (file, empty space, sidebar, breadcrumb)  
✅ Settings dialog (General, Appearance, Files, Layout tabs)  
✅ Command palette (Ctrl+P)  
✅ File preview panel (Space)  
✅ Column view mode  
✅ Drag-and-drop between panes  
✅ Theme (dark/light) + density (3 modes)  
✅ Filesystem watcher wired  
✅ Operation dialogs (copy/move/delete/create/rename)  
✅ Properties dialog  
✅ Diagnostics dialog  
✅ Shortcuts dialog  
✅ Status bar with selection/path/job info  
✅ Toast notifications  
✅ Activity/jobs panel

---

## Phase 1: Design Tokens & Theme System (§20)

**Goal:** Migrate ad-hoc CSS vars to structured design token system per spec §20.2-20.5

### Tasks

#### 1.1 Create `tokens.css` — Design Token Definitions

**File:** `packages/frontend/src/styles/tokens.css` (new)  
**Action:** Define all token categories from §20.2:

```css
:root {
  /* Color tokens */
  --fo-color-bg: #0f1115;
  --fo-color-surface: #171a21;
  --fo-color-surface-elevated: #20242d;
  --fo-color-border: #2d3340;
  --fo-color-text-primary: #eef1f6;
  --fo-color-text-secondary: #9ca3af;
  --fo-color-text-muted: #6b7280;
  --fo-color-accent: #4f8cff;
  --fo-color-danger: #ef4444;
  --fo-color-warning: #f59e0b;
  --fo-color-success: #22c55e;

  /* Typography tokens */
  --fo-font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  --fo-font-size-xs: 11px;
  --fo-font-size-sm: 12px;
  --fo-font-size-base: 13px;
  --fo-font-size-lg: 15px;
  --fo-line-height: 1.5;

  /* Spacing tokens */
  --fo-spacing-xs: 2px;
  --fo-spacing-sm: 4px;
  --fo-spacing-md: 8px;
  --fo-spacing-lg: 12px;
  --fo-spacing-xl: 16px;

  /* Radius tokens */
  --fo-radius-sm: 6px;
  --fo-radius-md: 10px;
  --fo-radius-lg: 14px;

  /* Elevation tokens */
  --fo-elevation-popover: 0 8px 24px rgba(0, 0, 0, 0.4);
  --fo-elevation-modal: 0 14px 36px rgba(0, 0, 0, 0.5);
  --fo-elevation-drawer: 0 12px 32px rgba(0, 0, 0, 0.45);
}
```

#### 1.2 Create `density.css` — Full Density System

**File:** `packages/frontend/src/styles/density.css` (new)  
**Action:** Expand density from just `--fo-row-height` to full spec §5.3:

```css
:root[data-density="compact"] {
  --fo-sidebar-width: 220px;
  --fo-toolbar-height: 34px;
  --fo-pathbar-height: 32px;
  --fo-row-height: 26px;
  --fo-statusbar-height: 24px;
  --fo-splitter-width: 5px;
  --fo-toast-width: 320px;
  --fo-job-drawer-width: 380px;
  --fo-font-size-base: 12px;
  --fo-spacing-md: 6px;
}

:root[data-density="comfortable"] {
  --fo-sidebar-width: 248px;
  --fo-toolbar-height: 40px;
  --fo-pathbar-height: 38px;
  --fo-row-height: 32px;
  --fo-statusbar-height: 28px;
  --fo-splitter-width: 6px;
  --fo-toast-width: 360px;
  --fo-job-drawer-width: 420px;
}

:root[data-density="spacious"] {
  --fo-sidebar-width: 280px;
  --fo-toolbar-height: 48px;
  --fo-pathbar-height: 44px;
  --fo-row-height: 40px;
  --fo-statusbar-height: 34px;
  --fo-splitter-width: 8px;
  --fo-toast-width: 420px;
  --fo-job-drawer-width: 480px;
  --fo-font-size-base: 14px;
  --fo-spacing-md: 10px;
}
```

#### 1.3 Create `themes.css` — Light/Dark Palettes

**File:** `packages/frontend/src/styles/themes.css` (new)  
**Action:** Consolidate scattered `:root[data-theme]` rules (currently 30+ selectors) into clean token overrides:

```css
:root[data-theme="light"] {
  --fo-color-bg: #ffffff;
  --fo-color-surface: #f8f9fa;
  --fo-color-surface-elevated: #ffffff;
  --fo-color-border: #dee2e6;
  --fo-color-text-primary: #212529;
  /* ... etc */
}

:root[data-theme="dark"] {
  --fo-color-bg: #0f1115;
  --fo-color-surface: #171a21;
  /* ... etc */
}
```

#### 1.4 Migrate App.css to Use Tokens

**File:** `apps/desktop-tauri/src/App.css`  
**Action:** Replace ad-hoc `var(--fo-*)` references with structured token references. Remove duplicate theme overrides (lines 1585-1783). Import new stylesheet files.

#### 1.5 Wire CSS imports in App entry point

**File:** `apps/desktop-tauri/src/App.tsx`  
**Action:** Import `tokens.css`, `density.css`, `themes.css` before `App.css`

**Verification:** `tsc --noEmit` clean, 97/97 tests pass, visual screenshot comparison before/after

---

## Phase 2: Layout Compliance (§5, §7, §8, §14)

**Goal:** Align main window layout with spec §5 dimensions and responsive behavior

### Tasks

#### 2.1 Active Pane Styling Enhancement

**Files:** `App.css`, `ShellLayout.tsx`  
**Current:** Active pane has subtle border  
**Spec §8:** Active pane must be "visually obvious and functionally consistent"  
**Action:**

- Add `data-active="true/false"` attribute on each pane
- CSS: active pane gets brighter border (`--fo-color-accent`), inactive gets dimmed
- Add subtle left-border accent stripe on active pane

#### 2.2 Responsive Breakpoints

**File:** `App.css`  
**Current:** No responsive behavior  
**Spec §5.4:** 5 breakpoints from 700px to 1400px+  
**Action:** Add media queries:

- `>= 1400px`: Full layout
- `1100-1399px`: Compact toolbar
- `900-1099px`: Collapsible sidebar auto-hide
- `700-899px`: Single-pane mode
- `< 700px`: Compact density

#### 2.3 Layout Region Dimensions

**File:** `density.css` (from Phase 1)  
**Action:** Ensure all §5.3 dimension tokens are used in layout CSS

#### 2.4 Job Activity Drawer Spec Compliance

**Files:** `ActivityPanel.tsx`, `App.css`  
**Spec §15:** Hidden by default, opens on demand or error, width per density  
**Action:** Verify drawer matches spec — panel width uses density tokens, has proper elevation

**Verification:** Screenshots at each breakpoint, active/inactive pane toggle test

---

## Phase 3: Pane Components (§9, §10, §11, §12, §13)

**Goal:** Align toolbar, breadcrumb, file view, pane states with spec

### Tasks

#### 3.1 Toolbar Group Redesign (§9)

**File:** `OperationToolbar.tsx`, `App.css`  
**Current:** Flat button list with overflow dropdown  
**Spec §9:** Grouped into Navigation | Creation | Operation | View | More  
**Action:**

- Add visual separator between groups (thin vertical line)
- Ensure primary actions (Copy, Move, Delete, New Folder) are in first group
- View mode toggle (Details/List/Grid/Columns) in View group
- Overflow for less common actions

#### 3.2 Breadcrumb/Path Bar Improvement (§10)

**File:** `PanePathBar.tsx`, `App.css`  
**Current:** Basic breadcrumb  
**Spec §10:** "Visually distinct from command buttons", editable path input  
**Action:**

- Ensure breadcrumb segments are styled differently from toolbar buttons
- Verify editable path input works (click path → text input → Enter navigates)
- Add proper spacing/separator between breadcrumb and toolbar

#### 3.3 File Table Polish (§11)

**File:** `FileTable.tsx`, `FileRow.tsx`  
**Current:** 9 columns, sort headers  
**Spec §11:** "Stable columns, sorting, desktop-like selection behavior"  
**Action:**

- Verify column resize works (or add if missing)
- Ensure stable column order (Name | Size | Type | Modified by default)
- Desktop-like selection: Ctrl+click multi-select, Shift+click range select (verify)

#### 3.4 Standardized Pane States (§12)

**File:** `PaneStateView.tsx`, `App.css`  
**Current:** Has empty, loading, error states  
**Spec §12:** Loading, Empty, Error, Permission denied, Timeout, Indexing, Offline  
**Action:**

- Verify all 7 states exist with appropriate icons/messages
- Ensure each state has distinct visual treatment
- Add "Retry" button on Error/Timeout states

#### 3.5 Search/Filter Row (§13)

**File:** `PaneFilterBar.tsx`  
**Current:** Filter input + recursive search  
**Spec §13:** Current-folder filter with search strip  
**Action:** Verify filter/search alignment with spec (likely already compliant)

**Verification:** Screenshots of each pane state, toolbar groups, breadcrumb

---

## Phase 4: Command Surfaces (§6, §17, §22)

**Goal:** Menu bar, context menus, keyboard shortcuts per spec

### Tasks

#### 4.1 Application Menu Bar (§6, §22)

**File:** `MenuBar.tsx`  
**Current:** Basic Help dropdown only  
**Spec:** Full menu taxonomy: File | Edit | View | Go | Tools | Window | Help  
**Action:**

- Implement full menu bar with all items from §22
- Each menu item targets active pane
- Keyboard shortcuts displayed next to items
- Separators between logical groups

#### 4.2 Context Menu Completeness (§17)

**File:** `ContextMenu.tsx`/`ContextMenuOverlay.tsx`  
**Current:** 30+ items with separators, sort submenu  
**Spec §17:** Context menus for: file rows, folders, multi-selection, empty pane, sidebar entries, breadcrumbs, jobs  
**Action:**

- Verify all 7 context target types exist
- Ensure items are contextually appropriate (file-only actions disabled for empty space)
- Verify Sort submenu (already done as CSS hover submenu)

#### 4.3 Toolbar Dropdown Wiring (§22)

**File:** `OperationToolbar.tsx`, dropdown components  
**Current:** Overflow dropdown exists  
**Action:** Verify all toolbar dropdowns have correct items and target active pane

**Verification:** Keyboard walkthrough, menu bar screenshot, context menu on each target

---

## Phase 5: Dialogs & Settings (§18, §19)

**Goal:** Settings, dialogs, toasts match spec

### Tasks

#### 5.1 Settings Dialog Tabs (§19)

**File:** `SettingsDialog.tsx`  
**Current:** General, Appearance, Files, Layout tabs  
**Spec §19:** Theme, density, view mode, hidden-file, shortcuts preferences  
**Action:**

- Verify all spec-required settings exist in current tabs
- Add any missing preferences (e.g., default view mode per-pane)
- Ensure density selector works end-to-end

#### 5.2 Conflict Resolution Dialog (§18)

**Files:** Check if exists  
**Spec §18:** Required dialog for file conflicts during copy/move  
**Action:** Verify conflict dialog exists and handles: Skip, Replace, Rename, Cancel

#### 5.3 Toast System Polish (§16)

**File:** `ToastStack.tsx`  
**Spec §16:** Non-blocking, themed, auto-dismiss, width per density  
**Action:**

- Verify toast width uses density token
- Ensure toasts are themed (dark/light)
- Verify auto-dismiss behavior

**Verification:** Settings walkthrough, conflict dialog test, toast screenshots

---

## Phase 6: Polish & QA (§15, §21, §26, §27)

**Goal:** Visual regression, accessibility, acceptance criteria validation

### Tasks

#### 6.1 Visual Regression Tests (§26)

**Action:** Add Playwright visual regression snapshots for:

- Normal states (dual pane with files)
- Empty pane
- Loading state
- Error state
- Context menus open
- Settings dialog
- Narrow/wide window

#### 6.2 Keyboard Interaction Tests (§21)

**Action:** Verify all baseline shortcuts from §21.1 work correctly

#### 6.3 Accessibility Pass (§21)

**Action:**

- Verify focus rings visible on all interactive elements
- ARIA labels on icon-only buttons
- Screen reader compatibility for file table
- Keyboard-only navigation through all menus/dialogs

#### 6.4 Acceptance Criteria Validation (§27)

**Action:** Walk through all 15 acceptance criteria from §27 and verify compliance

---

## Priority Order

1. **Phase 1** (Tokens) — Foundation for everything else, no visual regression risk
2. **Phase 2** (Layout) — Active pane styling + responsive behavior
3. **Phase 3** (Pane Components) — Toolbar groups + pane states
4. **Phase 4** (Menu Bar) — Biggest missing feature per Feature Inventory
5. **Phase 5** (Dialogs) — Polish existing dialogs
6. **Phase 6** (QA) — Validation

## Estimated Scope

| Phase      | New Files        | Modified Files                                              | Risk                        |
| ---------- | ---------------- | ----------------------------------------------------------- | --------------------------- |
| 1. Tokens  | 3 (CSS)          | 2 (App.css, App.tsx)                                        | Low — mostly additive       |
| 2. Layout  | 0                | 3 (App.css, ShellLayout, ActivityPanel)                     | Medium — responsive changes |
| 3. Pane    | 0                | 4 (OperationToolbar, PanePathBar, FileTable, PaneStateView) | Medium — visual redesign    |
| 4. Menus   | 0-1              | 2 (MenuBar, ContextMenu)                                    | High — new menu bar         |
| 5. Dialogs | 0                | 2 (SettingsDialog, ToastStack)                              | Low — polish                |
| 6. QA      | 1-2 (test files) | 0                                                           | Low — test only             |

**Total:** ~3 new CSS files, ~15 modified files, 0 new components needed
