import type {
  FileOctopusState,
  PanelAction,
  PanelTabState,
} from "../../panelStore";
import { storedSort, storedShowHidden } from "../../panelStore";
import type { HashState } from "../../pane/hashUtils";

type TabAction = Extract<
  PanelAction,
  { type: "openTab" } | { type: "closeTab" } | { type: "switchTab" }
>;

export function isTabAction(action: PanelAction): action is TabAction {
  return (
    action.type === "openTab" ||
    action.type === "closeTab" ||
    action.type === "switchTab"
  );
}

function canCloneListing(source: PanelTabState, uri: string): boolean {
  return (
    source.uri === uri &&
    (source.loadState === "loaded" || source.loadState === "empty")
  );
}

function createFreshTab(uri: string, source?: PanelTabState): PanelTabState {
  const cloneListing = source ? canCloneListing(source, uri) : false;

  return {
    uri,
    entriesById: cloneListing && source ? source.entriesById : {},
    orderedEntryIds: cloneListing && source ? source.orderedEntryIds : [],
    selectedIds: [],
    selectedId: null,
    focusedId: null,
    anchorId: null,
    sessionId: null,
    activeRequestId: null,
    loadState: cloneListing && source ? source.loadState : "loading",
    error: null,
    errorCode: null,
    filter: "",
    recursiveQuery: "",
    sort: source?.sort ?? storedSort(),
    viewMode: source?.viewMode ?? "details",
    showHidden: source?.showHidden ?? storedShowHidden(),
    backStack: [],
    forwardStack: [],
    hashMap:
      cloneListing && source
        ? source.hashMap
        : ({} as Record<string, HashState>),
  };
}

let _tabCounter = 0;
function generateTabId(): string {
  _tabCounter += 1;
  return `tab-${Date.now()}-${_tabCounter}`;
}

export function reduceTab(
  state: FileOctopusState,
  action: TabAction,
): FileOctopusState {
  switch (action.type) {
    case "openTab": {
      const panel = state.panels[action.panelId];
      const tabId = generateTabId();
      const newTab = createFreshTab(action.uri, panel.tabs[panel.activeTabId]);
      return {
        ...state,
        panels: {
          ...state.panels,
          [action.panelId]: {
            ...panel,
            activeTabId: tabId,
            tabs: {
              ...panel.tabs,
              [tabId]: newTab,
            },
          },
        },
      };
    }
    case "switchTab": {
      const panel = state.panels[action.panelId];
      if (!panel.tabs[action.tabId]) return state;
      return {
        ...state,
        panels: {
          ...state.panels,
          [action.panelId]: {
            ...panel,
            activeTabId: action.tabId,
          },
        },
      };
    }
    case "closeTab": {
      const panel = state.panels[action.panelId];
      const tabIds = Object.keys(panel.tabs);
      if (tabIds.length <= 1) return state;
      if (!panel.tabs[action.tabId]) return state;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [action.tabId]: _removed, ...remainingTabs } = panel.tabs;

      let newActiveTabId: string = panel.activeTabId;
      if (panel.activeTabId === action.tabId) {
        const idx = tabIds.indexOf(action.tabId);
        newActiveTabId = idx > 0 ? tabIds[idx - 1] : tabIds[idx + 1];
      }

      return {
        ...state,
        panels: {
          ...state.panels,
          [action.panelId]: {
            ...panel,
            activeTabId: newActiveTabId,
            tabs: remainingTabs,
          },
        },
      };
    }
    default:
      return state;
  }
}
