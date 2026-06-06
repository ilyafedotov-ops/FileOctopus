import { useEffect, type Dispatch } from "react";
import type { FileOctopusClient } from "@fileoctopus/ts-api";
import {
  activeTab,
  selectVisibleEntries,
  type FileOctopusState,
  type PanelAction,
  type PanelTabState,
} from "../panelStore";

export interface UseSelectedFileHashParams {
  client: FileOctopusClient;
  state: FileOctopusState;
  left: PanelTabState;
  right: PanelTabState;
  dispatch: Dispatch<PanelAction>;
}

export function useSelectedFileHash({
  client,
  state,
  left,
  right,
  dispatch,
}: UseSelectedFileHashParams) {
  useEffect(() => {
    const panelId = state.activePanelId;
    const tab = activeTab(state.panels[panelId]);
    const selectedEntry =
      selectVisibleEntries(tab).find((e) => e.uri === tab.selectedId) ?? null;

    if (
      !selectedEntry ||
      selectedEntry.kind === "directory" ||
      tab.hashMap[selectedEntry.uri] !== undefined
    ) {
      return;
    }

    const uri = selectedEntry.uri;
    let disposed = false;

    dispatch({
      type: "setHash",
      panelId,
      entryId: uri,
      hashState: "computing",
    });

    void client.fs
      .computeHash({ uri, algorithm: "sha256" })
      .then((res) => {
        if (!disposed) {
          dispatch({
            type: "setHash",
            panelId,
            entryId: uri,
            hashState: res.hash,
          });
        }
      })
      .catch(() => {
        if (!disposed) {
          dispatch({
            type: "setHash",
            panelId,
            entryId: uri,
            hashState: "error",
          });
        }
      });

    return () => {
      disposed = true;
    };
  }, [
    client,
    state.activePanelId,
    left.hashMap,
    right.hashMap,
    left.selectedId,
    right.selectedId,
    left.uri,
    right.uri,
    left.orderedEntryIds.length,
    right.orderedEntryIds.length,
    dispatch,
  ]);
}
