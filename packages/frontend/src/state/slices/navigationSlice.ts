import type { FileOctopusState, PanelAction } from "../../panelStore";
import {
  applyNavigation,
  normalizeLocalInput,
  updatePanel,
} from "../../panelStore";

type NavigationAction = Extract<
  PanelAction,
  | { type: "setActivePanel" }
  | { type: "navigate" }
  | { type: "goBack" }
  | { type: "goForward" }
>;

export function isNavigationAction(
  action: PanelAction,
): action is NavigationAction {
  return (
    action.type === "setActivePanel" ||
    action.type === "navigate" ||
    action.type === "goBack" ||
    action.type === "goForward"
  );
}

export function reduceNavigation(
  state: FileOctopusState,
  action: NavigationAction,
): FileOctopusState {
  switch (action.type) {
    case "setActivePanel":
      return {
        ...state,
        activePanelId: action.panelId,
      };
    case "navigate":
      return updatePanel(state, action.panelId, (tab) =>
        applyNavigation(tab, normalizeLocalInput(action.uri), {
          replace: action.replace,
          softRefresh: action.softRefresh,
          backgroundRefresh: action.backgroundRefresh,
        }),
      );
    case "goBack":
      return updatePanel(state, action.panelId, (tab) => {
        const uri = tab.backStack[tab.backStack.length - 1];
        if (!uri) {
          return tab;
        }
        return applyNavigation(tab, uri, {
          replace: true,
          backStack: tab.backStack.slice(0, -1),
          forwardStack: [tab.uri, ...tab.forwardStack],
        });
      });
    case "goForward":
      return updatePanel(state, action.panelId, (tab) => {
        const [uri, ...rest] = tab.forwardStack;
        if (!uri) {
          return tab;
        }
        return applyNavigation(tab, uri, {
          replace: true,
          backStack: [...tab.backStack, tab.uri],
          forwardStack: rest,
        });
      });
    default:
      return state;
  }
}
