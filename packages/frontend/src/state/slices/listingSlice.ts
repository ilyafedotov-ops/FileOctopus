import type { FileEntryDto } from "@fileoctopus/ts-api";
import type { FileOctopusState, PanelAction } from "../../panelStore";
import { applyBatch, updatePanel } from "../../panelStore";
type ListingAction = Extract<
  PanelAction,
  | { type: "startRequest" }
  | { type: "startSession" }
  | { type: "applyBatch" }
  | { type: "setPaneError" }
  | { type: "setArchiveEntries" }
>;

export function isListingAction(action: PanelAction): action is ListingAction {
  return (
    action.type === "startSession" ||
    action.type === "startRequest" ||
    action.type === "applyBatch" ||
    action.type === "setPaneError" ||
    action.type === "setArchiveEntries"
  );
}

export function reduceListing(
  state: FileOctopusState,
  action: ListingAction,
): FileOctopusState {
  switch (action.type) {
    case "startRequest":
      return updatePanel(state, action.panelId, (tab) => ({
        ...tab,
        sessionId: null,
        activeRequestId: action.requestId,
        loadState: "loading",
        error: null,
        errorCode: null,
      }));
    case "startSession":
      return updatePanel(state, action.panelId, (tab) => ({
        ...tab,
        sessionId: action.sessionId,
        activeRequestId: action.requestId,
        loadState:
          tab.activeRequestId === action.requestId &&
          tab.loadState !== "loading"
            ? tab.loadState
            : "loading",
        error:
          tab.activeRequestId === action.requestId &&
          tab.loadState !== "loading"
            ? tab.error
            : null,
        errorCode:
          tab.activeRequestId === action.requestId &&
          tab.loadState !== "loading"
            ? tab.errorCode
            : null,
      }));
    case "applyBatch":
      return applyBatch(state, action.batch);
    case "setPaneError":
      return updatePanel(state, action.panelId, (tab) => ({
        ...tab,
        error: action.error,
        errorCode: action.errorCode ?? null,
        loadState: action.loadState ?? (action.error ? "error" : tab.loadState),
      }));
    case "setArchiveEntries":
      return setArchiveEntriesReducer(
        state,
        action.panelId,
        action.uri,
        action.entries,
      );
    default:
      return state;
  }
}

function setArchiveEntriesReducer(
  state: FileOctopusState,
  panelId: "left" | "right",
  uri: string,
  entries: FileEntryDto[],
): FileOctopusState {
  const tab = state.panels[panelId].tabs[state.panels[panelId].activeTabId];
  const changed = uri !== tab.uri;
  const backStack = changed ? [...tab.backStack, tab.uri] : tab.backStack;
  const entriesById: Record<string, FileEntryDto> = {};
  const orderedEntryIds: string[] = [];
  for (const entry of entries) {
    entriesById[entry.uri] = entry;
    orderedEntryIds.push(entry.uri);
  }
  const firstId = orderedEntryIds[0] ?? null;
  return updatePanel(state, panelId, (current) => ({
    ...current,
    uri,
    entriesById,
    orderedEntryIds,
    selectedIds: firstId ? [firstId] : [],
    selectedId: firstId,
    focusedId: null,
    anchorId: null,
    sessionId: null,
    activeRequestId: null,
    loadState: "loaded" as const,
    error: null,
    errorCode: null,
    filter: "",
    backStack,
    forwardStack: changed ? [] : current.forwardStack,
  }));
}
