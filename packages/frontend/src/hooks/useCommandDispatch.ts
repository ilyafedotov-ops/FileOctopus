import { useCallback } from "react";
import type { PanelId } from "../panelStore";
import {
  dispatchCommand,
  type CommandDispatchDeps,
} from "../commands/dispatch";
import {
  normalizeCommandContext,
  type CommandInvokeArg,
} from "../commands/invokeContext";

export function useCommandDispatch(deps: CommandDispatchDeps) {
  return useCallback(
    (id: string, panelId?: PanelId, context?: CommandInvokeArg) => {
      deps.setCommandPaletteOpen(false);
      const activePanelId = panelId ?? deps.state.activePanelId;

      if (id === "filter") {
        deps.setFilterFocusToken((value) => value + 1);
        return;
      }

      if (id === "recursive-search" || id === "search-recursive") {
        deps.setRecursiveSearchFocusToken((value) => value + 1);
        return;
      }

      const invoke = normalizeCommandContext(context);
      dispatchCommand(id, deps, {
        panelId: activePanelId,
        ...invoke,
      });
    },
    [deps],
  );
}
