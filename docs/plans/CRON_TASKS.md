# FileOctopus — Cron Task Queue

> Pick work per [CRONJOB_WORKFLOW.md](./CRONJOB_WORKFLOW.md).  
> **Status:** `pending` → `in_progress` → `done` (at most one `in_progress`).  
> **Before Phase 3:** file a micro-spec (workflow template) and name the first failing test.

## Queue rules

1. Fix Phase 0 failures before new features.
2. Every task must list **Spec** + **Acceptance** IDs.
3. Mark `done` only after `bash scripts/health-check.sh` passes and TDD evidence is recorded in `CRON_STATUS.md`.

---

## Active Tasks

> Full plan: `docs/plans/2026-05-16-comprehensive-test-and-implementation.md`

### 1. Visual regression — Playwright screenshot baselines

|| Field | Value |
|| -------------- | ------------------------------------------------------------------------------ |
|| **Status** | `pending` |
|| **Priority** | P1 |
|| **Spec** | `docs/FileOctopus_UI_Design_Spec.md`; reference PNGs in `docs/Images/MainApp/` |
|| **Acceptance** | MVP-UI-001 visual parity; 15 screenshot test cases pass |
|| **Micro-spec** | _not written_ |

**Description:** Create `e2e/visual-regression.e2e.ts` with Playwright `toHaveScreenshot()` for each layout region. Capture: main shell, sidebar, toolbar, file table, status bar, breadcrumb, context menus, settings dialog, command palette, preview panel. Test light + dark themes, 3 density modes. Store baselines in `e2e/baselines/`.

**Test plan (TDD):**

- RED: write 15 test cases that fail (no baselines yet)
- GREEN: generate baselines via `npx playwright test --update-snapshots`
- REFACTOR: group by theme/density, shared setup/teardown

**Files:** `e2e/visual-regression.e2e.ts` (new), `e2e/baselines/` (new), `playwright.config.ts`

**IPC / boundary:** N/A

---

### 2. Tauri IPC integration tests — full coverage

|| Field | Value |
|| -------------- | ------------------------------------------------------------------------------ |
|| **Status** | `pending` |
|| **Priority** | P1 |
|| **Spec** | `docs/architecture/api-reference.md` (IPC contract); MVP §13 |
|| **Acceptance** | MVP-REL-005; all 34 `#[tauri::command]` handlers have ≥1 integration test |
|| **Micro-spec** | _not written_ |

**Description:** Create `apps/desktop-tauri/src-tauri/tests/` directory with integration tests for every Tauri command handler. Currently 23 unit tests in lib.rs cover basic happy paths — need error paths, async commands, state management. Test files: `ipc_basic_test.rs`, `ipc_file_ops_test.rs`, `ipc_hash_test.rs`, `ipc_preview_test.rs`, `ipc_folder_test.rs`, `ipc_watch_test.rs`, `ipc_search_test.rs`, `ipc_error_test.rs`.

**Test plan (TDD):**

- Rust: test each command with temp dir → invoke → assert response → cleanup
- Rust: error paths — invalid URIs, permission denied, not found, directory expected
- Rust: async progress events — `fs_folder_size_start`, `fs_recursive_search_start`

**Files:** `apps/desktop-tauri/src-tauri/tests/` (new directory, 8+ files), `Cargo.toml`

**IPC / boundary:**

- [ ] Tests exercise full path: `invoke` → handler → `AppCore` → `Vfs` → filesystem
- [ ] Cover `VfsError` → `IpcError` → Tauri response propagation
- [ ] Verify `local://` URI handling at command boundary

---

### 3. Sidebar context menu (3 items per Menu Spec)

|| Field | Value |
|| -------------- | ---------------------------------------------------------------- |
|| **Status** | `pending` |
|| **Priority** | P1 |
|| **Spec** | UI Design Spec §2; Menu spec §Sidebar Context Menu |
|| **Acceptance** | Right-click sidebar favorite → Rename/Remove/Reveal appear |
|| **Micro-spec** | _not written_ |

**Description:** Add context menu for sidebar favorites with 3 items: "Rename Favorite" (inline rename), "Remove Favorite" (remove from list), "Reveal Path" (calls `fs_reveal`). Add E2E test in new `e2e/sidebar.e2e.ts`.

**Test plan (TDD):**

- Frontend: Vitest — render Sidebar, right-click favorite, menu items visible
- E2E: Playwright — right-click sidebar entry, verify menu items
- E2E: Click "Remove Favorite" → entry removed

**Files:** `packages/frontend/src/sidebar/`, `packages/frontend/src/index.tsx`, `e2e/sidebar.e2e.ts` (new)

**IPC / boundary:** Uses existing `fs_reveal` command

---

### 4. Properties Dialog — detailed metadata view

|| Field | Value |
|| -------------- | ------------------------------------------------------------------------- |
|| **Status** | `pending` |
|| **Priority** | P1 |
|| **Spec** | Sprint 4 FO-S4-019; UI Design Spec `PropertiesDialog.tsx`; Menu spec §Properties |
|| **Acceptance** | Ctrl+I on file → dialog with name, path, size, type, timestamps, permissions |
|| **Micro-spec** | _not written_ |

**Description:** Create `PropertiesDialog.tsx` component with tabs: General (name, full path, type, size, timestamps, item count for dirs) and Permissions. Wire to Ctrl+I handler. Use `fs_properties` IPC for metadata. Add Vitest + E2E tests.

**Test plan (TDD):**

- Frontend: Vitest — render dialog with mock entry, verify all fields display
- Frontend: Vitest — verify tab switching
- E2E: Ctrl+I → dialog opens, shows file metadata

**Files:** `packages/frontend/src/components/PropertiesDialog.tsx` (new), `packages/frontend/src/index.tsx`, `e2e/dialogs.e2e.ts` (extend)

**IPC / boundary:** Uses existing `fs_properties` command

---

### 5. Expanded E2E — sidebar, toolbar, dialogs, view modes

|| Field | Value |
|| -------------- | ----------------------------------------------------------------------- |
|| **Status** | `pending` |
|| **Priority** | P1 |
|| **Spec** | UI Design Spec §§1-7; Sprint 4 + 5 backlogs |
|| **Acceptance** | 80+ new E2E tests across 5 new test files |
|| **Micro-spec** | _not written_ |

**Description:** Create 5 new E2E test files: `sidebar.e2e.ts` (12 tests), `toolbar.e2e.ts` (15 tests), `dialogs.e2e.ts` (10 tests), `view-modes.e2e.ts` (8 tests), `pane-states.e2e.ts` (8 tests). Covers: sidebar sections/favorites/devices, all toolbar buttons responsive, settings/shortcuts/diagnostics dialogs, 4 view modes, loading/empty/error states.

**Test plan (TDD):**

- Write test file → verify fails (RED) → implement feature or adjust test → pass (GREEN)
- Each test uses `page.locator('.fo-shell')` for keyboard events
- Use `toBeAttached()` for responsive-hidden toolbar elements

**Files:** `e2e/sidebar.e2e.ts`, `e2e/toolbar.e2e.ts`, `e2e/dialogs.e2e.ts`, `e2e/view-modes.e2e.ts`, `e2e/pane-states.e2e.ts` (all new)

**IPC / boundary:** N/A (Playwright against Vite dev server)

---

### 6. Wire Checksum toolbar action

|| Field | Value |
|| -------------- | ---------------------------------------------------------------------- |
|| **Status** | `pending` |
|| **Priority** | P2 |
|| **Spec** | UI Design Spec §4; gap analysis T3.1 |
|| **Acceptance** | Click Checksum → shows hash result in toast/dialog |
|| **Micro-spec** | _not written_ |

**Description:** Replace checksum toast placeholder with real action: call `fs_compute_hash` on selected file, display result (sha256 hex) in a dialog or toast. Wire toolbar button + context menu item.

**Test plan (TDD):**

- Frontend: Vitest — mock `client.fs.computeHash`, verify handler calls it
- E2E: Click checksum toolbar button → hash result displayed

**Files:** `packages/frontend/src/index.tsx`, `packages/frontend/src/pane/OperationToolbar.tsx`

**IPC / boundary:** Uses existing `fs_compute_hash` command

---

### 7. Implement Compress (archive job)

|| Field | Value |
|| -------------- | ------------------------------------------------------------------------ |
|| **Status** | `pending` |
|| **Priority** | P2 |
|| **Spec** | MVP engineering spec §3.1 archives; UI Design Spec §4 |
|| **Acceptance** | **MVP-ARC-001** (create archive) |
|| **Micro-spec** | _not written_ |

**Description:** Replace "coming soon" toast with planned archive job. Wire toolbar + context menu.

**Test plan (TDD):**

- Rust: `archive-core` or `fs-core` — traversal rejection tests per MVP §13.1
- TS + frontend: client method, toolbar handler

**Files:** `crates/` (new crate or extend), `packages/ts-api/`, `packages/frontend/src/`

**IPC / boundary:** New commands — full mirror checklist

---

### 8. Implement Extract (unarchive job)

|| Field | Value |
|| -------------- | ---------------------------------------------------- |
|| **Status** | `pending` |
|| **Priority** | P2 |
|| **Spec** | MVP §3.1; MVP §13.2 scenarios 8–9 |
|| **Acceptance** | **MVP-ARC-001**, **MVP-ARC-002** |
|| **Micro-spec** | _not written_ |

**Description:** Replace extract toast with extract job; block zip-slip / `..` traversal.

**Test plan (TDD):**

- Rust: `archive_rejects_dotdot_traversal`, safe extract + malicious rejection
- TS + frontend: same pattern as task 7

**Files:** Same stack as task 7

**IPC / boundary:** Same checklist as task 7

---

### 9. Empty directory state — action buttons

|| Field | Value |
|| -------------- | ----------------------------------------------------------- |
|| **Status** | `pending` |
|| **Priority** | P2 |
|| **Spec** | Sprint 5 FO-0211; UI Design Spec §Pane States |
|| **Acceptance** | Navigate to empty dir → "New Folder" + "Refresh" buttons |
|| **Micro-spec** | _not written_ |

**Description:** When directory is empty, show action buttons: "New Folder" (calls `fs_create_file` with folder kind), "Refresh" (re-lists directory). Add E2E test in `pane-states.e2e.ts`.

**Test plan (TDD):**

- Frontend: Vitest — render empty state, verify buttons present and wired
- E2E: Navigate to empty dir → click "New Folder" → folder created

**Files:** `packages/frontend/src/index.tsx`, `packages/frontend/src/pane/`

**IPC / boundary:** Uses existing `fs_create_file`

---

### 10. Settings: Shortcuts tab

|| Field | Value |
|| -------------- | ---------------------------------------------------------------- |
|| **Status** | `pending` |
|| **Priority** | P3 |
|| **Spec** | UI Design Spec §Preferences; Menu spec (shortcuts customization) |
|| **Acceptance** | MVP-UI-001 (configurable shortcuts foundation) |
|| **Micro-spec** | _not written_ |

**Description:** Add Shortcuts tab to SettingsDialog; allow rebinding entries from `shortcuts.ts` with persistence.

**Test plan (TDD):**

- Frontend: Vitest — render tab, change binding, shortcut fires new action

**Files:** `packages/frontend/src/components/SettingsDialog.tsx`, `packages/frontend/src/shortcuts.ts`
|| ------------------------------------ | ------------ | ---------- | --------- | ------- |
|| Menu spec comparison — context menu | Menu spec | 2026-05-16 | — | — |
|| Feature inventory cross-reference | UI inventory | 2026-05-16 | — | — |
|| Fix deprecated `sha256::digest_file` | — | 2026-05-16 | `5ea036b` | no |
|| Wire Checksum toolbar (Task 4) | Toolbar hash | 2026-05-16 | `d8959dc` | no |
|| Tauri IPC integration tests (Task 6) | 23 tests | 2026-05-16 | `eceb9de` | ✅ |
