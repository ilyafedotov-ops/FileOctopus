import type { FileEntryDto } from "@fileoctopus/ts-api";
import type {
  FileOctopusState,
  PanelAction,
  PanelId,
  PanelTabState,
} from "../../panelStore";
import {
  applyBatch,
  findTabByRequest,
  removeEntriesFromState,
  renameEntryInState,
  updatePanel,
  updatePanelTab,
} from "../../panelStore";
type ListingAction = Extract<
  PanelAction,
  | { type: "startRequest" }
  | { type: "startSession" }
  | { type: "applyBatch" }
  | { type: "renameEntry" }
  | { type: "removeEntries" }
  | { type: "setPaneError" }
  | { type: "setArchiveEntries" }
>;

export function isListingAction(action: PanelAction): action is ListingAction {
  return (
    action.type === "startSession" ||
    action.type === "startRequest" ||
    action.type === "applyBatch" ||
    action.type === "renameEntry" ||
    action.type === "removeEntries" ||
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
        loadState: action.backgroundRefresh ? tab.loadState : "loading",
        error: null,
        errorCode: null,
        backgroundListing: action.backgroundRefresh
          ? {
              requestId: action.requestId,
              sessionId: null,
              entriesById: {},
              orderedEntryIds: [],
            }
          : null,
      }));
    case "startSession":
      return updateRequestTab(
        state,
        action.panelId,
        action.requestId,
        (tab) => ({
          ...tab,
          sessionId: action.sessionId,
          activeRequestId: action.requestId,
          backgroundListing:
            tab.backgroundListing?.requestId === action.requestId
              ? {
                  ...tab.backgroundListing,
                  sessionId: action.sessionId,
                }
              : tab.backgroundListing,
          loadState: tab.loadState !== "loading" ? tab.loadState : "loading",
          error: tab.loadState !== "loading" ? tab.error : null,
          errorCode: tab.loadState !== "loading" ? tab.errorCode : null,
        }),
      );
    case "applyBatch":
      return applyBatch(state, action.batch);
    case "removeEntries":
      return removeEntriesFromState(state, action.uris);
    case "renameEntry":
      return renameEntryInState(
        state,
        action.oldUri,
        action.newUri,
        action.name,
      );
    case "setPaneError":
      return action.requestId
        ? updateRequestTab(state, action.panelId, action.requestId, (tab) => ({
            ...tab,
            activeRequestId: null,
            sessionId: null,
            error: action.error,
            errorCode: action.errorCode ?? null,
            loadState:
              action.loadState ?? (action.error ? "error" : tab.loadState),
          }))
        : updatePanel(state, action.panelId, (tab) => ({
            ...tab,
            error: action.error,
            errorCode: action.errorCode ?? null,
            loadState:
              action.loadState ?? (action.error ? "error" : tab.loadState),
          }));
    case "setArchiveEntries":
      return setArchiveEntriesReducer(
        state,
        action.panelId,
        action.requestId,
        action.uri,
        action.entries,
      );
    default:
      return state;
  }
}

function setArchiveEntriesReducer(
  state: FileOctopusState,
  panelId: PanelId,
  requestId: string | undefined,
  uri: string,
  entries: FileEntryDto[],
): FileOctopusState {
  const entriesById: Record<string, FileEntryDto> = {};
  const orderedEntryIds: string[] = [];
  for (const entry of entries) {
    entriesById[entry.uri] = entry;
    orderedEntryIds.push(entry.uri);
  }
  const firstId = orderedEntryIds[0] ?? null;
  const update = (current: PanelTabState): PanelTabState => ({
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
    backStack:
      uri !== current.uri
        ? [...current.backStack, current.uri]
        : current.backStack,
    forwardStack: uri !== current.uri ? [] : current.forwardStack,
    backgroundListing: null,
  });
  return requestId
    ? updateRequestTab(state, panelId, requestId, update)
    : updatePanel(state, panelId, update);
}

function updateRequestTab(
  state: FileOctopusState,
  panelId: PanelId,
  requestId: string,
  update: (tab: PanelTabState) => PanelTabState,
): FileOctopusState {
  const target = findTabByRequest(state, requestId);
  if (!target || target.panelId !== panelId) {
    return state;
  }
  return updatePanelTab(state, target.panelId, target.tabId, update);
}
