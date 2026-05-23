# FileOctopus — Cron Task Queue

> Execution-facing queue for autonomous agents.
> Last verified against repo state: 2026-05-23 14:45 UTC
>
> **Note:** Active RC Queue audit performed 2026-05-23. RC-MENU, RC-CONF, RC-IMG were found already implemented and moved to Recently Completed. RC-4 automated evidence refreshed. New automatable tasks added from PROJECT_STATUS_AND_DOC_ALIGNMENT.md gaps.

---

## Selection Rules

- Only pick work from **Active RC Queue**.
- If Active RC Queue has no `pending` items, check **Deferred / Post-RC** for P1/P2 tasks that can be promoted.
- Do not select **Deferred / Post-RC** P3 or lower items unless a human explicitly reprioritizes them.
- If a queue row conflicts with the codebase or higher-trust docs, update this file first and refresh `last_verified`.
- Keep at most one `in_progress` row at a time.
- A row is claimed only when `Status`, `Owner`, `Run ID`, `Started UTC`, and `Lock Expires UTC` are all set.
- A non-expired `Lock Expires UTC` blocks other agents from selecting that row.

---

## Active RC Queue

| ID           | Pri | Status   | Owner | Run ID  | Started UTC | Lock Expires UTC | Acceptance refs             | Task                                                                                                                                                                                                      | Blockers | Last verified |
| ------------ | --- | -------- | ----- | ------- | ----------- | ---------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------- |
| RC-4         | P1  | done     | -     | -       | -           | -                | M5; mvp-rc-checklist        | MVP RC: automated rc:validate + diagnostics E2E evidence refreshed; manual QA matrices remain human-only                                                                                                  | None     | 2026-05-23    |
| RC-PREFS     | P2  | done     | -     | -       | -           | -                | UI Design Spec §Preferences | Operations / Shortcuts tabs implemented; Advanced tab deferred to post-RC                                                                                                                                 | None     | 2026-05-23    |
| RC-MENU-FULL | P2  | done     | codex | 207eb90 | 2026-05-23  | 2026-05-23       | Menu & Modal Spec §4        | Application menu bar full wiring: native OS menu (Tauri menu.rs), sort submenu parity                                                                                                                     | None     | 2026-05-23    |
| RC-PAUSE     | P2  | deferred | -     | -       | -           | -                | UI §6; RC spec §3.2         | Pause on jobs: backend job.pause IPC + UI pause/resume button in activity panel (deferred: requires executor-level pause token refactor across jobs/app-core/fs-core crates — too large for single cycle) | None     | 2026-05-23    |
| RC-RECENT    | P2  | pending  | -     | -       | -           | -                | UI §2; UI_FEATURE_INVENTORY | Sidebar Recent section: split into "Today" and "This Week" groups (API already provides both buckets; UI only renders Today)                                                                              | None     | 2026-05-23    |
| RC-DIAG-LOC  | P3  | done     | cron  | 6fa3dac | 2026-05-23  | 2026-05-23       | UI Design Spec              | Diagnostics export location preference (default export path setting)                                                                                                                                      | None     | 2026-05-23    |
| RC-TAR       | P3  | pending  | -     | -       | -           | -                | RC spec §3.2                | Tar / non-zip archive formats: createArchive/extractArchive for tar.gz/tar.bz2                                                                                                                            | None     | 2026-05-23    |

---

## Deferred / Post-RC

| ID       | Why deferred                                                                                 |
| -------- | -------------------------------------------------------------------------------------------- |
| P1-3     | Rich Copy To / Move To destination chooser (tree browser) — new UI surface, post-RC          |
| P1-4     | Image preview expansion (EXIF, gallery) — broader product expansion than current RC gap      |
| RC-PAUSE | Pause on jobs — UI §6; currently Cancel only; not RC-blocking                                |
| RC-DIAG  | Diagnostics export location preference — UI Design Spec; export path chosen at export time   |
| RC-TAR   | Tar / non-zip archive formats — RC spec §3.2; zip only at RC (`fs-core/file_ops/archive.rs`) |
| P2-12    | Symlink policy changes expand the file-operation contract and warning model                  |
| P2-13    | PDF/media/EXIF preview is broader product expansion than the current RC image-preview gap    |
| P2-14    | Saved searches/smart folders add new persistence and virtual result views                    |
| P2-15    | Checksum verification UI is lower priority than current RC hardening; backend command exists |
| P2-16    | Archive browsing requires a new archive provider and capability model                        |
| P3-1     | Column reorder — polish/future                                                               |
| P3-2     | Eject/unmount — polish/future                                                                |
| P3-3     | Job pause/resume — polish/future                                                             |
| P3-4     | Dual pane vertical split — polish/future                                                     |
| P3-5     | Storage gauge — polish/future                                                                |
| P3-6     | Rubber-band select — polish/future                                                           |
| POST-1   | First-run overlay — Sprint 5 stretch, not built                                              |
| POST-2   | Title bar sync/health indicator — UI §1; optional, not built                                 |
| POST-3   | Videos sidebar entry — UI §2; not in sidebar model                                           |
| POST-4   | Network locations sidebar category — SFTP implemented as profiles; sidebar grouping TBD      |
| POST-5   | "This Week" recent group — API has `thisWeek` bucket; UI grouping may vary                   |
| RMT-1    | Remote providers (SFTP/SMB/S3) are product expansion and explicitly post-RC in the RC spec   |
| TAG-1    | Tag/label system is product expansion with new persistence and virtual views                 |

---

## Recently Completed

| ID      | Result                                                                                                      | Commit     |
| ------- | ----------------------------------------------------------------------------------------------------------- | ---------- |
| RC-4    | Automated RC evidence refreshed: backend + frontend RC green (502 tests); E2E timeout remains environmental | d74e917    |
| RC-MENU | Application menu bar routing verified — sort/theme/density/favorites-add already via `runCommand`           | d74e917    |
| RC-CONF | Conflict dialog verified — per-item actions, metadata compare, apply-to-all already implemented (11 tests)  | d74e917    |
| RC-IMG  | Image preview verified — `fs_read_image` + PreviewPanel + ViewerDialog image mode already implemented       | d74e917    |
| RC-PREF | Settings toggle "Remember last used panes" wired in Layout tab with backend persistence + localStorage sync | 1fe9ce8    |
| RC-3    | Refresh automated RC evidence (rc-qa-automated.sh) for commit b1c3cfd                                       | b1c3cfd    |
| GIT-1   | Git Intelligence V1: `git-intel` crate, FileRow badges (M/A/D/R/?/I/U/!), PaneHeader branch + dirty mark    | 2026-05-23 |
| NET-1   | Network provider hardening Stage 1: connection lifecycle correctness (lazy connect, no reconnect storm)     | 2026-05-19 |
| NET-2   | Network provider hardening Stage 2: SHA-256 fingerprint TOFU, port/hostname validation                      | 2026-05-19 |
| NET-3   | Network provider hardening Stage 4: push status events to frontend, sidebar badges                          | 2026-05-19 |
| NET-4   | SFTP network profiles with remote VFS and UI                                                                | 2026-05-19 |
| TERM-1  | Embedded terminal pane: local + SSH PTY, bottom split, tabs, maximize/close controls                        | 2026-05-19 |
| TERM-2  | Terminal shell prefs, keyboard input routing, per-pane controls (Option B/C)                                | 2026-05-19 |
| VIEW-1  | Built-in F3 viewer + F4 editor with shared syntax highlighting                                              | 2026-05-20 |
| VFS-1   | VfsProvider write methods: create_directory, create_file, rename, remove, copy_file, read_file_prefix       | 2026-05-22 |
| VFS-2   | LocalFsProvider + provider-sftp write implementations with read_write capabilities                          | 2026-05-22 |
| CMD-1   | Command registry: derive CommandId from as-const, dispatch exhaustiveness test                              | 2026-05-22 |
| PERF-1  | Performance smoke command (`pnpm perf:smoke`)                                                               | 2026-05-22 |
| COL-1   | Virtualize icons view with grid-aware windowing and ResizeObserver                                          | 2026-05-22 |
| COL-2   | Route ColumnsView through shared client with request correlation + timeout                                  | 2026-05-22 |
| PHASE5  | Phase 5 state and controller refactor + runtime reliability hardening                                       | 2026-05-22 |
| RC-6    | MenuBar sort/theme/density/favorites/filter/search routed via `runCommand` → `dispatchCommand`              | 2026-05-19 |
| RC-4d   | `app-layout.e2e.ts` updated for shell toolbar layout; 24/24 pass                                            | 2026-05-19 |
| RC-4c   | Visual regression baselines + preview `sidebarVisible`; `pnpm test:e2e:vite` 104 pass                       | 2026-05-19 |
| RC-4b   | Diagnostics E2E + `scripts/rc-qa-automated.sh` + `docs/qa/rc-automated-evidence.md`                         | 2026-05-19 |
| RC-4a   | Automated RC: `pnpm rc:validate` + `pnpm tauri:build` (deb/rpm/AppImage bundles)                            | 2026-05-19 |
| RC-5    | IPC integration: `ipc_basic`, `ipc_terminal`, `ipc_reveal` + error-path coverage                            | 2026-05-19 |
| RC-7    | Conflict dialog destination metadata compare via `fs.stat` + `destinationByUri`                             | 2026-05-19 |
| RC-2    | E2E multi-select Selection Properties smoke (`e2e/dialog.e2e.ts`)                                           | 2026-05-19 |
| P2-9    | Selection Properties dialog wired for multi-select; folder-size aggregate via folder-size jobs              | 2026-05-19 |
| P2-8    | Recent Locations management UI (dialog + clear/remove flows)                                                | preex      |
| P2-7    | VolumePickerDialog with discoverVolumes IPC + Go menu                                                       | 81568c8    |
| P2-11   | Offline/unmounted pane state                                                                                | 84867c3    |
| P2-10   | Accessible row names for file entries                                                                       | 993f879    |
| P2-6    | User-selectable visible columns with persistence                                                            | e902fb0    |
| P2-5    | Confirm before app close when jobs running                                                                  | 3490ee1    |
| P2-4    | Restore last pane paths and tab state on startup                                                            | d08d97d    |
| P2-2    | Focus-trap on modals + restore focus on close                                                               | 4d80006    |
| P2-1    | Real popover tooltip (replaced title-attribute stub)                                                        | 12a7a73    |
| P1-5    | Breadcrumb overflow menu                                                                                    | a8cc7fd    |
| P1-2    | Resizable details columns with localStorage persistence                                                     | 3a066d6    |
| P1-1    | TabBar UI with open/close/switch tab actions                                                                | 8f7e762    |
| P2-3    | Keyboard-navigable context menus                                                                            | c59a5e2    |
| P0-5    | Swap Panes command                                                                                          | fb55230    |
| P0-4    | Toolbar and status-bar menu toggles                                                                         | dffbf11    |
| P0-3    | Drag-and-drop file operations                                                                               | c869970    |
| P0-1    | Filter input rendered and wired                                                                             | 25c77c5    |
