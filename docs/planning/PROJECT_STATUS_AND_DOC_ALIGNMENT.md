# FileOctopus — Project Status & Documentation Alignment

**As of:** 2026-05-17  
**Purpose:** Single source of truth for how specification documents relate to the running codebase. Use this page before trusting older audit notes, sprint release notes, or inventory “not implemented” lists.

## Document roles

| Document                                                                  | Role                                          | Trust for “what exists today”                                              |
| ------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------- |
| [API reference](../architecture/api-reference.md)                         | Runtime IPC contract (commands, events, DTOs) | **Highest** — update with every boundary change                            |
| [MVP engineering spec](../architecture/mvp-engineering-spec.md)           | Target MVP scope, milestones, crate design    | Scope & acceptance criteria; see §Implementation status below for delivery |
| [UI Design Spec](../FileOctopus_UI_Design_Spec.md)                        | Visual/layout/UX direction post–Sprint 5      | Target UX; partial delivery                                                |
| [Menu & Modal Spec](../plans/FileOctopus_Menu_and_Modal_Specification.md) | Full desktop menu bar + modal catalog         | **Target** — most File/Edit/View/Go menus not built yet                    |
| [UI Feature Inventory](./UI_FEATURE_INVENTORY.md)                         | Checklist of specified UI elements            | Good for coverage matrix; §13 updated from this page                       |
| [E2E audit](../qa/e2e-audit-report.md)                                    | Manual QA snapshot (2026-05-16)               | **Partially stale** — many “missing” items fixed same day                  |
| Gap analysis (`~/.hermes/.../gap-analysis-2026-05.md`)                    | Agent implementation tracker                  | Working notes; sync from this page                                         |

## Engineering milestones (MVP spec §5)

| Milestone                      | Status          | Evidence                                                                           |
| ------------------------------ | --------------- | ---------------------------------------------------------------------------------- |
| M0 — Repo & build foundation   | **Done**        | Tauri v2, pnpm workspace, CI, `cargo test` / Vitest                                |
| M1 — Local navigation slice    | **Done**        | `fs.list_start` streaming, dual pane, virtualization, 100k perf protocol           |
| M2 — Durable job engine        | **Mostly done** | Plan/start copy/move/rename/mkdir/trash, progress events, SQLite operation history |
| M3 — Conflict & safety         | **Mostly done** | Planning, conflict policies, trash path; UI conflict dialog for planned ops        |
| M4 — Git, archive, terminal v1 | **Not started** | No `git-intel`, `archive-core`, or `terminal-core` crates                          |
| M5 — MVP hardening             | **In progress** | Diagnostics export, preferences, cross-platform QA docs                            |

## MVP acceptance criteria (summary)

| Area                     | IDs             | Status                                                                                                                |
| ------------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------- |
| Core FS navigation & ops | MVP-FS-001–008  | **Met** (local dual-pane, large dirs, copy/move/rename/mkdir/trash, conflicts via plan)                               |
| Jobs                     | MVP-JOB-001–004 | **Mostly met** — queue UI, cancel, failures, history after restart; full job SQLite schema in spec not fully mirrored |
| Git                      | MVP-GIT-001–002 | **Not met**                                                                                                           |
| Archives                 | MVP-ARC-001–002 | **Not met** — UI stubs only; no extract job                                                                           |
| Terminal                 | MVP-TERM-001    | **Partial** — `fs_open_terminal` spawns external emulator in cwd; no embedded xterm panel                             |
| UI keyboard              | MVP-UI-001      | **Mostly met** — shortcuts + command palette (Ctrl/Cmd+P); no app menu bar                                            |
| Security                 | MVP-SEC-001     | **Met** — ADR-0002, typed IPC only                                                                                    |

Performance targets (MVP-PERF-\*) and release checklist (§16) remain **not formally signed off**.

## UI delivery vs design specs

### Implemented (matches UI Design Spec / Sprint 4–5)

- Dual-pane shell, sidebar (favorites, devices, pinned, recent buckets, starred), resizable split
- Pane toolbar (primary + overflow), path bar, filter, recursive search job
- View modes: details, list, icons, columns
- Details columns: Name, Size, Modified, Created, Type, Extension, Permissions, Owner; Hash on-demand per selected file
- Context menus (item + empty space), operation dialogs, activity/history panel, status bar, toasts
- Settings: General (autostart), Appearance (theme, density, accent, font/icon scale), Files & Folders, Layout (sidebar/activity visibility)
- Help: Keyboard shortcuts, Diagnostics + export bundle
- Filesystem watcher → debounced refresh
- Command palette (Ctrl/Cmd+P), text preview panel (Space for text files)
- Shortcuts: Ctrl/Cmd+I properties, Ctrl/Cmd+H and Ctrl/Cmd+. for hidden files

### Specified but not implemented (or stub only)

| Item                                                       | Spec source                 | Notes                                                                        |
| ---------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------- |
| Application menu bar (File/Edit/View/Go/Tools/Window/Help) | Menu & Modal Spec §4        | Title bar uses Settings + Help dropdown only                                 |
| Operations / Shortcuts / Advanced settings tabs            | UI Design Spec §Preferences | Merged into existing tabs or separate dialogs                                |
| Remember last used panes (setting + restore)               | UI Design Spec              | No preference or boot restore                                                |
| Diagnostics export location preference                     | UI Design Spec              | Export path chosen at export time                                            |
| Compress / Extract archive jobs                            | MVP-ARC-001, UI §4          | Toolbar/context entries show “coming soon” toast                             |
| Checksum toolbar action                                    | UI §4                       | `fs_compute_hash` exists; toolbar still stub; hash column fills on selection |
| Embedded terminal panel                                    | MVP §Embedded Terminal      | External terminal spawn only                                                 |
| Git branch + status badges                                 | MVP-GIT-\*                  | No `git-intel`                                                               |
| Title bar sync/health indicator                            | UI §1                       | Optional; not built                                                          |
| Sidebar: Videos shortcut, network locations                | UI §2 / Sprint 4            | Not in sidebar model                                                         |
| First-run overlay                                          | Sprint 5 stretch            | Not built                                                                    |
| Last-path restore on startup                               | Sprint 5 FO-0243            | Not built                                                                    |
| Tabs per panel (multiple tabs)                             | MVP §3.1                    | `PanelTabState` ready; single tab per pane                                   |
| Full conflict dialog (Compare metadata, Apply to all)      | UI Design Spec              | Plan/start conflict policy in copy/move dialog; not full spec matrix         |
| Pause on jobs                                              | UI §6                       | Cancel only                                                                  |

### Intentionally deferred (MVP spec §3.2)

P2P sync, AI search, cloud providers, plugins, diff/merge, mobile, ACL editor, etc.

## IPC surface vs MVP spec §8

The [API reference](../architecture/api-reference.md) is authoritative. Notable **extras** beyond the MVP spec’s minimal list:

- Navigation: favorites, recent, starred, record visit, standard locations
- FS helpers: `fs_read_text_file`, `fs_compute_hash`, `fs_open_terminal`, watch start/stop, folder size, recursive search, properties, create file, permanent delete, reveal, open default
- Preferences + autostart
- Diagnostics health + export bundle

**Not present** (still in MVP spec): `git.*`, `archive.plan_extract` / `archive.start_extract`, embedded `terminal.write` / `terminal.resize` / output events, `settings.get`/`update` as monolithic settings (replaced by `get_preferences` / `set_preference`).

## Crate layout vs MVP spec §6–7

**Present:** `vfs`, `fs-core`, `jobs`, `app-core`, `app-ipc`, `telemetry`, `config`, `platform` (minimal), `test-support`, `apps/cli` (placeholder).

**Absent (MVP planned):** `git-intel`, `archive-core`, `terminal-core`, `indexer`, `content-id`.

## Full documentation inventory

Legend: **Current** = matches codebase; **Target** = spec/backlog; **Stale** = outdated sections; **Historical** = sprint snapshot, do not use for status.

### Root & agent guides

| Document                     | Status                 | Notes                                                        |
| ---------------------------- | ---------------------- | ------------------------------------------------------------ |
| [README.md](../../README.md) | **Updated 2026-05-16** | Was stuck on “Sprint 4”; now reflects post–Sprint 5 features |
| [CLAUDE.md](../../CLAUDE.md) | **Current**            | Commands and crate list accurate                             |
| [AGENTS.md](../../AGENTS.md) | **Current**            | Boundary invariants match ADRs                               |

### Architecture & API

| Document                                                           | Status              | Notes                                                                                           |
| ------------------------------------------------------------------ | ------------------- | ----------------------------------------------------------------------------------------------- |
| [architecture/README.md](../architecture/README.md)                | **Current**         | Links this page                                                                                 |
| [api-reference.md](../architecture/api-reference.md)               | **Partial**         | Full command registry added; per-command detail sections still sparse for navigation/FS helpers |
| [mvp-engineering-spec.md](../architecture/mvp-engineering-spec.md) | **Target + status** | MVP scope; §17 historical                                                                       |
| [pane-lifecycle.md](../architecture/pane-lifecycle.md)             | **Current**         | `requestId`, `loadState`, 30s timeout                                                           |
| [modules/\*.md](../architecture/modules/)                          | **Mixed**           | See module table below                                                                          |

| Module doc                                | Status      | Gap                                                                                     |
| ----------------------------------------- | ----------- | --------------------------------------------------------------------------------------- |
| [vfs](modules/vfs.md)                     | Current     | —                                                                                       |
| [fs-core](modules/fs-core.md)             | Current     | Reflects `file_ops/` split + helper modules (2026-05-17)                                |
| [jobs](modules/jobs.md)                   | Current     | —                                                                                       |
| [app-core](modules/app-core.md)           | Current     | Reflects `runtime` / `history` / `paths` split (2026-05-17)                             |
| [app-ipc](modules/app-ipc.md)             | Partial     | DTO count grew; spot-check when adding IPC                                              |
| [frontend](modules/frontend.md)           | **Partial** | Component tree still simplified; `hooks/fileOps/` layout documented (2026-05-17)        |
| [desktop-tauri](modules/desktop-tauri.md) | Current     | `commands/*` layout; full registry in [api-reference](../architecture/api-reference.md) |
| [ts-api](modules/ts-api.md)               | Current     | `commandMap.ts`, `clients/*`, `transports/*` (2026-05-17)                               |
| [ui](modules/ui.md)                       | Current     | Small package                                                                           |
| [telemetry](modules/telemetry.md)         | Current     | —                                                                                       |
| [test-support](modules/test-support.md)   | Current     | —                                                                                       |

### ADRs

| Document                                                         | Status  |
| ---------------------------------------------------------------- | ------- |
| [adr/README.md](../adr/README.md)                                | Current |
| [0001-tauri-v2](adr/0001-tauri-v2-desktop-shell.md)              | Current |
| [0002-frontend-fs](adr/0002-frontend-filesystem-restrictions.md) | Current |
| [0003-local-uri](adr/0003-local-resource-uri.md)                 | Current |

### Product & UI specs

| Document                                                                        | Status                                                                                                      |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [FileOctopus_UI_Design_Spec.md](../FileOctopus_UI_Design_Spec.md)               | Target + status banner                                                                                      |
| [FileOctopus_UI_Elements_Inventory.md](../FileOctopus_UI_Elements_Inventory.md) | Target only — duplicate of UI Design Spec; use [UI_FEATURE_INVENTORY](./UI_FEATURE_INVENTORY.md) for status |
| [Menu & Modal Spec](../plans/FileOctopus_Menu_and_Modal_Specification.md)       | Target; app menu bar not built                                                                              |
| [UI_FEATURE_INVENTORY](./UI_FEATURE_INVENTORY.md)                               | Current §13                                                                                                 |

### Planning & sprint backlogs

| Document                                                                                                | Status                                                     |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [sprint-0-1 through sprint-4 backlogs](./sprint-0-1-backlog.md)                                         | **Historical**                                             |
| [FileOctopus_Sprint_5_Backlog.md](./FileOctopus_Sprint_5_Backlog.md)                                    | **Historical** — many FO-\* items done on `main` after tag |
| [2026-05-15-settings-controls-gaps.md](../plans/2026-05-15-settings-controls-gaps.md)                   | **Historical** — superseded by settings work               |
| [2026-05-16-gap-analysis-and-implementation.md](../plans/2026-05-16-gap-analysis-and-implementation.md) | **Historical** — points here                               |
| [2025-05-16-b4-command-palette.md](../plans/2025-05-16-b4-command-palette.md)                           | **Historical** — palette shipped                           |
| [superpowers/\* settings plans](../superpowers/)                                                        | **Historical** — implementation complete                   |

### QA, testing, release

| Document                                                                            | Status                                        |
| ----------------------------------------------------------------------------------- | --------------------------------------------- |
| [qa/e2e-audit-report.md](../qa/e2e-audit-report.md)                                 | **Stale** §2–4 — banner added                 |
| [qa/sprint-3-smoke-test.md](../qa/sprint-3-smoke-test.md)                           | Historical checklist — still useful for RC    |
| [qa/sprint-4-baseline-qa.md](../qa/sprint-4-baseline-qa.md)                         | Historical checklist — still useful for RC    |
| [testing/README.md](../testing/README.md)                                           | **Updated** — links all protocols             |
| [testing/large-directory-performance.md](../testing/large-directory-performance.md) | Current protocol                              |
| [testing/sprint-1-demo.md](../testing/sprint-1-demo.md)                             | Historical demo script                        |
| [testing/sprint-5-macos-qa.md](../testing/sprint-5-macos-qa.md)                     | Platform QA — verify against current UI       |
| [performance.md](../performance.md)                                                 | Current baselines; manual timings per machine |
| [release/mvp-rc-checklist.md](../release/mvp-rc-checklist.md)                       | **Living** — unchecked; use for RC gate       |
| [release-notes/mvp-rc.md](../release-notes/mvp-rc.md)                               | **Updated** — post–Sprint 5 note              |
| [releases/sprint-5.md](../releases/sprint-5.md)                                     | Historical + post-sprint section              |

### Operations & misc

| Document                                                           | Status                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------- |
| [usage.md](../usage.md)                                            | **Updated** — shortcuts from `shortcuts.ts` + palette/preview |
| [build.md](../build.md)                                            | Current                                                       |
| [security/README.md](../security/README.md)                        | Placeholder / minimal                                         |
| [plans/CRON\_\*.md](../plans/CRON_STATUS.md)                       | Agent automation log — not product spec                       |
| [apps/desktop-tauri/README.md](../../apps/desktop-tauri/README.md) | **Updated** — was Tauri template                              |
| [apps/cli/README.md](../../apps/cli/README.md)                     | Current placeholder                                           |

## Recommended doc maintenance

1. After any IPC or UI milestone, update **API reference** and this page’s tables.
2. Treat **Menu & Modal Spec** as the backlog for menu-bar work until `AppMenuBar` exists.
3. Mark **E2E audit** sections with date; link here when bulk fixes land.
4. Keep **UI Feature Inventory §13** in sync with this page (not the reverse).
5. MVP spec §17 “Immediate next steps” is historical; use milestone table above for planning.

## Test signal (2026-05-16)

- `pnpm --filter @fileoctopus/frontend test` — 90 tests pass (`vitest run tests --environment jsdom`)
- Rust workspace tests — pass (`pnpm rust:test`)
