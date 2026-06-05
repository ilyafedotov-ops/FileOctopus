import type { Dispatch, SetStateAction } from "react";
import {
  isRemoteUri,
  isNetworkUri,
  isSupportedNavigationUri,
  normalizeIpcError,
  type FileOctopusClient,
} from "@fileoctopus/ts-api";
import type {
  FavoriteEntryDto,
  FileEntryDto,
  NetworkConnectionDraftDto,
  RecentEntryDto,
  StarredEntryDto,
} from "@fileoctopus/ts-api";
import {
  activeTab,
  normalizeUriInput,
  type FileOctopusState,
  type PanelAction,
  type PanelId,
} from "../panelStore";
import { createRequestId, loadStateFromBatchError } from "../paneTypes";
import { localPathFromUri } from "../utils/paneUtils";
import { isArchiveFile } from "../utils/archiveUtils";
import { operationErrorMessage } from "../dialogs/OperationDialogView";
import type { SearchState } from "../pane/PaneFilterBar";

export interface NavigationControllerDeps {
  client: FileOctopusClient;
  state: FileOctopusState;
  dispatch: Dispatch<PanelAction>;
  setSearch: Dispatch<SetStateAction<SearchState | null>>;
  setFavorites: Dispatch<SetStateAction<FavoriteEntryDto[]>>;
  setRecentToday: Dispatch<SetStateAction<RecentEntryDto[]>>;
  setRecentWeek: Dispatch<SetStateAction<RecentEntryDto[]>>;
  setStarred: Dispatch<SetStateAction<StarredEntryDto[]>>;
  setOperationError: Dispatch<SetStateAction<string | null>>;
  syncTerminalCwd?: (panelId: PanelId, uri: string) => void;
  onOpenConnectionWizard?: (prefill?: NetworkConnectionDraftDto) => void;
  openPreviewInOppositePane?: (
    sourcePanelId: PanelId,
    entry: FileEntryDto,
  ) => void;
}

export interface NavigateOptions {
  replace?: boolean;
  includeHidden?: boolean;
  softRefresh?: boolean;
  backgroundRefresh?: boolean;
}

export interface NavigationController {
  navigatePanel(
    panelId: PanelId,
    input: string,
    options?: NavigateOptions,
  ): Promise<void>;
  startListing(
    panelId: PanelId,
    uri: string,
    includeHidden: boolean,
  ): Promise<void>;
  goHistory(panelId: PanelId, direction: "back" | "forward"): Promise<void>;
  refreshPanel(panelId: PanelId, options?: NavigateOptions): void;
  refreshVisiblePanels(options?: NavigateOptions): void;
  refreshNavigation(): Promise<void>;
  activateEntry(panelId: PanelId, entry: FileEntryDto | null): void;
  openExternal(entry: FileEntryDto): Promise<void>;
}

export function createNavigationController(
  deps: NavigationControllerDeps,
): NavigationController {
  const {
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
    onOpenConnectionWizard,
    openPreviewInOppositePane,
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

  async function startListing(
    panelId: PanelId,
    uri: string,
    includeHidden: boolean,
    backgroundRefresh = false,
  ) {
    const requestId = createRequestId();
    dispatch({ type: "startRequest", panelId, requestId, backgroundRefresh });

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

  async function loadNetworkNeighborhood(panelId: PanelId, uri: string) {
    const requestId = createRequestId();
    dispatch({ type: "startRequest", panelId, requestId });
    try {
      const response = await client.network.discoverNeighborhood({ uri });
      dispatch({
        type: "setArchiveEntries",
        panelId,
        uri: response.uri,
        entries: response.entries,
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

  async function navigatePanel(
    panelId: PanelId,
    input: string,
    options: NavigateOptions = {},
  ) {
    const uri = normalizeUriInput(input);
    const tab = activeTab(state.panels[panelId]);

    if (!isSupportedNavigationUri(uri)) {
      dispatch({
        type: "setPaneError",
        panelId,
        error: "Enter a local path or supported remote URI (sftp://)",
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
      backgroundRefresh: options.backgroundRefresh,
    });
    if (!options.softRefresh) {
      setSearch((current) =>
        current?.panelId === panelId ? { ...current, result: null } : current,
      );
    }

    if (isNetworkUri(uri)) {
      await loadNetworkNeighborhood(panelId, uri);
    } else {
      await startListing(
        panelId,
        uri,
        options.includeHidden ?? tab.showHidden,
        options.backgroundRefresh ?? false,
      );
    }
    if (!options.softRefresh) {
      if (!isNetworkUri(uri)) {
        syncTerminalCwd?.(panelId, uri);
      }
      void client.navigation
        .recordVisit({
          uri,
          label: isRemoteUri(uri) ? uri : localPathFromUri(uri),
        })
        .then(() => refreshNavigation())
        .catch(() => undefined);
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
    if (isNetworkUri(uri)) {
      await loadNetworkNeighborhood(panelId, uri);
    } else {
      await startListing(panelId, uri, tab.showHidden);
    }
  }

  function refreshPanel(panelId: PanelId, options: NavigateOptions = {}) {
    const tab = activeTab(state.panels[panelId]);
    if (tab.tabKind !== "directory") {
      return;
    }

    void navigatePanel(panelId, tab.uri, {
      replace: options.replace ?? true,
      includeHidden: options.includeHidden ?? tab.showHidden,
      softRefresh: options.softRefresh ?? false,
      backgroundRefresh: options.backgroundRefresh ?? false,
    });
  }

  function refreshVisiblePanels(options: NavigateOptions = {}) {
    refreshPanel("left", options);
    refreshPanel("right", options);
  }

  function activateEntry(panelId: PanelId, entry: FileEntryDto | null) {
    if (!entry) {
      return;
    }

    if (entry.virtualKind === "addConnection") {
      onOpenConnectionWizard?.();
      return;
    }

    if (entry.status === "credentialsRequired" && entry.protocol) {
      onOpenConnectionWizard?.({
        scheme: entry.protocol,
        host: entry.name,
        label: entry.name,
        defaultPath: "/",
      });
      return;
    }

    const openUri = entry.targetUri ?? entry.uri;

    if (entry.kind === "directory") {
      void navigatePanel(panelId, openUri);
      return;
    }

    if (isArchiveFile(entry.name)) {
      void navigateArchive(panelId, entry);
      return;
    }

    if (openPreviewInOppositePane) {
      openPreviewInOppositePane(panelId, entry);
      return;
    }

    void openExternal(entry);
  }

  async function navigateArchive(panelId: PanelId, entry: FileEntryDto) {
    dispatch({ type: "navigate", panelId, uri: entry.uri });
    try {
      const response = await client.fs.listArchive({ uri: entry.uri });
      dispatch({
        type: "setArchiveEntries",
        panelId,
        uri: entry.uri,
        entries: response.entries,
      });
    } catch (error) {
      const normalized = normalizeIpcError(error);
      dispatch({
        type: "setPaneError",
        panelId,
        error: normalized.message,
        errorCode: normalized.code,
        loadState: "error",
      });
    }
  }

  return {
    navigatePanel,
    startListing,
    goHistory,
    refreshPanel,
    refreshVisiblePanels,
    refreshNavigation,
    activateEntry,
    openExternal,
  };
}
