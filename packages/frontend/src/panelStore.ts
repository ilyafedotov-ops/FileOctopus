import type { DirectoryBatchEventDto, FileEntryDto } from "@fileoctopus/ts-api";
import type { HashState } from "./pane/hashUtils";
import {
  type PaneLoadState,
  shouldApplyBatch,
  terminalLoadState,
} from "./paneTypes";
import { parentUri as resolveParentUri } from "./utils/paneUtils";
import {
  isParentDirectoryUri,
  prependParentDirectoryEntry,
} from "./utils/parentEntry";

export type { PaneLoadState } from "./paneTypes";

import { compareEntries } from "./paneSort";
import {
  storedShowHidden,
  storedSort,
  homeUri,
  documentsUri,
} from "./panelStorage";
export { storedShowHidden, storedSort, homeUri, documentsUri };
export type PanelId = "left" | "right";
export type SortField =
  | "name"
  | "type"
  | "size"
  | "modified"
  | "created"
  | "extension"
  | "permissions"
  | "owner";
export type SortDirection = "asc" | "desc";
export type ViewMode = "details" | "list" | "compact" | "icons" | "columns";

export interface SortState {
  field: SortField;
  direction: SortDirection;
  directoriesFirst: boolean;
}

export interface PanelTabState {
  uri: string;
  entriesById: Record<string, FileEntryDto>;
  orderedEntryIds: string[];
  selectedIds: string[];
  selectedId: string | null;
  focusedId: string | null;
  anchorId: string | null;
  sessionId: string | null;
  activeRequestId: string | null;
  loadState: PaneLoadState;
  error: string | null;
  errorCode: string | null;
  filter: string;
  recursiveQuery: string;
  sort: SortState;
  viewMode: ViewMode;
  showHidden: boolean;
  backStack: string[];
  forwardStack: string[];
  hashMap: Record<string, HashState>;
}

export interface PanelState {
  id: PanelId;
  activeTabId: string;
  tabs: Record<string, PanelTabState>;
}

export interface FileOctopusState {
  activePanelId: PanelId;
  panels: Record<PanelId, PanelState>;
}

export type PanelAction =
  | { type: "setActivePanel"; panelId: PanelId }
  | {
      type: "navigate";
      panelId: PanelId;
      uri: string;
      replace?: boolean;
      softRefresh?: boolean;
    }
  | { type: "goBack"; panelId: PanelId }
  | { type: "goForward"; panelId: PanelId }
  | {
      type: "startRequest";
      panelId: PanelId;
      requestId: string;
    }
  | {
      type: "startSession";
      panelId: PanelId;
      sessionId: string;
      requestId: string;
    }
  | { type: "applyBatch"; batch: DirectoryBatchEventDto }
  | {
      type: "renameEntry";
      oldUri: string;
      newUri: string;
      name: string;
    }
  | { type: "setSelection"; panelId: PanelId; entryId: string | null }
  | { type: "selectAll"; panelId: PanelId }
  | { type: "invertSelection"; panelId: PanelId }
  | { type: "clearSelection"; panelId: PanelId }
  | {
      type: "selectEntry";
      panelId: PanelId;
      entryId: string;
      mode: "single" | "toggle" | "range";
    }
  | { type: "moveSelection"; panelId: PanelId; delta: number }
  | {
      type: "setPaneError";
      panelId: PanelId;
      error: string | null;
      errorCode?: string | null;
      loadState?: PaneLoadState;
    }
  | { type: "setFilter"; panelId: PanelId; filter: string }
  | { type: "setRecursiveQuery"; panelId: PanelId; query: string }
  | { type: "setSort"; panelId: PanelId; field: SortField }
  | { type: "setViewMode"; panelId: PanelId; viewMode: ViewMode }
  | { type: "toggleHidden"; panelId: PanelId }
  | {
      type: "hydratePreferences";
      showHidden: boolean;
      viewMode: ViewMode;
    }
  | {
      type: "setHash";
      panelId: PanelId;
      entryId: string;
      hashState: HashState;
    }
  | { type: "swapPanes" }
  | { type: "openTab"; panelId: PanelId; uri: string }
  | { type: "closeTab"; panelId: PanelId; tabId: string }
  | { type: "switchTab"; panelId: PanelId; tabId: string }
  | {
      type: "setArchiveEntries";
      panelId: PanelId;
      uri: string;
      entries: FileEntryDto[];
    };

export function createInitialState(
  leftUri = homeUri(),
  rightUri = documentsUri(),
): FileOctopusState {
  return {
    activePanelId: "left",
    panels: {
      left: createPanel("left", leftUri),
      right: createPanel("right", rightUri),
    },
  };
}

import { reducePanelAction } from "./state/paneReducer";

export function panelReducer(
  state: FileOctopusState,
  action: PanelAction,
): FileOctopusState {
  if (action.type === "swapPanes") {
    return {
      ...state,
      panels: {
        left: state.panels.right,
        right: state.panels.left,
      },
    };
  }
  return reducePanelAction(state, action);
}

export function activeTab(panel: PanelState): PanelTabState {
  return panel.tabs[panel.activeTabId];
}

export function selectVisibleEntries(tab: PanelTabState): FileEntryDto[] {
  const filter = tab.filter.trim().toLowerCase();
  const entries = tab.orderedEntryIds
    .map((id) => tab.entriesById[id])
    .filter((entry) => !filter || entry.name.toLowerCase().includes(filter));

  return entries.sort((left, right) => compareEntries(left, right, tab.sort));
}

export function selectDisplayedEntries(tab: PanelTabState): FileEntryDto[] {
  return prependParentDirectoryEntry(tab.uri, selectVisibleEntries(tab));
}

export function countVisibleEntries(tab: PanelTabState): number {
  return selectVisibleEntries(tab).length;
}

export function operationalSelectionIds(tab: PanelTabState): string[] {
  return tab.selectedIds.filter((id) => Boolean(tab.entriesById[id]));
}

export function countOperationalSelection(tab: PanelTabState): number {
  return operationalSelectionIds(tab).length;
}

export function normalizeLocalInput(input: string): string {
  const value = input.trim();

  if (value.includes("://")) {
    return value;
  }

  if (value.startsWith("/")) {
    return `local://${value}`;
  }

  if (/^[A-Za-z]:[\\/]/.test(value)) {
    return `local://${value.replace(/\\/g, "/")}`;
  }

  return value;
}

export function normalizeUriInput(input: string): string {
  return normalizeLocalInput(input);
}

export function parentUri(uri: string): string | null {
  return resolveParentUri(uri);
}

function createPanel(id: PanelId, uri: string): PanelState {
  return {
    id,
    activeTabId: "main",
    tabs: {
      main: {
        uri,
        entriesById: {},
        orderedEntryIds: [],
        selectedIds: [],
        selectedId: null,
        focusedId: null,
        anchorId: null,
        sessionId: null,
        activeRequestId: null,
        loadState: "idle",
        error: null,
        errorCode: null,
        filter: "",
        recursiveQuery: "",
        sort: storedSort(),
        viewMode: "details",
        showHidden: storedShowHidden(),
        backStack: [],
        forwardStack: [],
        hashMap: {},
      },
    },
  };
}

export function applyNavigation(
  tab: PanelTabState,
  uri: string,
  options: {
    replace?: boolean;
    softRefresh?: boolean;
    backStack?: string[];
    forwardStack?: string[];
  } = {},
): PanelTabState {
  const changed = uri !== tab.uri;

  if (options.softRefresh && !changed && tab.loadState !== "error") {
    return {
      ...tab,
      sessionId: null,
      activeRequestId: null,
    };
  }

  const backStack =
    options.backStack ??
    (!options.replace && changed ? [...tab.backStack, tab.uri] : tab.backStack);
  const forwardStack =
    options.forwardStack ??
    (!options.replace && changed ? [] : tab.forwardStack);

  return {
    ...tab,
    uri,
    entriesById: {},
    orderedEntryIds: [],
    selectedIds: [],
    selectedId: null,
    focusedId: null,
    anchorId: null,
    sessionId: null,
    activeRequestId: null,
    loadState: "loading",
    error: null,
    errorCode: null,
    filter: "",
    backStack,
    forwardStack,
  };
}

export function updatePanel(
  state: FileOctopusState,
  panelId: PanelId,
  update: (tab: PanelTabState) => PanelTabState,
): FileOctopusState {
  const panel = state.panels[panelId];
  const tab = activeTab(panel);

  return {
    ...state,
    panels: {
      ...state.panels,
      [panelId]: {
        ...panel,
        tabs: {
          ...panel.tabs,
          [panel.activeTabId]: update(tab),
        },
      },
    },
  };
}

export function applyBatch(
  state: FileOctopusState,
  batch: DirectoryBatchEventDto,
): FileOctopusState {
  const target =
    findPanelBySession(state, batch.sessionId) ??
    findPanelByRequest(state, batch.requestId);

  if (!target) {
    return state;
  }

  const tab = activeTab(state.panels[target]);

  if (!shouldApplyBatch(tab.activeRequestId, batch)) {
    return state;
  }

  if (batch.error && batch.isComplete) {
    return updatePanel(state, target, (current) => ({
      ...current,
      loadState: terminalLoadState(0, batch.error),
      error: batch.error?.message ?? "Failed to load directory",
      errorCode: batch.error?.code ?? null,
    }));
  }

  return updatePanel(state, target, (current) => {
    const entriesById = { ...current.entriesById };
    const orderedEntryIds = [...current.orderedEntryIds];

    for (const entry of batch.entries) {
      if (!entriesById[entry.uri]) {
        orderedEntryIds.push(entry.uri);
      }

      entriesById[entry.uri] = entry;
    }

    const retainedSelection = current.selectedIds.filter(
      (id) => entriesById[id],
    );
    const firstId =
      retainedSelection[0] ?? current.selectedId ?? orderedEntryIds[0] ?? null;

    const loadState = batch.isComplete
      ? terminalLoadState(orderedEntryIds.length, batch.error)
      : "loading";

    return {
      ...current,
      entriesById,
      orderedEntryIds,
      selectedIds:
        retainedSelection.length > 0
          ? retainedSelection
          : firstId
            ? [firstId]
            : [],
      selectedId: firstId,
      focusedId: firstId,
      loadState,
      error: batch.error?.message ?? null,
      errorCode: batch.error?.code ?? null,
    };
  });
}

export function renameEntryInState(
  state: FileOctopusState,
  oldUri: string,
  newUri: string,
  name: string,
): FileOctopusState {
  const panels = (Object.keys(state.panels) as PanelId[]).reduce(
    (nextPanels, panelId) => {
      const panel = state.panels[panelId];
      const tabs = Object.entries(panel.tabs).reduce(
        (nextTabs, [tabId, tab]) => {
          const entry = tab.entriesById[oldUri];
          if (!entry) {
            nextTabs[tabId] = tab;
            return nextTabs;
          }

          const entriesById = { ...tab.entriesById };
          delete entriesById[oldUri];
          entriesById[newUri] = {
            ...entry,
            uri: newUri,
            name,
            extension:
              entry.kind === "directory" ? null : extensionFromName(name),
          };

          const replaceId = (id: string | null) =>
            id === oldUri ? newUri : id;
          nextTabs[tabId] = {
            ...tab,
            entriesById,
            orderedEntryIds: tab.orderedEntryIds.map((id) =>
              id === oldUri ? newUri : id,
            ),
            selectedIds: tab.selectedIds.map((id) =>
              id === oldUri ? newUri : id,
            ),
            selectedId: replaceId(tab.selectedId),
            focusedId: replaceId(tab.focusedId),
            anchorId: replaceId(tab.anchorId),
          };
          return nextTabs;
        },
        {} as PanelState["tabs"],
      );

      nextPanels[panelId] = {
        ...panel,
        tabs,
      };
      return nextPanels;
    },
    {} as FileOctopusState["panels"],
  );

  return {
    ...state,
    panels,
  };
}

function extensionFromName(name: string): string | null {
  const index = name.lastIndexOf(".");
  if (index <= 0 || index === name.length - 1) {
    return null;
  }
  return name.slice(index);
}

export function selectEntry(
  tab: PanelTabState,
  entryId: string,
  mode: "single" | "toggle" | "range",
): PanelTabState {
  if (mode === "single") {
    return {
      ...tab,
      selectedIds: [entryId],
      selectedId: entryId,
      focusedId: entryId,
      anchorId: entryId,
    };
  }

  if (mode === "toggle") {
    if (isParentDirectoryUri(entryId, tab.uri)) {
      return selectEntry(tab, entryId, "single");
    }

    const selected = new Set(
      tab.selectedIds.filter((id) => !isParentDirectoryUri(id, tab.uri)),
    );

    if (selected.has(entryId)) {
      selected.delete(entryId);
    } else {
      selected.add(entryId);
    }

    const selectedIds = [...selected];

    return {
      ...tab,
      selectedIds,
      selectedId: selectedIds[0] ?? null,
      focusedId: entryId,
      anchorId: entryId,
    };
  }

  const visible = selectDisplayedEntries(tab)
    .map((entry) => entry.uri)
    .filter((id) => !isParentDirectoryUri(id, tab.uri));
  const anchor = tab.anchorId ?? tab.focusedId ?? entryId;
  const anchorIndex = visible.indexOf(anchor);
  const entryIndex = visible.indexOf(entryId);

  if (anchorIndex < 0 || entryIndex < 0) {
    return selectEntry(tab, entryId, "single");
  }

  const start = Math.min(anchorIndex, entryIndex);
  const end = Math.max(anchorIndex, entryIndex);
  const selectedIds = visible.slice(start, end + 1);

  if (selectedIds.length === 0) {
    return selectEntry(tab, entryId, "single");
  }

  return {
    ...tab,
    selectedIds,
    selectedId: selectedIds[0] ?? null,
    focusedId: entryId,
    anchorId: anchor,
  };
}

function findPanelBySession(
  state: FileOctopusState,
  sessionId: string,
): PanelId | null {
  for (const panelId of Object.keys(state.panels) as PanelId[]) {
    if (activeTab(state.panels[panelId]).sessionId === sessionId) {
      return panelId;
    }
  }

  return null;
}

function findPanelByRequest(
  state: FileOctopusState,
  requestId: string,
): PanelId | null {
  const trimmed = requestId.trim();

  if (!trimmed) {
    return null;
  }

  for (const panelId of Object.keys(state.panels) as PanelId[]) {
    if (activeTab(state.panels[panelId]).activeRequestId === trimmed) {
      return panelId;
    }
  }

  return null;
}

export function moveSelection(
  tab: PanelTabState,
  delta: number,
): PanelTabState {
  const visible = selectDisplayedEntries(tab);

  if (visible.length === 0) {
    return {
      ...tab,
      selectedId: null,
      focusedId: null,
    };
  }

  const currentIndex = Math.max(
    0,
    visible.findIndex(
      (entry) => entry.uri === tab.focusedId || entry.uri === tab.selectedId,
    ),
  );
  const nextIndex = Math.min(
    Math.max(currentIndex + delta, 0),
    visible.length - 1,
  );
  const nextId = visible[nextIndex].uri;

  return {
    ...tab,
    selectedIds: [nextId],
    selectedId: nextId,
    focusedId: nextId,
    anchorId: nextId,
  };
}
