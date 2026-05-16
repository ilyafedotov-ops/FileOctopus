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

### 7. Implement Compress (archive job)

|                | Field                                                 | Value |     |
| -------------- | ----------------------------------------------------- | ----- | --- |
| **Status**     | `pending`                                             |
| **Priority**   | P2                                                    |
| **Spec**       | MVP engineering spec §3.1 archives; UI Design Spec §4 |
| **Acceptance** | **MVP-ARC-001** (create archive)                      |
| **Micro-spec** | _not written_                                         |

**Description:** Replace "coming soon" toast with planned archive job. Wire toolbar + context menu.

**Test plan (TDD):**

- Rust: `archive-core` or `fs-core` — traversal rejection tests per MVP §13.1
- TS + frontend: client method, toolbar handler

**Files:** `crates/` (new crate or extend), `packages/ts-api/`, `packages/frontend/src/`

**IPC / boundary:** New commands — full mirror checklist

---

### 8. Implement Extract (unarchive job)

|                | Field                             | Value |     |
| -------------- | --------------------------------- | ----- | --- |
| **Status**     | `pending`                         |
| **Priority**   | P2                                |
| **Spec**       | MVP §3.1; MVP §13.2 scenarios 8–9 |
| **Acceptance** | **MVP-ARC-001**, **MVP-ARC-002**  |
| **Micro-spec** | _not written_                     |

**Description:** Replace extract toast with extract job; block zip-slip / `..` traversal.

**Test plan (TDD):**

- Rust: `archive_rejects_dotdot_traversal`, safe extract + malicious rejection
- TS + frontend: same pattern as task 7

**Files:** Same stack as task 7

**IPC / boundary:** Same checklist as task 7

---

### 9. Empty directory state — action buttons

|                | Field                                                     | Value |     |
| -------------- | --------------------------------------------------------- | ----- | --- |
| **Status**     | `done`                                                    |
| **Priority**   | P2                                                        |
| **Spec**       | Sprint 5 FO-0211; UI Design Spec §Pane States             |
| **Acceptance** | Navigate to empty dir → "New Folder" + "Refresh" buttons  |
| **Micro-spec** | _already implemented — PaneStateView with action buttons_ |
| **Commit**     | `be185d9`                                                 |

**Description:** When directory is empty, show action buttons: "New Folder" (calls `fs_create_file` with folder kind), "Refresh" (re-lists directory). Add E2E test in `pane-states.e2e.ts`.

**Test plan (TDD):**

- Frontend: Vitest — render empty state, verify buttons present and wired ✅
- E2E: pane-state-empty class presence/absence ✅; skipped test for button visibility (needs Tauri) ✅

**Files:** `packages/frontend/src/index.tsx`, `packages/frontend/src/pane/`, `packages/frontend/src/components/PaneStateView.tsx`

**IPC / boundary:** Uses existing `fs_create_file`

---

## Backlog (not yet prioritized for next cycle)

- Application menu bar (File/Edit/View/Go/…) — P2, MVP-UI-001, Menu & Modal Spec §4
- Git branch + file badges (`git-intel`) — P2, MVP-GIT-001–002, MVP M4
- Embedded terminal panel — P3, MVP-TERM-001, MVP §Embedded Terminal
- Remember last panes / boot restore — P3, UI Design Spec, FO-0243 / Sprint 5
- Tabs per panel — P3, MVP §3.1, `PanelTabState` exists
- Shortcut rebinding UI — P3, extends Task 10 foundation

---

## Completed Tasks

| Task                                 | Acceptance                                 | Date       | Commit    | TDD RED |
| ------------------------------------ | ------------------------------------------ | ---------- | --------- | ------- |
| Menu spec comparison — context menu  | Menu spec                                  | 2026-05-16 | —         | —       |
| Feature inventory cross-reference    | UI inventory                               | 2026-05-16 | —         | —       |
| Fix deprecated `sha256::digest_file` | —                                          | 2026-05-16 | `5ea036b` | no      |
| Wire Checksum toolbar (Task 4)       | Toolbar hash                               | 2026-05-16 | `d8959dc` | no      |
| Tauri IPC integration tests (Task 6) | 23 tests                                   | 2026-05-16 | `eceb9de` | ✅      |
| 1. Visual regression baselines       | 12 screenshot tests                        | 2026-05-16 | existing  | ✅      |
| 2. IPC integration tests (full)      | 163 Rust tests (7 test files)              | 2026-05-16 | `e6bf418` | ✅      |
| 3. Sidebar context menu              | Rename/Remove/Reveal                       | 2026-05-16 | existing  | ✅      |
| 4. Properties Dialog                 | Name/Path/Size/Type/Timestamps/Permissions | 2026-05-16 | existing  | ✅      |
| 5. Expanded E2E tests                | 174 tests across 13 files                  | 2026-05-16 | existing  | ✅      |
| 6. Wire Checksum toolbar             | handleChecksum via computeHash             | 2026-05-16 | existing  | ✅      |
| 9. Empty directory state             | New Folder + Refresh buttons               | 2026-05-16 | `be185d9` | ✅      |
| 10. Settings: Shortcuts tab          | Read-only shortcuts display in Settings    | 2026-05-16 | `2d90951` | ✅      |
