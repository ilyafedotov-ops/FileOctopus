# `@fileoctopus/frontend` — React shell

`packages/frontend` is the **product UI**: the two-panel file manager, the operation toolbar, the job activity panel, and the operation dialogs. It is a pure React 19 component package — no application bootstrap, no Tauri import. The desktop shell mounts it; the React build can also run in a plain browser against the preview transport in `@fileoctopus/ts-api`.

- Source: `packages/frontend/src/{index,panelStore}.{tsx,ts}`
- Depends on: `@fileoctopus/ts-api`, `@fileoctopus/ui`, `react` (peer).
- Used by: `apps/desktop-tauri/src/App.tsx`.

## Public surface

A single component is exported:

```ts
export function FileOctopusShell(): JSX.Element;
```

Plus the panel store primitives, which are exported for tests:

```ts
export {
  activeTab, createInitialState, normalizeLocalInput, panelReducer,
  parentUri, selectVisibleEntries,
} from "./panelStore";
export type { PanelId, PanelTabState, SortField } from "./panelStore";
```

## Component tree

```
FileOctopusShell
 ├── <header>  topbar (active panel indicator)
 ├── <section> fo-panels
 │     ├── FilePanel (left)        ── PathBar, OperationToolbar, FileTable
 │     └── FilePanel (right)       ── PathBar, OperationToolbar, FileTable
 ├── JobActivityPanel               (live jobs + recent history)
 ├── OperationDialogView            (modal for create/rename/copy-move/trash)
 └── <footer> status (selection + entry counts)

ErrorBoundary wraps the whole tree to catch render-time exceptions.
```

The shell owns:

- `state` (panel state, via `useReducer(panelReducer)`).
- `jobs` (live `Record<jobId, JobSnapshot>`).
- `history` (`OperationHistoryRecordDto[]` from `operationHistory.listRecentOperations`).
- `operationError` (string | null) — the last user-facing IPC error.
- `dialog` (`OperationDialog | null`) — the active modal.

These are all `useState` / `useReducer` locals; there is no global store. Persistence between sessions, if needed, would land in `panelStore` (currently `homeUri()` reads a `localStorage` key as a hint).

## Lifecycle and effects

`FileOctopusShell` runs three effects:

1. **Directory-batch subscription**, on mount and on each `client` change (memoized once). Dispatches `applyBatch` actions to the reducer.
2. **Job event subscriptions** for all five `fileOperation.job.*` events. Each callback merges its event into the `jobs` map; terminal events also refresh the visible panels and reload history. Effect re-runs when `left.uri` / `right.uri` change so subscriptions follow the active panels.
3. **Initial navigation** runs once on mount: triggers `navigatePanel` for left and right, plus the first `refreshHistory` call.

`navigatePanel` is the operation that wires together URI normalization, the reducer dispatch, and the `fs.list_start` call:

```
normalizeLocalInput(input) ─► dispatch "navigate" ─► client.fs.listStart(...) ─► dispatch "startSession"
```

The reducer keys the panel by the returned `sessionId`; subsequent `directory.batch` events are routed by matching their `sessionId` to the panel.

## `panelStore`

`src/panelStore.ts` is a pure reducer module — no React imports.

```ts
type PanelId = "left" | "right";
type SortField = "name" | "type" | "size" | "modified";

interface PanelTabState {
  uri: string;
  entriesById: Record<string, FileEntryDto>;
  orderedEntryIds: string[];
  selectedIds: string[];
  selectedId: string | null;
  focusedId: string | null;
  anchorId: string | null;
  sessionId: string | null;
  loading: boolean;
  error: string | null;
  filter: string;
  sort: SortState;
}

interface PanelState { id: PanelId; activeTabId: string; tabs: Record<string, PanelTabState>; }
interface FileOctopusState { activePanelId: PanelId; panels: Record<PanelId, PanelState>; }
```

A panel is a list of tabs keyed by id; the active tab is tracked by `activeTabId`. Today only one tab (`"main"`) is created per panel, but the shape is ready for multi-tab navigation.

### Actions

| Action | Effect |
| --- | --- |
| `setActivePanel` | Updates `activePanelId`. |
| `navigate` | Clears entries/selection, sets the new URI, marks `loading: true`, clears any prior `sessionId`. |
| `startSession` | Stores the `sessionId` returned by `fs.list_start`. Subsequent batches with that id are routed here. |
| `applyBatch` | Merges incoming entries into `entriesById` + `orderedEntryIds`, preserves selection where possible, clears `loading` on the final batch, surfaces any `batch.error`. |
| `setSelection` | Single-id selection. |
| `selectEntry` | Multi-id selection with `mode: "single" \| "toggle" \| "range"`. Range mode walks the visible (sorted+filtered) entry list between `anchorId` and the clicked id. |
| `moveSelection` | Keyboard navigation (Up/Down/PageUp/PageDown/Home/End). |
| `setLoading`, `setError`, `setFilter`, `setSort` | Field updates. |

### Selectors

- `activeTab(panel)` — returns the active `PanelTabState`.
- `selectVisibleEntries(tab)` — applies the filter (case-insensitive substring on `name`) and the sort. Directories first by default (`sort.directoriesFirst`); the field comparator is name (numeric+base), type, size, or modified time.
- `parentUri(uri)` — strips one `/<segment>` from a `local://` URI; returns `null` at the root.
- `normalizeLocalInput(value)` — accepts a `local://` URI, an absolute POSIX path, or a Windows drive path. Anything else passes through unchanged; the UI checks for `startsWith("local://")` and surfaces a friendly error if it isn't.

### Conventions

- **No reducer side effects.** The reducer is pure; all I/O is in `FileOctopusShell`. Action handlers in the shell are responsible for sequencing dispatches with `client.*` calls.
- **Entries are keyed by URI.** `entriesById` and `selectedIds` both store `FileEntryDto.uri`. Renames cause a fresh URI on the next batch — that's why `applyBatch` falls back to the first id if the previously-selected URI is gone.
- **Selection is derived, not authoritative.** The visible/sorted/filtered order is recomputed on every render via `selectVisibleEntries`. Don't cache it in state.

## Operations UX

Five operation entry points are exposed through `OperationToolbar`:

- **New Folder** — opens the `createFolder` dialog. Validates the name (`isValidName` rejects empty, path separators, NULs). On submit, calls `startOperation("createDirectory", [], joinLocalUri(uri, name))`.
- **Rename** — only enabled when exactly one entry is selected. Opens the `rename` dialog pre-filled with the current name.
- **Copy / Move** — opens the `copyMove` dialog with the other panel's URI as the default destination and `ConflictPolicy = "fail"`. The dialog has a two-step submit: **Plan** calls `client.fileOperations.planFileOperation` and renders the plan summary (item count, first 3 conflicts, first 3 warnings); **Start** uses the cached plan via `startPlannedOperation`.
- **Move to Trash** — opens the `trash` dialog with a confirmation summary; submit calls `startOperation("deleteToTrash", uris)`.

`operationErrorMessage(code, fallback)` maps common error codes (`permission_denied`, `not_found`, `destination_conflict`, `invalid_name`, `unsupported_trash`, `cancelled`) to friendly strings. Any other code falls back to `message`.

## Job activity

`JobActivityPanel` reads from the `jobs` map and the `history` array:

- Active jobs (`queued` or `running`) are shown with a progress bar driven by `completedBytes/totalBytes` (falling back to `completedItems/totalItems` when `totalBytes` is null) and a Cancel button.
- The five most recent terminal jobs (`completed`/`failed`/`cancelled`) are shown below.
- The history section lists rows from `operationHistory.listRecentOperations({ limit: 20 })`.

`refreshHistory` is called on initial mount, after every terminal job event, and on the Refresh button click.

## Virtualization

`FileTable` implements a simple row virtualizer:

- Fixed `rowHeight = 30`, `overscan = 8`.
- The viewport's `scrollTop` is captured via `onScroll`; the visible window is `[startIndex, startIndex + visibleCount)`.
- Rows are positioned absolutely via `transform: translateY(top)`.
- Keyboard handling (`handleKeyDown`) dispatches `moveSelection` for Up/Down/Page/Home/End and `onActivate` for Enter; `useEffect` keeps the focused row inside the viewport.

This is intentionally lightweight — no `react-virtual` or similar dependency. The Sprint 1 perf protocol (`docs/testing/large-directory-performance.md`) validates that 100k entry lists scroll cleanly under this implementation.

## Conventions

- **Use `@fileoctopus/ts-api` for all IPC.** Never import `@tauri-apps/api` here.
- **Render is a function of state.** Avoid `useEffect` for derived data; use `useMemo` or recompute on render.
- **Friendly errors come from `operationErrorMessage`.** When you introduce a new error code, add a mapping here.
- **No CSS-in-JS.** Styling lives in `apps/desktop-tauri/src/App.css`. Class names use the `fo-*` prefix.
- **Tabs are first-class even though there's one today.** Reach `PanelTabState` through `activeTab(panel)` rather than `panel.tabs.main`.

## Tests

`packages/frontend/tests/`:

- `panelStore.test.ts` — exhaustive reducer/selector coverage (navigate, applyBatch, multi-select modes, sort/filter, parent URI math).
- `appShell.test.tsx` — Vitest + `@testing-library/react` renders against a mock `IpcTransport`, asserts that initial navigation triggers the right invokes and the shell renders entries from a stubbed batch.

Run with `pnpm --filter @fileoctopus/frontend test`.
