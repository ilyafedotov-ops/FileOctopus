import { useCallback, useRef } from "react";
import type { FileOperationPlanDto } from "@fileoctopus/ts-api";
import {
  activeTab,
  parentUri,
  type FileOctopusState,
  type PanelId,
} from "../panelStore";

export interface OperationRefreshTargetSet {
  folderUris: string[];
  removedEntryUris: string[];
}

export interface UseOperationRefreshTargetsParams {
  state: FileOctopusState;
  refreshPanel: (
    panelId: PanelId,
    options?: {
      replace?: boolean;
      includeHidden?: boolean;
      softRefresh?: boolean;
      backgroundRefresh?: boolean;
    },
  ) => void;
  refreshVisiblePanels: (options?: {
    replace?: boolean;
    softRefresh?: boolean;
    backgroundRefresh?: boolean;
  }) => void;
}

export function useOperationRefreshTargets({
  state,
  refreshPanel,
  refreshVisiblePanels,
}: UseOperationRefreshTargetsParams) {
  const operationRefreshTargetsRef = useRef(
    new Map<string, OperationRefreshTargetSet>(),
  );

  const registerOperationRefresh = useCallback(
    (jobId: string, plan: FileOperationPlanDto) => {
      const folderUris = new Set<string>();
      const removedEntryUris: string[] = [];
      const addParent = (uri: string | null | undefined) => {
        if (!uri) {
          return;
        }
        folderUris.add(parentUri(uri) ?? uri);
      };
      const addDestination = () => {
        addParent(plan.destination);
      };
      const addSources = () => {
        for (const source of plan.sources) {
          addParent(source);
        }
      };

      switch (plan.kind) {
        case "copy":
        case "createArchive":
        case "extractArchive":
        case "createDirectory":
        case "createFile":
        case "writeTextFile":
          addDestination();
          break;
        case "move":
          addSources();
          addDestination();
          break;
        case "deleteToTrash":
        case "deletePermanently":
          for (const source of plan.sources) {
            removedEntryUris.push(source);
            addParent(source);
          }
          break;
        default:
          addSources();
          addDestination();
          break;
      }

      operationRefreshTargetsRef.current.set(jobId, {
        folderUris: [...folderUris],
        removedEntryUris,
      });
    },
    [],
  );

  const takeOperationRefreshTargets = useCallback((jobId: string) => {
    const targets = operationRefreshTargetsRef.current.get(jobId) ?? null;
    operationRefreshTargetsRef.current.delete(jobId);
    return targets;
  }, []);

  const refreshOperationTargets = useCallback(
    (targets: string[] | null, options?: { fullReload?: boolean }) => {
      const fullReload = options?.fullReload === true;
      const refreshOptions = {
        replace: true,
        softRefresh: !fullReload,
        backgroundRefresh: !fullReload,
      };
      const folderUris = targets ?? null;
      const panelIds = (["left", "right"] as const).filter((panelId) => {
        const tab = activeTab(state.panels[panelId]);
        return folderUris?.includes(tab.uri);
      });

      if (panelIds.length === 0) {
        refreshVisiblePanels(refreshOptions);
        return;
      }

      for (const panelId of panelIds) {
        refreshPanel(panelId, refreshOptions);
      }
    },
    [refreshPanel, refreshVisiblePanels, state.panels],
  );

  return {
    registerOperationRefresh,
    takeOperationRefreshTargets,
    refreshOperationTargets,
  };
}
