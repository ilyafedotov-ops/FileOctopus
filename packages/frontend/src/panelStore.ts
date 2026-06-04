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
export type TabKind = "directory" | "preview" | "editor";

export interface SortState {
  field: SortField;
  direction: SortDirection;
  directoriesFirst: boolean;
}

export interface PanelTabState {
  tabKind: TabKind;
  uri: string;
  previewEntry: FileEntryDto | null;
  editorEntry: FileEntryDto | null;
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
  backgroundListing: {
    requestId: string;
    sessionId: string | null;
    entriesById: Record<string, FileEntryDto>;
    orderedEntryIds: string[];
  } | null;
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
      backgroundRefresh?: boolean;
    }
  | { type: "goBack"; panelId: PanelId }
  | { type: "goForward"; panelId: PanelId }
  | {
      type: "startRequest";
      panelId: PanelId;
      requestId: string;
      backgroundRefresh?: boolean;
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
  | { type: "openPreviewTab"; panelId: PanelId; entry: FileEntryDto }
  | { type: "openEditorTab"; panelId: PanelId; entry: FileEntryDto }
  | { type: "closeTab"; panelId: PanelId; tabId: string }
  | { type: "switchTab"; panelId: PanelId; tabId: string }
  | {
      type: "setArchiveEntries";
      panelId: PanelId;
      uri: string;
      entries: FileEntryDto[];
    }
  | { type: "removeEntries"; uris: string[] };

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
        tabKind: "directory",
        uri,
        previewEntry: null,
        editorEntry: null,
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
        backgroundListing: null,
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
    backgroundRefresh?: boolean;
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
      backgroundListing: null,
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
    tabKind: "directory",
    uri,
    previewEntry: null,
    editorEntry: null,
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
    backgroundListing: null,
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
      backgroundListing:
        current.backgroundListing?.requestId === batch.requestId
          ? null
          : current.backgroundListing,
    }));
  }

  return updatePanel(state, target, (current) => {
    const backgroundListing =
      current.backgroundListing?.requestId === batch.requestId
        ? current.backgroundListing
        : null;
    const entriesById = {
      ...(backgroundListing?.entriesById ?? current.entriesById),
    };
    const orderedEntryIds = [
      ...(backgroundListing?.orderedEntryIds ?? current.orderedEntryIds),
    ];

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

    if (backgroundListing && !batch.isComplete) {
      return {
        ...current,
        backgroundListing: {
          ...backgroundListing,
          entriesById,
          orderedEntryIds,
        },
        error: batch.error?.message ?? null,
        errorCode: batch.error?.code ?? null,
      };
    }

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
      backgroundListing:
        backgroundListing && batch.isComplete
          ? null
          : current.backgroundListing,
    };
  });
}

export function removeEntriesFromState(
  state: FileOctopusState,
  uris: string[],
): FileOctopusState {
  if (uris.length === 0) {
    return state;
  }

  const uriSet = new Set(uris);
  const panels = (Object.keys(state.panels) as PanelId[]).reduce(
    (nextPanels, panelId) => {
      const panel = state.panels[panelId];
      const tabs = Object.entries(panel.tabs).reduce(
        (nextTabs, [tabId, tab]) => {
          const hasRemoved = tab.orderedEntryIds.some((id) => uriSet.has(id));
          if (!hasRemoved) {
            nextTabs[tabId] = tab;
            return nextTabs;
          }

          const entriesById = { ...tab.entriesById };
          for (const uri of uris) {
            delete entriesById[uri];
          }

          const orderedEntryIds = tab.orderedEntryIds.filter(
            (id) => !uriSet.has(id),
          );
          const selectedIds = tab.selectedIds.filter((id) => !uriSet.has(id));
          const firstId = selectedIds[0] ?? orderedEntryIds[0] ?? null;

          nextTabs[tabId] = {
            ...tab,
            entriesById,
            orderedEntryIds,
            selectedIds,
            selectedId:
              tab.selectedId && uriSet.has(tab.selectedId)
                ? firstId
                : tab.selectedId,
            focusedId:
              tab.focusedId && uriSet.has(tab.focusedId)
                ? firstId
                : tab.focusedId,
            anchorId:
              tab.anchorId && uriSet.has(tab.anchorId) ? firstId : tab.anchorId,
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
    const tab = activeTab(state.panels[panelId]);
    if (
      tab.sessionId === sessionId ||
      tab.backgroundListing?.sessionId === sessionId
    ) {
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
