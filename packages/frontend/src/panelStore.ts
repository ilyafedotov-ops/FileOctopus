import type { DirectoryBatchEventDto, FileEntryDto } from "@fileoctopus/ts-api";
import type { HashState } from "./pane/hashUtils";
import {
  type PaneLoadState,
  shouldApplyBatch,
  terminalLoadState,
} from "./paneTypes";

export type { PaneLoadState } from "./paneTypes";
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
      type: "startSession";
      panelId: PanelId;
      sessionId: string;
      requestId: string;
    }
  | { type: "applyBatch"; batch: DirectoryBatchEventDto }
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

export function normalizeLocalInput(input: string): string {
  const value = input.trim();

  if (value.startsWith("local://")) {
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

export function parentUri(uri: string): string | null {
  const path = uri.replace(/^local:\/\//, "");
  const normalized =
    path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path;
  const index = normalized.lastIndexOf("/");

  if (index <= 0) {
    return null;
  }

  return `local://${normalized.slice(0, index)}`;
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
        viewMode: storedViewMode(),
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
  const target = findPanelBySession(state, batch.sessionId);

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
    const selected = new Set(tab.selectedIds);

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

  const visible = selectVisibleEntries(tab).map((entry) => entry.uri);
  const anchor = tab.anchorId ?? tab.focusedId ?? entryId;
  const anchorIndex = visible.indexOf(anchor);
  const entryIndex = visible.indexOf(entryId);

  if (anchorIndex < 0 || entryIndex < 0) {
    return selectEntry(tab, entryId, "single");
  }

  const start = Math.min(anchorIndex, entryIndex);
  const end = Math.max(anchorIndex, entryIndex);
  const selectedIds = visible.slice(start, end + 1);

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

export function moveSelection(
  tab: PanelTabState,
  delta: number,
): PanelTabState {
  const visible = selectVisibleEntries(tab);

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

function compareEntries(
  left: FileEntryDto,
  right: FileEntryDto,
  sort: SortState,
): number {
  if (sort.directoriesFirst && left.kind !== right.kind) {
    if (left.kind === "directory") {
      return -1;
    }

    if (right.kind === "directory") {
      return 1;
    }
  }

  const direction = sort.direction === "asc" ? 1 : -1;
  const result = compareField(left, right, sort.field);

  return result * direction;
}

function compareField(
  left: FileEntryDto,
  right: FileEntryDto,
  field: SortField,
): number {
  switch (field) {
    case "type":
      return (
        left.kind.localeCompare(right.kind) ||
        left.name.localeCompare(right.name)
      );
    case "size":
      return (
        (left.size ?? -1) - (right.size ?? -1) ||
        left.name.localeCompare(right.name)
      );
    case "modified":
      return (
        dateValue(left.modifiedAt) - dateValue(right.modifiedAt) ||
        left.name.localeCompare(right.name)
      );
    case "created":
      return (
        dateValue(left.createdAt) - dateValue(right.createdAt) ||
        left.name.localeCompare(right.name)
      );
    case "extension":
      return (
        (left.extension ?? "").localeCompare(right.extension ?? "") ||
        left.name.localeCompare(right.name)
      );
    case "permissions":
      return (
        (left.permissions ?? "").localeCompare(right.permissions ?? "") ||
        left.name.localeCompare(right.name)
      );
    case "owner":
      return (
        (left.owner ?? "").localeCompare(right.owner ?? "") ||
        left.name.localeCompare(right.name)
      );
    case "name":
    default:
      return left.name.localeCompare(right.name, undefined, {
        numeric: true,
        sensitivity: "base",
      });
  }
}

function dateValue(value?: string | null): number {
  return value ? Date.parse(value) || 0 : 0;
}

function storedViewMode(): ViewMode {
  const value = readValue("fileoctopus.viewMode");

  return value === "list" ||
    value === "compact" ||
    value === "icons" ||
    value === "columns" ||
    value === "details"
    ? value
    : "details";
}

function storedShowHidden(): boolean {
  return readValue("fileoctopus.showHidden") === "true";
}

function storedSort(): SortState {
  const value = readJson<Partial<SortState>>("fileoctopus.sort");
  const field = value?.field;
  const direction = value?.direction;

  return {
    field:
      field === "type" ||
      field === "size" ||
      field === "modified" ||
      field === "created" ||
      field === "extension" ||
      field === "permissions" ||
      field === "owner"
        ? field
        : "name",
    direction: direction === "desc" ? "desc" : "asc",
    directoriesFirst: true,
  };
}

function readValue(key: string): string | null {
  const storage = globalThis.localStorage;

  return storage && typeof storage.getItem === "function"
    ? storage.getItem(key)
    : null;
}

function readJson<T>(key: string): T | null {
  const value = readValue(key);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function homeUri(): string {
  const home = readValue("fileoctopus.homeUri");

  if (home) return home;

  const platform = typeof navigator !== "undefined" ? navigator.platform : "";
  if (platform.startsWith("Linux")) {
    return "local:///home/ilya";
  }
  if (platform.startsWith("Win")) {
    return "local:///C:/Users/ilya";
  }
  return "local:///Users/ilya";
}

function documentsUri(): string {
  return `${homeUri()}/Documents`;
}
