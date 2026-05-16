# FileOctopus — Pending Tasks (Cron Queue)

Tasks are picked up by the next cron run. Mark status as `pending`, `in_progress`, or `done`.

## Active Tasks

### 1. Compare UI against reference images

- **Status:** pending
- **Priority:** P1
- **Description:** Start Vite dev server, take Playwright screenshots of main app, compare against `docs/Images/MainApp/` (11 reference PNGs). Check: dual-pane layout, toolbar, sidebar, file table columns, status bar, breadcrumb navigation.
- **Files:** `docs/Images/MainApp/*.png`, `packages/frontend/src/index.tsx`

### 2. Compare menus against menu spec

- **Status:** pending
- **Priority:** P1
- **Description:** Verify all context menu items match `docs/plans/FileOctopus_Menu_and_Modal_Specification.md`. Check: toolbar menus, item context menu, empty-space context menu, sidebar context menu. Verify enablement rules.
- **Files:** `packages/frontend/src/components/ContextMenu.tsx`, `packages/frontend/src/pane/OperationToolbar.tsx`

### 3. Compare features against UI Feature Inventory

- **Status:** pending
- **Priority:** P2
- **Description:** Cross-reference `docs/planning/UI_FEATURE_INVENTORY.md` with actual implementation. Mark each item as ✅ implemented, ⚠️ partial, or ❌ missing.
- **Files:** `docs/planning/UI_FEATURE_INVENTORY.md`

### 4. Remaining gap analysis items

- **Status:** pending
- **Priority:** P2
- **Description:** From gap analysis: Compress/Extract (toolbar placeholders), Settings Shortcuts tab. Evaluate if any can be implemented this cycle.
- **Files:** `packages/frontend/src/index.tsx`

## Completed Tasks

(none yet)
