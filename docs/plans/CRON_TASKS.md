# FileOctopus — Cron Task Queue

> Execution-facing queue for autonomous agents.
> Last verified against repo state: 2026-05-28 00:15 UTC
>
> **Note:** If Active RC Queue has fewer than 3 `pending` tasks, the agent MUST read `PROJECT_STATUS_AND_DOC_ALIGNMENT.md` §"Specified but not implemented" + `UI_FEATURE_INVENTORY.md` §13 and backfill immediately. Never stop with "queue empty" while deferred items exist.

---

## Selection Rules

- Only pick work from **Active RC Queue**.
- If one or more rows are `pending`, automatically select the highest-priority unblocked row; do not ask for confirmation.
- If Active RC Queue has no `pending` items, read `PROJECT_STATUS_AND_DOC_ALIGNMENT.md` §"Specified but not implemented" + `UI_FEATURE_INVENTORY.md` §13, backfill the queue with 3+ P1–P3 tasks, THEN select work. Only run audit-only if ALL spec docs confirm zero gaps.
- Do not select or promote **Deferred / Post-RC** items unless a human explicitly reprioritizes them by moving them into Active RC Queue with `Status: pending`.
- If a queue row conflicts with the codebase or higher-trust docs, update this file first and refresh `last_verified`.
- Keep at most one `in_progress` row at a time.
- A row is claimed only when `Status`, `Owner`, `Run ID`, `Started UTC`, and `Lock Expires UTC` are all set.
- A non-expired `Lock Expires UTC` blocks other agents from selecting that row.

---

## Active RC Queue

| ID           | Pri        | Status   | Owner | Run ID   | Started UTC | Lock Expires UTC | Acceptance refs                       | Task                                                                                                                                                | Blockers                                                                                                                                                    | Last verified |
| ------------ | ---------- | -------- | ----- | -------- | ----------- | ---------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ---------- |
| RC-4         | P1         | done     | -     | -        | -           | -                | M5; mvp-rc-checklist                  | MVP RC: automated rc:validate + diagnostics E2E evidence refreshed; manual QA matrices remain human-only                                            | None                                                                                                                                                        | 2026-05-23    |
| RC-PREFS     | P2         | done     | -     | -        | -           | -                | UI Design Spec §Preferences           | Operations / Shortcuts tabs implemented; Advanced tab deferred to post-RC                                                                           | None                                                                                                                                                        | 2026-05-23    |
| RC-MENU-FULL | P2         | done     | codex | 207eb90  | 2026-05-23  | 2026-05-23       | Menu & Modal Spec §4                  | Application menu bar full wiring: native OS menu (Tauri menu.rs), sort submenu parity                                                               | None                                                                                                                                                        | 2026-05-23    |
| RC-PAUSE     | P2         | done     | cron  | 7f8f8a5  | 2026-05-26  | 2026-05-26       | UI §6; RC spec §3.2                   | Pause on jobs: backend job.pause IPC + UI pause/resume button in activity panel                                                                     | None                                                                                                                                                        | 2026-05-26    |
| RC-VIDEOS    | P3         | done     | cron  | -        | 2026-05-24  | 2026-05-24       | UI_FEATURE_INVENTORY §3               | Sidebar Videos icon mapping implemented                                                                                                             | None                                                                                                                                                        | 2026-05-24    |
| RC-RECENT    | P2         | done     | cron  | 7cadc95  | 2026-05-23  | 2026-05-23       | UI §2; UI_FEATURE_INVENTORY           | Sidebar Recent section renders Today and This Week groups                                                                                           | None                                                                                                                                                        | 2026-05-24    |
| RC-DIAG-LOC  | P3         | done     | cron  | 6fa3dac  | 2026-05-23  | 2026-05-23       | UI Design Spec                        | Diagnostics export location preference                                                                                                              | None                                                                                                                                                        | 2026-05-24    |
| RC-TAR       | P3         | done     | cron  | 35d463a  | 2026-05-23  | 2026-05-23       | RC spec §3.2                          | Archive formats: .tar, .tar.gz/.tgz, .tar.bz2/.tbz2                                                                                                 | None                                                                                                                                                        | 2026-05-24    |
| P2-15        | P2         | done     | cron  | c6fac7a  | 2026-05-24  | 2026-05-24       | UI_FEATURE_INVENTORY §3               | Checksum verification UI: on-demand SHA-256 + expected hash + Match/Mismatch                                                                        | None                                                                                                                                                        | 2026-05-24    |
| QA-1         | P1         | done     | codex | qaauto   | 2026-05-24  | 2026-05-24       | Release checklist; UI §27–28          | Automated Phase 5 QA evidence refreshed                                                                                                             | None                                                                                                                                                        | 2026-05-24    |
| DOC-DRIFT-1  | P1         | done     | codex | docdrift | 2026-05-24  | 2026-05-24       | PROJECT_STATUS; CRON_TASKS            | Reconciled planning/status drift                                                                                                                    | None                                                                                                                                                        | 2026-05-24    |
| POST-4       | P2         | done     | codex | sidebar  | 2026-05-24  | 2026-05-24       | UI Design Spec §2                     | Network sidebar polish: no SFTP duplication under Devices/Volumes                                                                                   | None                                                                                                                                                        | 2026-05-24    |
| POST-1       | P2         | done     | codex | firstrun | 2026-05-24  | 2026-05-24       | Sprint 5 stretch                      | First-run welcome overlay                                                                                                                           | None                                                                                                                                                        | 2026-05-24    |
| POST-2       | P3         | done     | codex | titlebar | 2026-05-24  | 2026-05-24       | UI Design Spec §1                     | Title bar sync/health indicator                                                                                                                     | None                                                                                                                                                        | 2026-05-24    |
| P3-1         | P3         | done     | cron  | p3-1col  | 2026-05-24  | 2026-05-24       | UI Design Spec                        | Column reorder: drag column headers, persisted in localStorage                                                                                      | None                                                                                                                                                        | 2026-05-24    |
| P3-6         | P3         | deferred | -     | -        | -           | -                | UI Design Spec                        | Rubber-band select: requires virtual-scroll-aware coordinate math + intersection testing; too large for single cycle                                | None                                                                                                                                                        | 2026-05-24    |
| P3-4         | P3         | done     | cron  | vert     | 2026-05-24  | 2026-05-25       | UI Design Spec                        | Dual pane vertical split                                                                                                                            | None                                                                                                                                                        | 2026-05-24    |
| P3-5         | P3         | done     | cron  | rubber   | 2026-05-24  | 2026-05-25       | UI Design Spec                        | Storage gauge: disk usage bar in status bar or sidebar                                                                                              | None                                                                                                                                                        | 2026-05-24    |
| P1-3         | P1         | done     | cron  | f8acc08  | 2026-05-25  | 2026-05-25       | UI Design Spec §5                     | Rich Copy To / Move To: tree browser destination chooser                                                                                            | None                                                                                                                                                        | 2026-05-25    |
| P1-4         | P1         | done     | cron  | 0e65e72  | 2026-05-25  | 2026-05-25       | UI Design Spec §3                     | Image preview: gallery prev/next, image dimensions, file size and modified date in viewer footer                                                    | None                                                                                                                                                        | 2026-05-25    |
| P2-12        | P2         | done     | cron  | ec61bbb  | 2026-05-25  | 2026-05-25       | UI Design Spec §4                     | Symlink indicator + copy/move warning                                                                                                               | None                                                                                                                                                        | 2026-05-25    |
| P2-13        | P2         | done     | cron  | df3e782  | 2026-05-26  | 2026-05-26       | UI Design Spec §3                     | Audio/video media preview with HTML5 controls                                                                                                       | None                                                                                                                                                        | 2026-05-26    |
| P2-14        | P2         | done     | cron  | 9aa61ba  | 2026-05-26  | 2026-05-26       | UI Design Spec §3                     | Saved searches / smart folders: sidebar section with save/open/rename/remove, localStorage persistence                                              | None                                                                                                                                                        | 2026-05-26    |
| P2-16        | P2         | done     | cron  | 1e9f07d  | 2026-05-26  | 2026-05-26       | UI Design Spec §3                     | Archive browsing: browse zip/tar contents without extraction (16 tests)                                                                             | None                                                                                                                                                        | 2026-05-26    |
| P3-2         | P3         | done     | cron  | 7e665e7  | 2026-05-26  | 2026-05-26       | UI Design Spec §6                     | Eject/unmount: safely eject removable volumes                                                                                                       | None                                                                                                                                                        | 2026-05-26    |
| P3-3         | P3         | done     | cron  | 7f8f8a5  | 2026-05-26  | 2026-05-26       | UI Design Spec §6                     | Job pause/resume                                                                                                                                    | None                                                                                                                                                        | 2026-05-26    |
| TAG-1        | P2         | done     | cron  | 92a05c7  | 2026-05-26  | 2026-05-26       | UI Design Spec §3                     | Tag/label system: color tags, context menu Tags submenu, tag badges on FileRow, localStorage persistence (15 tests)                                 | None                                                                                                                                                        | 2026-05-26    |
|              | RMT-1      | P2       | done  | cron     | ce392bf     | 2026-05-26       | 2026-05-26                            | UI Design Spec §2                                                                                                                                   | Remote providers: SMB and S3 protocol support                                                                                                               | None          | 2026-05-26 |
|              | E2E-1      | P1       | done  | cron     | 02bd975     | 2026-05-27       | 2026-05-27                            | mvp-rc-checklist; testing/README.md                                                                                                                 | E2E reliability audit: 165 pass, 27 conditional skips, 0 failures; sort submenu hover fix, sidebar selector modernization, retry logic, snapshot updates    | None          | 2026-05-27 |
|              | TEST-1     | P1       | done  | cron     | 8b75ab7     | 2026-05-27       | 2026-05-27                            | testing/README.md; coverage target 85%                                                                                                              | Test coverage audit for recent features: TAG-1 (tags), RMT-1 (SMB/S3), P2-14 (smart folders), P2-16 (archive browsing) — add missing unit/integration tests | None          | 2026-05-27 |
| TEST-2       | P1         | done     | cron  | 938249a  | 2026-05-27  | 2026-05-27       | testing/README.md                     | SMB/S3 integration test validation: verify provider-smb and provider-s3 crates have adequate test coverage for connector, ops, and provider modules | None                                                                                                                                                        | 2026-05-27    |
| PDF-1        | P2         | done     | cron  | 3aa5615  | 2026-05-27  | 2026-05-27       | UI_FEATURE_INVENTORY §13; UI §Preview | PDF preview: render first page of PDF files in ViewerDialog using pdf.js or canvas-based approach                                                   | None                                                                                                                                                        | 2026-05-27    |
| PERF-2       | P2         | done     | cron  | 16c0208  | 2026-05-27  | 2026-05-27       | docs/performance.md; mvp-rc-checklist | Performance benchmark capture: execute perf:smoke, record large-directory and large-file-operation timings in docs/performance.md                   | None                                                                                                                                                        | 2026-05-27    |
| SET-ADV      | P2         | done     | cron  | 05b31a7  | 2026-05-27  | 2026-05-27       | 2026-05-26-settings-ui-improvement    | Advanced settings tab: wire new Advanced tab with log level, experimental features toggle, cache size, thread count                                 | None                                                                                                                                                        | 2026-05-27    |
| SET-NET      | P2         | done     | cron  | 01748a3  | 2026-05-27  | 2026-05-27       | 2026-05-26-settings-ui-improvement    | Network settings tab: wire stub into tree with connection timeout, auto-reconnect, default protocol, SSH key path preferences                       | None                                                                                                                                                        | 2026-05-27    |
| SET-EDIT     | P2         | done     | cron  | 9bfe938  | 2026-05-27  | 2026-05-27       | 2026-05-26-settings-ui-improvement    | Editor settings tab: wire stub into tree with font family/size, tab size, word wrap, auto-save, syntax highlighting, line numbers                   | None                                                                                                                                                        | 2026-05-27    |
| SET-VIEW     | P2         | done     | cron  | 7243e03  | 2026-05-27  | 2026-05-27       | 2026-05-26-settings-ui-improvement    | Viewer settings tab: wire stub into tree with default view mode, image zoom, media autoplay, max preview file size                                  | None                                                                                                                                                        | 2026-05-27    |
|              | SET-POLISH | P3       | done  | cron     | a54576c     | 2026-05-27       | 2026-05-27                            | 2026-05-26-settings-ui-improvement                                                                                                                  | Settings dialog polish: search/filter bar, consistent spacing/labels, section descriptions                                                                  | None          | 2026-05-27 |
|              | CLOUD-1    | P2       | done  | cron     | 917d772     | 2026-05-28       | 2026-05-28                            | RC spec §3.3                                                                                                                                        | Cloud providers: Google Drive, Dropbox, OneDrive — backend connector crates + VFS registration + frontend sidebar UI wiring                                 | None          | 2026-05-28 |
| PLUG-1       | P2         | done     | cron  | 64f87a7  | 2026-05-28  | 2026-05-28       | RC spec §3.3                          | Plugin marketplace: plugin loader, manifest schema, sandboxed execution, UI marketplace browser                                                     | None                                                                                                                                                        | 2026-05-28    |
| DIFF-1       | P2         | done     | cron  | bb87696  | 2026-05-28  | 2026-05-28       | RC spec §3.3                          | File content diff/merge: side-by-side diff view, merge conflict resolution UI, inline change markers                                                | None                                                                                                                                                        | 2026-05-28    |
| ACL-1        | P3         | pending  | -     | -        | -           | -                | RC spec §3.3                          | Advanced ACL editing: POSIX/NTFS ACL viewer + editor, permission matrix UI, recursive apply                                                         | None                                                                                                                                                        | 2026-05-28    |

---

## Deferred / Post-RC

| ID       | Why deferred                                                                                    |
| -------- | ----------------------------------------------------------------------------------------------- |
| RC-PAUSE | Pause on jobs — UI §6; currently Cancel only; not RC-blocking                                   |
| P2-12    | Done — symlink indicator badge + copy/move warning (`ec61bbb`)                                  |
| P2-13    | Done — audio/video media preview with HTML5 controls (`df3e782`); PDF/EXIF remain post-RC       |
| P2-14    | Saved searches/smart folders add new persistence and virtual result views                       |
| P2-15    | Done — implemented in Properties dialog (`c6fac7a`)                                             |
| P2-16    | Done — archive browsing with fs_list_archive IPC + frontend wiring (`1e9f07d`)                  |
| P3-1     | Promoted to Active RC Queue for post-RC polish                                                  |
| P3-2     | Eject/unmount — polish/future                                                                   |
| P3-3     | Job pause/resume — polish/future                                                                |
| P3-4     | Dual pane vertical split — polish/future                                                        |
| P3-6     | Rubber-band select — polish/future                                                              |
| POST-1   | Done — first-run welcome overlay is implemented and persisted after dismissal                   |
| POST-2   | Done — title bar shows Git, remote connection, and operation health status pills                |
| POST-3   | Done — Videos standard-location icon mapping is implemented                                     |
| POST-4   | Done — Network sidebar deduplicates saved SFTP profiles from Devices/Volumes                    |
| POST-5   | Done — sidebar renders Today and This Week recent groups                                        |
| RMT-1    | Done — SMB/S3 providers registered in VFS + connectors + frontend UI wiring (`ce392bf`)         |
| TAG-1    | Done — tag/label system with context menu submenu, FileRow badges, and localStorage (`92a05c7`) |
| SET-1    | Superseded by SET-ADV in 2026-05-26-settings-ui-improvement plan                                |
| EXIF-1   | EXIF metadata display in Properties — post-RC visual expansion                                  |
| P2P-1    | P2P sync — intentionally deferred (RC spec §3.3)                                                |
| AI-1     | AI semantic search — intentionally deferred (RC spec §3.3)                                      |
| PLUG-1   | **Done** — plugin marketplace with install/uninstall/toggle + UI (`64f87a7`)                    |
| CLOUD-1  | Done — Google Drive, Dropbox, OneDrive providers (`917d772`)                                    |
| DIFF-1   | **Promoted to Active RC Queue** (2026-05-28) — file diff/merge                                  |
| ACL-1    | **Promoted to Active RC Queue** (2026-05-28) — ACL editing                                      |

---

## Recently Completed

|| ID | Result | Commit |
|| ----------- | ------------------------------------------------------------------------------------------------------------ | ---------- |
|| SET-POLISH | Settings dialog polish: search/filter bar, section descriptions, consistent aria-labels (27 tests) | a54576c ||
|| CLOUD-1 | Cloud providers: Google Drive, Dropbox, OneDrive connector crates + VFS registration + OAuth auth (20 tests) | 917d772 ||
|| PDF-1 | PDF preview: pdf.js canvas rendering, page navigation, error fallback, 13 tests | 3aa5615 |
| TEST-1 | Test coverage audit: 22 new tests (16 frontend, 6 Rust), 1 SMB bug fix for NT_STATUS mapping | 8b75ab7 |
| E2E-1 | E2E reliability audit: 165 pass, 27 conditional skips, 0 failures; sort submenu, selectors, retry, snapshots | 02bd975 |
| RMT-1 | SMB/S3 remote provider support: backend crates, connector/VFS registration, frontend UI wiring, URI tests | ce392bf |
| TAG-1 | Tag/label system: context menu submenu, FileRow badges, localStorage persistence, 15 tests | 92a05c7 |
| P3-3 | Job pause/resume: event wiring + UI buttons + merge helpers for activity panel state updates | 7f8f8a5 |
| P3-2 | Eject/unmount: fs_eject_volume IPC + sidebar context menu + PaneWorkspace wiring | 7e665e7 |
| P2-16 | Archive browsing: fs_list_archive IPC + TS client + activateEntry intercept + archive icon (16 tests) | 1e9f07d |
| P2-14 | Saved searches / smart folders: sidebar section, save/open/rename/remove, localStorage persistence | 9aa61ba |
| P2-13 | Audio/video media preview: ViewerMediaMode with native HTML5 controls, 19 audio/video extensions | df3e782 |
| P2-12 | Symlink indicator badge + copy/move warning + kind column display | ec61bbb |
| P1-4 | Image preview: gallery prev/next, image dimensions, file size and modified date in viewer footer | 0e65e72 |
| P1-3 | Rich Copy To / Move To: tree browser destination chooser via fs_list_directories IPC | f8acc08 |
| P3-5 | Storage gauge in status bar: on-demand volume discovery + usage bar + free-space text | 15eff46 |
| P3-4 | Dual pane vertical split toggle | vert |
| P3-1 | Column reorder: drag column headers, persisted in localStorage | p3-1col |
| POST-2 | Title bar status indicator for active Git repo, remote connection, and operation errors | 2026-05-24 |
| POST-1 | First-run welcome overlay with persisted dismissal and links into Settings, Shortcuts, and Network | 2026-05-24 |
| QA-1 | Automated Phase 5 QA evidence refreshed: failure-state snapshots and accessibility smoke coverage | 2026-05-24 |
| DOC-DRIFT-1 | Planning/status drift reconciled for archives, menu, preferences, checksum, and network sidebar status | 2026-05-24 |
| POST-4 | Network sidebar deduplication: saved SFTP profiles render only in the dedicated Network section | 2026-05-24 |
| P2-15 | Checksum verification UI in Properties dialog: on-demand SHA-256 + expected hash input + Match/Mismatch | c6fac7a |
| RC-PAUSE | Job pause/resume: event wiring + UI buttons + merge helpers for activity panel state updates | 7f8f8a5 |
| RC-4 | Automated RC evidence refreshed: backend + frontend RC green (502 tests); E2E timeout remains environmental | d74e917 |
| RC-MENU | Application menu bar routing verified — sort/theme/density/favorites-add via runCommand | d74e917 |
| RC-CONF | Conflict dialog verified — per-item actions, metadata compare, apply-to-all (11 tests) | d74e917 |
| RC-IMG | Image preview verified — fs_read_image + PreviewPanel + ViewerDialog image mode | d74e917 |
| RC-PREF | Settings toggle "Remember last used panes" wired in Layout tab with backend persistence | 1fe9ce8 |
| RC-3 | Refresh automated RC evidence for commit b1c3cfd | b1c3cfd |
| GIT-1 | Git Intelligence V1: git-intel crate, FileRow badges, PaneHeader branch + dirty mark | 2026-05-23 |
| NET-1..4 | Network provider hardening Stages 1–4: lifecycle, fingerprint TOFU, status events, SFTP profiles | 2026-05-19 |
| TERM-1..2 | Embedded terminal: local + SSH PTY, bottom split, tabs, shell prefs | 2026-05-19 |
| VIEW-1 | Built-in F3 viewer + F4 editor with shared syntax highlighting | 2026-05-20 |
| VFS-1..2 | VfsProvider write methods: create_directory, create_file, rename, remove, copy_file, read_file_prefix | 2026-05-22 |
| CMD-1 | Command registry: derive CommandId from as-const, dispatch exhaustiveness test | 2026-05-22 |
| PERF-1 | Performance smoke command (pnpm perf:smoke) | 2026-05-22 |
| COL-1..2 | Virtualize icons view + ColumnsView shared client routing | 2026-05-22 |
| PHASE5 | Phase 5 state and controller refactor + runtime reliability hardening | 2026-05-22 |
