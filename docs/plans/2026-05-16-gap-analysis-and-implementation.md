# FileOctopus Gap Analysis & Implementation Plan

> **Date:** 2026-05-16  
> **Superseded for status:** [PROJECT_STATUS_AND_DOC_ALIGNMENT.md](../planning/PROJECT_STATUS_AND_DOC_ALIGNMENT.md) and `~/.hermes/skills/dogfood/fileoctopus-dev/references/gap-analysis-2026-05.md`  
> **Source:** E2E UI Audit (docs/qa/e2e-audit-report.md) + live code review

## Verified Status (vs Audit Report)

**Update (end of day 2026-05-16):** Phases A and B (watcher, command palette, preview, permissions/owner) are complete on `main`. Remaining work is Milestone 4 (Git, archives, embedded terminal) and Menu spec application menu bar. See alignment doc.

The audit report is **partially stale** — several items marked as "broken" or "missing" have already been fixed:

| Audit Claim                    | Actual Status          | Evidence                                                                                                                                                    |
| ------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ctrl+I not wired               | ✅ **FIXED**           | `index.tsx:1548` — `event.key.toLowerCase() === "i"` → `handleProperties()`                                                                                 |
| Ctrl+H missing alias           | ✅ **FIXED**           | `index.tsx:1541` — `event.code === "Period" \|\| event.key.toLowerCase() === "h"` → `toggleHidden()`                                                        |
| General settings tab empty     | ✅ **FIXED**           | `SettingsDialog.tsx:100-119` — autostart toggle + platform hint                                                                                             |
| Settings: 12 fields missing    | ✅ **FIXED**           | All fields implemented: theme, density, accent, font/icon scale, view, hidden, confirm delete/permanent/overwrite, trash, conflict, sidebar, activity panel |
| File table: only Name+Modified | ✅ **PARTIALLY STALE** | 4 default columns implemented: Name, Size, Modified, Type                                                                                                   |

## Real Gaps (confirmed by code review)

### Tier 1: Frontend-Only (data already in DTO) — Quick Wins

| #    | Feature                                   | Data Source                                    | Effort |
| ---- | ----------------------------------------- | ---------------------------------------------- | ------ |
| T1.1 | **Created date column**                   | `FileEntryDto.createdAt` (exists in Rust + TS) | Small  |
| T1.2 | **Extension column**                      | `FileEntryDto.extension` (exists in Rust + TS) | Small  |
| T1.3 | **Reveal in File Manager** toolbar action | `client.fs.revealPathInFileManager()` (exists) | Small  |
| T1.4 | **Calculate Folder Size** toolbar action  | `client.fs.startFolderSizeJob()` (exists)      | Small  |

### Tier 2: Backend + Frontend — Medium Effort

| #    | Feature                | What's Needed                                                              | Effort       |
| ---- | ---------------------- | -------------------------------------------------------------------------- | ------------ |
| T2.1 | **Permissions column** | Add `permissions` to `FileEntryDto` (Rust: read mode bits → string)        | Medium       |
| T2.2 | **Owner column**       | Add `owner` to `FileEntryDto` (Rust: uid → username)                       | Medium       |
| T2.3 | **Filesystem watcher** | Types exist (`WatchStartRequest`, `WatchEventDto`); wire frontend listener | Medium       |
| T2.4 | **Command palette**    | New UI component + search index of commands                                | Medium       |
| T2.5 | **File preview panel** | New component + `fs.stat` for text files                                   | Medium-Large |

### Tier 3: New Crates / MVP Stretch — Large Effort

| #    | Feature                     | What's Needed                    | Effort |
| ---- | --------------------------- | -------------------------------- | ------ |
| T3.1 | **Checksum toolbar action** | New IPC command (sha256/md5)     | Medium |
| T3.2 | **Compress / Extract**      | `archive-core` crate (zip, tar)  | Large  |
| T3.3 | **Embedded terminal**       | `terminal-core` crate + xterm.js | Large  |
| T3.4 | **Git integration**         | `git-intel` crate                | Large  |

## Implementation Plan

### Phase A: Quick Wins (Tier 1) — Estimated: 2-3 hours

#### Task A1: Add Created date column to FileTable

**Files:**

- Modify: `packages/frontend/src/panelStore.ts` — add `"created"` to `SortField` type
- Modify: `packages/frontend/src/pane/FileTable.tsx` — add ColumnHeader for Created
- Modify: `packages/frontend/src/pane/FileRow.tsx` — render `entry.createdAt` in details view
- Modify: `packages/frontend/src/pane/fileTableUtils.ts` — ensure `formatDate` handles createdAt

**Steps:**

1. Add `"created"` to SortField union in panelStore.ts
2. Add `<ColumnHeader field="created" ...>Created</ColumnHeader>` after Modified in FileTable
3. Add `<span>{formatDate(entry.createdAt)}</span>` in FileRow details section
4. Verify sort works for created field (backend already sends createdAt)

#### Task A2: Add Extension column to FileTable

**Files:**

- Modify: `packages/frontend/src/panelStore.ts` — add `"extension"` to `SortField` type
- Modify: `packages/frontend/src/pane/FileTable.tsx` — add ColumnHeader for Extension
- Modify: `packages/frontend/src/pane/FileRow.tsx` — render `entry.extension` in details view

**Steps:**

1. Add `"extension"` to SortField union
2. Add `<ColumnHeader field="extension" ...>Extension</ColumnHeader>` after Type in FileTable
3. Add `<span>{entry.extension ?? "—"}</span>` in FileRow details section

#### Task A3: Add "Reveal in File Manager" to toolbar overflow

**Files:**

- Modify: `packages/frontend/src/pane/OperationToolbar.tsx` — add overflow item
- Modify: `packages/frontend/src/index.tsx` — add handler + pass prop

**Steps:**

1. Add `onRevealInFileManager` prop to OperationToolbarProps
2. Add overflow menu item: `{ id: "reveal", label: "Reveal in File Manager", icon: Icons.folder(), separatorBefore: true, onSelect: onRevealInFileManager }`
3. Add handler in FileOctopusShell that calls `client.fs.revealPathInFileManager(uri)`

#### Task A4: Add "Calculate Size" to toolbar overflow

**Files:**

- Modify: `packages/frontend/src/pane/OperationToolbar.tsx` — add overflow item
- Modify: `packages/frontend/src/index.tsx` — add handler + pass prop

**Steps:**

1. Add `onCalculateSize` prop to OperationToolbarProps
2. Add overflow menu item: `{ id: "calc-size", label: "Calculate Size", icon: Icons.file(), onSelect: onCalculateSize }`
3. Add handler that calls `client.fs.startFolderSizeJob(uri)` for selected directory

### Phase B: Backend + Frontend (Tier 2) — Estimated: 4-6 hours

#### Task B1: Add Permissions column (requires Rust changes)

**Files:**

- Modify: `crates/vfs/src/lib.rs` — add `permissions: Option<String>` to `FileEntry`
- Modify: `crates/fs-core/` — populate permissions from `std::fs::Metadata::mode()`
- Modify: `crates/app-ipc/src/lib.rs` — add `permissions` to `FileEntryDto`
- Modify: `packages/ts-api/src/types.ts` — add `permissions?: string | null`
- Modify: `packages/frontend/src/panelStore.ts` — add `"permissions"` to SortField
- Modify: `packages/frontend/src/pane/FileTable.tsx` + `FileRow.tsx`

#### Task B2: Add Owner column (requires Rust changes)

**Files:**

- Similar to B1, add `owner: Option<String>` through the stack

#### Task B3: Wire filesystem watcher

**Files:**

- Modify: `packages/ts-api/src/client.ts` — add `watchStart` method + `onWatchEvent` listener
- Modify: `packages/frontend/src/index.tsx` — call `watchStart` on directory load, handle events
- Add `WATCH_EVENT` to Rust emit_with_eval

#### Task B4: Command palette

**Files:**

- Create: `packages/frontend/src/components/CommandPalette.tsx`
- Modify: `packages/frontend/src/index.tsx` — add state, shortcut (Ctrl+P), render
- Add shortcut entry to shortcuts.ts

#### Task B5: File preview panel

**Files:**

- Create: `packages/frontend/src/components/PreviewPanel.tsx`
- Add IPC: `fs.read_text_file` command
- Modify layout to show preview alongside active panel

### Phase C: MVP Stretch (Tier 3) — Deferred

These require substantial new Rust crates and are out of scope for this sprint.

---

## Execution Order

1. ✅ Phase A (all 4 tasks) — Quick wins, no backend changes needed
2. Phase B tasks in order of impact: B3 (watcher) → B4 (command palette) → B1 (permissions) → B2 (owner) → B5 (preview)
3. Phase C — future sprint
