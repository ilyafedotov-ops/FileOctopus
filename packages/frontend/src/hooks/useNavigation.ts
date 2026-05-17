import type { Dispatch, SetStateAction } from "react";
import {
  createFileOctopusClient,
  normalizeIpcError,
} from "@fileoctopus/ts-api";
import type {
  AppDataHealthResponse,
  AppInfoResponse,
  FavoriteEntryDto,
  FileEntryDto,
  FolderSizeCompletedEventDto,
  OperationHistoryRecordDto,
  RecursiveSearchCompletedEventDto,
  RecursiveSearchMatchEventDto,
  RecentEntryDto,
  StandardLocationDto,
  StarredEntryDto,
} from "@fileoctopus/ts-api";
import {
  activeTab,
  normalizeLocalInput,
  type FileOctopusState,
  type PanelAction,
  type PanelId,
} from "../panelStore";
import { createRequestId, loadStateFromBatchError } from "../paneTypes";
import { localPathFromUri } from "../utils/paneUtils";
import { operationErrorMessage } from "../dialogs/OperationDialogView";
import type { OperationDialog } from "../dialogs/OperationDialogView";
import type { SearchState } from "../pane/PaneFilterBar";

interface UseNavigationDeps {
  client: ReturnType<typeof createFileOctopusClient>;
  state: FileOctopusState;
  dispatch: Dispatch<PanelAction>;
  setSearch: Dispatch<SetStateAction<SearchState | null>>;
  setDialog: Dispatch<SetStateAction<OperationDialog | null>>;
  setFavorites: (favorites: FavoriteEntryDto[]) => void;
  setRecentToday: (entries: RecentEntryDto[]) => void;
  setRecentWeek: (entries: RecentEntryDto[]) => void;
  setStarred: (entries: StarredEntryDto[]) => void;
  setLocations: (locations: StandardLocationDto[]) => void;
  setHistory: (ops: OperationHistoryRecordDto[]) => void;
  setOperationError: (error: string | null) => void;
  setAppInfo: (info: AppInfoResponse | null) => void;
  setAppHealth: (health: AppDataHealthResponse | null) => void;
  setDiagnosticsMessage: (msg: string | null) => void;
  setExportingDiagnostics: (val: boolean) => void;
  diagnosticsDestination: string;
}

export function useNavigation(deps: UseNavigationDeps) {
  const {
    client,
    state,
    dispatch,
    setSearch,
    setDialog,
    setFavorites,
    setRecentToday,
    setRecentWeek,
    setStarred,
    setLocations,
    setHistory,
    setOperationError,
    setAppInfo,
    setAppHealth,
    setDiagnosticsMessage,
    setExportingDiagnostics,
    diagnosticsDestination,
  } = deps;

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
    navigatePanel,
    refreshNavigation,
    startListing,
    goHistory,
    refreshPanel,
    refreshLocations,
    activateEntry,
    refreshVisiblePanels,
    refreshHistory,
    clearHistory,
    refreshDiagnostics,
    exportDiagnostics,
    applyFolderSizeCompleted,
    applyRecursiveSearchMatch,
    applyRecursiveSearchCompleted,
  };
}
