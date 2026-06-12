import { useEffect, type Dispatch } from "react";
import { normalizeIpcError, type FileOctopusClient } from "@fileoctopus/ts-api";
import {
  activeTab,
  type FileOctopusState,
  type PanelAction,
  type PanelId,
  type PanelTabState,
} from "../panelStore";

export interface UseFileSystemWatchersParams {
  client: FileOctopusClient;
  state: FileOctopusState;
  left: PanelTabState;
  right: PanelTabState;
  dispatch: Dispatch<PanelAction>;
  refreshPanel: (
    panelId: PanelId,
    options?: {
      replace?: boolean;
      includeHidden?: boolean;
      softRefresh?: boolean;
      backgroundRefresh?: boolean;
    },
  ) => void;
}

export function useFileSystemWatchers({
  client,
  state,
  left,
  right,
  dispatch,
  refreshPanel,
}: UseFileSystemWatchersParams) {
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let disposed = false;
    client.fs
      .onDirectoryBatch((event) => {
        dispatch({ type: "applyBatch", batch: event });
      })
      .then((value) => {
        if (disposed) {
          value();
          return;
        }
        unlisten = value;
      })
      .catch((error) => {
        const normalized = normalizeIpcError(error);
        dispatch({
          type: "setPaneError",
          panelId: "left",
          error: normalized.message,
          errorCode: normalized.code,
          loadState: "error",
        });
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [client, dispatch]);

  useEffect(() => {
    const activePanelId = state.activePanelId;
    const tab = activeTab(state.panels[activePanelId]);
    const activeUri = tab.uri;

    if (tab.tabKind !== "directory" || !activeUri.startsWith("local://")) {
      return;
    }

    void client.fs.startWatching({ uri: activeUri }).catch(() => undefined);

    return () => {
      void client.fs.stopWatching().catch(() => undefined);
    };
  }, [
    client,
    state.activePanelId,
    state.panels.left.activeTabId,
    left.tabKind,
    left.uri,
    state.panels.right.activeTabId,
    right.tabKind,
    right.uri,
  ]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let disposed = false;
    const activePanelId = state.activePanelId;
    const tab = activeTab(state.panels[activePanelId]);
    const activeUri = tab.uri;

    if (tab.tabKind !== "directory") {
      return;
    }

    client.fs
      .onWatchChanged((event) => {
        if (event.uri === activeUri) {
          refreshPanel(activePanelId, {
            replace: true,
            softRefresh: true,
            backgroundRefresh: true,
          });
        }
      })
      .then((value) => {
        if (disposed) {
          value();
          return;
        }
        unlisten = value;
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [
    client,
    state.activePanelId,
    state.panels.left.activeTabId,
    left.tabKind,
    left.uri,
    state.panels.right.activeTabId,
    right.tabKind,
    right.uri,
    refreshPanel,
  ]);
}
