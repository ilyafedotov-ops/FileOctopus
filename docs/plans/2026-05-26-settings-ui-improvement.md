# Settings UI Improvement Plan

> **Started:** 2026-05-26
> **Status:** Active
> **Supersedes:** `2026-05-15-settings-controls-gaps.md` (historical — preference fields from that plan are implemented)

## Goal

Close all remaining gaps in the Settings dialog: wire the 3 stub tabs (Network, Editor, Viewer) into the settings tree with real preference fields, add the deferred Advanced tab, and polish the overall settings UX.

## Current State

9 tabs are fully wired and functional: General, Display, Colors, Layout, Layout Profiles, File List, Operations, Terminal, Keyboard.

3 components exist as stubs but are **not in the settings tree** and show only "coming soon" text:

- `SettingsNetwork.tsx` — connection defaults
- `SettingsEditor.tsx` — built-in editor preferences
- `SettingsViewer.tsx` — built-in viewer preferences

1 tab is specified but has no component at all:

- **Advanced** — experimental/config options

## Tasks

### SET-ADV — Advanced Settings Tab (P2)

Wire a new Advanced tab into the settings tree with experimental/config options:

- Add `"advanced"` to `SettingsCategory` union and `SETTINGS_TREE`
- Create `SettingsAdvanced.tsx` with fields: log level, enable experimental features, cache size limit, file operation thread count
- Backend: add new preference fields to `config::UserPreferences`, IPC DTOs, TS types
- Acceptance: tab appears in tree, all fields persist across restart

**Files:** `types.ts`, `SettingsTree.tsx`, new `SettingsAdvanced.tsx`, `SettingsDialog.tsx`, `crates/config/src/lib.rs`, `crates/app-ipc/src/lib.rs`, `packages/ts-api/src/types.ts`

### SET-NET — Network Settings Tab (P2)

Wire the existing stub into the settings tree with real preference fields:

- Add `"network"` to `SettingsCategory` union and `SETTINGS_TREE`
- Implement fields: default connection timeout, auto-reconnect toggle, default protocol preference, SSH key path override
- Backend: add network preference fields to `config::UserPreferences`, IPC DTOs, TS types
- Acceptance: tab appears in tree, connection defaults persist across restart

**Files:** `types.ts`, `SettingsTree.tsx`, `SettingsNetwork.tsx`, `SettingsDialog.tsx`, `crates/config/src/lib.rs`, `crates/app-ipc/src/lib.rs`, `packages/ts-api/src/types.ts`

### SET-EDIT — Editor Settings Tab (P2)

Wire the existing stub into the settings tree with real preference fields:

- Add `"editor"` to `SettingsCategory` union and `SETTINGS_TREE`
- Implement fields: font family, font size, tab size, word wrap toggle, auto-save toggle, syntax highlighting theme, line numbers toggle
- Backend: add editor preference fields to `config::UserPreferences`, IPC DTOs, TS types
- Acceptance: tab appears in tree, editor preferences persist and apply to F4 built-in editor

**Files:** `types.ts`, `SettingsTree.tsx`, `SettingsEditor.tsx`, `SettingsDialog.tsx`, `crates/config/src/lib.rs`, `crates/app-ipc/src/lib.rs`, `packages/ts-api/src/types.ts`

### SET-VIEW — Viewer Settings Tab (P2)

Wire the existing stub into the settings tree with real preference fields:

- Add `"viewer"` to `SettingsCategory` union and `SETTINGS_TREE`
- Implement fields: default view mode (text/hex), image zoom behavior (fit/fill/actual), media autoplay toggle, max preview file size
- Backend: add viewer preference fields to `config::UserPreferences`, IPC DTOs, TS types
- Acceptance: tab appears in tree, viewer preferences persist and apply to F3 built-in viewer

**Files:** `types.ts`, `SettingsTree.tsx`, `SettingsViewer.tsx`, `SettingsDialog.tsx`, `crates/config/src/lib.rs`, `crates/app-ipc/src/lib.rs`, `packages/ts-api/src/types.ts`

### SET-POLISH — Settings Dialog Polish (P3)

Improve settings UX consistency:

- Add settings search/filter bar at the top of the dialog
- Ensure all tabs follow consistent spacing and label conventions
- Add section descriptions matching the UI Design Spec
- Acceptance: search filters visible tabs and fields, all tabs follow consistent patterns

**Files:** `SettingsDialog.tsx`, CSS modules

## Dependency Graph

```
SET-ADV ──┐
SET-NET ──┤── (independent, can run in parallel)
SET-EDIT ──┤
SET-VIEW ──┘
     │
     ▼
  SET-POLISH (depends on all 4 tabs being wired)
```

## Acceptance

- All 13 tabs appear in settings tree navigation
- All preference fields persist across app restarts
- No regressions in existing 9 tabs
- `pnpm typecheck` + `pnpm test` + `pnpm lint` + `cargo test` all green
