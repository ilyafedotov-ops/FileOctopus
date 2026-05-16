import {
  Component,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  createFileOctopusClient,
  normalizeIpcError,
} from "@fileoctopus/ts-api";
import type {
  AppDataHealthResponse,
  AppInfoResponse,
  ConflictPolicy,
  FileEntryDto,
  FileOperationPlanDto,
  FileOperationKind,
  FolderSizeCompletedEventDto,
  PathPropertiesDto,
  RecursiveSearchCompletedEventDto,
  RecursiveSearchMatchEventDto,
  RecursiveSearchResultDto,
  StandardLocationDto,
  FavoriteEntryDto,
  RecentEntryDto,
  StarredEntryDto,
  JobCancelledEvent,
  JobCompletedEvent,
  JobFailedEvent,
  JobProgressEvent,
  JobSnapshot,
  JobStartedEvent,
  OperationHistoryRecordDto,
} from "@fileoctopus/ts-api";
import {
  activeTab,
  createInitialState,
  normalizeLocalInput,
  panelReducer,
  homeUri,
  parentUri,
  selectVisibleEntries,
  type PanelId,
  type PanelTabState,
  type SortField,
  type ViewMode,
} from "./panelStore";
import {
  applyAllPreferences,
  applyDensityPreference,
  applyLayoutPreferences,
  applySplitRatio,
  rowHeightForDensity,
  viewModeFromPreference,
  type DensityPreference,
} from "./applyPreferences";
import {
  BreadcrumbPath,
  Button,
  IconButton,
  Icons,
  SearchInput,
  SegmentedControl,
  cx,
} from "@fileoctopus/ui";
import { ActivityPanel } from "./activity/ActivityPanel";
import { ColumnsView } from "./pane/ColumnsView";
import { OperationToolbar } from "./pane/OperationToolbar";
import { FileTable } from "./pane/FileTable";
import { fileIconGlyph, formatDate, formatSize } from "./pane/fileTableUtils";
import {
  readDraggedUri,
  useFileOctopusDragTarget,
} from "./hooks/useFileOctopusDragTarget";
import { useWorkspaceLayout } from "./hooks/useWorkspaceLayout";
import { SidebarResizer, SplitResizer } from "./shell/LayoutResizers";
import { StatusBar } from "./shell/StatusBar";
import { TitleBar } from "./shell/TitleBar";
import { Sidebar } from "./sidebar/Sidebar";
import { DiagnosticsDialog } from "./components/DiagnosticsDialog";
import { ContextMenu, type ContextMenuState } from "./components/ContextMenu";
import { PaneStateView } from "./components/PaneStateView";
import { SettingsDialog } from "./components/SettingsDialog";
import { ShortcutsDialog } from "./components/ShortcutsDialog";
import { ToastStack, type ToastMessage } from "./components/ToastStack";
import { mergeToast } from "./toastNotifications";
import { useDialogEscape } from "./hooks/useDialogEscape";
import { createRequestId } from "./paneTypes";
import { isEditableTarget } from "./shortcuts";
import type { UserPreferencesDto } from "@fileoctopus/ts-api";

const SKIP_TRASH_CONFIRM_KEY = "fileoctopus.skipTrashConfirm";
const isProductionBuild = Boolean(
  (import.meta as ImportMeta & { env?: { PROD?: boolean } }).env?.PROD,
);

type CopyMoveKind = Extract<FileOperationKind, "copy" | "move">;

interface FileClipboardState {
  kind: CopyMoveKind;
  uris: string[];
  providerId: string;
  timestamp: number;
}

interface SearchState {
  panelId: PanelId;
  query: string;
  running: boolean;
  jobId: string | null;
  result: RecursiveSearchResultDto | null;
  error: string | null;
}

type OperationDialog =
  | {
      type: "createFolder";
      panelId: PanelId;
      name: string;
      error: string | null;
    }
  | {
      type: "createFile";
      panelId: PanelId;
      name: string;
      error: string | null;
    }
  | {
      type: "rename";
      panelId: PanelId;
      entry: FileEntryDto;
      name: string;
      error: string | null;
    }
  | {
      type: "copyMove";
      panelId: PanelId;
      kind: CopyMoveKind;
      entries: FileEntryDto[];
      destination: string;
      conflictPolicy: ConflictPolicy;
      plan: FileOperationPlanDto | null;
      planning: boolean;
      step: "review" | "confirm-overwrite";
      error: string | null;
    }
  | {
      type: "trash";
      panelId: PanelId;
      entries: FileEntryDto[];
      dontAskAgain: boolean;
      error: string | null;
    }
  | {
      type: "permanentDelete";
      panelId: PanelId;
      entries: FileEntryDto[];
      error: string | null;
    }
  | {
      type: "properties";
      panelId: PanelId;
      entry: FileEntryDto | null;
      properties: PathPropertiesDto | null;
      loading: boolean;
      folderSizeJobId: string | null;
      error: string | null;
    };

export function FileOctopusShell() {
  const client = useMemo(() => createFileOctopusClient(), []);
  const hasInitializedRef = useRef(false);
  const [state, dispatch] = useReducer(panelReducer, undefined, () =>
    createInitialState(),
  );
  const [jobs, setJobs] = useState<Record<string, JobSnapshot>>({});
  const [history, setHistory] = useState<OperationHistoryRecordDto[]>([]);
  const [appInfo, setAppInfo] = useState<AppInfoResponse | null>(null);
  const [appHealth, setAppHealth] = useState<AppDataHealthResponse | null>(
    null,
  );
  const [diagnosticsDestination, setDiagnosticsDestination] = useState(
    "/tmp/fileoctopus-diagnostics.zip",
  );
  const [diagnosticsMessage, setDiagnosticsMessage] = useState<string | null>(
    null,
  );
  const [exportingDiagnostics, setExportingDiagnostics] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<OperationDialog | null>(null);
  const [locations, setLocations] = useState<StandardLocationDto[]>([]);
  const [clipboard, setClipboard] = useState<FileClipboardState | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [search, setSearch] = useState<SearchState | null>(null);
  const [pathFocusToken, setPathFocusToken] = useState(0);
  const [filterFocusToken, setFilterFocusToken] = useState(0);
  const [recursiveSearchFocusToken, setRecursiveSearchFocusToken] = useState(0);
  const [preferences, setPreferences] = useState<UserPreferencesDto | null>(
    null,
  );
  const [density, setDensity] = useState<DensityPreference>("comfortable");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);

  // ── E2E test bridge ──────────────────────────────────────────────
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__FO_TEST__ = {
      openSettings: () => setSettingsOpen(true),
      closeSettings: () => setSettingsOpen(false),
      openShortcuts: () => setShortcutsOpen(true),
      closeShortcuts: () => setShortcutsOpen(false),
      openDiagnostics: () => setDiagnosticsOpen(true),
      closeDiagnostics: () => setDiagnosticsOpen(false),
      toggleHelp: () => setHelpOpen((v) => !v),
    };
    return () => {
      delete (window as unknown as Record<string, unknown>).__FO_TEST__;
    };
  }, []);
  const [favorites, setFavorites] = useState<FavoriteEntryDto[]>([]);
  const [recentToday, setRecentToday] = useState<RecentEntryDto[]>([]);
  const [recentWeek, setRecentWeek] = useState<RecentEntryDto[]>([]);
  const [starred, setStarred] = useState<StarredEntryDto[]>([]);
  const [activityCollapsed, setActivityCollapsed] = useState(false);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const { markActivityPinnedOpen } = useWorkspaceLayout({
    workspaceRef,
    sidebarWidth: preferences?.sidebarWidth ?? 240,
    activityCollapsed,
    activityPanelVisible: preferences?.activityPanelVisible ?? true,
    onCollapseActivity: () => {
      setActivityCollapsed(true);
      void updatePreference("activityPanelVisible", "false");
    },
  });
  const [jobMetrics, setJobMetrics] = useState<
    Record<
      string,
      {
        speedLabel: string | null;
        etaLabel: string | null;
        lastBytes: number;
        lastAt: number;
      }
    >
  >({});
  const rowHeight = rowHeightForDensity(density);
  const starredUriSet = useMemo(
    () => new Set(starred.map((entry) => entry.uri)),
    [starred],
  );
  const left = activeTab(state.panels.left);
  const right = activeTab(state.panels.right);
  const statusTab = activeTab(state.panels[state.activePanelId]);
  const statusSelection = statusTab.selectedIds
    .map((id) => statusTab.entriesById[id])
    .filter((entry): entry is FileEntryDto => Boolean(entry));
  const statusKnownBytes = statusSelection.reduce(
    (total, entry) => total + (entry.size ?? 0),
    0,
  );
  const statusUnknownSizes = statusSelection.some(
    (entry) => entry.size == null,
  );

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let disposed = false;
    client.fs
      .onDirectoryBatch((event) => {
        // eslint-disable-next-line no-console
        console.log("[FO][batch]", {
          sessionId: event.sessionId,
          requestId: event.requestId,
          uri: event.uri,
          batchIndex: event.batchIndex,
          isComplete: event.isComplete,
          entries: event.entries.length,
          error: event.error ?? null,
        });
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
  }, [client]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let disposed = false;
    const activePanelId = state.activePanelId;
    const activeUri = activeTab(state.panels[activePanelId]).uri;

    client.fs
      .onWatchChanged((event) => {
        if (event.uri === activeUri) {
          refreshPanel(activePanelId, { replace: true, softRefresh: true });
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
  }, [client, state.activePanelId, left.uri, right.uri]);

  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    let disposed = false;
    const remember = (event: JobSnapshot) =>
      setJobs((current) => ({
        ...current,
        [jobIdValue(event.jobId)]: event,
      }));

    Promise.all([
      client.fileOperations.onJobStarted((event) => {
        remember(snapshotFromStarted(event));
      }),
      client.fileOperations.onJobProgress((event) => {
        setJobs((current) => ({
          ...current,
          [jobIdValue(event.jobId)]: mergeProgress(current, event),
        }));
        setJobMetrics((current) => {
          const id = jobIdValue(event.jobId);
          const previous = current[id];
          const now = Date.now();
          const deltaBytes = previous
            ? event.completedBytes - previous.lastBytes
            : 0;
          const deltaMs = previous ? now - previous.lastAt : 0;
          let speedLabel: string | null = null;
          let etaLabel: string | null = null;

          if (deltaMs > 0 && deltaBytes > 0) {
            const bytesPerSecond = (deltaBytes * 1000) / deltaMs;
            speedLabel = `${formatSize(bytesPerSecond)}/s`;
            const totalBytes = event.totalBytes ?? 0;
            const remaining = totalBytes - event.completedBytes;
            if (remaining > 0 && bytesPerSecond > 0 && totalBytes > 0) {
              const seconds = Math.round(remaining / bytesPerSecond);
              etaLabel = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")} left`;
            }
          }

          return {
            ...current,
            [id]: {
              speedLabel,
              etaLabel,
              lastBytes: event.completedBytes,
              lastAt: now,
            },
          };
        });
      }),
      client.fileOperations.onJobCompleted((event) => {
        setJobs((current) => ({
          ...current,
          [jobIdValue(event.jobId)]: mergeCompleted(current, event),
        }));
        pushToast({
          tone: "success",
          title: "Operation completed",
          detail: event.operationKind,
        });
        refreshVisiblePanels();
        void refreshHistory();
      }),
      client.fileOperations.onJobFailed((event) => {
        setJobs((current) => ({
          ...current,
          [jobIdValue(event.jobId)]: mergeFailed(current, event),
        }));
        pushToast({
          tone: "error",
          title: "Operation failed",
          detail: event.message,
          actionLabel: "View details",
          onAction: () => setOperationError(event.message),
        });
        setSearch((current) =>
          current?.jobId === jobIdValue(event.jobId)
            ? { ...current, running: false, error: event.message }
            : current,
        );
        setDialog((current) =>
          current?.type === "properties" &&
          current.folderSizeJobId === jobIdValue(event.jobId)
            ? { ...current, loading: false, error: event.message }
            : current,
        );
        refreshVisiblePanels();
        void refreshHistory();
      }),
      client.fileOperations.onJobCancelled((event) => {
        setJobs((current) => ({
          ...current,
          [jobIdValue(event.jobId)]: mergeCancelled(current, event),
        }));
        pushToast({
          tone: "info",
          title: "Operation cancelled",
          detail: event.operationKind,
        });
        setSearch((current) =>
          current?.jobId === jobIdValue(event.jobId)
            ? { ...current, running: false, error: "Operation cancelled." }
            : current,
        );
        setDialog((current) =>
          current?.type === "properties" &&
          current.folderSizeJobId === jobIdValue(event.jobId)
            ? { ...current, loading: false }
            : current,
        );
        refreshVisiblePanels();
        void refreshHistory();
      }),
    ])
      .then((items) => {
        if (disposed) {
          for (const unlisten of items) {
            unlisten();
          }
          return;
        }
        unlisteners.push(...items);
      })
      .catch((error) => {
        setOperationError(normalizeIpcError(error).message);
      });

    return () => {
      disposed = true;
      for (const unlisten of unlisteners) {
        unlisten();
      }
    };
  }, [client, left.uri, right.uri]);

  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    let disposed = false;

    Promise.all([
      client.fs.onFolderSizeCompleted((event) =>
        applyFolderSizeCompleted(event),
      ),
      client.fs.onRecursiveSearchMatch((event) =>
        applyRecursiveSearchMatch(event),
      ),
      client.fs.onRecursiveSearchCompleted((event) =>
        applyRecursiveSearchCompleted(event),
      ),
    ])
      .then((items) => {
        if (disposed) {
          for (const unlisten of items) {
            unlisten();
          }
          return;
        }
        unlisteners.push(...items);
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      for (const unlisten of unlisteners) {
        unlisten();
      }
    };
  }, [client]);

  useEffect(() => {
    if (hasInitializedRef.current) {
      return;
    }
    hasInitializedRef.current = true;

    void (async () => {
      let showHidden = false;

      void refreshLocations();
      void refreshNavigation();

      try {
        const response = await client.preferences.get();
        setPreferences(response.preferences);
        applyAllPreferences(response.preferences);
        applyLayoutPreferences(response.preferences);
        setDensity(applyDensityPreference(response.preferences.density));
        setActivityCollapsed(!response.preferences.activityPanelVisible);
        showHidden = response.preferences.showHiddenFiles;
        dispatch({
          type: "hydratePreferences",
          showHidden,
          viewMode: viewModeFromPreference(
            response.preferences.defaultViewMode,
          ),
        });
      } catch {
        // Fall back to localStorage-backed defaults in panelStore.
      }

      await Promise.allSettled([
        navigatePanel("left", activeTab(state.panels.left).uri, {
          includeHidden: showHidden,
        }),
        navigatePanel("right", activeTab(state.panels.right).uri, {
          includeHidden: showHidden,
        }),
      ]);
      void refreshLocations();
      void refreshHistory();
      void refreshDiagnostics();
    })();
  }, []);

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

  useEffect(() => {
    const tab = activeTab(state.panels[state.activePanelId]);

    void client.fs.startWatching({ uri: tab.uri }).catch(() => undefined);

    return () => {
      void client.fs.stopWatching().catch(() => undefined);
    };
  }, [client, state.activePanelId, left.uri, right.uri]);

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

    // eslint-disable-next-line no-console
    console.log("[FO][listStart→]", { panelId, uri, requestId, includeHidden });

    try {
      const response = await client.fs.listStart({
        uri,
        requestId,
        panelId,
        batchSize: 256,
        includeHidden,
      });
      // eslint-disable-next-line no-console
      console.log("[FO][listStart←]", {
        panelId,
        sessionId: response.sessionId,
        requestId: response.requestId,
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
        loadState:
          normalized.code === "permission_denied"
            ? "permissionDenied"
            : normalized.code === "timeout"
              ? "timeout"
              : "error",
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

  async function planOperation(
    kind: FileOperationKind,
    sources: string[],
    destination?: string,
    newName?: string,
    conflictPolicy: ConflictPolicy = "fail",
  ) {
    return client.fileOperations.planFileOperation({
      operation: {
        kind,
        sources,
        destination,
        newName,
        conflictPolicy,
      },
    });
  }

  async function startPlannedOperation(
    plan: FileOperationPlanDto,
  ): Promise<boolean> {
    try {
      const started = await client.fileOperations.startFileOperation({ plan });

      setJobs((current) => ({
        ...current,
        [jobIdValue(started.job.jobId)]: started.job,
      }));
      return true;
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setOperationError(
        operationErrorMessage(normalized.code, normalized.message),
      );
      return false;
    }
  }

  async function startOperation(
    kind: FileOperationKind,
    sources: string[],
    destination?: string,
    newName?: string,
    conflictPolicy: ConflictPolicy = "fail",
  ): Promise<boolean> {
    setOperationError(null);

    try {
      const planResponse = await planOperation(
        kind,
        sources,
        destination,
        newName,
        conflictPolicy,
      );

      return startPlannedOperation(planResponse.plan);
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setOperationError(
        operationErrorMessage(normalized.code, normalized.message),
      );
      return false;
    }
  }

  async function reviewCopyMoveDialog(
    current: Extract<OperationDialog, { type: "copyMove" }>,
  ) {
    setOperationError(null);
    setDialog({ ...current, planning: true, error: null });

    try {
      const planResponse = await planOperation(
        current.kind,
        current.entries.map((entry) => entry.uri),
        normalizeLocalInput(current.destination),
        undefined,
        current.conflictPolicy,
      );

      setDialog({ ...current, plan: planResponse.plan, planning: false });
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setDialog({
        ...current,
        planning: false,
        error: operationErrorMessage(normalized.code, normalized.message),
      });
    }
  }

  function selectedEntries(panelId: PanelId): FileEntryDto[] {
    const tab = activeTab(state.panels[panelId]);

    return tab.selectedIds
      .map((id) => tab.entriesById[id])
      .filter((entry): entry is FileEntryDto => Boolean(entry));
  }

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

  async function revealEntry(panelId: PanelId, entry: FileEntryDto | null) {
    if (!entry) {
      return;
    }

    try {
      await client.fs.revealPathInFileManager({ uri: entry.uri });
    } catch {
      const parent = parentUri(entry.uri);

      if (parent) {
        await navigatePanel(panelId, parent);
        dispatch({ type: "setSelection", panelId, entryId: entry.uri });
      }
    }
  }

  function copySelectionToFileClipboard(panelId: PanelId, kind: CopyMoveKind) {
    const entries = selectedEntries(panelId);

    if (entries.length === 0) {
      return;
    }

    setClipboard({
      kind,
      uris: entries.map((entry) => entry.uri),
      providerId: entries[0].providerId,
      timestamp: Date.now(),
    });
  }

  async function pasteClipboard(panelId: PanelId) {
    if (!clipboard) {
      return;
    }

    const tab = activeTab(state.panels[panelId]);
    const ok = await startOperation(
      clipboard.kind,
      clipboard.uris,
      tab.uri,
      undefined,
      "renameNew",
    );

    if (ok && clipboard.kind === "move") {
      setClipboard(null);
    }
  }

  async function copyTextFromSelection(
    panelId: PanelId,
    mode: "path" | "name",
  ) {
    const entries = selectedEntries(panelId);

    if (entries.length === 0) {
      return;
    }

    const text = entries
      .map((entry) =>
        mode === "path" ? localPathFromUri(entry.uri) : entry.name,
      )
      .join("\n");

    await globalThis.navigator.clipboard?.writeText(text);
  }

  function handleCreateFolder(panelId: PanelId) {
    setDialog({
      type: "createFolder",
      panelId,
      name: "New Folder",
      error: null,
    });
  }

  function handleCreateFile(panelId: PanelId) {
    setDialog({
      type: "createFile",
      panelId,
      name: "New File.txt",
      error: null,
    });
  }

  function handleRename(panelId: PanelId) {
    const entries = selectedEntries(panelId);
    const entry = entries[0];

    if (entries.length !== 1 || !entry) {
      return;
    }

    setDialog({
      type: "rename",
      panelId,
      entry,
      name: entry.name,
      error: null,
    });
  }

  function handleCopyOrMove(panelId: PanelId, kind: CopyMoveKind) {
    const entries = selectedEntries(panelId);
    const otherPanel = panelId === "left" ? "right" : "left";
    const defaultDestination = activeTab(state.panels[otherPanel]).uri;

    if (entries.length === 0) {
      return;
    }

    setDialog({
      type: "copyMove",
      panelId,
      kind,
      entries,
      destination: defaultDestination,
      conflictPolicy: "fail",
      plan: null,
      planning: false,
      step: "review",
      error: null,
    });
  }

  async function executeTrash(_panelId: PanelId, entries: FileEntryDto[]) {
    const ok = await startOperation(
      "deleteToTrash",
      entries.map((entry) => entry.uri),
    );

    if (ok) {
      setDialog(null);
    }
  }

  function handleTrash(panelId: PanelId) {
    const entries = selectedEntries(panelId);

    if (entries.length === 0) {
      return;
    }

    if (
      typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem(SKIP_TRASH_CONFIRM_KEY) === "true"
    ) {
      void executeTrash(panelId, entries);
      return;
    }

    setDialog({
      type: "trash",
      panelId,
      entries,
      dontAskAgain: false,
      error: null,
    });
  }

  async function toggleStarredForEntry(entry: FileEntryDto) {
    try {
      await client.navigation.toggleStarred({
        uri: entry.uri,
        label: entry.name,
      });
      await refreshNavigation();
    } catch (error) {
      setOperationError(normalizeIpcError(error).message);
    }
  }

  function handlePermanentDelete(panelId: PanelId) {
    const entries = selectedEntries(panelId);

    if (entries.length === 0) {
      return;
    }

    setDialog({ type: "permanentDelete", panelId, entries, error: null });
  }

  async function handleProperties(
    panelId: PanelId,
    entry: FileEntryDto | null,
  ) {
    const tab = activeTab(state.panels[panelId]);
    const target = entry ?? selectedEntries(panelId)[0] ?? null;
    const uri = target?.uri ?? tab.uri;

    setDialog({
      type: "properties",
      panelId,
      entry: target,
      properties: null,
      loading: true,
      folderSizeJobId: null,
      error: null,
    });

    try {
      const response = await client.fs.properties({
        uri,
        includeFolderSummary: false,
      });
      const properties = response.properties;
      let folderSizeJobId: string | null = null;

      if (properties.kind === "directory") {
        const sizeJob = await client.fs.startFolderSizeJob({ uri });
        folderSizeJobId = jobIdValue(sizeJob.job.jobId);
      }

      setDialog({
        type: "properties",
        panelId,
        entry: target,
        properties,
        loading: Boolean(folderSizeJobId),
        folderSizeJobId,
        error: null,
      });
    } catch (error) {
      setDialog({
        type: "properties",
        panelId,
        entry: target,
        properties: null,
        loading: false,
        folderSizeJobId: null,
        error: normalizeIpcError(error).message,
      });
    }
  }

  async function runRecursiveSearch(panelId: PanelId) {
    const tab = activeTab(state.panels[panelId]);
    const query = tab.recursiveQuery.trim();

    if (!query) {
      setSearch(null);
      return;
    }

    setSearch({
      panelId,
      query,
      running: true,
      jobId: null,
      result: { matches: [], warnings: [], incomplete: false },
      error: null,
    });

    try {
      const response = await client.fs.startRecursiveSearchJob({
        uri: tab.uri,
        query,
        limit: 500,
      });

      setSearch({
        panelId,
        query,
        running: true,
        jobId: jobIdValue(response.job.jobId),
        result: { matches: [], warnings: [], incomplete: false },
        error: null,
      });
    } catch (error) {
      setSearch({
        panelId,
        query,
        running: false,
        jobId: null,
        result: null,
        error: normalizeIpcError(error).message,
      });
    }
  }

  function toggleHidden(panelId: PanelId) {
    const tab = activeTab(state.panels[panelId]);

    dispatch({ type: "toggleHidden", panelId });
    refreshPanel(panelId, {
      replace: true,
      includeHidden: !tab.showHidden,
    });
  }

  async function submitCreateFolder(
    current: Extract<OperationDialog, { type: "createFolder" }>,
  ) {
    const name = current.name.trim();

    if (!isValidName(name)) {
      setDialog({
        ...current,
        error: "Enter a folder name without path separators.",
      });
      return;
    }

    const tab = activeTab(state.panels[current.panelId]);
    const ok = await startOperation(
      "createDirectory",
      [],
      joinLocalUri(tab.uri, name),
    );

    if (ok) {
      setDialog(null);
      refreshVisiblePanels();
    }
  }

  async function submitCreateFile(
    current: Extract<OperationDialog, { type: "createFile" }>,
  ) {
    const name = current.name.trim();

    if (!isValidName(name)) {
      setDialog({
        ...current,
        error: "Enter a file name without path separators.",
      });
      return;
    }

    const tab = activeTab(state.panels[current.panelId]);

    try {
      const response = await client.fs.createFile({
        uri: joinLocalUri(tab.uri, name),
      });

      setDialog(null);
      refreshPanel(current.panelId);
      dispatch({
        type: "setSelection",
        panelId: current.panelId,
        entryId: response.entry.uri,
      });
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setDialog({
        ...current,
        error: operationErrorMessage(normalized.code, normalized.message),
      });
    }
  }

  async function submitRename(
    current: Extract<OperationDialog, { type: "rename" }>,
  ) {
    const name = current.name.trim();

    if (!isValidName(name)) {
      setDialog({ ...current, error: "Enter a name without path separators." });
      return;
    }

    const ok = await startOperation(
      "rename",
      [current.entry.uri],
      undefined,
      name,
    );

    if (ok) {
      setDialog(null);
      refreshVisiblePanels();
    }
  }

  async function submitCopyMove(
    current: Extract<OperationDialog, { type: "copyMove" }>,
  ) {
    if (!current.destination.trim()) {
      setDialog({ ...current, error: "Enter a destination local URI." });
      return;
    }

    if (!current.plan) {
      await reviewCopyMoveDialog(current);
      return;
    }

    // Confirm-overwrite gate: if preference is on, conflicts exist, and policy is overwrite
    if (
      current.step !== "confirm-overwrite" &&
      (preferences?.confirmOverwrite ?? false) &&
      current.plan.conflicts.length > 0 &&
      current.conflictPolicy === "overwrite"
    ) {
      setDialog({ ...current, step: "confirm-overwrite" });
      return;
    }

    const ok = await startPlannedOperation(current.plan);

    if (ok) {
      setDialog(null);
    }
  }

  async function submitTrash(
    current: Extract<OperationDialog, { type: "trash" }>,
  ) {
    if (current.dontAskAgain && typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(SKIP_TRASH_CONFIRM_KEY, "true");
    }

    await executeTrash(current.panelId, current.entries);
  }

  async function submitPermanentDelete(
    current: Extract<OperationDialog, { type: "permanentDelete" }>,
  ) {
    try {
      await client.fs.deletePermanently({
        uris: current.entries.map((entry) => entry.uri),
      });

      setDialog(null);
      refreshPanel(current.panelId);
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setDialog({
        ...current,
        error: operationErrorMessage(normalized.code, normalized.message),
      });
    }
  }

  function handleShellKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      if (dialog) {
        event.preventDefault();
        setDialog(null);
        return;
      }
      if (contextMenu) {
        event.preventDefault();
        setContextMenu(null);
        return;
      }
      if (helpOpen) {
        event.preventDefault();
        setHelpOpen(false);
        return;
      }
    }

    if (isEditableTarget(event.target)) {
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      dispatch({
        type: "setActivePanel",
        panelId: state.activePanelId === "left" ? "right" : "left",
      });
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key === ",") {
      event.preventDefault();
      setSettingsOpen(true);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key === "/") {
      event.preventDefault();
      setShortcutsOpen(true);
      return;
    }

    if (dialog) {
      return;
    }

    const panelId = state.activePanelId;
    const tab = activeTab(state.panels[panelId]);
    const selectedEntry =
      selectVisibleEntries(tab).find((entry) => entry.uri === tab.selectedId) ??
      null;

    if (event.key === "Enter") {
      event.preventDefault();
      activateEntry(panelId, selectedEntry);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "l") {
      event.preventDefault();
      setPathFocusToken((value) => value + 1);
      return;
    }

    if (
      (event.metaKey || event.ctrlKey) &&
      event.shiftKey &&
      event.key.toLowerCase() === "f"
    ) {
      event.preventDefault();
      setRecursiveSearchFocusToken((value) => value + 1);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
      event.preventDefault();
      setFilterFocusToken((value) => value + 1);
      return;
    }

    if (
      (event.metaKey || event.ctrlKey) &&
      (event.code === "Period" || event.key.toLowerCase() === "h")
    ) {
      event.preventDefault();
      toggleHidden(panelId);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "i") {
      event.preventDefault();
      void handleProperties(panelId, null);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
      event.preventDefault();
      handleCreateFolder(panelId);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      dispatch({ type: "selectAll", panelId });
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
      event.preventDefault();
      copySelectionToFileClipboard(panelId, "copy");
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "x") {
      event.preventDefault();
      copySelectionToFileClipboard(panelId, "move");
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v") {
      event.preventDefault();
      void pasteClipboard(panelId);
      return;
    }

    if (event.key === "F2") {
      event.preventDefault();
      handleRename(panelId);
      return;
    }

    if (event.altKey && event.key === "ArrowLeft") {
      event.preventDefault();
      void goHistory(panelId, "back");
      return;
    }

    if (event.altKey && event.key === "ArrowRight") {
      event.preventDefault();
      void goHistory(panelId, "forward");
      return;
    }

    if (
      event.key === "Backspace" ||
      (event.altKey && event.key === "ArrowUp")
    ) {
      const upUri = parentUri(tab.uri);

      if (upUri) {
        event.preventDefault();
        void navigatePanel(panelId, upUri);
      }

      return;
    }

    if (
      event.key === "F5" ||
      ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "r")
    ) {
      event.preventDefault();
      refreshPanel(panelId);
      return;
    }

    if (event.key === "Delete") {
      event.preventDefault();
      if (event.shiftKey) {
        handlePermanentDelete(panelId);
      } else {
        handleTrash(panelId);
      }
    }
  }

  const activeJobCount = Object.values(jobs).filter(
    (job) => job.status === "queued" || job.status === "running",
  ).length;
  return (
    <ErrorBoundary>
      <main className="fo-shell" onKeyDown={handleShellKeyDown}>
        <div className="fo-shell-frame">
          <TitleBar
            helpOpen={helpOpen}
            onToggleHelp={() => setHelpOpen((value) => !value)}
            onSettings={() => setSettingsOpen(true)}
            onShortcuts={() => {
              setHelpOpen(false);
              setShortcutsOpen(true);
            }}
            onDiagnostics={() => {
              setHelpOpen(false);
              setDiagnosticsOpen(true);
            }}
          />
          <section
            ref={workspaceRef}
            className="fo-workspace"
            aria-label="File workspace"
          >
            <Sidebar
              locations={locations}
              favorites={favorites}
              recentToday={recentToday}
              recentWeek={recentWeek}
              starred={starred}
              activeUri={activeTab(state.panels[state.activePanelId]).uri}
              onNavigate={(uri) => navigatePanel(state.activePanelId, uri)}
              onAddFavorite={(uri, label) => {
                void client.navigation
                  .addFavorite({ uri, label })
                  .then(() => refreshNavigation())
                  .catch((error) =>
                    setOperationError(normalizeIpcError(error).message),
                  );
              }}
              onRemoveFavorite={(id) => {
                void client.navigation
                  .removeFavorite({ id })
                  .then(() => refreshNavigation())
                  .catch((error) =>
                    setOperationError(normalizeIpcError(error).message),
                  );
              }}
              onRenameFavorite={(id, label) => {
                void client.navigation
                  .renameFavorite({ id, label })
                  .then(() => refreshNavigation())
                  .catch((error) =>
                    setOperationError(normalizeIpcError(error).message),
                  );
              }}
              onRevealFavorite={(uri) => {
                void client.fs
                  .revealPathInFileManager({ uri })
                  .catch((error: unknown) =>
                    setOperationError(normalizeIpcError(error).message),
                  );
              }}
            />
            <SidebarResizer
              onSidebarResize={(width) => {
                document.documentElement.style.setProperty(
                  "--fo-sidebar-width",
                  `${width}px`,
                );
                void updatePreference("sidebarWidth", String(width));
              }}
            />
            <div className="fo-dual-pane" aria-label="File panels">
              <FilePanel
                panelId="left"
                title="Left"
                tab={left}
                active={state.activePanelId === "left"}
                onActivate={() =>
                  dispatch({ type: "setActivePanel", panelId: "left" })
                }
                onNavigate={(uri) => navigatePanel("left", uri)}
                onBack={() => void goHistory("left", "back")}
                onForward={() => void goHistory("left", "forward")}
                onSelect={(entryId) =>
                  dispatch({ type: "setSelection", panelId: "left", entryId })
                }
                onEntrySelect={(entryId, mode) =>
                  dispatch({
                    type: "selectEntry",
                    panelId: "left",
                    entryId,
                    mode,
                  })
                }
                onCreateFolder={() => handleCreateFolder("left")}
                onCreateFile={() => handleCreateFile("left")}
                onRename={() => handleRename("left")}
                onCopy={() => copySelectionToFileClipboard("left", "copy")}
                onCut={() => copySelectionToFileClipboard("left", "move")}
                onCopyOperation={() => handleCopyOrMove("left", "copy")}
                onMoveOperation={() => handleCopyOrMove("left", "move")}
                onPaste={() => void pasteClipboard("left")}
                onTrash={() => handleTrash("left")}
                onPermanentDelete={() => handlePermanentDelete("left")}
                onCopyPath={() => void copyTextFromSelection("left", "path")}
                onCopyName={() => void copyTextFromSelection("left", "name")}
                onProperties={(entry) => void handleProperties("left", entry)}
                onReveal={(entry) => void revealEntry("left", entry)}
                onRefresh={() => refreshPanel("left")}
                onToggleHidden={() => toggleHidden("left")}
                onSelectAll={() =>
                  dispatch({ type: "selectAll", panelId: "left" })
                }
                onMove={(delta) =>
                  dispatch({ type: "moveSelection", panelId: "left", delta })
                }
                onSort={(field) =>
                  dispatch({ type: "setSort", panelId: "left", field })
                }
                onFilter={(filter) =>
                  dispatch({ type: "setFilter", panelId: "left", filter })
                }
                onRecursiveQuery={(query) =>
                  dispatch({
                    type: "setRecursiveQuery",
                    panelId: "left",
                    query,
                  })
                }
                onRecursiveSearch={() => void runRecursiveSearch("left")}
                onViewMode={(viewMode) =>
                  dispatch({ type: "setViewMode", panelId: "left", viewMode })
                }
                canPaste={Boolean(clipboard)}
                pathFocusToken={pathFocusToken}
                filterFocusToken={filterFocusToken}
                recursiveSearchFocusToken={recursiveSearchFocusToken}
                rowHeight={rowHeight}
                search={search?.panelId === "left" ? search : null}
                onContextMenu={setContextMenu}
                onEntryActivate={(entry) => activateEntry("left", entry)}
              />
              <SplitResizer
                onSplitResize={(ratio) => {
                  const nextRatio = applySplitRatio(ratio);
                  void updatePreference("splitRatio", String(nextRatio));
                }}
              />
              <FilePanel
                panelId="right"
                title="Right"
                tab={right}
                active={state.activePanelId === "right"}
                onActivate={() =>
                  dispatch({ type: "setActivePanel", panelId: "right" })
                }
                onNavigate={(uri) => navigatePanel("right", uri)}
                onBack={() => void goHistory("right", "back")}
                onForward={() => void goHistory("right", "forward")}
                onSelect={(entryId) =>
                  dispatch({ type: "setSelection", panelId: "right", entryId })
                }
                onEntrySelect={(entryId, mode) =>
                  dispatch({
                    type: "selectEntry",
                    panelId: "right",
                    entryId,
                    mode,
                  })
                }
                onCreateFolder={() => handleCreateFolder("right")}
                onCreateFile={() => handleCreateFile("right")}
                onRename={() => handleRename("right")}
                onCopy={() => copySelectionToFileClipboard("right", "copy")}
                onCut={() => copySelectionToFileClipboard("right", "move")}
                onCopyOperation={() => handleCopyOrMove("right", "copy")}
                onMoveOperation={() => handleCopyOrMove("right", "move")}
                onPaste={() => void pasteClipboard("right")}
                onTrash={() => handleTrash("right")}
                onPermanentDelete={() => handlePermanentDelete("right")}
                onCopyPath={() => void copyTextFromSelection("right", "path")}
                onCopyName={() => void copyTextFromSelection("right", "name")}
                onProperties={(entry) => void handleProperties("right", entry)}
                onReveal={(entry) => void revealEntry("right", entry)}
                onRefresh={() => refreshPanel("right")}
                onToggleHidden={() => toggleHidden("right")}
                onSelectAll={() =>
                  dispatch({ type: "selectAll", panelId: "right" })
                }
                onMove={(delta) =>
                  dispatch({ type: "moveSelection", panelId: "right", delta })
                }
                onSort={(field) =>
                  dispatch({ type: "setSort", panelId: "right", field })
                }
                onFilter={(filter) =>
                  dispatch({ type: "setFilter", panelId: "right", filter })
                }
                onRecursiveQuery={(query) =>
                  dispatch({
                    type: "setRecursiveQuery",
                    panelId: "right",
                    query,
                  })
                }
                onRecursiveSearch={() => void runRecursiveSearch("right")}
                onViewMode={(viewMode) =>
                  dispatch({ type: "setViewMode", panelId: "right", viewMode })
                }
                canPaste={Boolean(clipboard)}
                pathFocusToken={pathFocusToken}
                filterFocusToken={filterFocusToken}
                recursiveSearchFocusToken={recursiveSearchFocusToken}
                rowHeight={rowHeight}
                search={search?.panelId === "right" ? search : null}
                onContextMenu={setContextMenu}
                onEntryActivate={(entry) => activateEntry("right", entry)}
              />
            </div>
            <ActivityPanel
              jobs={Object.values(jobs)}
              history={history}
              error={operationError}
              collapsed={activityCollapsed}
              jobMetrics={jobMetrics}
              onToggleCollapsed={() => {
                const next = !activityCollapsed;
                if (!next) {
                  markActivityPinnedOpen();
                }
                setActivityCollapsed(next);
                void updatePreference("activityPanelVisible", String(!next));
              }}
              onCancel={(jobId) => void client.jobs.cancelJob({ jobId })}
              onRefreshHistory={() => void refreshHistory()}
              onClearHistory={() => void clearHistory()}
            />
          </section>
          <ToastStack
            toasts={toasts}
            onDismiss={(id) =>
              setToasts((current) => current.filter((toast) => toast.id !== id))
            }
          />
          {preferences ? (
            <SettingsDialog
              open={settingsOpen}
              preferences={preferences}
              onClose={() => setSettingsOpen(false)}
              onChange={(key, value) => void updatePreference(key, value)}
            />
          ) : null}
          <ShortcutsDialog
            open={shortcutsOpen}
            onClose={() => setShortcutsOpen(false)}
          />
          <DiagnosticsDialog
            open={diagnosticsOpen}
            appInfo={appInfo}
            appHealth={appHealth}
            destination={diagnosticsDestination}
            message={diagnosticsMessage}
            exporting={exportingDiagnostics}
            showDeveloperFields={!isProductionBuild}
            onClose={() => setDiagnosticsOpen(false)}
            onDestinationChange={setDiagnosticsDestination}
            onRefresh={() => void refreshDiagnostics()}
            onExport={() => void exportDiagnostics()}
          />
          <OperationDialogView
            dialog={dialog}
            onClose={() => setDialog(null)}
            onUpdate={(next) => setDialog(next)}
            onReviewCopyMove={(current) => void reviewCopyMoveDialog(current)}
            onSubmitCreateFolder={(current) => void submitCreateFolder(current)}
            onSubmitCreateFile={(current) => void submitCreateFile(current)}
            onSubmitRename={(current) => void submitRename(current)}
            onSubmitCopyMove={(current) => void submitCopyMove(current)}
            onSubmitTrash={(current) => void submitTrash(current)}
            onSubmitPermanentDelete={(current) =>
              void submitPermanentDelete(current)
            }
            onCopyPath={(panelId) =>
              void copyTextFromSelection(panelId, "path")
            }
            onReveal={(panelId, entry) => void revealEntry(panelId, entry)}
          />
          <ContextMenu
            menu={contextMenu}
            canPaste={Boolean(clipboard)}
            isStarred={
              contextMenu?.entry
                ? starredUriSet.has(contextMenu.entry.uri)
                : false
            }
            showHidden={
              contextMenu?.panelId
                ? activeTab(state.panels[contextMenu.panelId]).showHidden
                : false
            }
            onClose={() => setContextMenu(null)}
            onToggleHidden={(panelId) => toggleHidden(panelId)}
            onOpen={(panelId, entry) => activateEntry(panelId, entry)}
            onRename={handleRename}
            onCopy={(panelId) => copySelectionToFileClipboard(panelId, "copy")}
            onCut={(panelId) => copySelectionToFileClipboard(panelId, "move")}
            onPaste={(panelId) => void pasteClipboard(panelId)}
            onTrash={handleTrash}
            onToggleStarred={(_panelId, entry) =>
              void toggleStarredForEntry(entry)
            }
            onPermanentDelete={handlePermanentDelete}
            onCopyPath={(panelId) =>
              void copyTextFromSelection(panelId, "path")
            }
            onCopyName={(panelId) =>
              void copyTextFromSelection(panelId, "name")
            }
            onProperties={(panelId, entry) =>
              void handleProperties(panelId, entry)
            }
            onReveal={(panelId, entry) => void revealEntry(panelId, entry)}
            onCreateFolder={handleCreateFolder}
            onCreateFile={handleCreateFile}
            onRefresh={refreshPanel}
            onSelectAll={(panelId) => dispatch({ type: "selectAll", panelId })}
            onViewMode={(panelId, viewMode) =>
              dispatch({ type: "setViewMode", panelId, viewMode })
            }
            onSort={(panelId, field) =>
              dispatch({ type: "setSort", panelId, field })
            }
          />
          <StatusBar
            activePanelLabel={
              state.activePanelId === "left" ? "Left pane" : "Right pane"
            }
            pathLabel={localPathFromUri(statusTab.uri)}
            loadState={statusTab.loadState}
            selectedCount={statusSelection.length}
            entryCount={statusTab.orderedEntryIds.length}
            filterActive={statusTab.filter.trim().length > 0}
            selectedSizeLabel={
              statusSelection.length > 0
                ? `${formatSize(statusKnownBytes)}${statusUnknownSizes ? " plus unknown sizes" : ""}`
                : null
            }
            activeJobCount={activeJobCount}
            operationError={operationError}
            logPath={appHealth?.logDir ?? null}
            showLogPath={diagnosticsOpen}
          />
        </div>
      </main>
    </ErrorBoundary>
  );
}

interface FilePanelProps {
  panelId: PanelId;
  title: string;
  tab: PanelTabState;
  active: boolean;
  onActivate: () => void;
  onNavigate: (uri: string) => void;
  onBack: () => void;
  onForward: () => void;
  onSelect: (entryId: string | null) => void;
  onEntrySelect: (entryId: string, mode: "single" | "toggle" | "range") => void;
  onMove: (delta: number) => void;
  onSort: (field: SortField) => void;
  onFilter: (filter: string) => void;
  onRecursiveQuery: (query: string) => void;
  onRecursiveSearch: () => void;
  onViewMode: (viewMode: ViewMode) => void;
  onEntryActivate: (entry: FileEntryDto | null) => void;
  onCreateFolder: () => void;
  onCreateFile: () => void;
  onRename: () => void;
  onCopy: () => void;
  onCut: () => void;
  onCopyOperation: () => void;
  onMoveOperation: () => void;
  onPaste: () => void;
  onTrash: () => void;
  onPermanentDelete: () => void;
  onCopyPath: () => void;
  onCopyName: () => void;
  onProperties: (entry: FileEntryDto | null) => void;
  onReveal: (entry: FileEntryDto | null) => void;
  onRefresh: () => void;
  onToggleHidden: () => void;
  onSelectAll: () => void;
  canPaste: boolean;
  pathFocusToken: number;
  filterFocusToken: number;
  recursiveSearchFocusToken: number;
  rowHeight: number;
  search: SearchState | null;
  onContextMenu: (menu: ContextMenuState | null) => void;
}

function FilePanel({
  panelId,
  title,
  tab,
  active,
  onActivate,
  onNavigate,
  onBack,
  onForward,
  onSelect,
  onEntrySelect,
  onMove,
  onSort,
  onFilter,
  onRecursiveQuery,
  onRecursiveSearch,
  onViewMode,
  onEntryActivate,
  onCreateFolder,
  onCreateFile,
  onRename,
  onCopy,
  onCut,
  onCopyOperation,
  onMoveOperation,
  onPaste,
  onTrash,
  onPermanentDelete,
  onCopyPath,
  onCopyName,
  onProperties,
  onReveal,
  onRefresh,
  onToggleHidden,
  onSelectAll,
  canPaste,
  pathFocusToken,
  filterFocusToken,
  recursiveSearchFocusToken,
  rowHeight,
  search,
  onContextMenu,
}: FilePanelProps) {
  const entries = selectVisibleEntries(tab);
  // eslint-disable-next-line no-console
  console.log("[FO][FilePanel render]", {
    panelId,
    uri: tab.uri,
    loadState: tab.loadState,
    orderedCount: tab.orderedEntryIds.length,
    visibleCount: entries.length,
    sessionId: tab.sessionId,
    activeRequestId: tab.activeRequestId,
  });
  const selectedEntry =
    entries.find((entry) => entry.uri === tab.selectedId) ?? null;
  const upUri = parentUri(tab.uri);
  const recursiveSearchRef = useRef<HTMLInputElement | null>(null);
  const { dragOver, reset, dragTargetProps } = useFileOctopusDragTarget();

  useEffect(() => {
    if (recursiveSearchFocusToken > 0 && active) {
      recursiveSearchRef.current?.focus();
      recursiveSearchRef.current?.select();
    }
  }, [active, recursiveSearchFocusToken]);

  return (
    <section
      className={active ? "fo-panel fo-panel-active" : "fo-panel"}
      onFocus={onActivate}
    >
      <header className="fo-panel-header">
        <div className="fo-panel-title-row">
          <span className="fo-pane-badge">{title}</span>
          <div className="fo-panel-nav">
            <IconButton
              label={`${panelId} back`}
              size="sm"
              disabled={tab.backStack.length === 0}
              onClick={onBack}
            >
              {Icons.chevronLeft()}
            </IconButton>
            <IconButton
              label={`${panelId} forward`}
              size="sm"
              disabled={tab.forwardStack.length === 0}
              onClick={onForward}
            >
              {Icons.chevronRight()}
            </IconButton>
            <IconButton
              label={`${panelId} up`}
              size="sm"
              disabled={!upUri}
              onClick={() => upUri && onNavigate(upUri)}
            >
              {Icons.arrowUp()}
            </IconButton>
          </div>
          <PathBar
            value={tab.uri}
            error={tab.error}
            focusToken={pathFocusToken}
            onSubmit={onNavigate}
          />
          <span className={active ? "fo-pane-active-label" : "fo-pane-label"}>
            {title.toUpperCase()}
          </span>
        </div>
      </header>
      <div
        className={cx("fo-panel-body", dragOver && "fo-panel-body-drag-over")}
        {...dragTargetProps}
        onDrop={(event) => {
          const uri = readDraggedUri(event);
          if (!uri) {
            return;
          }
          event.preventDefault();
          reset();
          onNavigate(uri);
        }}
      >
        {dragOver ? (
          <div className="fo-panel-drop-overlay" aria-live="polite">
            Drop here to open in {title.toLowerCase()} pane
            <span className="fo-panel-drop-path">
              {localPathFromUri(tab.uri)}
            </span>
          </div>
        ) : null}
        <OperationToolbar
          selectedCount={tab.selectedIds.length}
          canRename={tab.selectedIds.length === 1}
          canPaste={canPaste}
          showHidden={tab.showHidden}
          viewMode={tab.viewMode}
          onCreateFolder={onCreateFolder}
          onCreateFile={onCreateFile}
          onRename={onRename}
          onCopy={onCopy}
          onCut={onCut}
          onCopyOperation={onCopyOperation}
          onMove={onMoveOperation}
          onPaste={onPaste}
          onTrash={onTrash}
          onPermanentDelete={onPermanentDelete}
          onCopyPath={onCopyPath}
          onCopyName={onCopyName}
          onProperties={() => onProperties(selectedEntry)}
          onRefresh={onRefresh}
          onToggleHidden={onToggleHidden}
          onSelectAll={onSelectAll}
          onViewMode={onViewMode}
        />
        <div className="fo-panel-filter-row">
          <FilterInput
            panelId={panelId}
            value={tab.filter}
            focusToken={filterFocusToken}
            onChange={onFilter}
          />
          <SegmentedControl
            aria-label={`${panelId} view mode`}
            value={tab.viewMode}
            options={[
              { value: "details", label: "Details" },
              { value: "list", label: "List" },
              { value: "icons", label: "Icons" },
              { value: "columns", label: "Columns" },
            ]}
            onChange={onViewMode}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleHidden}
          >
            {tab.showHidden ? "Hide Hidden" : "Show Hidden"}
          </Button>
        </div>
        <div className="fo-search-strip">
          <input
            ref={recursiveSearchRef}
            aria-label={`${panelId} recursive search`}
            value={tab.recursiveQuery}
            placeholder="Search in subfolders..."
            onChange={(event) => onRecursiveQuery(event.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRecursiveSearch}
          >
            Search
          </Button>
        </div>
        <PaneStateView
          loadState={tab.loadState}
          uri={tab.uri}
          message={tab.error}
          onRetry={() => onNavigate(tab.uri)}
          onRefresh={onRefresh}
          onCreateFolder={onCreateFolder}
        />
        {tab.viewMode === "columns" ? (
          <ColumnsView
            rootUri={homeUri()}
            activeUri={tab.uri}
            showHidden={tab.showHidden}
            onNavigate={onNavigate}
            onOpen={onEntryActivate}
            fileIcon={fileIconGlyph}
          />
        ) : (
          <FileTable
            entries={entries}
            loadState={tab.loadState}
            rowHeight={rowHeight}
            selectedId={tab.selectedId}
            selectedIds={tab.selectedIds}
            focusedId={tab.focusedId}
            sortField={tab.sort.field}
            sortDirection={tab.sort.direction}
            viewMode={tab.viewMode}
            onSelect={onSelect}
            onEntrySelect={onEntrySelect}
            onMove={onMove}
            onSort={onSort}
            onActivate={() => onEntryActivate(selectedEntry)}
            onEntryActivate={onEntryActivate}
            onContextMenu={(event, entry) => {
              event.preventDefault();
              onActivate();
              if (entry && !tab.selectedIds.includes(entry.uri)) {
                onSelect(entry.uri);
              }
              onContextMenu({
                panelId,
                x: event.clientX,
                y: event.clientY,
                entry,
              });
            }}
          />
        )}
        <RecursiveSearchPanel
          panelId={panelId}
          search={search}
          onOpen={(entry) => onEntryActivate(entry)}
          onReveal={onReveal}
          onProperties={onProperties}
        />
        <footer className="fo-pane-status">
          {tab.selectedIds.length} selected - {entries.length} items
        </footer>
      </div>
    </section>
  );
}

interface PathBarProps {
  value: string;
  error: string | null;
  focusToken: number;
  onSubmit: (value: string) => void;
}

function PathBar({ value, error, focusToken, onSubmit }: PathBarProps) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(value);
    }
  }, [editing, value]);

  useEffect(() => {
    if (focusToken > 0) {
      setEditing(true);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [focusToken]);

  if (!editing) {
    return (
      <div
        className={error ? "fo-path-error-wrap" : undefined}
        onDoubleClick={() => setEditing(true)}
      >
        <BreadcrumbPath
          segments={breadcrumbSegments(value).map((segment) => ({
            label: segment.label,
            path: segment.uri,
          }))}
          onNavigate={onSubmit}
          onEditPath={() => setEditing(true)}
        />
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      className={error ? "fo-path fo-path-error" : "fo-path"}
      value={editing ? draft : value}
      aria-label="Current path"
      onFocus={() => setEditing(true)}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          setEditing(false);
          onSubmit(draft);
        }

        if (event.key === "Escape") {
          setEditing(false);
          setDraft(value);
        }
      }}
      onBlur={() => {
        setEditing(false);
        setDraft(value);
      }}
    />
  );
}

interface FilterInputProps {
  panelId: PanelId;
  value: string;
  focusToken: number;
  onChange: (value: string) => void;
}

function FilterInput({
  panelId,
  value,
  focusToken,
  onChange,
}: FilterInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (focusToken > 0) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [focusToken]);

  return (
    <SearchInput
      ref={inputRef}
      className="fo-filter"
      aria-label={`${panelId} filter`}
      value={value}
      placeholder="Filter current folder…"
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

interface RecursiveSearchPanelProps {
  panelId: PanelId;
  search: SearchState | null;
  onOpen: (entry: FileEntryDto) => void;
  onReveal: (entry: FileEntryDto) => void;
  onProperties: (entry: FileEntryDto) => void;
}

function RecursiveSearchPanel({
  search,
  onOpen,
  onReveal,
  onProperties,
}: RecursiveSearchPanelProps) {
  if (!search) {
    return null;
  }

  const matches = search.result?.matches ?? [];

  return (
    <section
      className="fo-search-results"
      aria-label="Recursive search results"
    >
      <header>
        <strong>
          {search.running ? "Searching" : `${matches.length} result(s)`}
        </strong>
        {search.error ? <span>{search.error}</span> : null}
      </header>
      {matches.length === 0 && !search.running ? (
        <div className="fo-empty-inline">No recursive matches</div>
      ) : null}
      {matches.slice(0, 50).map((match) => {
        const entry = searchMatchToEntry(match);

        return (
          <div className="fo-search-row" key={match.uri}>
            <span>
              {fileIconGlyph(entry)} {match.name}
            </span>
            <span>{localPathFromUri(match.parentUri)}</span>
            <button type="button" onClick={() => onOpen(entry)}>
              Open
            </button>
            <button type="button" onClick={() => onReveal(entry)}>
              Reveal
            </button>
            <button type="button" onClick={() => onProperties(entry)}>
              Properties
            </button>
          </div>
        );
      })}
      {search.result?.incomplete ? (
        <div className="fo-empty-inline">
          Some folders could not be searched.
        </div>
      ) : null}
    </section>
  );
}

function propertyType(properties: PathPropertiesDto): string {
  if (properties.kind === "directory") {
    return "Folder";
  }

  if (properties.isSymlink) {
    return "Symlink";
  }

  return properties.kind;
}

function localPathFromUri(uri: string): string {
  return uri.replace(/^local:\/\//, "");
}

function breadcrumbSegments(
  uri: string,
): Array<{ label: string; uri: string }> {
  const path = localPathFromUri(uri).replace(/\/+$/, "");
  const segments = path.split("/").filter(Boolean);
  const result: Array<{ label: string; uri: string }> = [];
  let current = "";

  if (path.startsWith("/")) {
    result.push({ label: "/", uri: "local:///" });
  }

  for (const segment of segments) {
    current =
      path.startsWith("/") || current ? `${current}/${segment}` : segment;
    result.push({
      label: segment,
      uri: `local://${path.startsWith("/") ? current : `${current}/`}`,
    });
  }

  return result.length > 0 ? result : [{ label: uri, uri }];
}

function searchMatchToEntry(
  match: RecursiveSearchResultDto["matches"][number],
): FileEntryDto {
  return {
    uri: match.uri,
    name: match.name,
    kind: match.kind,
    size: match.size,
    modifiedAt: match.modifiedAt,
    isHidden: false,
    isSymlink: match.kind === "symlink",
    providerId: "local",
    canRead: true,
    canList: match.kind === "directory",
    canWrite: true,
    canDelete: true,
    canRename: true,
  };
}

interface OperationDialogViewProps {
  dialog: OperationDialog | null;
  onClose: () => void;
  onUpdate: (dialog: OperationDialog) => void;
  onReviewCopyMove: (
    dialog: Extract<OperationDialog, { type: "copyMove" }>,
  ) => void;
  onSubmitCreateFolder: (
    dialog: Extract<OperationDialog, { type: "createFolder" }>,
  ) => void;
  onSubmitCreateFile: (
    dialog: Extract<OperationDialog, { type: "createFile" }>,
  ) => void;
  onSubmitRename: (
    dialog: Extract<OperationDialog, { type: "rename" }>,
  ) => void;
  onSubmitCopyMove: (
    dialog: Extract<OperationDialog, { type: "copyMove" }>,
  ) => void;
  onSubmitTrash: (dialog: Extract<OperationDialog, { type: "trash" }>) => void;
  onSubmitPermanentDelete: (
    dialog: Extract<OperationDialog, { type: "permanentDelete" }>,
  ) => void;
  onCopyPath: (panelId: PanelId) => void;
  onReveal: (panelId: PanelId, entry: FileEntryDto | null) => void;
}

function OperationDialogView({
  dialog,
  onClose,
  onUpdate,
  onReviewCopyMove,
  onSubmitCreateFolder,
  onSubmitCreateFile,
  onSubmitRename,
  onSubmitCopyMove,
  onSubmitTrash,
  onSubmitPermanentDelete,
  onCopyPath,
  onReveal,
}: OperationDialogViewProps) {
  useDialogEscape(Boolean(dialog), onClose);

  if (!dialog) {
    return null;
  }

  const title =
    dialog.type === "createFolder"
      ? "Create Folder"
      : dialog.type === "createFile"
        ? "Create File"
        : dialog.type === "rename"
          ? "Rename"
          : dialog.type === "properties"
            ? "Properties"
            : dialog.type === "permanentDelete"
              ? "Delete Permanently"
              : dialog.type === "trash"
                ? "Move to Trash"
                : dialog.kind === "copy"
                  ? "Copy"
                  : "Move";

  return (
    <div className="fo-dialog-backdrop" role="presentation">
      <section
        className="fo-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <strong>{title}</strong>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>
        {dialog.type === "createFolder" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitCreateFolder(dialog);
            }}
          >
            <label>
              Folder name
              <input
                aria-label="Folder name"
                value={dialog.name}
                onChange={(event) =>
                  onUpdate({ ...dialog, name: event.target.value, error: null })
                }
              />
            </label>
            {dialog.error ? (
              <div className="fo-operation-error">{dialog.error}</div>
            ) : null}
            <Button type="submit" variant="primary" size="sm">
              Create
            </Button>
          </form>
        ) : null}
        {dialog.type === "createFile" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitCreateFile(dialog);
            }}
          >
            <label>
              File name
              <input
                aria-label="File name"
                value={dialog.name}
                onChange={(event) =>
                  onUpdate({ ...dialog, name: event.target.value, error: null })
                }
              />
            </label>
            {dialog.error ? (
              <div className="fo-operation-error">{dialog.error}</div>
            ) : null}
            <Button type="submit" variant="primary" size="sm">
              Create
            </Button>
          </form>
        ) : null}
        {dialog.type === "rename" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitRename(dialog);
            }}
          >
            <label>
              New name
              <input
                aria-label="New name"
                value={dialog.name}
                onChange={(event) =>
                  onUpdate({ ...dialog, name: event.target.value, error: null })
                }
              />
            </label>
            {dialog.error ? (
              <div className="fo-operation-error">{dialog.error}</div>
            ) : null}
            <Button type="submit" variant="primary" size="sm">
              Rename
            </Button>
          </form>
        ) : null}
        {dialog.type === "copyMove" ? (
          dialog.step === "confirm-overwrite" ? (
            <section className="fo-dialog-section">
              <h3>Confirm overwrite</h3>
              <p>
                The conflict policy is set to overwrite. Files at the destination
                with the same name will be replaced. Continue?
              </p>
              <div className="fo-dialog-actions">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onUpdate({ ...dialog, step: "review" })
                  }
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => void onSubmitCopyMove(dialog)}
                >
                  Overwrite
                </Button>
              </div>
            </section>
          ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitCopyMove(dialog);
            }}
          >
            <label>
              Destination local URI
              <input
                aria-label="Destination local URI"
                value={dialog.destination}
                onChange={(event) =>
                  onUpdate({
                    ...dialog,
                    destination: event.target.value,
                    plan: null,
                    error: null,
                  })
                }
              />
            </label>
            <label>
              Conflict policy
              <select
                aria-label="Conflict policy"
                value={dialog.conflictPolicy}
                onChange={(event) =>
                  onUpdate({
                    ...dialog,
                    conflictPolicy: event.target.value as ConflictPolicy,
                    plan: null,
                    error: null,
                  })
                }
              >
                <option value="fail">Fail without changes</option>
                <option value="skip">Skip existing destinations</option>
                <option value="overwrite">
                  Overwrite existing destinations
                </option>
                <option value="renameNew">Rename new items</option>
                <option value="renameExisting">Rename existing items</option>
              </select>
            </label>
            <div className="fo-dialog-summary">
              {dialog.entries.length} item(s) selected
            </div>
            {dialog.plan ? (
              <div className="fo-dialog-summary">
                <span>
                  {dialog.plan.totalItems} planned item(s),{" "}
                  {dialog.plan.conflicts.length} conflict(s)
                </span>
                {dialog.plan.conflicts.slice(0, 3).map((conflict) => (
                  <span key={`${conflict.source}-${conflict.destination}`}>
                    {conflict.destination}
                  </span>
                ))}
                {dialog.plan.warnings.slice(0, 3).map((warning) => (
                  <span key={`${warning.code}-${warning.uri ?? ""}`}>
                    {warning.message}
                  </span>
                ))}
              </div>
            ) : null}
            {dialog.error ? (
              <div className="fo-operation-error">{dialog.error}</div>
            ) : null}
            <div className="fo-dialog-actions">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={dialog.planning}
                onClick={() => onReviewCopyMove(dialog)}
              >
                {dialog.planning ? "Planning" : "Plan"}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={dialog.planning || !dialog.plan}
              >
                Start
              </Button>
            </div>
          </form>
          )
        ) : null}
        {dialog.type === "trash" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitTrash(dialog);
            }}
          >
            <div className="fo-dialog-summary">
              <span>Move {dialog.entries.length} item(s) to Trash</span>
              {dialog.entries.slice(0, 3).map((entry) => (
                <span key={entry.uri}>{entry.name}</span>
              ))}
            </div>
            {dialog.error ? (
              <div className="fo-operation-error">{dialog.error}</div>
            ) : null}
            <label className="fo-checkbox-label">
              <input
                type="checkbox"
                checked={dialog.dontAskAgain}
                onChange={(event) =>
                  onUpdate({
                    ...dialog,
                    dontAskAgain: event.target.checked,
                  })
                }
              />
              Don&apos;t ask again this session
            </label>
            <Button type="submit" variant="primary" size="sm">
              Move to Trash
            </Button>
          </form>
        ) : null}
        {dialog.type === "permanentDelete" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitPermanentDelete(dialog);
            }}
          >
            <div className="fo-dialog-summary">
              <span>Permanently delete {dialog.entries.length} item(s)</span>
              {dialog.entries.slice(0, 5).map((entry) => (
                <span key={entry.uri}>{entry.name}</span>
              ))}
            </div>
            {dialog.error ? (
              <div className="fo-operation-error">{dialog.error}</div>
            ) : null}
            <Button type="submit" variant="danger" size="sm">
              Delete Permanently
            </Button>
          </form>
        ) : null}
        {dialog.type === "properties" ? (
          <div className="fo-properties">
            {dialog.loading ? <div>Loading</div> : null}
            {dialog.error ? (
              <div className="fo-operation-error">{dialog.error}</div>
            ) : null}
            {dialog.properties ? (
              <>
                <dl>
                  <dt>Name</dt>
                  <dd>{dialog.properties.name}</dd>
                  <dt>Path</dt>
                  <dd>{localPathFromUri(dialog.properties.uri)}</dd>
                  <dt>Type</dt>
                  <dd>{propertyType(dialog.properties)}</dd>
                  <dt>Size</dt>
                  <dd>
                    {formatSize(
                      dialog.properties.size ?? dialog.properties.totalSize,
                    )}
                  </dd>
                  <dt>Items</dt>
                  <dd>{dialog.properties.itemCount ?? "Unavailable"}</dd>
                  <dt>Modified</dt>
                  <dd>{formatDate(dialog.properties.modifiedAt)}</dd>
                  <dt>Created</dt>
                  <dd>{formatDate(dialog.properties.createdAt)}</dd>
                  <dt>Accessed</dt>
                  <dd>{formatDate(dialog.properties.accessedAt)}</dd>
                  <dt>Hidden</dt>
                  <dd>{dialog.properties.isHidden ? "Yes" : "No"}</dd>
                  <dt>Read-only</dt>
                  <dd>{dialog.properties.readonly ? "Yes" : "No"}</dd>
                </dl>
                {dialog.properties.warnings.length > 0 ? (
                  <div className="fo-dialog-summary">
                    {dialog.properties.warnings.slice(0, 3).map((warning) => (
                      <span key={warning}>{warning}</span>
                    ))}
                  </div>
                ) : null}
                <div className="fo-dialog-actions">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onCopyPath(dialog.panelId)}
                  >
                    Copy Path
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onReveal(dialog.panelId, dialog.entry)}
                  >
                    Reveal
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function jobIdValue(jobId: JobSnapshot["jobId"]): string {
  return typeof jobId === "string" ? jobId : String(jobId.value ?? "");
}

function snapshotFromStarted(event: JobStartedEvent): JobSnapshot {
  const now = event.startedAt;

  return {
    jobId: event.jobId,
    operationKind: event.operationKind,
    status: "running",
    currentItem: null,
    completedItems: 0,
    totalItems: event.totalItems,
    completedBytes: 0,
    totalBytes: event.totalBytes,
    errorCode: null,
    message: null,
    startedAt: now,
    updatedAt: now,
  };
}

function mergeProgress(
  current: Record<string, JobSnapshot>,
  event: JobProgressEvent,
): JobSnapshot {
  const existing =
    current[jobIdValue(event.jobId)] ??
    snapshotFromStarted({
      jobId: event.jobId,
      operationKind: event.operationKind,
      totalItems: event.totalItems,
      totalBytes: event.totalBytes,
      startedAt: event.updatedAt,
    });

  return {
    ...existing,
    status: "running",
    currentItem: event.currentItem,
    completedItems: event.completedItems,
    totalItems: event.totalItems,
    completedBytes: event.completedBytes,
    totalBytes: event.totalBytes,
    updatedAt: event.updatedAt,
  };
}

function mergeCompleted(
  current: Record<string, JobSnapshot>,
  event: JobCompletedEvent,
): JobSnapshot {
  const existing =
    current[jobIdValue(event.jobId)] ??
    snapshotFromStarted({
      jobId: event.jobId,
      operationKind: event.operationKind,
      totalItems: event.completedItems,
      totalBytes: event.completedBytes,
      startedAt: event.completedAt,
    });

  return {
    ...existing,
    status: "completed",
    completedItems: event.completedItems,
    completedBytes: event.completedBytes,
    updatedAt: event.completedAt,
  };
}

function mergeFailed(
  current: Record<string, JobSnapshot>,
  event: JobFailedEvent,
): JobSnapshot {
  const existing =
    current[jobIdValue(event.jobId)] ??
    snapshotFromStarted({
      jobId: event.jobId,
      operationKind: event.operationKind,
      totalItems: 0,
      totalBytes: 0,
      startedAt: event.failedAt,
    });

  return {
    ...existing,
    status: "failed",
    errorCode: event.errorCode,
    message: event.message,
    updatedAt: event.failedAt,
  };
}

function mergeCancelled(
  current: Record<string, JobSnapshot>,
  event: JobCancelledEvent,
): JobSnapshot {
  const existing =
    current[jobIdValue(event.jobId)] ??
    snapshotFromStarted({
      jobId: event.jobId,
      operationKind: event.operationKind,
      totalItems: 0,
      totalBytes: 0,
      startedAt: event.cancelledAt,
    });

  return {
    ...existing,
    status: "cancelled",
    updatedAt: event.cancelledAt,
  };
}

function joinLocalUri(parent: string, name: string): string {
  return `${parent.replace(/\/$/, "")}/${name}`;
}

function isValidName(name: string): boolean {
  return Boolean(name.trim()) && !/[\\/]/.test(name) && !name.includes("\0");
}

function operationErrorMessage(code: string, fallback: string): string {
  const messages: Record<string, string> = {
    permission_denied: "Permission denied for this operation.",
    not_found: "The selected file or folder no longer exists.",
    destination_missing: "The destination folder no longer exists.",
    destination_conflict: "A destination item already exists.",
    invalid_name: "Enter a valid name without path separators.",
    unsupported_symlink:
      "Symlink file operations are not supported in this MVP.",
    unsupported_trash: "Move to Trash is not supported on this platform.",
    cancelled: "Operation cancelled.",
    interrupted: "Operation interrupted by app shutdown.",
    timeout: "Directory listing timed out.",
  };

  return messages[code] ?? fallback;
}

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="fo-shell fo-fatal-error">
          <h1>FileOctopus recovered from a UI error</h1>
          {!isProductionBuild ? <pre>{this.state.error.message}</pre> : null}
          <div className="fo-dialog-actions">
            <button type="button" onClick={() => globalThis.location.reload()}>
              Reload
            </button>
            <button
              type="button"
              onClick={() =>
                void globalThis.navigator.clipboard?.writeText(
                  this.state.error?.stack ?? this.state.error?.message ?? "",
                )
              }
            >
              Copy Diagnostics
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
