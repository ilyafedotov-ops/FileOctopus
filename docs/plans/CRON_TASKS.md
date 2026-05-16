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

### 1. Visual comparison against reference images

| Field          | Value                                                                          |
| -------------- | ------------------------------------------------------------------------------ |
| **Status**     | `pending`                                                                      |
| **Priority**   | P1                                                                             |
| **Spec**       | `docs/FileOctopus_UI_Design_Spec.md`; reference PNGs in `docs/Images/MainApp/` |
| **Acceptance** | UI inventory / visual parity (supports MVP-UI-001 polish)                      |
| **Micro-spec** | _not written_                                                                  |

**Description:** Start Vite dev server (`:1420`), capture Playwright screenshots of main shell, compare to 11 reference PNGs: dual-pane layout, toolbar, sidebar, file table, status bar, breadcrumbs.

**Test plan (TDD):**

- TS: add or extend Playwright spec under `apps/desktop-tauri/` or `packages/frontend/` — assert layout regions / snapshot diff vs baselines
- Manual: document deltas in `CRON_STATUS.md` if automation blocked

**Files:** `docs/Images/MainApp/*.png`, `packages/frontend/src/index.tsx`, Playwright config (if present)

**IPC / boundary:** N/A

---

### 2. Implement Compress (archive job)

| Field          | Value                                                                    |
| -------------- | ------------------------------------------------------------------------ |
| **Status**     | `pending`                                                                |
| **Priority**   | P2                                                                       |
| **Spec**       | MVP engineering spec §3.1 archives; UI Design Spec §4; gap analysis T3.2 |
| **Acceptance** | **MVP-ARC-001** (partial — create archive); **MVP-SEC-001** / ADR-0002   |
| **Micro-spec** | _not written_                                                            |

**Description:** Replace “coming soon” toast with planned archive job. Prefer `archive-core` crate + plan/start pattern (not ad-hoc `fs_compress` only). Wire toolbar + context menu.

**Test plan (TDD):**

- Rust: `archive-core` or `fs-core` — `archive_rejects_dotdot_traversal`-style cases per MVP §13.1 when applicable; plan/execute integration test
- Rust: `crates/app-ipc` — DTO round-trip if new request types
- TS: `packages/ts-api/tests/` — client method + error normalization
- Frontend: Vitest — toolbar handler invokes client (mock transport)

**Files:** `crates/` (new `archive-core` or extend `fs-core`), `crates/vfs`, `crates/app-ipc`, `crates/app-core`, `apps/desktop-tauri/src-tauri/src/lib.rs`, `packages/ts-api/src/types.ts`, `client.ts`, `packages/frontend/src/index.tsx`, `docs/architecture/api-reference.md`

**IPC / boundary:**

- [ ] New commands mirrored: `app-ipc`, `api-reference`, `types.ts`, `client.ts`, `commandMap`, `lib.rs`
- [ ] `local://` URIs only
- [ ] Mutations via plan/start job + progress events
- [ ] Stable error codes documented

---

### 3. Implement Extract (unarchive job)

| Field          | Value                                                |
| -------------- | ---------------------------------------------------- |
| **Status**     | `pending`                                            |
| **Priority**   | P2                                                   |
| **Spec**       | MVP §3.1; MVP §13.2 scenarios 8–9; UI Design Spec §4 |
| **Acceptance** | **MVP-ARC-001**, **MVP-ARC-002**, **MVP-REL-005**    |
| **Micro-spec** | _not written_                                        |

**Description:** Replace extract toast with extract job to selected destination; block zip-slip / `..` traversal (MVP-ARC-002).

**Test plan (TDD):**

- Rust: `archive_rejects_dotdot_traversal`, `archive_rejects_absolute_path` (MVP §13.1)
- Rust: integration — safe zip extract + malicious archive rejected
- TS + frontend: same pattern as task 2

**Files:** Same stack as task 2

**IPC / boundary:** Same checklist as task 2

---

### 4. Wire Checksum toolbar action

| Field          | Value                                                                  |
| -------------- | ---------------------------------------------------------------------- |
| **Status**     | `pending`                                                              |
| **Priority**   | P2                                                                     |
| **Spec**       | UI Design Spec §4; gap analysis T3.1                                   |
| **Acceptance** | UI inventory (toolbar checksum); reuse existing hash IPC if sufficient |
| **Micro-spec** | _not written_                                                          |

**Description:** Replace checksum toast. `fs_compute_hash` may already exist — wire toolbar + context menu to job or command; show result in dialog/toast. Only add `fs_verify_checksum` if spec requires verify-vs-file comparison.

**Test plan (TDD):**

- TS: `packages/ts-api/tests/` — hash/verify client calls
- Frontend: Vitest — handler calls `client.fs` and surfaces result
- Rust: extend only if new verify semantics — unit test in `fs-core`

**Files:** `packages/frontend/src/index.tsx`, `packages/ts-api/src/client.ts`, optionally `apps/desktop-tauri/src-tauri/src/lib.rs`, `docs/architecture/api-reference.md`

**IPC / boundary:**

- [ ] Prefer existing commands; if new command, full mirror checklist
- [ ] `local://` URIs only

---

### 5. Settings: Shortcuts tab

| Field          | Value                                                            |
| -------------- | ---------------------------------------------------------------- |
| **Status**     | `pending`                                                        |
| **Priority**   | P3                                                               |
| **Spec**       | UI Design Spec §Preferences; Menu spec (shortcuts customization) |
| **Acceptance** | MVP-UI-001 (configurable shortcuts foundation)                   |
| **Micro-spec** | _not written_                                                    |

**Description:** Add Shortcuts tab to SettingsDialog; allow rebinding entries from `shortcuts.ts` with persistence (preferences store / IPC if needed).

**Test plan (TDD):**

- Frontend: Vitest — render tab, change binding, shortcut fires new action
- TS: persistence round-trip if new preference IPC

**Files:** `packages/frontend/src/components/SettingsDialog.tsx`, `packages/frontend/src/shortcuts.ts`, preferences module

**IPC / boundary:** N/A unless new `app.setPreference` keys — then mirror DTOs

---

### 6. Tauri IPC integration tests

| Field          | Value                                                                  |
| -------------- | ---------------------------------------------------------------------- |
| **Status**     | `pending`                                                              |
| **Priority**   | P1                                                                     |
| **Spec**       | `docs/architecture/api-reference.md` (IPC contract); MVP §13           |
| **Acceptance** | MVP-REL-005 (reliability); all 39 `#[tauri::command]` handlers covered |
| **Micro-spec** | _not written_                                                          |

**Description:** Add integration tests for Tauri command handlers. Currently only 2 unit tests exist in `lib.rs` — the remaining 37 commands (`fs_stat`, `fs_list_directory`, `fs_copy`, `fs_move`, `fs_trash`, `fs_delete_permanent`, `fs_write_text_file`, checksum, compress/extract, terminal, preferences, etc.) have zero test coverage. Use `tauri::test` macro or `AppHandle` + `MockRuntime` to test through the actual IPC layer.

**Test plan (TDD):**

- Rust: `apps/desktop-tauri/src-tauri/tests/` (new directory) — test each command through `#[tauri::command]` invoke with `AppState` + temp dir
- Rust: Error path tests — `IpcError` serialization, invalid URIs, permission denied scenarios
- Rust: Async command tests — verify `fs_copy`, `fs_move` progress events
- Rust: State management tests — `AppState` initialization, `Managed` injection

**Files:** `apps/desktop-tauri/src-tauri/tests/` (new), `apps/desktop-tauri/src-tauri/src/lib.rs`, `apps/desktop-tauri/src-tauri/Cargo.toml`

**IPC / boundary:**

- [ ] Tests must exercise full IPC path: `invoke` → handler → `AppCore` → `Vfs` → filesystem
- [ ] Cover error propagation: `VfsError` → `IpcError` → Tauri response
- [ ] Verify `local://` URI handling at command boundary

---

### 7. Visual regression — pixel-level screenshot tests

| Field          | Value                                                                          |
| -------------- | ------------------------------------------------------------------------------ |
| **Status**     | `pending`                                                                      |
| **Priority**   | P1                                                                             |
| **Spec**       | `docs/FileOctopus_UI_Design_Spec.md`; reference PNGs in `docs/Images/MainApp/` |
| **Acceptance** | UI inventory / visual parity (MVP-UI-001)                                      |
| **Micro-spec** | _not written_                                                                  |

**Description:** Add Playwright `toHaveScreenshot()` pixel-level comparison tests against baseline images. Currently only 2 DOM-structure snapshot tests exist (`visualSnapshots.test.tsx`) — no visual regression. Capture screenshots of main shell, dual-pane layout, toolbar, sidebar, file table, status bar in both light/dark themes and all density modes (compact/comfortable/spacious).

**Test plan (TDD):**

- Playwright: `e2e/visual-regression.e2e.ts` (new) — `expect(page).toHaveScreenshot()` for each layout region
- Playwright: Multi-theme: light + dark baselines
- Playwright: Multi-density: compact + comfortable + spacious
- Generate baselines on first run, store in `e2e/baselines/`

**Files:** `e2e/visual-regression.e2e.ts` (new), `e2e/baselines/` (new), `playwright.config.ts`, `docs/Images/MainApp/*.png`

**IPC / boundary:** N/A

---

## Backlog (not yet prioritized for next cycle)

| Feature                                    | Priority | Acceptance      | Spec                   |
| ------------------------------------------ | -------- | --------------- | ---------------------- |
| Application menu bar (File/Edit/View/Go/…) | P2       | MVP-UI-001      | Menu & Modal Spec §4   |
| Git branch + file badges (`git-intel`)     | P2       | MVP-GIT-001–002 | MVP M4                 |
| Embedded terminal panel                    | P3       | MVP-TERM-001    | MVP §Embedded Terminal |
| Remember last panes / boot restore         | P3       | UI Design Spec  | FO-0243 / Sprint 5     |
| Tabs per panel                             | P3       | MVP §3.1        | `PanelTabState` exists |

_Add rows here when discovered; promote to **Active Tasks** with full template when scheduled._

---

## In Progress

_None — set exactly one task to `in_progress` when starting Phase 3._

---

## Completed Tasks

| Task                                 | Acceptance   | Date       | Commit    | TDD RED |
| ------------------------------------ | ------------ | ---------- | --------- | ------- |
| Menu spec comparison — context menu  | Menu spec    | 2026-05-16 | —         | —       |
| Feature inventory cross-reference    | UI inventory | 2026-05-16 | —         | —       |
| Fix deprecated `sha256::digest_file` | —            | 2026-05-16 | `5ea036b` | no      |
