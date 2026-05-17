import { useCallback } from "react";
import {
  dispatchCommand,
  type CommandDispatchDeps,
} from "../commands/dispatch";

export function useCommandDispatch(
  deps: CommandDispatchDeps & {
    setCommandPaletteOpen: (open: boolean) => void;
  },
) {
  return useCallback(
    (id: string) => {
      deps.setCommandPaletteOpen(false);
      const panelId = deps.state.activePanelId;

      if (id === "switch-pane") {
        deps.dispatch({
          type: "setActivePanel",
          panelId: panelId === "left" ? "right" : "left",
        });
        return;
      }

      if (id === "filter") {
        deps.setFilterFocusToken((value) => value + 1);
        return;
      }

      dispatchCommand(id, deps);
    },
    [deps],
  );
}
