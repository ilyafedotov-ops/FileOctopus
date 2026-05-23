# FileOctopus — Comprehensive Test & Implementation Plan

**Created:** 2026-05-16
**Goal:** Expand E2E, add Tauri testing, add visual comparisons, implement missing menu items and visual elements per specs.

---

## Current State (2026-05-16)

### Test Coverage

| Area                  | Count                  | Status                                    |
| --------------------- | ---------------------- | ----------------------------------------- |
| E2E (Playwright)      | 69 tests (3 files)     | ✅ Layout, shortcuts, context menu        |
| Vitest (unit)         | ~94 tests (14 files)   | ✅ Components, store, utils               |
| Visual regression     | 2 DOM snapshots        | ⚠️ No pixel-level comparison              |
| Tauri IPC integration | 23 unit tests (lib.rs) | ⚠️ Only basic happy paths, no error paths |
| Rust workspace tests  | 56 tests (8 crates)    | ✅ vfs, fs-core, app-core, etc.           |

### Missing from Implementation (per UI_FEATURE_INVENTORY.md + Menu Spec)

1. **Context Menu — Sidebar** — Rename favorite, Remove favorite, Reveal path (3 items)
2. **Sidebar: Videos, Network locations** — partial
3. **View modes — Grid/Icons view** — not implemented
4. **Empty directory state** — UI placeholder exists but no "New Folder" action button
5. **Error state** — expandable technical details
6. **Permission-denied state** — with OS-level guidance
7. **Application menu bar** (File/Edit/View/Go) — title bar only
8. **Compress / Extract** — stub toasts
9. **Checksum toolbar** — stub toast (hash column works via IPC)
10. **Properties Dialog** — detailed metadata view
11. **Conflict Resolution Dialog** — not implemented
12. **Settings: Shortcuts tab** — customizable keybindings
13. **Settings: Advanced tab** — not implemented
14. **First-run Welcome overlay** — stretch

---

## Plan Structure

### Phase 1: Visual Regression Tests (P1)

**File:** `e2e/visual-regression.e2e.ts` (NEW)

Baseline screenshots against reference images in `docs/Images/MainApp/` and `docs/Images/MenuImages/`.

```
Test cases:
1. Main shell — dual-pane layout (light theme)
2. Main shell — dual-pane layout (dark theme)
3. Sidebar — expanded state
4. Toolbar — all primary buttons visible
5. File table — column headers visible
6. Status bar — content visible
7. Breadcrumb path bar — segments
8. Context menu — file right-click (compare to MenuImages/)
9. Context menu — empty space right-click
10. Settings dialog — each tab
11. Command palette — open state
12. Preview panel — open with text file
13. Compact density
14. Comfortable density
15. Spacious density
```

**Approach:**

- Use `page.locator('.fo-shell').screenshot()` for regions
- `toHaveScreenshot()` with maxDiffPixelRatio: 0.1
- Store baselines in `e2e/baselines/`
- Reference PNGs in `docs/Images/` guide expected layout but are NOT pixel-identical targets

### Phase 2: Tauri IPC Integration Tests (P1)

**Directory:** `apps/desktop-tauri/src-tauri/tests/` (NEW)

Test every `#[tauri::command]` through the actual IPC boundary.

```
Test files:
1. ipc_basic_test.rs    — fs_stat, fs_properties, fs_standard_locations
2. ipc_file_ops_test.rs — fs_create_file, fs_delete_permanently
3. ipc_hash_test.rs     — fs_compute_hash (file, directory, missing)
4. ipc_preview_test.rs  — fs_read_text_file (content, truncation, directory)
5. ipc_folder_test.rs   — fs_folder_size, fs_folder_size_start
6. ipc_terminal_test.rs — fs_open_terminal (path validation)
7. ipc_watch_test.rs    — fs_watch_start, fs_watch_stop lifecycle
8. ipc_search_test.rs   — fs_recursive_search, fs_recursive_search_start
9. ipc_reveal_test.rs   — fs_reveal, fs_open_default
10. ipc_error_test.rs   — invalid URIs, permission denied, not found
```

**Approach:**

- Use `tauri::test::MockRuntime` or direct handler invocation with temp directories
- Each test: create temp dir → invoke handler → assert response → cleanup
- Error paths: test each `IpcError` code variant

### Phase 3: Missing Context Menu & Dialog Implementation (P1-P2)

**Per Menu Spec (`FileOctopus_Menu_and_Modal_Specification.md`):**

1. **Sidebar context menu** (3 items):
   - "Rename Favorite" → inline rename input
   - "Remove Favorite" → remove from favorites
   - "Reveal Path" → `fs_reveal`

2. **Properties Dialog** (`PropertiesDialog.tsx`):
   - Name, full path, type, size, folder item count
   - Timestamps (created, modified, accessed)
   - Permissions display
   - "Copy Path" button, "Reveal" button
   - Tab: General / Permissions

3. **Conflict Resolution Dialog**:
   - Replace / Skip / Keep Both options
   - "Apply to all" checkbox
   - Compare metadata view

4. **Checksum toolbar action** → wire to existing `fs_compute_hash` + result dialog

5. **Empty directory state** — "New Folder" + "Refresh" action buttons

### Phase 4: Visual Elements & View Modes (P2)

1. **Grid/Icons view** — thumbnail-oriented layout for files
2. **Error state** — expandable details section with retry
3. **Permission-denied state** — restricted path display + guidance
4. **Application menu bar** — at minimum File/Edit/View/Go/Help dropdowns
5. **Active pane highlight** — accent strip on active panel
6. **Loading spinner** — standardized loading animation

### Phase 5: Expanded E2E Tests (P1-P2)

**New test files:**

```
e2e/sidebar.e2e.ts           — 12 tests: sections, favorites, devices, collapse, click-nav
e2e/toolbar.e2e.ts           — 15 tests: primary/secondary buttons, overflow, responsive
e2e/dialogs.e2e.ts           — 10 tests: settings, shortcuts, diagnostics, command palette
e2e/view-modes.e2e.ts        — 8 tests: details, list, grid, columns
e2e/file-operations.e2e.ts   — 10 tests: copy, move, rename, delete, new folder/file
e2e/filter-search.e2e.ts     — 6 tests: filter bar, recursive search
e2e/pane-states.e2e.ts       — 8 tests: loading, empty, error, permission-denied
e2e/visual-regression.e2e.ts — 15 tests: screenshot comparison baselines
```

**Total new E2E: ~84 tests** (current 69 → target 153+)

---

## Execution Order

1. **Phase 1** (Visual regression) — establishes baselines for all subsequent work
2. **Phase 2** (Tauri IPC tests) — ensures backend is correct before frontend work
3. **Phase 3** (Missing menus/dialogs) — fill spec gaps
4. **Phase 4** (Visual elements) — refine to match reference images
5. **Phase 5** (Expanded E2E) — comprehensive coverage of everything above

---

## Cron Integration

Tasks from this plan will be added to `CRON_TASKS.md` for autonomous execution by the CI/CD cron agent (3h cycle). Each phase maps to one or more cron tasks.

The cron agent will:

1. Pick highest-priority pending task
2. Write micro-spec + first failing test (RED)
3. Implement (GREEN)
4. Refactor + commit
5. Update CRON_STATUS.md
