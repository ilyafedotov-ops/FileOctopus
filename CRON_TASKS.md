# FileOctopus — Cron Task Queue

## Current Stats (baseline)

- Frontend: 122 test files / 877 tests / 205 source files (≈60% file coverage)
- Rust: 479 tests / 20 crates
- E2E: 192 tests / 14 files
- ts-api: 6 test files / 13 client modules
- ui package: 2 test files

## Target

- **95% component test coverage** (every .tsx/.ts component has a .test.tsx/.test.ts)
- **95% Rust crate coverage** (every crate with src/ has tests/)
- **Full E2E coverage** for all major user workflows
- **Integration tests** for IPC boundary, providers, and state management

---

## Active Task Queue

### Phase 1 — Missing Frontend Component Tests (target: 95%)

| ID       | Task                                                                                                                               | Priority | Status  |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| TC-FE-01 | Tests for `pane/` directory (26 source files — FilePanel, FileTable, FileRow, ColumnsView, FolderTree, LayoutResizers, pane utils) | P0       | pending |
| TC-FE-02 | Tests for `components/dialogs/` (18 source files — all dialog components)                                                          | P0       | pending |
| TC-FE-03 | Tests for `components/settings/` (17 source files — all settings panels)                                                           | P0       | pending |
| TC-FE-04 | Tests for `components/viewer/` (7 source files — viewer modes, gallery)                                                            | P0       | pending |
| TC-FE-05 | Tests for `components/codemirror/` (5 source files)                                                                                | P1       | pending |
| TC-FE-06 | Tests for `components/editor/` (2 source files) + `components/diff/` (1 source file)                                               | P1       | pending |
| TC-FE-07 | Tests for `shell/` directory (14 source files — AppShell, MenuBar, StatusBar, LayoutResizers)                                      | P0       | pending |
| TC-FE-08 | Tests for `hooks/` directory (14+7=21 source files — all custom hooks including fileOps/)                                          | P0       | pending |
| TC-FE-09 | Tests for `state/slices/` (5 source files — all Zustand slices)                                                                    | P0       | pending |
| TC-FE-10 | Tests for `navigation/` (4 source files)                                                                                           | P1       | pending |
| TC-FE-11 | Tests for `terminal/` (5 source files)                                                                                             | P1       | pending |
| TC-FE-12 | Tests for `menus/context/` (4 source files — context menu builders)                                                                | P1       | pending |
| TC-FE-13 | Tests for `utils/` (11 source files — columnPresets, fileTypeColors, layoutProfiles, etc.)                                         | P0       | pending |
| TC-FE-14 | Tests for `jobs/` (5 source files — JobCard, JobsProvider, jobCardUtils)                                                           | P1       | pending |
| TC-FE-15 | Tests for `sidebar/` (1 source file — but complex, sidebar tree + navigation + network status)                                     | P1       | pending |
| TC-FE-16 | Tests for `app/providers/` (8 source files — all context providers)                                                                | P1       | pending |
| TC-FE-17 | Tests for `commands/` (13 source files — command registry, dispatch, actions)                                                      | P0       | pending |
| TC-FE-18 | Tests for `onboarding/` + `dev/` (3 source files)                                                                                  | P2       | pending |

### Phase 2 — Missing Rust Crate Tests (target: 95%)

| ID       | Task                                                                                  | Priority | Status  |
| -------- | ------------------------------------------------------------------------------------- | -------- | ------- |
| TC-RS-01 | `app-core` — add integration tests/ dir (only 2 unit tests currently, no integration) | P0       | pending |
| TC-RS-02 | `config` — add integration tests/ dir (3 unit tests, no integration)                  | P1       | pending |
| TC-RS-03 | `jobs` — add integration tests/ dir (1 unit test, no integration)                     | P1       | pending |
| TC-RS-04 | `plugin-core` — add integration tests/ dir (1 unit test, no integration)              | P2       | pending |
| TC-RS-05 | `vfs` — add integration tests/ dir (1 unit test, no integration)                      | P0       | pending |
| TC-RS-06 | `provider-dropbox` — add integration tests/ dir (2 unit tests, no integration)        | P2       | pending |
| TC-RS-07 | `provider-gdrive` — add integration tests/ dir (2 unit tests, no integration)         | P2       | pending |
| TC-RS-08 | `provider-onedrive` — add integration tests/ dir (2 unit tests, no integration)       | P2       | pending |
| TC-RS-09 | `fs-core` — expand coverage for file_ops, metadata, search modules                    | P0       | pending |
| TC-RS-10 | `app-ipc` — expand DTO serialization/deserialization roundtrip tests                  | P1       | pending |
| TC-RS-11 | `desktop-tauri` commands — add handler-level integration tests                        | P0       | pending |

### Phase 3 — ts-api & UI Package Tests

| ID        | Task                                                                                                                                                            | Priority | Status  |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| TC-API-01 | Tests for remaining ts-api clients: autostart, diagnostics, fileOperations, git, history, jobs, navigation, network, plugin, preferences, terminal (11 missing) | P0       | pending |
| TC-API-02 | Tests for ts-api transports/ layer                                                                                                                              | P1       | pending |
| TC-API-03 | Tests for ts-api commandMap.ts completeness                                                                                                                     | P1       | pending |
| TC-API-04 | Tests for ts-api events.ts event name mapping                                                                                                                   | P1       | pending |
| TC-UI-01  | Expand ui package tests (currently only 2 — add tests for all exported components)                                                                              | P1       | pending |

### Phase 4 — E2E Test Expansion

| ID        | Task                                                                | Priority | Status  |
| --------- | ------------------------------------------------------------------- | -------- | ------- |
| TC-E2E-01 | E2E: File operations — copy, move, delete, rename with verification | P0       | pending |
| TC-E2E-02 | E2E: Drag-and-drop between panes                                    | P0       | pending |
| TC-E2E-03 | E2E: Tab management — open, close, switch, drag reorder             | P0       | pending |
| TC-E2E-04 | E2E: Breadcrumb navigation + overflow menu                          | P0       | pending |
| TC-E2E-05 | E2E: Filter input + search (filter + recursive search)              | P0       | pending |
| TC-E2E-06 | E2E: Preview panel — image, text, PDF, media viewer                 | P0       | pending |
| TC-E2E-07 | E2E: Properties dialog + metadata display                           | P1       | pending |
| TC-E2E-08 | E2E: Multi-rename dialog workflow                                   | P1       | pending |
| TC-E2E-09 | E2E: Settings dialog — all tabs, persist/reload                     | P1       | pending |
| TC-E2E-10 | E2E: Connect server dialog — SFTP, SMB, S3 flows                    | P1       | pending |
| TC-E2E-11 | E2E: Command palette — search, execute, recent                      | P1       | pending |
| TC-E2E-12 | E2E: Git status indicators in file table                            | P1       | pending |
| TC-E2E-13 | E2E: Tags/labels — add, remove, filter by tag                       | P1       | pending |
| TC-E2E-14 | E2E: Saved searches / smart folders                                 | P2       | pending |
| TC-E2E-15 | E2E: Volume eject/unmount                                           | P2       | pending |
| TC-E2E-16 | E2E: Archive compress + extract workflow                            | P1       | pending |
| TC-E2E-17 | E2E: Diagnostics bundle export                                      | P2       | pending |
| TC-E2E-18 | E2E: First-run onboarding overlay                                   | P2       | pending |
| TC-E2E-19 | E2E: Accessibility — keyboard-only full workflow (no mouse)         | P0       | pending |

### Phase 5 — Integration & Stress Tests

| ID        | Task                                                                                     | Priority | Status  |
| --------- | ---------------------------------------------------------------------------------------- | -------- | ------- |
| TC-INT-01 | IPC boundary integration tests — every IPC command roundtrip with real Tauri invoke mock | P0       | pending |
| TC-INT-02 | State management integration — Zustand store cross-slice interactions                    | P1       | pending |
| TC-INT-03 | Provider integration — SMB/S3/SFTP auth flow + operation lifecycle                       | P1       | pending |
| TC-INT-04 | Stress test — 100k file directory rendering + scroll perf                                | P1       | pending |
| TC-INT-05 | Stress test — concurrent file operations (copy + move + delete simultaneously)           | P2       | pending |
| TC-INT-06 | Error path coverage — network disconnect during transfer, permission denied, disk full   | P1       | pending |

---

## Rules

1. Pick tasks in priority order: P0 → P1 → P2
2. Each task: write tests first (TDD), run suite, ensure pass, commit
3. After every 3-5 tasks: run `pnpm rc:validate` + `cargo test` to guard regressions
4. Commit message format: `test: <scope> — <description>`
5. If a source file has no test yet → highest priority within its phase
6. Maintain backward compatibility — never change source to make it testable unless it's a refactor improvement
7. Target: **95% of source files have corresponding test files** by end of queue

## Selection Policy

- If <5 pending tasks remain, backfill from the next phase or from docs/specs
- Never declare "audit-only" — always pick a task and implement tests
- When phase is complete, mark all its tasks and move to next phase
