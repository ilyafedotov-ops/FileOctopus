# FileOctopus — Cron Task Queue

> Execution-facing queue for autonomous agents.
> Last verified against repo state: 2026-05-18

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

| ID    | Pri | Status  | Owner | Run ID  | Started UTC | Lock Expires UTC | Acceptance refs                       | Task                                                                                                               | Blockers | Last verified |
| ----- | --- | ------- | ----- | ------- | ----------- | ---------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------- | ------------- |
| P1-2  | P1  | done    | cron  | 3a066d6 | 2026-05-18  | -                | UI spec file table sizing; MVP-UI-001 | Add resizable details columns in `FileTable` and persist widths.                                                   | None     | 2026-05-18    |
| P1-3  | P1  | done    | cron  | TBD     | 2026-05-18  | -                | Menu spec §14.5–14.6                  | Replace the simple Copy To / Move To destination input with a richer chooser dialog.                               | None     | 2026-05-18    |
| P1-4  | P1  | pending | -     | -       | -           | -                | UI preview behavior; MVP-UI-001       | Extend `PreviewPanel` from text-only to include image preview.                                                     | None     | 2026-05-18    |
| P1-5  | P1  | pending | -     | -       | -           | -                | UI spec §10.4; MVP-UI-001             | Collapse long breadcrumbs into an overflow menu instead of truncating silently.                                    | None     | 2026-05-18    |
| P2-2  | P2  | pending | -     | -       | -           | -                | UI spec §18.1, §21.2; M5              | Add reusable focus-trap behavior to modal dialogs and restore focus on close.                                      | None     | 2026-05-18    |
| P2-4  | P2  | pending | -     | -       | -           | -                | UI spec §19.5; M5                     | Restore last pane paths and tab state on startup.                                                                  | None     | 2026-05-18    |
| P2-5  | P2  | pending | -     | -       | -           | -                | UI spec §18.2; MVP-REL-001/002        | Confirm before app close when file-operation jobs are still running.                                               | None     | 2026-05-18    |
| P2-6  | P2  | pending | -     | -       | -           | -                | UI spec §19.4; MVP-UI-001             | Add user-selectable visible columns and persist the choice.                                                        | None     | 2026-05-18    |
| P2-8  | P2  | pending | -     | -       | -           | -                | Menu spec §8.2, §14.19-14.20          | Add Recent Locations management UI. Tracking already exists; missing pieces are the dialog and clear/remove flows. | None     | 2026-05-18    |
| P2-10 | P2  | pending | -     | -       | -           | -                | UI spec §21.2; M5                     | Add accessible row names for file entries.                                                                         | None     | 2026-05-18    |
| P2-1  | P2  | pending | -     | -       | -           | -                | UI spec §9.5; M5                      | Replace `Tooltip.tsx` title-attribute stub with real popover tooltip. Wire into disabled buttons and menu items.   | None     | 2026-05-18    |
| P2-7  | P2  | pending | -     | -       | -           | -                | UI spec §18.2                         | Create VolumePickerDialog with discoverVolumes IPC + VolumeDto. Add to Go menu.                                    | None     | 2026-05-18    |
| P2-9  | P2  | pending | -     | -       | -           | -                | UI spec §18.2                         | Create SelectionPropertiesDialog for multi-file aggregate (count, total size, type breakdown).                     | None     | 2026-05-18    |
| P2-11 | P2  | pending | -     | -       | -           | -                | UI spec §12.2                         | Add offline/unmounted pane state to PaneLoadState + PaneStateView + error code mapping.                            | None     | 2026-05-18    |

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

| ID   | Result                                                           | Commit    |
| ---- | ---------------------------------------------------------------- | --------- |
| P1-2 | Resizable details columns with localStorage persistence shipped. | `3a066d6` |
| P1-1 | TabBar UI shipped with open/close/switch tab actions.            | `8f7e762` |
| P2-3 | Context menus are keyboard navigable.                            | `c59a5e2` |
| P0-5 | Swap Panes command shipped.                                      | `fb55230` |
| P0-4 | Toolbar and status-bar menu toggles shipped.                     | `dffbf11` |
| P0-3 | Drag-and-drop file operations shipped.                           | `c869970` |
| P0-1 | Filter input is rendered and wired.                              | `25c77c5` |
