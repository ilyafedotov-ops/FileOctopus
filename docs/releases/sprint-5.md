# Sprint 5 release notes

## Highlights

- Reliable pane loading states with empty, error, permission-denied, and timeout handling
- Request-correlated directory listing IPC with cancellation and timeout guardrails
- Diagnostics moved out of the default layout into a dedicated dialog
- Grouped pane toolbar with overflow actions
- Persisted user preferences for theme, density, default view mode, and hidden files
- Settings and keyboard-shortcuts dialogs
- Toast feedback for completed file operations
- Expanded status bar and macOS location handling improvements

## Known limitations (at Sprint 5 tag)

- Split ratio and last-path restore remain stretch follow-ups
- Command palette and first-run overlay are not included in this release
- No column-view or drag-and-drop support

## Post–Sprint 5 progress (2026-05-30)

Subsequent work on `main` added: command palette (Ctrl/Cmd+P), text preview panel, column view, internal drag-and-drop, split-ratio persistence, full details columns (including permissions/owner), filesystem watcher, expanded settings, compress/extract archives, embedded terminal (local + SSH), Git integration, cloud providers (Google Drive, Dropbox, OneDrive with OAuth), plugin marketplace, ACL editor, file diff/merge, SMB/S3 remote providers, sync directories, tag/label system, saved searches, archive browsing, audio/video preview, checksum verification, dual pane vertical split, storage gauge, and content search. See [PROJECT_STATUS_AND_DOC_ALIGNMENT.md](../planning/PROJECT_STATUS_AND_DOC_ALIGNMENT.md).
