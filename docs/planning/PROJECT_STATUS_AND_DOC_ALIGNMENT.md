# FileOctopus — Project Status & Documentation Alignment

**As of:** 2026-05-24
**Purpose:** Single source of truth for how specification documents relate to the running codebase. Use this page before trusting older audit notes, sprint release notes, or inventory “not implemented” lists.

## Document roles

| Document                                                                  | Role                                          | Trust for “what exists today”                                                                               |
| ------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [API reference](../architecture/api-reference.md)                         | Runtime IPC contract (commands, events, DTOs) | **Highest** — update with every boundary change                                                             |
| [RC engineering spec](../architecture/rc-engineering-spec.md)             | RC scope, milestones, crate design            | Scope & acceptance criteria; see §1 delivery matrix in spec                                                 |
| [UI Design Spec](../FileOctopus_UI_Design_and_Layout_Specification-1.md)  | Visual/layout/UX direction post–Sprint 5      | Target UX; partial delivery                                                                                 |
| [Menu & Modal Spec](../plans/FileOctopus_Menu_and_Modal_Specification.md) | Full desktop menu bar + modal catalog         | **Target + status** — in-app `MenuBar` and native Tauri menu are wired; use for remaining modal/menu polish |
| [UI Feature Inventory](./UI_FEATURE_INVENTORY.md)                         | Checklist of specified UI elements            | Good for coverage matrix; §13 updated from this page                                                        |
| [E2E audit](../qa/e2e-audit-report.md)                                    | Manual QA snapshot (2026-05-16)               | **Partially stale** — many “missing” items fixed same day                                                   |
| Gap analysis (`~/.hermes/.../gap-analysis-2026-05.md`)                    | Agent implementation tracker                  | Working notes; sync from this page                                                                          |

## Engineering milestones (RC spec §5)

| Milestone                      | Status          | Evidence                                                                                                                                                                                                                         |
| ------------------------------ | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 — Repo & build foundation   | **Done**        | Tauri v2, pnpm workspace, CI, `cargo test` / Vitest                                                                                                                                                                              |
| M1 — Local navigation slice    | **Done**        | `fs.list_start` streaming, dual pane, virtualization, 100k perf protocol                                                                                                                                                         |
| M2 — Durable job engine        | **Mostly done** | Plan/start copy/move/rename/mkdir/trash, progress events, SQLite operation history                                                                                                                                               |
| M3 — Conflict & safety         | **Mostly done** | Planning, conflict policies, trash path; UI conflict dialog for planned ops                                                                                                                                                      |
| M4 — Git, archive, terminal v1 | **Mostly done** | Zip/tar create/extract in `fs-core/file_ops`; external terminal; embedded local + SSH PTY merged on `main` (#2); SFTP network profiles with read/write VFS; backend `git-intel` foundation plus active-pane Git branch/status UI |
| M5 — RC hardening              | **In progress** | Diagnostics export, preferences, cross-platform QA docs, [mvp-rc-checklist](../release/mvp-rc-checklist.md)                                                                                                                      |

## MVP acceptance criteria (summary)

| Area                     | IDs             | Status                                                                                                                                                       |
| ------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Core FS navigation & ops | MVP-FS-001–008  | **Met** (local dual-pane, large dirs, copy/move/rename/mkdir/trash, conflicts via plan)                                                                      |
| Jobs                     | MVP-JOB-001–004 | **Mostly met** — queue UI, cancel, failures, history after restart; full job SQLite schema in spec not fully mirrored                                        |
| Git                      | MVP-GIT-001–002 | **Mostly met** — local backend `git-intel`, `git.*` IPC/TS client, active-pane branch display, cached/watch-refreshed row status badges; remote Git deferred |
| Archives                 | MVP-ARC-001–002 | **Mostly met** — zip, tar, tar.gz/tgz, and tar.bz2/tbz2 create/extract via `createArchive`/`extractArchive`; archive traversal tests pass                    |
| Terminal                 | MVP-TERM-001    | **Partial** — external terminal plus embedded local + SSH PTY on `main`; manual remote smoke still pending                                                   |
| UI keyboard              | MVP-UI-001      | **Partial** — palette, menu, toolbar, context menu, and global keys on `dispatchCommand`; Help shortcuts from registry via `shortcutHelp.ts`                 |
| Security                 | MVP-SEC-001     | **Met** — ADR-0002, typed IPC only                                                                                                                           |

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
- Command palette (Ctrl/Cmd+P) built from `COMMAND_DEFINITIONS` (`commands/paletteEntries.ts`), text preview panel (Space for text files)
- Standalone modals: About, Go to Location, Manage Favorites, Operation History, Error Details, Properties, Conflict resolution
- Application menu bar routed through `useMenuBarProps` → `dispatchCommand` for nav, file ops, clipboard, view modes, app dialogs; native Tauri menu emits the same command events
- Context menu builders split under `menus/context/`; shell styles in `packages/frontend/src/styles/regions/`
- Shortcuts: Ctrl/Cmd+I properties, Ctrl/Cmd+H and Ctrl/Cmd+. for hidden files
- Application menu bar shell (`MenuBar` in title bar)
- Zip/tar archive create/extract via toolbar and context menu (`useArchiveHandlers`)
- **SFTP network profiles** — remote VFS, sidebar badges, status events, host-key fingerprint TOFU (`provider-sftp`, `remote-core`)
- **Embedded terminal** — local + SSH PTY, pane bottom split, tabs, maximize/close, shell prefs (`terminal-core`)
- **Built-in F3 viewer + F4 editor** — shared syntax highlighting
- **Virtualized icons view** — grid-aware windowing + ResizeObserver
- **ColumnsView reliability** — shared client routing with request correlation + timeout
- **Performance smoke** — `pnpm perf:smoke` command
- **Command registry refactor** — derive `CommandId` from as-const registry, dispatch exhaustiveness test
- **Git branch + status badges** — local repositories show an active-pane branch pill and compact row badges from `git.statusForDirectory`
- **Diagnostics export location preference** — Settings exposes `diagnosticsExportPath`, persisted through preferences and used by the diagnostics dialog
- **Checksum verification UI** — Properties supports on-demand SHA-256 plus expected-hash match/mismatch state
- **Network sidebar deduplication** — saved SFTP/SSH profiles are surfaced in the dedicated Network section instead of being duplicated under Devices/Volumes
- **First-run overlay** — dismissible initial welcome flow persisted in localStorage with entry points into Settings, Shortcuts, and Network
- **Title bar sync/health indicator** — title bar shows active Git repo state, remote connection state, and operation error health pills

### Specified but not implemented (or stub only)

| Item                             | Spec source                 | Notes                                                                             |
| -------------------------------- | --------------------------- | --------------------------------------------------------------------------------- |
| Advanced settings tab            | UI Design Spec §Preferences | Operations and Shortcuts sections exist; a separate Advanced tab remains deferred |
| PDF/media/EXIF preview expansion | UI §Preview                 | Image preview is implemented; broader preview modes remain deferred               |
| Pause on jobs                    | UI §6                       | Cancel only                                                                       |

### Intentionally deferred (RC spec §3.3)

P2P sync, AI search, cloud providers, plugins, diff/merge, mobile, ACL editor, etc.

## IPC surface vs RC spec §8

The [API reference](../architecture/api-reference.md) is authoritative. Notable **extras** beyond the original MVP minimal list:

- Navigation: favorites, recent, starred, record visit, standard locations
- FS helpers: `fs_read_text_file`, `fs_compute_hash`, `fs_open_terminal`, watch start/stop, folder size, recursive search, properties, create file, permanent delete, reveal, open default
- Preferences + autostart
- Diagnostics health + export bundle

**Not present:** separate `archive.*` IPC (RC uses `file_operations.*` with `createArchive`/`extractArchive`).

## Crate layout vs RC spec §6–7

**Present:** `vfs`, `fs-core`, `jobs`, `app-core`, `app-ipc`, `git-intel`, `terminal-core`, `telemetry`, `config`, `platform` (minimal), `test-support`, `apps/cli` (placeholder).

**Absent (MVP planned):** `archive-core`, `indexer`, `content-id`.

## Full documentation inventory

Legend: **Current** = matches codebase; **Target** = spec/backlog; **Stale** = outdated sections; **Historical** = sprint snapshot, do not use for status.

### Root & agent guides

| Document                     | Status                 | Notes                                                        |
| ---------------------------- | ---------------------- | ------------------------------------------------------------ |
| [README.md](../../README.md) | **Updated 2026-05-16** | Was stuck on “Sprint 4”; now reflects post–Sprint 5 features |
| [CLAUDE.md](../../CLAUDE.md) | **Current**            | Commands and crate list accurate                             |
| [AGENTS.md](../../AGENTS.md) | **Current**            | Boundary invariants match ADRs                               |

### Architecture & API

| Document                                                           | Status              | Notes                                                                                                   |
| ------------------------------------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------- |
| [architecture/README.md](../architecture/README.md)                | **Current**         | Links this page                                                                                         |
| [api-reference.md](../architecture/api-reference.md)               | **Partial**         | Full registry (57 cmds, 2026-05-22); per-command detail sections still sparse for navigation/FS helpers |
| [rc-engineering-spec.md](../architecture/rc-engineering-spec.md)   | **Target + status** | RC scope; §17 post-RC priorities                                                                        |
| [mvp-engineering-spec.md](../architecture/mvp-engineering-spec.md) | **Redirect**        | Stub → rc-engineering-spec                                                                              |
| [pane-lifecycle.md](../architecture/pane-lifecycle.md)             | **Current**         | `requestId`, `loadState`, 30s timeout                                                                   |
| [modules/\*.md](../architecture/modules/)                          | **Mixed**           | See module table below                                                                                  |

| Module doc                                | Status      | Gap                                                                                     |
| ----------------------------------------- | ----------- | --------------------------------------------------------------------------------------- |
| [vfs](modules/vfs.md)                     | Current     | —                                                                                       |
| [fs-core](modules/fs-core.md)             | Current     | Reflects `file_ops/` split + helper modules (2026-05-17)                                |
| [jobs](modules/jobs.md)                   | Current     | —                                                                                       |
| [app-core](modules/app-core.md)           | Current     | Reflects `runtime` / `history` / `paths` split (2026-05-17)                             |
| [app-ipc](modules/app-ipc.md)             | Partial     | DTO count grew; spot-check when adding IPC                                              |
| [frontend](modules/frontend.md)           | **Current** | Decomposed shell, commands, jobs/, styles (2026-05-17)                                  |
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

| Document                                                                                                      | Status                                                              |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [FileOctopus_UI_Design_and_Layout_Specification-1.md](../FileOctopus_UI_Design_and_Layout_Specification-1.md) | Target + status banner                                              |
| [Menu & Modal Spec](../plans/FileOctopus_Menu_and_Modal_Specification.md)                                     | Target + status; in-app `MenuBar` and native menu (`menu.rs`) built |
| [UI_FEATURE_INVENTORY](./UI_FEATURE_INVENTORY.md)                                                             | Current §13                                                         |

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

| Document                                                           | Status                                                                       |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| [usage.md](../usage.md)                                            | **Updated** — shortcuts help from registry; keys via `runCommand` / dispatch |
| [build.md](../build.md)                                            | Current                                                                      |
| [security/README.md](../security/README.md)                        | Placeholder / minimal                                                        |
| [plans/CRON\_\*.md](../plans/CRON_STATUS.md)                       | Agent automation log — not product spec                                      |
| [apps/desktop-tauri/README.md](../../apps/desktop-tauri/README.md) | **Updated** — was Tauri template                                             |
| [apps/cli/README.md](../../apps/cli/README.md)                     | Current placeholder                                                          |

## Recommended doc maintenance

1. After any IPC or UI milestone, update **API reference** and this page’s tables.
2. Treat **Menu & Modal Spec** as the backlog for remaining menu gaps (native menu, sort submenu parity, stub toolbar items) — in-app `MenuBar` exists.
3. Mark **E2E audit** sections with date; link here when bulk fixes land.
4. Keep **UI Feature Inventory §13** in sync with this page (not the reverse).
5. Use RC spec §17 and the milestone table above for planning (not the old MVP §17 list).

## Test signal (2026-05-22)

- `pnpm --filter @fileoctopus/frontend test` — 495 tests across 77 files pass (`vitest run --environment jsdom`)
- `cargo test --workspace` — 257 tests pass across all crates
- Catalog drift guards: `packages/ts-api/tests/catalogs.test.ts` keeps Rust ↔ TS command/event constants and the 57-command count aligned
