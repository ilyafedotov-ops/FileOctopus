import type { Dispatch, SetStateAction } from "react";
import type {
  AppDataHealthResponse,
  AppInfoResponse,
  AutostartStatusDto,
  FavoriteEntryDto,
  FileEntryDto,
  FolderSizeCompletedEventDto,
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
  activeTab,
  normalizeLocalInput,
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
import { operationErrorMessage } from "../dialogs/OperationDialogView";
import { mergeToast } from "../toastNotifications";
import { localPathFromUri } from "../utils/paneUtils";
import { createRequestId, loadStateFromBatchError } from "../paneTypes";
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
  setDialog: Dispatch<SetStateAction<OperationDialog | null>>;
  setHistory: Dispatch<SetStateAction<OperationHistoryRecordDto[]>>;
  setAppInfo: Dispatch<SetStateAction<AppInfoResponse | null>>;
  setAppHealth: Dispatch<SetStateAction<AppDataHealthResponse | null>>;
  setDiagnosticsMessage: Dispatch<SetStateAction<string | null>>;
  setExportingDiagnostics: Dispatch<SetStateAction<boolean>>;
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
  setDialog,
  setHistory,
  setAppInfo,
  setAppHealth,
  setDiagnosticsMessage,
  setExportingDiagnostics,
}: UseEventHandlersParams) {
  // ── openExternal (used by activateEntry) ─────────────────────────
  async function openExternal(entry: FileEntryDto) {
    setOperationError(null);
    try {
      await client.fs.openPathWithDefaultApp({ uri: entry.uri });
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setOperationError(
        operationErrorMessage(normalized.code, normalized.message),
      );
    }
  }

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

  async function navigatePanel(
    panelId: PanelId,
    input: string,
    options: {
      replace?: boolean;
      includeHidden?: boolean;
      softRefresh?: boolean;
    } = {},
  ) {
    const uri = normalizeLocalInput(input);
    const tab = activeTab(state.panels[panelId]);

    if (!uri.startsWith("local://")) {
      dispatch({
        type: "setPaneError",
        panelId,
        error: "Enter a local:// URI or absolute path",
        errorCode: "invalid_uri",
        loadState: "error",
      });
      return;
    }

    dispatch({
      type: "navigate",
      panelId,
      uri,
      replace: options.replace,
      softRefresh: options.softRefresh,
    });
    if (!options.softRefresh) {
      setSearch((current) =>
        current?.panelId === panelId ? { ...current, result: null } : current,
      );
    }

    await startListing(panelId, uri, options.includeHidden ?? tab.showHidden);
    if (!options.softRefresh) {
      void client.navigation
        .recordVisit({ uri, label: localPathFromUri(uri) })
        .then(() => refreshNavigation())
        .catch(() => undefined);
    }
  }

  async function refreshNavigation() {
    try {
      const [favoriteResponse, todayResponse, weekResponse, starredResponse] =
        await Promise.all([
          client.navigation.listFavorites(),
          client.navigation.listRecent({ bucket: "today" }),
          client.navigation.listRecent({ bucket: "thisWeek" }),
          client.navigation.listStarred(),
        ]);
      setFavorites(favoriteResponse.favorites);
      setRecentToday(todayResponse.entries);
      setRecentWeek(weekResponse.entries);
      setStarred(starredResponse.entries);
    } catch (error) {
      setOperationError(normalizeIpcError(error).message);
    }
  }

  async function startListing(
    panelId: PanelId,
    uri: string,
    includeHidden: boolean,
  ) {
    const requestId = createRequestId();

    try {
      const response = await client.fs.listStart({
        uri,
        requestId,
        panelId,
        batchSize: 256,
        includeHidden,
      });

      dispatch({
        type: "startSession",
        panelId,
        sessionId: response.sessionId,
        requestId: response.requestId,
      });
    } catch (error) {
      const normalized = normalizeIpcError(error);
      dispatch({
        type: "setPaneError",
        panelId,
        error: normalized.message,
        errorCode: normalized.code,
        loadState: loadStateFromBatchError(normalized),
      });
    }
  }

  async function goHistory(panelId: PanelId, direction: "back" | "forward") {
    const tab = activeTab(state.panels[panelId]);
    const uri =
      direction === "back"
        ? tab.backStack[tab.backStack.length - 1]
        : tab.forwardStack[0];

    if (!uri) {
      return;
    }

    dispatch({ type: direction === "back" ? "goBack" : "goForward", panelId });
    await startListing(panelId, uri, tab.showHidden);
  }

  function refreshPanel(
    panelId: PanelId,
    options: {
      replace?: boolean;
      includeHidden?: boolean;
      softRefresh?: boolean;
    } = {},
  ) {
    const tab = activeTab(state.panels[panelId]);

    void navigatePanel(panelId, tab.uri, {
      replace: options.replace ?? true,
      includeHidden: options.includeHidden ?? tab.showHidden,
      softRefresh: options.softRefresh ?? false,
    });
  }

  async function refreshLocations() {
    try {
      const response = await client.fs.standardLocations();
      setLocations(response.locations);
    } catch (error) {
      setOperationError(normalizeIpcError(error).message);
    }
  }

  function activateEntry(panelId: PanelId, entry: FileEntryDto | null) {
    if (!entry) {
      return;
    }

    if (entry.kind === "directory") {
      void navigatePanel(panelId, entry.uri);
      return;
    }

    void openExternal(entry);
  }

  function refreshVisiblePanels() {
    refreshPanel("left");
    refreshPanel("right");
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
      if (
        current?.type !== "properties" ||
        current.folderSizeJobId !== event.jobId ||
        !current.properties
      ) {
        return current;
      }

      return {
        ...current,
        loading: false,
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
    activateEntry,
    refreshVisiblePanels,
    refreshHistory,
    refreshDiagnostics,
    applyFolderSizeCompleted,
    applyRecursiveSearchMatch,
    applyRecursiveSearchCompleted,
    clearHistory,
    exportDiagnostics,
  };
}
