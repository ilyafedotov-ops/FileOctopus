# `@fileoctopus/frontend` — React shell

> **Doc freshness (2026-05-17):** Shell decomposed from the former monolith (`index.tsx` + `App.css`). Entry is `FileOctopusApp`; styles live in `packages/frontend/src/styles/` and are imported by `apps/desktop-tauri/src/App.css`. For delivery vs UI specs see [PROJECT_STATUS_AND_DOC_ALIGNMENT.md](../../planning/PROJECT_STATUS_AND_DOC_ALIGNMENT.md).

`packages/frontend` is the **product UI**: dual-pane file manager, sidebar, menu bar, operation toolbar, jobs/activity rail, modals, and command palette. It is a pure React 19 package — no Tauri import. The desktop shell mounts it; Vitest runs against the preview transport in `@fileoctopus/ts-api`.

- **Source:** `packages/frontend/src/`
- **Depends on:** `@fileoctopus/ts-api`, `@fileoctopus/ui`, `react` (peer)
- **Used by:** `apps/desktop-tauri/src/App.tsx`

## Public surface

```ts
export { FileOctopusApp, FileOctopusShell } from "./app/FileOctopusApp";
```

`FileOctopusShell` is an alias for `FileOctopusApp`. Panel store primitives remain exported for tests:

```ts
export {
  activeTab,
  createInitialState,
  normalizeLocalInput,
  panelReducer,
  parentUri,
  selectVisibleEntries,
} from "./panelStore";
export type { PanelId, PanelTabState, SortField, ViewMode } from "./panelStore";
```

## Package layout

```text
packages/frontend/src/
  index.tsx                 # re-exports FileOctopusApp / FileOctopusShell
  app/
    FileOctopusApp.tsx      # orchestration: IPC effects, handlers, shell context
    providers/
      AppProviders.tsx      # ShellProvider → JobsProvider → ModalsProvider
      ShellProvider.tsx     # client, preferences, navigation, toasts, layout chrome
      JobsProvider.tsx      # live jobs map + history refresh
      ModalsProvider.tsx    # settings, shortcuts, diagnostics, about, go-to, favorites, operation history
  shell/
    AppShell.tsx            # grid: sidebar, workspace, activity rail, status bar
    ShellLayout.tsx         # composes title bar, menu, panes, overlays
    ShellLayoutContext.tsx  # props bag for overlays and pane workspace
    PaneWorkspace.tsx       # dual/single pane + resizers
    MenuBar.tsx             # application menu (wired via useMenuBarProps + dispatch)
    ShellOverlays.tsx       # dialogs, palette, context menu, preview
    ShellStatusBar.tsx
  pane/                     # FilePanel, FileTable, OperationToolbar, path/filter bars
  sidebar/
  jobs/                     # ActivityPanel, JobCard, OperationHistoryList (was activity/)
  components/
    dialogs/                # About, GoToLocation, ManageFavorites, Properties, Conflict, ErrorDetails, OperationHistory
    CommandPalette.tsx
    ContextMenu.tsx         # thin shell; menu bodies in menus/context/*
  menus/context/
    ContextMenuPrimitives.tsx
    buildBreadcrumbMenu.tsx
    buildPaneBackgroundMenu.tsx
    buildFileEntryMenu.tsx
  commands/
    types.ts                # CommandId, CommandGroup
    registry.ts             # COMMAND_DEFINITIONS + shortcut formatting
    bindings.ts             # COMMAND_BINDINGS (menu / toolbar / palette targets)
    dispatch.ts             # dispatchCommand + CommandDispatchDeps
    paletteEntries.ts       # buildPaletteEntries() for CommandPalette
  state/
    paneReducer.ts          # composes navigation, listing, selection, sort/filter slices
    slices/                 # navigationSlice, listingSlice, selectionSlice, sortFilterSlice
    layoutStore.ts          # focus tokens (path, filter, rename, recursive search)
  hooks/
    useFileOpHandlers.ts    # facade over hooks/fileOps/*
    useCommandDispatch.ts   # palette + legacy switch-pane/filter → dispatchCommand
    useMenuBarProps.ts      # MenuBar callbacks → runCommand where possible
    useKeyboardShortcuts.ts # global keymap (not yet on command registry)
    useWorkspaceLayout.ts   # data-layout / data-layout-tier on shell
    fileOps/                # clipboard, mutations, transfers, metadata, archive
  styles/
    app.css                 # entry: density, themes, regions/layout.css
    regions/                # base, shell, sidebar, pane, jobs, dialogs, shared
  panelStore.ts             # types, selectors, reducePanelAction delegate
```

Styling uses the `fo-*` class prefix. **Do not add CSS under `apps/desktop-tauri/src/`** except `App.css` importing `@fileoctopus/frontend/styles/app.css`.

## Component tree

```
AppProviders
 └── FileOctopusApp
      ├── AppShell
      │    ├── TitleBar + MenuBar
      │    ├── Sidebar
      │    ├── PaneWorkspace → FilePanel × (1|2)
      │    ├── ActivityPanel (jobs rail; pinned open per product choice vs overlay drawer in UI spec §15)
      │    └── ShellStatusBar
      └── ShellOverlays
           ├── DialogOverlayGroup (settings, shortcuts, diagnostics, about, go-to, favorites, operation history, operation dialog)
           ├── CommandPalette
           ├── ContextMenuOverlay → ContextMenu
           └── PreviewPanel
```

`ErrorBoundary` wraps the tree. Live job state and operation history come from `JobsProvider`; modal open flags from `ModalsProvider`; navigation/client/preferences from `ShellProvider`.

## Command system

User actions are converging on a single **command id** vocabulary (`commands/types.ts` + `commands/registry.ts`).

| Layer                                     | Role                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `COMMAND_DEFINITIONS`                     | Labels, groups, platform shortcuts                                                                  |
| `dispatchCommand(id, deps, { panelId? })` | Executes commands for active or overridden pane; legacy aliases (`settings` → `app.settings`, etc.) |
| `buildPaletteEntries()`                   | Palette rows from registry + legacy `switch-pane` / `filter`                                        |
| `buildShortcutHelpEntries()`              | Shortcuts dialog + Settings → Shortcuts (registry + supplemental rows)                              |
| `useCommandDispatch(id, panelId?)`        | Closes palette, handles `switch-pane` / `filter`, then dispatch                                     |
| `useMenuBarProps({ runCommand })`         | Most menu items call `runCommand("…")`                                                              |

**Wired through dispatch today:** app modals, navigation, view modes/toggles (hidden files refreshes listing), create folder/file, copy/cut/paste/trash/delete, properties, open/reveal/open-default, clipboard copy variants, selection select/clear/invert, copy-to/move-to, operation history; **pane toolbar**, **context menu** (`runPanelCommand`), and **global keyboard** shortcuts.

**Still direct handlers (not dispatch):** path/recursive-search focus and text preview (Space); compress/extract/checksum/terminal/calculate-size; context-menu properties when a specific entry is passed; sort submenu; sidebar; drag-and-drop; theme/density; favorites add; diagnostics export; menu `onSwitchPane`.

When adding a user-visible action, prefer: register in `registry.ts` → implement in `dispatch.ts` → bind in `bindings.ts` / menu / palette / shortcuts.

## State

### Panel state (`panelStore.ts` + `state/paneReducer.ts`)

`FileOctopusState` holds `activePanelId` and `panels.left` / `panels.right`. Each panel has tabs; today only `"main"` is used. `reducePanelAction` delegates to slices:

- **navigation** — `navigate`, history stacks
- **listing** — `startSession`, `applyBatch`, loading/error
- **selection** — single/range/toggle, select all, invert, clear
- **sort/filter** — `setSort`, `setFilter`, `toggleHidden`, `setViewMode`

Selectors: `activeTab`, `selectVisibleEntries`, `parentUri`, `normalizeLocalInput`.

### Layout focus (`state/layoutStore.ts`)

Zustand store for UI focus tokens consumed by path bar, filter bar, inline rename, and recursive search — not persisted preferences.

### Jobs and modals

- **Jobs:** `Record<jobId, JobSnapshot>` + `operationHistory.listRecentOperations` in `JobsProvider`.
- **Modals:** boolean flags in `ModalsProvider` (settings, shortcuts, diagnostics, about, go-to location, manage favorites, operation history).

## File-operation handlers

`hooks/useFileOpHandlers.ts` composes:

| Hook                      | Responsibility                            |
| ------------------------- | ----------------------------------------- |
| `useOperationCore.ts`     | Dialog state, plan/start, error surfacing |
| `useClipboardHandlers.ts` | Copy/cut/paste clipboard                  |
| `useMutationHandlers.ts`  | Create, rename, trash, permanent delete   |
| `useTransferHandlers.ts`  | Copy/move dialog                          |
| `useMetadataHandlers.ts`  | Properties, hash, folder size             |
| `useArchiveHandlers.ts`   | Compress/extract                          |

`FileOctopusApp` wires these into shell context and dispatch deps once.

## Lifecycle and effects

`FileOctopusApp` (via `useAppInit` / shell effects):

1. **Directory-batch subscription** — dispatches `applyBatch` by `sessionId`.
2. **Job event subscriptions** — merge into jobs map; terminal events refresh panels and history.
3. **Initial navigation** — both panes, history, diagnostics.

`navigatePanel`: `normalizeLocalInput` → dispatch `navigate` → `client.fs.listStart` → dispatch `startSession`.

## Operations UX

Toolbar and dialogs expose create/rename/copy-move/trash/archive flows. `operationErrorMessage` in `FileOctopusApp` maps stable IPC codes to user strings.

Inline rename: F2 / toolbar when one item selected; invalid names fall back to the rename dialog.

## Jobs / activity rail

`jobs/ActivityPanel.tsx` shows active jobs with cancel, recent terminal jobs, and a short history list. Full history: **Tools → Operation History** → `OperationHistoryDialog` (shared `OperationHistoryList`).

## Virtualization

`FileTable` uses a fixed row height virtualizer (no `react-virtual`). See `docs/testing/large-directory-performance.md`.

## Conventions

- **IPC only through `@fileoctopus/ts-api`.** No `@tauri-apps/api` in this package.
- **`local://` URIs** at persistence and IPC boundaries (ADR-0003).
- **Pure reducer** — no I/O in `panelStore` / slices.
- **Render from state** — prefer `useMemo` over effect-derived data.
- **Tests:** `packages/frontend/tests/` — `panelStore.test.ts`, `appShell.test.tsx`, `commands.*.test.ts`. Run: `pnpm --filter @fileoctopus/frontend test`.

## Related docs

- [API reference](../api-reference.md) — IPC contract (update when boundary changes)
- [UI Design Spec](../../FileOctopus_UI_Design_and_Layout_Specification-1.md) — target layout/UX
- [Menu & Modal Spec](../../plans/FileOctopus_Menu_and_Modal_Specification.md) — menu catalog; many items now routed via dispatch
- [Pane lifecycle](../pane-lifecycle.md) — list sessions and batch streaming
