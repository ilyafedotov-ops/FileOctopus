import type {
  FileOctopusState,
  PanelAction,
  PanelId,
  SortDirection,
  ViewMode,
} from "../../panelStore";
import { activeTab, updatePanel } from "../../panelStore";

type SortFilterAction = Extract<
  PanelAction,
  | { type: "setFilter" }
  | { type: "setRecursiveQuery" }
  | { type: "setSort" }
  | { type: "setViewMode" }
  | { type: "toggleHidden" }
  | { type: "hydratePreferences" }
  | { type: "setHash" }
>;

export function isSortFilterAction(
  action: PanelAction,
): action is SortFilterAction {
  return (
    action.type === "setFilter" ||
    action.type === "setRecursiveQuery" ||
    action.type === "setSort" ||
    action.type === "setViewMode" ||
    action.type === "toggleHidden" ||
    action.type === "hydratePreferences" ||
    action.type === "setHash"
  );
}

function persistJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function persistValue(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function reduceSortFilter(
  state: FileOctopusState,
  action: SortFilterAction,
): FileOctopusState {
  switch (action.type) {
    case "setFilter":
      return updatePanel(state, action.panelId, (tab) => ({
        ...tab,
        filter: action.filter,
      }));
    case "setRecursiveQuery":
      return updatePanel(state, action.panelId, (tab) => ({
        ...tab,
        recursiveQuery: action.query,
      }));
    case "setSort":
      return updatePanel(state, action.panelId, (tab) => {
        const direction: SortDirection =
          tab.sort.field === action.field && tab.sort.direction === "asc"
            ? "desc"
            : "asc";
        const sort = {
          ...tab.sort,
          field: action.field,
          direction,
        };
        persistJson("fileoctopus.sort", sort);
        return {
          ...tab,
          sort,
        };
      });
    case "setViewMode":
      persistValue("fileoctopus.viewMode", action.viewMode);
      return updatePanel(state, action.panelId, (tab) => ({
        ...tab,
        viewMode: action.viewMode,
      }));
    case "toggleHidden":
      return updatePanel(state, action.panelId, (tab) => {
        const showHidden = !tab.showHidden;
        persistValue("fileoctopus.showHidden", String(showHidden));
        return {
          ...tab,
          showHidden,
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
        };
      });
    case "hydratePreferences":
      persistValue("fileoctopus.viewMode", action.viewMode);
      persistValue("fileoctopus.showHidden", String(action.showHidden));
      return {
        ...state,
        panels: (Object.keys(state.panels) as PanelId[]).reduce(
          (panels, panelId) => {
            const panel = state.panels[panelId];
            panels[panelId] = {
              ...panel,
              tabs: {
                ...panel.tabs,
                [panel.activeTabId]: {
                  ...activeTab(panel),
                  showHidden: action.showHidden,
                  viewMode: action.viewMode,
                },
              },
            };
            return panels;
          },
          { ...state.panels },
        ),
      };
    case "setHash":
      return updatePanel(state, action.panelId, (tab) => ({
        ...tab,
        hashMap: {
          ...tab.hashMap,
          [action.entryId]: action.hashState,
        },
      }));
    default:
      return state;
  }
}

export type { ViewMode };
