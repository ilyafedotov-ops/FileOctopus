import { useCallback } from "react";
import type { PanelId } from "../panelStore";
import {
  dispatchCommand,
  type CommandDispatchDeps,
} from "../commands/dispatch";

export function useCommandDispatch(deps: CommandDispatchDeps) {
  return useCallback(
    (id: string, panelId?: PanelId) => {
      deps.setCommandPaletteOpen(false);
      const activePanelId = panelId ?? deps.state.activePanelId;

      if (id === "switch-pane") {
        deps.dispatch({
          type: "setActivePanel",
          panelId: deps.state.activePanelId === "left" ? "right" : "left",
        });
        return;
      }

      if (id === "filter") {
        deps.setFilterFocusToken((value) => value + 1);
        return;
      }

      dispatchCommand(id, deps, { panelId: activePanelId });
    },
    [deps],
  );
}
