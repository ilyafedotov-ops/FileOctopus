# FileOctopus MVP Release Candidate Notes

## Supported

- Local filesystem navigation through `local://` resource URIs.
- Two-panel file browsing with sorting, filtering, keyboard navigation, and virtualized large lists.
- Planned copy, move, rename, create-folder, and move-to-trash operations.
- Job progress, cancellation, terminal operation history, startup interruption marking, and diagnostics export.
- Sprint 5 polish: persisted preferences (theme, density, view mode, hidden files), pane load states with stale-listing guards, grouped toolbar with overflow, settings/shortcuts/diagnostics dialogs, and macOS sidebar path filtering. See `docs/releases/sprint-5.md` and `docs/testing/sprint-5-macos-qa.md`.
- Post–Sprint 5 on `main`: command palette, text preview, columns view, expanded table columns, filesystem watcher, navigation/favorites/starred IPC, hash and folder-size helpers. See `docs/planning/PROJECT_STATUS_AND_DOC_ALIGNMENT.md`.

## Platforms

- Primary RC validation target: Linux desktop through Tauri v2.
- macOS and Windows are expected to build through Tauri but need platform smoke testing for Trash, symlinks, locked files, and long paths.

## Known Limitations

- Cloud, SFTP, SMB, WebDAV, archive compress/extract jobs, plugins, indexed search, Git decorations, and multi-tab panes are not included.
- Compress/Extract/Checksum toolbar actions may show “coming soon” toasts; hash column uses on-demand `fs_compute_hash`.
- Symlink object copy is intentionally unsupported in the MVP and fails with `unsupported_symlink`.
- Locked-file semantics are platform-specific; unsupported behavior must be recorded during QA.
- Diagnostics redacts the home directory path where practical but may include operation filenames from history.

## Bug Reports

Attach the diagnostics bundle from **Help → Diagnostics** and the completed QA checklist (`docs/testing/sprint-5-macos-qa.md` on macOS, or `docs/qa/sprint-3-smoke-test.md` on Linux).
