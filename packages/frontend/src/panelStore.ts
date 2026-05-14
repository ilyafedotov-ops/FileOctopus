import type { DirectoryBatchEventDto, FileEntryDto } from "@fileoctopus/ts-api";

export type PanelId = "left" | "right";
export type SortField = "name" | "type" | "size" | "modified";
export type SortDirection = "asc" | "desc";

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
  loading: boolean;
  error: string | null;
  filter: string;
  sort: SortState;
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
  | { type: "navigate"; panelId: PanelId; uri: string }
  | { type: "startSession"; panelId: PanelId; sessionId: string }
  | { type: "applyBatch"; batch: DirectoryBatchEventDto }
  | { type: "setSelection"; panelId: PanelId; entryId: string | null }
  | {
      type: "selectEntry";
      panelId: PanelId;
      entryId: string;
      mode: "single" | "toggle" | "range";
    }
  | { type: "moveSelection"; panelId: PanelId; delta: number }
  | { type: "setLoading"; panelId: PanelId; loading: boolean }
  | { type: "setError"; panelId: PanelId; error: string | null }
  | { type: "setFilter"; panelId: PanelId; filter: string }
  | { type: "setSort"; panelId: PanelId; field: SortField };

const defaultSort: SortState = {
  field: "name",
  direction: "asc",
  directoriesFirst: true,
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

export function panelReducer(
  state: FileOctopusState,
  action: PanelAction,
): FileOctopusState {
  switch (action.type) {
    case "setActivePanel":
      return {
        ...state,
        activePanelId: action.panelId,
      };
    case "navigate":
      return updatePanel(state, action.panelId, (tab) => ({
        ...tab,
        uri: normalizeLocalInput(action.uri),
        entriesById: {},
        orderedEntryIds: [],
        selectedIds: [],
        selectedId: null,
        focusedId: null,
        anchorId: null,
        sessionId: null,
        loading: true,
        error: null,
      }));
    case "startSession":
      return updatePanel(state, action.panelId, (tab) => ({
        ...tab,
        sessionId: action.sessionId,
        loading: true,
        error: null,
      }));
    case "applyBatch":
      return applyBatch(state, action.batch);
    case "setSelection":
      return updatePanel(state, action.panelId, (tab) => ({
        ...tab,
        selectedIds: action.entryId ? [action.entryId] : [],
        selectedId: action.entryId,
        focusedId: action.entryId,
        anchorId: action.entryId,
      }));
    case "selectEntry":
      return updatePanel(state, action.panelId, (tab) =>
        selectEntry(tab, action.entryId, action.mode),
      );
    case "moveSelection":
      return updatePanel(state, action.panelId, (tab) =>
        moveSelection(tab, action.delta),
      );
    case "setLoading":
      return updatePanel(state, action.panelId, (tab) => ({
        ...tab,
        loading: action.loading,
      }));
    case "setError":
      return updatePanel(state, action.panelId, (tab) => ({
        ...tab,
        error: action.error,
        loading: false,
      }));
    case "setFilter":
      return updatePanel(state, action.panelId, (tab) => ({
        ...tab,
        filter: action.filter,
      }));
    case "setSort":
      return updatePanel(state, action.panelId, (tab) => {
        const direction =
          tab.sort.field === action.field && tab.sort.direction === "asc"
            ? "desc"
            : "asc";

        return {
          ...tab,
          sort: {
            ...tab.sort,
            field: action.field,
            direction,
          },
        };
      });
    default:
      return state;
  }
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
        loading: false,
        error: null,
        filter: "",
        sort: defaultSort,
      },
    },
  };
}

function updatePanel(
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

function applyBatch(
  state: FileOctopusState,
  batch: DirectoryBatchEventDto,
): FileOctopusState {
  const target = findPanelBySession(state, batch.sessionId);

  if (!target) {
    return state;
  }

  const error = batch.error?.message ?? null;

  return updatePanel(state, target, (tab) => {
    const entriesById = { ...tab.entriesById };
    const orderedEntryIds = [...tab.orderedEntryIds];

    for (const entry of batch.entries) {
      if (!entriesById[entry.uri]) {
        orderedEntryIds.push(entry.uri);
      }

      entriesById[entry.uri] = entry;
    }

    const retainedSelection = tab.selectedIds.filter((id) => entriesById[id]);
    const firstId =
      retainedSelection[0] ?? tab.selectedId ?? orderedEntryIds[0] ?? null;

    return {
      ...tab,
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
      loading: batch.isComplete ? false : tab.loading,
      error,
    };
  });
}

function selectEntry(
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

function moveSelection(tab: PanelTabState, delta: number): PanelTabState {
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

function homeUri(): string {
  const storage = globalThis.localStorage;
  const home =
    storage && typeof storage.getItem === "function"
      ? storage.getItem("fileoctopus.homeUri")
      : null;

  return home || "local:///Users/ilya";
}

function documentsUri(): string {
  return `${homeUri()}/Documents`;
}
