import type { Dispatch, SetStateAction } from "react";
import type {
  AppDataHealthResponse,
  AppInfoResponse,
  AutostartStatusDto,
  FavoriteEntryDto,
  FolderSizeCompletedEventDto,
  NetworkConnectionStatusDto,
  NetworkProfileDto,
  OperationHistoryRecordDto,
  RecentEntryDto,
  RecursiveSearchCompletedEventDto,
  RecursiveSearchMatchEventDto,
  StandardLocationDto,
  StarredEntryDto,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
import { normalizeIpcError, type FileOctopusClient } from "@fileoctopus/ts-api";
import {
  type FileOctopusState,
  type PanelAction,
  type PanelId,
} from "../panelStore";
import {
  applyAllPreferences,
  applyDensityPreference,
  applyLayoutPreferences,
  type DensityPreference,
} from "../applyPreferences";
import type { SearchState } from "../pane/PaneFilterBar";
import type { ToastMessage } from "../components/ToastStack";
import type { OperationDialog } from "../dialogs/OperationDialogView";
import { mergeToast } from "../toastNotifications";
import { createRequestId } from "../paneTypes";
import { createNavigationController } from "../navigation/navigationController";

export interface UseEventHandlersParams {
  client: FileOctopusClient;
  state: FileOctopusState;
  dispatch: Dispatch<PanelAction>;
  diagnosticsDestination: string;
  setToasts: Dispatch<SetStateAction<ToastMessage[]>>;
  setPreferences: Dispatch<SetStateAction<UserPreferencesDto | null>>;
  setDensity: Dispatch<SetStateAction<DensityPreference>>;
  setActivityCollapsed: Dispatch<SetStateAction<boolean>>;
  setOperationError: Dispatch<SetStateAction<string | null>>;
  setSearch: Dispatch<SetStateAction<SearchState | null>>;
  setAutostart: Dispatch<SetStateAction<AutostartStatusDto | null>>;
  setFavorites: Dispatch<SetStateAction<FavoriteEntryDto[]>>;
  setRecentToday: Dispatch<SetStateAction<RecentEntryDto[]>>;
  setRecentWeek: Dispatch<SetStateAction<RecentEntryDto[]>>;
  setStarred: Dispatch<SetStateAction<StarredEntryDto[]>>;
  setLocations: Dispatch<SetStateAction<StandardLocationDto[]>>;
  setNetworkProfiles: Dispatch<SetStateAction<NetworkProfileDto[]>>;
  setNetworkStatuses: Dispatch<SetStateAction<NetworkConnectionStatusDto[]>>;
  setDialog: Dispatch<SetStateAction<OperationDialog | null>>;
  setHistory: Dispatch<SetStateAction<OperationHistoryRecordDto[]>>;
  setAppInfo: Dispatch<SetStateAction<AppInfoResponse | null>>;
  setAppHealth: Dispatch<SetStateAction<AppDataHealthResponse | null>>;
  setDiagnosticsMessage: Dispatch<SetStateAction<string | null>>;
  setExportingDiagnostics: Dispatch<SetStateAction<boolean>>;
  syncTerminalCwd?: (panelId: PanelId, uri: string) => void;
}

export function useEventHandlers({
  client,
  state,
  dispatch,
  diagnosticsDestination,
  setToasts,
  setPreferences,
  setDensity,
  setActivityCollapsed,
  setOperationError,
  setSearch,
  setAutostart,
  setFavorites,
  setRecentToday,
  setRecentWeek,
  setStarred,
  setLocations,
  setNetworkProfiles,
  setNetworkStatuses,
  setDialog,
  setHistory,
  setAppInfo,
  setAppHealth,
  setDiagnosticsMessage,
  setExportingDiagnostics,
  syncTerminalCwd,
}: UseEventHandlersParams) {
  const navigation = createNavigationController({
    client,
    state,
    dispatch,
    setSearch,
    setFavorites,
    setRecentToday,
    setRecentWeek,
    setStarred,
    setOperationError,
    syncTerminalCwd,
  });

  const {
    openExternal,
    navigatePanel,
    refreshNavigation,
    startListing,
    goHistory,
    refreshPanel,
    refreshVisiblePanels,
    activateEntry,
  } = navigation;

  function pushToast(toast: Omit<ToastMessage, "id">) {
    let toastId = createRequestId();
    setToasts((current) => {
      const merged = mergeToast(current, toast, createRequestId);
      toastId = merged.toastId;
      return merged.toasts;
    });
    globalThis.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== toastId));
    }, 6000);
  }

  async function updatePreference(key: string, value: string) {
    try {
      const response = await client.preferences.set({ key, value });
      setPreferences(response.preferences);
      applyAllPreferences(response.preferences);
      applyLayoutPreferences(response.preferences);
      setDensity(applyDensityPreference(response.preferences.density));
      if (key === "activityPanelVisible") {
        setActivityCollapsed(!response.preferences.activityPanelVisible);
      }
      if (key === "showHiddenFiles") {
        refreshVisiblePanels();
      }
    } catch (error) {
      setOperationError(normalizeIpcError(error).message);
    }
  }

  async function handleSetAutostart(enabled: boolean) {
    try {
      const status = await client.autostart.set(enabled);
      setAutostart(status);
    } catch {
      // ignore — checkbox stays in previous state
    }
  }

  async function refreshNetworkProfiles() {
    try {
      const [profilesResponse, statusResponse] = await Promise.all([
        client.network.listProfiles(),
        client.network.connectionStatus(),
      ]);
      setNetworkProfiles(profilesResponse.profiles);
      setNetworkStatuses(statusResponse.statuses);
    } catch (error) {
      setOperationError(normalizeIpcError(error).message);
    }
  }

  async function refreshLocations() {
    try {
      const response = await client.fs.standardLocations();
      setLocations(response.locations);
    } catch (error) {
      setOperationError(normalizeIpcError(error).message);
    }
  }

  async function refreshHistory() {
    try {
      const response = await client.operationHistory.listRecentOperations({
        limit: 20,
      });
      setHistory(response.operations);
    } catch (error) {
      setOperationError(normalizeIpcError(error).message);
    }
  }

  async function refreshDiagnostics() {
    try {
      const [info, health] = await Promise.all([
        client.getAppInfo(),
        client.diagnostics.appDataHealth(),
      ]);

      setAppInfo(info);
      setAppHealth(health);
    } catch (error) {
      setOperationError(normalizeIpcError(error).message);
    }
  }

  function applyFolderSizeCompleted(event: FolderSizeCompletedEventDto) {
    setDialog((current) => {
      if (current?.type === "selectionProperties") {
        if (!current.folderSizeJobIds.includes(event.jobId)) {
          return current;
        }

        const pendingFolderSizeJobs = current.pendingFolderSizeJobs - 1;
        const folderSizeBytes =
          current.folderSizeBytes + event.summary.totalSize;

        if (pendingFolderSizeJobs > 0) {
          return {
            ...current,
            pendingFolderSizeJobs,
            folderSizeBytes,
          };
        }

        return {
          ...current,
          pendingFolderSizeJobs: 0,
          calculatingSize: false,
          folderSizeBytes,
          totalSize: current.fileSizeBaseline + folderSizeBytes,
        };
      }

      if (current?.type !== "properties" || !current.properties) {
        return current;
      }

      const matchesJob = current.folderSizeJobId === event.jobId;
      const matchesPendingFolder =
        current.loading &&
        current.properties.uri === event.uri &&
        (current.folderSizeJobId === null ||
          current.folderSizeJobId === event.jobId);

      if (!matchesJob && !matchesPendingFolder) {
        return current;
      }

      return {
        ...current,
        loading: false,
        folderSizeJobId: event.jobId,
        properties: {
          ...current.properties,
          totalSize: event.summary.totalSize,
          itemCount: event.summary.itemCount,
          fileCount: event.summary.fileCount,
          directoryCount: event.summary.directoryCount,
          warnings: event.summary.warnings,
        },
      };
    });
  }

  function applyRecursiveSearchMatch(event: RecursiveSearchMatchEventDto) {
    setSearch((current) => {
      if (!current || current.jobId !== event.jobId) {
        return current;
      }

      const matches = current.result?.matches ?? [];

      if (matches.some((item) => item.uri === event.item.uri)) {
        return current;
      }

      return {
        ...current,
        result: {
          matches: [...matches, event.item],
          warnings: current.result?.warnings ?? [],
          incomplete: current.result?.incomplete ?? false,
        },
      };
    });
  }

  function applyRecursiveSearchCompleted(
    event: RecursiveSearchCompletedEventDto,
  ) {
    setSearch((current) => {
      if (!current || current.jobId !== event.jobId) {
        return current;
      }

      return {
        ...current,
        running: false,
        result: event.result,
        error: null,
      };
    });
  }

  async function clearHistory() {
    try {
      await client.operationHistory.clearOperationHistory();
      await refreshHistory();
    } catch (error) {
      setOperationError(normalizeIpcError(error).message);
    }
  }

  async function exportDiagnostics() {
    if (!diagnosticsDestination.trim()) {
      setDiagnosticsMessage("Enter a diagnostics bundle destination.");
      return;
    }

    setExportingDiagnostics(true);
    setDiagnosticsMessage(null);

    try {
      const response = await client.diagnostics.exportBundle({
        destination: diagnosticsDestination.trim(),
      });

      setDiagnosticsMessage(`Exported ${response.files.length} file(s).`);
    } catch (error) {
      setDiagnosticsMessage(normalizeIpcError(error).message);
    } finally {
      setExportingDiagnostics(false);
    }
  }

  return {
    pushToast,
    updatePreference,
    handleSetAutostart,
    navigatePanel,
    refreshNavigation,
    startListing,
    goHistory,
    refreshPanel,
    refreshLocations,
    refreshNetworkProfiles,
    activateEntry,
    refreshVisiblePanels,
    refreshHistory,
    refreshDiagnostics,
    applyFolderSizeCompleted,
    applyRecursiveSearchMatch,
    applyRecursiveSearchCompleted,
    clearHistory,
    exportDiagnostics,
    openExternal,
  };
}
