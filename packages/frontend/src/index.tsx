import {
  type KeyboardEvent,
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
  AutostartStatusDto,
  ConflictPolicy,
  FileEntryDto,
  FileOperationPlanDto,
  FileOperationKind,
  FolderSizeCompletedEventDto,
  RecursiveSearchCompletedEventDto,
  RecursiveSearchMatchEventDto,
  StandardLocationDto,
  FavoriteEntryDto,
  RecentEntryDto,
  StarredEntryDto,
  JobSnapshot,
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
import { ActivityPanel } from "./activity/ActivityPanel";
import type { SearchState } from "./pane/PaneFilterBar";
import { formatSize } from "./pane/fileTableUtils";
import { useWorkspaceLayout } from "./hooks/useWorkspaceLayout";
import { SidebarResizer, SplitResizer } from "./shell/LayoutResizers";
import { TitleBar } from "./shell/TitleBar";
import type { MenuBarProps } from "./shell/MenuBar";
import { Sidebar } from "./sidebar/Sidebar";
import { type ContextMenuState } from "./components/ContextMenu";
import { ContextMenuOverlay } from "./components/ContextMenuOverlay";
import type { CommandEntry } from "./components/CommandPalette";
import { isTextPreviewable } from "./components/PreviewPanel";
import { ToastStack, type ToastMessage } from "./components/ToastStack";
import { DialogOverlayGroup } from "./components/DialogOverlayGroup";
import { mergeToast } from "./toastNotifications";

import { FilePanel, type FilePanelProps } from "./pane/FilePanel";
import { localPathFromUri } from "./utils/paneUtils";
import {
  type OperationDialog,
  jobIdValue,
  snapshotFromStarted,
  mergeProgress,
  mergeCompleted,
  mergeFailed,
  mergeCancelled,
  joinLocalUri,
  isValidName,
  operationErrorMessage,
} from "./dialogs/OperationDialogView";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { StatusBarSection } from "./components/StatusBarSection";
import { createRequestId } from "./paneTypes";
import { isEditableTarget, shortcutEntries } from "./shortcuts";
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
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [autostart, setAutostart] = useState<AutostartStatusDto | null>(null);

  // ── Autostart: fetch when settings dialog opens ─────────────────
  useEffect(() => {
    if (!settingsOpen) return;
    void client.autostart
      .get()
      .then(setAutostart)
      .catch(() => setAutostart(null));
  }, [settingsOpen]);

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

  const previewEntry = useMemo(() => {
    const tab = activeTab(state.panels[state.activePanelId]);
    return (
      selectVisibleEntries(tab).find((e) => e.uri === tab.selectedId) ?? null
    );
  }, [state]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let disposed = false;
    client.fs
      .onDirectoryBatch((event) => {
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

  // ── On-demand hash computation for selected file ──────────────────
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
  ]);

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

  // ── Command Palette entries ──────────────────────────────────────
  const commandEntries: CommandEntry[] = useMemo(
    () => [
      ...shortcutEntries.map((s) => ({
        id: s.id,
        label: s.label,
        shortcutKey: s.windowsLinux,
        category: s.category,
      })),
      {
        id: "settings",
        label: "Open Settings",
        shortcutKey: "Ctrl+,",
        category: "App",
      },
      {
        id: "shortcuts",
        label: "Show Keyboard Shortcuts",
        shortcutKey: "Ctrl+/",
        category: "App",
      },
      { id: "diagnostics", label: "Open Diagnostics", category: "App" },
      { id: "toggle-sidebar", label: "Toggle Sidebar", category: "View" },
    ],
    [],
  );

  function handleCommandSelect(id: string) {
    setCommandPaletteOpen(false);
    const panelId = state.activePanelId;
    const tab = activeTab(state.panels[panelId]);
    switch (id) {
      case "settings":
        setSettingsOpen(true);
        break;
      case "shortcuts":
        setShortcutsOpen(true);
        break;
      case "diagnostics":
        setDiagnosticsOpen(true);
        break;
      case "toggle-sidebar":
        void updatePreference(
          "sidebarVisible",
          String(preferences?.sidebarVisible === false),
        );
        break;
      case "switch-pane":
        dispatch({
          type: "setActivePanel",
          panelId: panelId === "left" ? "right" : "left",
        });
        break;
      case "up": {
        const upUri = parentUri(tab.uri);
        if (upUri) void navigatePanel(panelId, upUri);
        break;
      }
      case "refresh":
        refreshPanel(panelId);
        break;
      case "filter":
        setFilterFocusToken((v) => v + 1);
        break;
      case "toggle-hidden":
        dispatch({ type: "toggleHidden", panelId });
        break;
      default:
        break;
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

    console.log("[FO][listStart→]", { panelId, uri, requestId, includeHidden });

    try {
      const response = await client.fs.listStart({
        uri,
        requestId,
        panelId,
        batchSize: 256,
        includeHidden,
      });

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

  async function calculateSize(panelId: PanelId, entry: FileEntryDto | null) {
    if (!entry || entry.kind !== "directory") {
      return;
    }

    try {
      const result = await client.fs.startFolderSizeJob({ uri: entry.uri });
      setDialog({
        type: "properties",
        panelId,
        entry,
        properties: null,
        loading: true,
        folderSizeJobId: jobIdValue(result.job.jobId),
        error: null,
      });
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setOperationError(
        operationErrorMessage(normalized.code, normalized.message),
      );
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
    mode: "path" | "name" | "parentPath" | "uri",
  ) {
    const entries = selectedEntries(panelId);

    if (entries.length === 0) {
      return;
    }

    const text = entries
      .map((entry) => {
        switch (mode) {
          case "path":
            return localPathFromUri(entry.uri);
          case "name":
            return entry.name;
          case "parentPath":
            return localPathFromUri(parentUri(entry.uri) ?? "");
          case "uri":
            return entry.uri;
        }
      })
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

  async function openTerminal(uri: string) {
    try {
      await client.fs.openTerminal({ uri });
    } catch (error) {
      const normalized = normalizeIpcError(error);
      pushToast({
        tone: "error",
        title: `Failed to open terminal: ${normalized.message}`,
      });
    }
  }

  async function handleChecksum(panelId: PanelId) {
    const tab = activeTab(state.panels[panelId]);
    const selectedEntry =
      selectVisibleEntries(tab).find((e) => e.uri === tab.selectedId) ?? null;

    if (!selectedEntry || selectedEntry.kind === "directory") {
      pushToast({ tone: "error", title: "Select a file to compute checksum" });
      return;
    }

    try {
      const result = await client.fs.computeHash({
        uri: selectedEntry.uri,
        algorithm: "sha256",
      });
      pushToast({
        tone: "success",
        title: `SHA-256: ${result.hash}`,
      });
    } catch (error) {
      const normalized = normalizeIpcError(error);
      pushToast({
        tone: "error",
        title: `Checksum failed: ${normalized.message}`,
      });
    }
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
      if (commandPaletteOpen) {
        event.preventDefault();
        setCommandPaletteOpen(false);
        return;
      }
      if (previewOpen) {
        event.preventDefault();
        setPreviewOpen(false);
        return;
      }
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

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
      event.preventDefault();
      setCommandPaletteOpen(true);
      return;
    }

    const panelId = state.activePanelId;
    const tab = activeTab(state.panels[panelId]);
    const selectedEntry =
      selectVisibleEntries(tab).find((entry) => entry.uri === tab.selectedId) ??
      null;

    if (event.key === " " && !event.metaKey && !event.ctrlKey) {
      if (!previewOpen && selectedEntry && isTextPreviewable(selectedEntry)) {
        event.preventDefault();
        setPreviewOpen(true);
        return;
      }
      if (previewOpen) {
        event.preventDefault();
        setPreviewOpen(false);
        return;
      }
    }

    if (dialog) {
      return;
    }

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

  const menuBarProps: MenuBarProps = {
    activePanelId: state.activePanelId,
    onBack: () => void goHistory(state.activePanelId, "back"),
    onForward: () => void goHistory(state.activePanelId, "forward"),
    onUp: () => {
      const upUri = parentUri(activeTab(state.panels[state.activePanelId]).uri);
      if (upUri) void navigatePanel(state.activePanelId, upUri);
    },
    onHome: () => void navigatePanel(state.activePanelId, homeUri()),
    onGoToLocation: () => setPathFocusToken((v) => v + 1),
    goStandardLocation: (loc: string) => {
      const match = locations.find(
        (l) => l.id.toLowerCase() === loc.toLowerCase(),
      );
      if (match) void navigatePanel(state.activePanelId, match.uri);
    },
    onNewFolder: () => handleCreateFolder(state.activePanelId),
    onNewFile: () => handleCreateFile(state.activePanelId),
    onOpenSelected: () => {
      const entry = selectedEntries(state.activePanelId)[0];
      if (entry) activateEntry(state.activePanelId, entry);
    },
    onOpenWithDefaultApp: () => {
      const entry = selectedEntries(state.activePanelId)[0];
      if (entry) void openExternal(entry);
    },
    onRevealInFileManager: () => {
      const entry = selectedEntries(state.activePanelId)[0];
      if (entry) void revealEntry(state.activePanelId, entry);
    },
    onRename: () => handleRename(state.activePanelId),
    onCopyTo: () => pushToast({ tone: "info", title: "Copy To… coming soon" }),
    onMoveTo: () => pushToast({ tone: "info", title: "Move To… coming soon" }),
    onTrash: () => handleTrash(state.activePanelId),
    onDeletePermanently: () => handlePermanentDelete(state.activePanelId),
    onProperties: () => void handleProperties(state.activePanelId, null),
    onCut: () => copySelectionToFileClipboard(state.activePanelId, "move"),
    onCopy: () => copySelectionToFileClipboard(state.activePanelId, "copy"),
    onPaste: () => void pasteClipboard(state.activePanelId),
    onClearClipboard: () => setClipboard(null),
    onSelectAll: () =>
      dispatch({ type: "selectAll", panelId: state.activePanelId }),
    onClearSelection: () =>
      dispatch({ type: "clearSelection", panelId: state.activePanelId }),
    onInvertSelection: () =>
      pushToast({ tone: "info", title: "Invert Selection coming soon" }),
    onCopyPath: () => void copyTextFromSelection(state.activePanelId, "path"),
    onCopyName: () => void copyTextFromSelection(state.activePanelId, "name"),
    onCopyParentPath: () =>
      void copyTextFromSelection(state.activePanelId, "parentPath"),
    onCopyResourceUri: () =>
      void copyTextFromSelection(state.activePanelId, "uri"),
    onViewMode: (mode: string) => {
      const panelId = state.activePanelId;
      dispatch({
        type: "setViewMode",
        panelId,
        viewMode: mode as import("./panelStore").ViewMode,
      });
    },
    onSortBy: (field: string) => {
      dispatch({
        type: "setSort",
        panelId: state.activePanelId,
        field: field as import("./panelStore").SortField,
      });
    },
    onSortDirection: (dir: string) => {
      const tab = activeTab(state.panels[state.activePanelId]);
      const ascending = dir === "ascending";
      if ((tab.sort.direction === "asc") !== ascending) {
        dispatch({
          type: "setSort",
          panelId: state.activePanelId,
          field: tab.sort.field,
        });
      }
    },
    onTheme: (theme: string) => {
      void updatePreference("theme", theme);
    },
    onDensity: (density: string) => {
      const d = density as DensityPreference;
      setDensity(d);
      applyDensityPreference(d);
      void updatePreference("density", density);
    },
    onToggleSidebar: () => {
      void updatePreference(
        "sidebarVisible",
        String(preferences?.sidebarVisible === false),
      );
    },
    onToggleToolbar: () =>
      pushToast({ tone: "info", title: "Toggle Toolbar coming soon" }),
    onToggleStatusBar: () =>
      pushToast({ tone: "info", title: "Toggle Status Bar coming soon" }),
    onToggleDualPane: () => {
      pushToast({ tone: "info", title: "Dual Pane coming soon" });
    },
    onToggleHidden: () => toggleHidden(state.activePanelId),
    onRefresh: () => refreshPanel(state.activePanelId),
    onAddFavorite: () => {
      const uri = activeTab(state.panels[state.activePanelId]).uri;
      const name = uri.split("/").filter(Boolean).pop() ?? "Untitled";
      void client.navigation
        .addFavorite({ uri, label: name })
        .then(() => refreshNavigation())
        .catch((error) =>
          pushToast({ tone: "error", title: normalizeIpcError(error).message }),
        );
    },
    onManageFavorites: () => setSettingsOpen(true),
    onFilter: () => setFilterFocusToken((v) => v + 1),
    onSearchRecursive: () => setRecursiveSearchFocusToken((v) => v + 1),
    onJobActivity: () =>
      pushToast({ tone: "info", title: "Job Activity coming soon" }),
    onDiagnostics: () => setDiagnosticsOpen(true),
    onExportDiagnostics: () =>
      pushToast({ tone: "info", title: "Export Diagnostics coming soon" }),
    onSwitchPane: () =>
      dispatch({
        type: "setActivePanel",
        panelId: state.activePanelId === "left" ? "right" : "left",
      }),
    onSwapPanes: () =>
      pushToast({ tone: "info", title: "Swap Panes coming soon" }),
    onEqualizePanes: () =>
      pushToast({ tone: "info", title: "Equalize Panes coming soon" }),
    onShortcuts: () => setShortcutsOpen(true),
    onDocumentation: () => {
      void globalThis.open(
        "https://github.com/nous-research/fileoctopus",
        "_blank",
      );
    },
    onReportIssue: () => {
      void globalThis.open(
        "https://github.com/nous-research/fileoctopus/issues",
        "_blank",
      );
    },
    onAbout: () =>
      pushToast({ tone: "info", title: "About FileOctopus coming soon" }),
    onSettings: () => setSettingsOpen(true),
    onExit: () => pushToast({ tone: "info", title: "Exit coming soon" }),
    canGoBack:
      activeTab(state.panels[state.activePanelId]).backStack.length > 0,
    canGoForward:
      activeTab(state.panels[state.activePanelId]).forwardStack.length > 0,
    hasSelection:
      activeTab(state.panels[state.activePanelId]).selectedIds.length > 0,
    hasClipboard: clipboard !== null,
    sidebarVisible: preferences?.sidebarVisible !== false,
    toolbarVisible: true,
    statusBarVisible: true,
    dualPane: false,
    showHidden: activeTab(state.panels[state.activePanelId]).showHidden,
  };

  function makeFilePanelProps(pid: "left" | "right"): FilePanelProps {
    const tab = activeTab(state.panels[pid]);
    return {
      panelId: pid,
      title: pid === "left" ? "Left" : "Right",
      tab,
      active: state.activePanelId === pid,
      onActivate: () => dispatch({ type: "setActivePanel", panelId: pid }),
      onNavigate: (uri) => navigatePanel(pid, uri),
      onBack: () => void goHistory(pid, "back"),
      onForward: () => void goHistory(pid, "forward"),
      onSelect: (entryId) =>
        dispatch({ type: "setSelection", panelId: pid, entryId }),
      onEntrySelect: (entryId, mode) =>
        dispatch({ type: "selectEntry", panelId: pid, entryId, mode }),
      onCreateFolder: () => handleCreateFolder(pid),
      onCreateFile: () => handleCreateFile(pid),
      onRename: () => handleRename(pid),
      onCopy: () => copySelectionToFileClipboard(pid, "copy"),
      onCut: () => copySelectionToFileClipboard(pid, "move"),
      onCopyOperation: () => handleCopyOrMove(pid, "copy"),
      onMoveOperation: () => handleCopyOrMove(pid, "move"),
      onPaste: () => void pasteClipboard(pid),
      onTrash: () => handleTrash(pid),
      onPermanentDelete: () => handlePermanentDelete(pid),
      onCopyPath: () => void copyTextFromSelection(pid, "path"),
      onCopyName: () => void copyTextFromSelection(pid, "name"),
      onProperties: (entry) => void handleProperties(pid, entry),
      onReveal: (entry) => void revealEntry(pid, entry),
      onCalculateSize: (entry) => void calculateSize(pid, entry),
      onCompress: () =>
        pushToast({ tone: "info", title: "Compress coming soon" }),
      onExtract: () =>
        pushToast({ tone: "info", title: "Extract coming soon" }),
      onOpenTerminal: () => openTerminal(tab.uri),
      onChecksum: () => void handleChecksum(pid),
      onRefresh: () => refreshPanel(pid),
      onToggleHidden: () => toggleHidden(pid),
      onSelectAll: () => dispatch({ type: "selectAll", panelId: pid }),
      onMove: (delta) =>
        dispatch({ type: "moveSelection", panelId: pid, delta }),
      onSort: (field) => dispatch({ type: "setSort", panelId: pid, field }),
      onFilter: (filter) =>
        dispatch({ type: "setFilter", panelId: pid, filter }),
      onRecursiveQuery: (query) =>
        dispatch({ type: "setRecursiveQuery", panelId: pid, query }),
      onRecursiveSearch: () => void runRecursiveSearch(pid),
      onViewMode: (viewMode) =>
        dispatch({ type: "setViewMode", panelId: pid, viewMode }),
      canPaste: Boolean(clipboard),
      pathFocusToken,
      filterFocusToken,
      recursiveSearchFocusToken,
      rowHeight,
      search: search?.panelId === pid ? search : null,
      onContextMenu: setContextMenu,
      onEntryActivate: (entry) => activateEntry(pid, entry),
    };
  }

  return (
    <ErrorBoundary>
      <main className="fo-shell" tabIndex={-1} onKeyDown={handleShellKeyDown}>
        <div className="fo-shell-frame">
          <TitleBar
            onSettings={() => setSettingsOpen(true)}
            menuBarProps={menuBarProps}
          />
          <section
            ref={workspaceRef}
            className="fo-workspace"
            aria-label="File workspace"
          >
            {preferences?.sidebarVisible !== false ? (
              <>
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
              </>
            ) : null}
            <div className="fo-dual-pane" aria-label="File panels">
              <FilePanel {...makeFilePanelProps("left")} />
              <SplitResizer
                onSplitResize={(ratio) => {
                  const nextRatio = applySplitRatio(ratio);
                  void updatePreference("splitRatio", String(nextRatio));
                }}
              />
              <FilePanel {...makeFilePanelProps("right")} />
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
          <DialogOverlayGroup
            preferences={preferences}
            settingsOpen={settingsOpen}
            shortcutsOpen={shortcutsOpen}
            commandPaletteOpen={commandPaletteOpen}
            previewOpen={previewOpen}
            diagnosticsOpen={diagnosticsOpen}
            dialog={dialog}
            autostart={autostart}
            commandEntries={commandEntries}
            previewEntry={previewEntry}
            appInfo={appInfo}
            appHealth={appHealth}
            diagnosticsDestination={diagnosticsDestination}
            diagnosticsMessage={diagnosticsMessage}
            exportingDiagnostics={exportingDiagnostics}
            isProductionBuild={isProductionBuild}
            fs={client.fs}
            updatePreference={updatePreference}
            handleSetAutostart={handleSetAutostart}
            handleCommandSelect={handleCommandSelect}
            setSettingsOpen={setSettingsOpen}
            setShortcutsOpen={setShortcutsOpen}
            setCommandPaletteOpen={setCommandPaletteOpen}
            setDiagnosticsOpen={setDiagnosticsOpen}
            setPreviewOpen={setPreviewOpen}
            setDialog={setDialog}
            setDiagnosticsDestination={setDiagnosticsDestination}
            refreshDiagnostics={refreshDiagnostics}
            exportDiagnostics={exportDiagnostics}
            reviewCopyMoveDialog={reviewCopyMoveDialog}
            submitCreateFolder={submitCreateFolder}
            submitCreateFile={submitCreateFile}
            submitRename={submitRename}
            submitCopyMove={submitCopyMove}
            submitTrash={submitTrash}
            submitPermanentDelete={submitPermanentDelete}
            copyTextFromSelection={copyTextFromSelection}
            revealEntry={revealEntry}
          />
          <ContextMenuOverlay
            menu={contextMenu}
            state={state}
            clipboard={clipboard}
            starredUriSet={starredUriSet}
            dispatch={dispatch}
            onClose={() => setContextMenu(null)}
            activateEntry={activateEntry}
            handleRename={handleRename}
            copySelectionToFileClipboard={copySelectionToFileClipboard}
            pasteClipboard={pasteClipboard}
            handleTrash={handleTrash}
            toggleStarredForEntry={toggleStarredForEntry}
            handlePermanentDelete={handlePermanentDelete}
            copyTextFromSelection={copyTextFromSelection}
            handleProperties={handleProperties}
            revealEntry={revealEntry}
            pushToast={pushToast}
            openTerminal={openTerminal}
            handleChecksum={handleChecksum}
            handleCreateFolder={handleCreateFolder}
            handleCreateFile={handleCreateFile}
            refreshPanel={refreshPanel}
            handleCopyOrMove={handleCopyOrMove}
            openExternal={openExternal}
            toggleHidden={toggleHidden}
          />
          <StatusBarSection
            state={state}
            jobs={jobs}
            operationError={operationError}
            appHealth={appHealth}
            diagnosticsOpen={diagnosticsOpen}
          />
        </div>
      </main>
    </ErrorBoundary>
  );
}
