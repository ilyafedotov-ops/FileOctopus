# FileOctopus Cron Status

## Last Run: 2026-05-16 12:54 UTC

### Build & Tests

| Check      | Status | Details                               |
| ---------- | ------ | ------------------------------------- |
| Git Status | ✅     | Working tree clean                    |
| TypeScript | ✅     | tsc --noEmit — 0 errors               |
| Rust       | ✅     | cargo check --workspace — OK          |
| Unit Tests | ✅     | vitest — all passing, cargo test — OK |
| Lint       | ✅     | ESLint — 0 errors                     |
| Rust Tests | ✅     | cargo test --workspace — OK           |

### Issues Found

1. `sha256::digest_file` — deprecated API (fixed, see below)
2. Compress/Extract/Checksum — still "coming soon" toast placeholders (deferred)
3. No visual regression test (Playwright not run this cycle)

### Fixes Applied

- `5ea036b` — fix: replace deprecated `sha256::digest_file` with `try_digest`

### Spec Compliance Summary

- ContextMenu: ✅ All 20+ items match spec (onRename, onCopy, onCut, onPaste, onTrash, onToggleStarred, onPermanentDelete, onCopyPath, onCopyName, onProperties, onReveal, onCompress, onExtract, onOpenTerminal, onChecksum, onCreateFolder, onCreateFile, onRefresh, onSelectAll, onViewMode, onSort, onToggleHidden)
- Toolbar: ✅ 22 items wired; Compress/Extract/Checksum are toast placeholders
- FileTable columns: ✅ Name, Extension, Size, Modified, Created, Type, Permissions, Owner, Hash (9/9)
- Settings: ✅ 4 tabs (General, Appearance, Files, Layout)
- Shortcuts: ✅ 23 keyboard shortcuts defined and wired
- Sort submenu: ✅ Collapsed into CSS hover submenu with 6 sort options
- ViewMode: ✅ 4 modes (details, list, icons, columns)

### Tasks Deferred to Next Run

- Visual comparison against reference images (Playwright)
- Compress/Extract/Checksum real implementations (need Rust backend)
- Settings Shortcuts tab (custom shortcut editor)
