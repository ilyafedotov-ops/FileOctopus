# FileOctopus — Cron Task Queue

> Execution-facing queue for autonomous agents.
> Last verified against repo state: 2026-05-23

---

## Selection Rules

- Only pick work from **Active RC Queue**.
- Do not select **Deferred / Post-RC** items unless a human explicitly reprioritizes them.
- If a queue row conflicts with the codebase or higher-trust docs, update this file first and refresh `last_verified`.
- Keep at most one `in_progress` row at a time.
- A row is claimed only when `Status`, `Owner`, `Run ID`, `Started UTC`, and `Lock Expires UTC` are all set.
- A non-expired `Lock Expires UTC` blocks other agents from selecting that row.

---

## Active RC Queue

| ID   | Pri | Status  | Owner | Run ID | Started UTC | Lock Expires UTC | Acceptance refs       | Task                                                                                        | Blockers | Last verified |
| ---- | --- | ------- | ----- | ------ | ----------- | ---------------- | --------------------- | ------------------------------------------------------------------------------------------- | -------- | ------------- |
| RC-3 | P1  | pending | -     | -      | -           | -                | RC spec §4.2 MVP-PERF | Manual 10k/100k UI perf capture on target hardware (automated evidence recorded 2026-05-19) | None     | 2026-05-19    |
| RC-4 | P2  | pending | -     | -      | -           | -                | M5; mvp-rc-checklist  | MVP RC: manual sprint QA matrices + 100k UI recording (automated: `rc:qa`, diagnostics E2E) | None     | 2026-05-19    |

---

## Deferred / Post-RC

| ID    | Why deferred                                                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------- |
| P1-6  | Bulk rename is a larger cross-boundary feature with new planning and preview rules. It is not part of the current RC hardening queue. |
| P1-7  | Trash browser/restore requires a new virtual surface and restore semantics beyond the current RC queue.                               |
| P2-12 | Symlink policy changes expand the file-operation contract and warning model. Defer unless explicitly prioritized.                     |
| P2-13 | PDF/media/EXIF preview is broader product expansion than the current RC image-preview gap.                                            |
| P2-14 | Saved searches/smart folders add new persistence and virtual result views.                                                            |
| P2-15 | Checksum verification UI is lower priority than current RC hardening; the checksum backend command already exists.                    |
| P2-16 | Archive browsing requires a new archive provider and capability model.                                                                |
| P3-\* | Polish/future items remain out of scope for the active RC queue unless promoted deliberately.                                         |
| RMT-1 | Remote providers (SFTP/SMB/S3) are product expansion and explicitly post-RC in the RC spec.                                           |
| TAG-1 | Tag/label system is product expansion with new persistence and virtual views.                                                         |

---

## Recently Completed

| ID     | Result                                                                                                   | Commit     |
| ------ | -------------------------------------------------------------------------------------------------------- | ---------- |
| GIT-1  | Git Intelligence V1: `git-intel` crate, FileRow badges (M/A/D/R/?/I/U/!), PaneHeader branch + dirty mark | 2026-05-23 |
| NET-1  | Network provider hardening Stage 1: connection lifecycle correctness (lazy connect, no reconnect storm)  | 2026-05-19 |
| NET-2  | Network provider hardening Stage 2: SHA-256 fingerprint TOFU, port/hostname validation                   | 2026-05-19 |
| NET-3  | Network provider hardening Stage 4: push status events to frontend, sidebar badges                       | 2026-05-19 |
| NET-4  | SFTP network profiles with remote VFS and UI                                                             | 2026-05-19 |
| TERM-1 | Embedded terminal pane: local + SSH PTY, bottom split, tabs, maximize/close controls                     | 2026-05-19 |
| TERM-2 | Terminal shell prefs, keyboard input routing, per-pane controls (Option B/C)                             | 2026-05-19 |
| VIEW-1 | Built-in F3 viewer + F4 editor with shared syntax highlighting                                           | 2026-05-20 |
| VFS-1  | VfsProvider write methods: create_directory, create_file, rename, remove, copy_file, read_file_prefix    | 2026-05-22 |
| VFS-2  | LocalFsProvider + provider-sftp write implementations with read_write capabilities                       | 2026-05-22 |
| CMD-1  | Command registry: derive CommandId from as-const, dispatch exhaustiveness test                           | 2026-05-22 |
| PERF-1 | Performance smoke command (`pnpm perf:smoke`)                                                            | 2026-05-22 |
| COL-1  | Virtualize icons view with grid-aware windowing and ResizeObserver                                       | 2026-05-22 |
| COL-2  | Route ColumnsView through shared client with request correlation + timeout                               | 2026-05-22 |
| PHASE5 | Phase 5 state and controller refactor + runtime reliability hardening                                    | 2026-05-22 |
| RC-6   | MenuBar sort/theme/density/favorites/filter/search routed via `runCommand` → `dispatchCommand`           | 2026-05-19 |
| RC-4d  | `app-layout.e2e.ts` updated for shell toolbar layout; 24/24 pass                                         | 2026-05-19 |
| RC-4c  | Visual regression baselines + preview `sidebarVisible`; `pnpm test:e2e:vite` 104 pass                    | 2026-05-19 |
| RC-4b  | Diagnostics E2E + `scripts/rc-qa-automated.sh` + `docs/qa/rc-automated-evidence.md`                      | 2026-05-19 |
| RC-4a  | Automated RC: `pnpm rc:validate` + `pnpm tauri:build` (deb/rpm/AppImage bundles)                         | 2026-05-19 |
| RC-5   | IPC integration: `ipc_basic`, `ipc_terminal`, `ipc_reveal` + error-path coverage                         | 2026-05-19 |
| RC-7   | Conflict dialog destination metadata compare via `fs.stat` + `destinationByUri`                          | 2026-05-19 |
| RC-2   | E2E multi-select Selection Properties smoke (`e2e/dialog.e2e.ts`)                                        | 2026-05-19 |
| P2-9   | Selection Properties dialog wired for multi-select; folder-size aggregate via folder-size jobs           | 2026-05-19 |
| P2-8   | Recent Locations management UI (dialog + clear/remove flows)                                             | preex      |
| P2-7   | VolumePickerDialog with discoverVolumes IPC + Go menu                                                    | 81568c8    |
| P2-11  | Offline/unmounted pane state                                                                             | 84867c3    |
| P2-10  | Accessible row names for file entries                                                                    | 993f879    |
| P2-6   | User-selectable visible columns with persistence                                                         | e902fb0    |
| P2-5   | Confirm before app close when jobs running                                                               | 3490ee1    |
| P2-4   | Restore last pane paths and tab state on startup                                                         | d08d97d    |
| P2-2   | Focus-trap on modals + restore focus on close                                                            | 4d80006    |
| P2-1   | Real popover tooltip (replaced title-attribute stub)                                                     | 12a7a73    |
| P1-5   | Breadcrumb overflow menu                                                                                 | a8cc7fd    |
| P1-4   | Image preview in PreviewPanel                                                                            | TBD        |
| P1-3   | Rich Copy To / Move To destination chooser                                                               | TBD        |
| P1-2   | Resizable details columns with localStorage persistence                                                  | 3a066d6    |
| P1-1   | TabBar UI with open/close/switch tab actions                                                             | 8f7e762    |
| P2-3   | Keyboard-navigable context menus                                                                         | c59a5e2    |
| P0-5   | Swap Panes command                                                                                       | fb55230    |
| P0-4   | Toolbar and status-bar menu toggles                                                                      | dffbf11    |
| P0-3   | Drag-and-drop file operations                                                                            | c869970    |
| P0-1   | Filter input rendered and wired                                                                          | 25c77c5    |
