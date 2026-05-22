import type { FileOctopusState, PanelAction } from "../../panelStore";
import { applyBatch, updatePanel } from "../../panelStore";
type ListingAction = Extract<
  PanelAction,
  | { type: "startRequest" }
  | { type: "startSession" }
  | { type: "applyBatch" }
  | { type: "setPaneError" }
>;

export function isListingAction(action: PanelAction): action is ListingAction {
  return (
    action.type === "startSession" ||
    action.type === "startRequest" ||
    action.type === "applyBatch" ||
    action.type === "setPaneError"
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
    default:
      return state;
  }
}
