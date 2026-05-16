# FileOctopus — Pending Tasks (Cron Queue)

Tasks are picked up by the next cron run. Mark status as `pending`, `in_progress`, or `done`.

## Active Tasks

### 1. Visual comparison against reference images

- **Status:** pending
- **Priority:** P1
- **Description:** Start Vite dev server, take Playwright screenshots of main app, compare against `docs/Images/MainApp/` (11 reference PNGs). Check: dual-pane layout, toolbar, sidebar, file table columns, status bar, breadcrumb navigation.
- **Files:** `docs/Images/MainApp/*.png`, `packages/frontend/src/index.tsx`

### 2. Implement Compress (Archive) — Rust backend

- **Status:** pending
- **Priority:** P2
- **Description:** Replace "coming soon" toast with real IPC. Rust: add `fs_compress` command using `zip` crate. TS: add `compress()` to FsClient. Wire in toolbar + context menu.
- **Files:** `apps/desktop-tauri/src-tauri/src/lib.rs`, `packages/ts-api/src/client.ts`, `packages/frontend/src/index.tsx`

### 3. Implement Extract (Unarchive) — Rust backend

- **Status:** pending
- **Priority:** P2
- **Description:** Replace "coming soon" toast with real IPC. Rust: add `fs_extract` command. TS: add `extract()` to FsClient. Wire in toolbar + context menu.
- **Files:** `apps/desktop-tauri/src-tauri/src/lib.rs`, `packages/ts-api/src/client.ts`, `packages/frontend/src/index.tsx`

### 4. Implement Checksum verification — Rust backend

- **Status:** pending
- **Priority:** P2
- **Description:** Replace "coming soon" toast with real IPC. Rust: add `fs_verify_checksum` command (MD5/SHA256). TS: add method to FsClient. Show result in dialog or toast.
- **Files:** `apps/desktop-tauri/src-tauri/src/lib.rs`, `packages/ts-api/src/client.ts`, `packages/frontend/src/index.tsx`

### 5. Settings: Shortcuts tab

- **Status:** pending
- **Priority:** P3
- **Description:** Add keyboard shortcut customization tab to SettingsDialog. Allow re-binding shortcuts from shortcuts.ts.
- **Files:** `packages/frontend/src/components/SettingsDialog.tsx`, `packages/frontend/src/shortcuts.ts`

## Completed Tasks

- ✅ **Menu spec comparison** — ContextMenu fully matches spec (2026-05-16)
- ✅ **Feature inventory cross-reference** — All specified items accounted for (2026-05-16)
- ✅ **Fix deprecated sha256::digest_file** → replaced with `try_digest` (2026-05-16, `5ea036b`)
