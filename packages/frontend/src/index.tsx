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
  panelReducer,
  parentUri,
  selectVisibleEntries,
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
import { useMenuBarProps } from "./hooks/useMenuBarProps";
import { useEventHandlers } from "./hooks/useEventHandlers";
import {
  useFileOpHandlers,
  type FileClipboardState,
} from "./hooks/useFileOpHandlers";
import { SidebarResizer, SplitResizer } from "./shell/LayoutResizers";
import { TitleBar } from "./shell/TitleBar";
import { Sidebar } from "./sidebar/Sidebar";
import { type ContextMenuState } from "./components/ContextMenu";
import { ContextMenuOverlay } from "./components/ContextMenuOverlay";
import type { CommandEntry } from "./components/CommandPalette";
import { isTextPreviewable } from "./components/PreviewPanel";
import { ToastStack, type ToastMessage } from "./components/ToastStack";
import { DialogOverlayGroup } from "./components/DialogOverlayGroup";

import { FilePanel, type FilePanelProps } from "./pane/FilePanel";
import {
  type OperationDialog,
  jobIdValue,
  snapshotFromStarted,
  mergeProgress,
  mergeCompleted,
  mergeFailed,
  mergeCancelled,
} from "./dialogs/OperationDialogView";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { StatusBarSection } from "./components/StatusBarSection";
import { isEditableTarget, shortcutEntries } from "./shortcuts";
import type { UserPreferencesDto } from "@fileoctopus/ts-api";

const isProductionBuild = Boolean(
  (import.meta as ImportMeta & { env?: { PROD?: boolean } }).env?.PROD,
);

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

  const {
    pushToast,
    updatePreference,
    handleCommandSelect,
    handleSetAutostart,
    navigatePanel,
    refreshNavigation,
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
  } = useEventHandlers({
    client,
    state,
    dispatch,
    preferences,
    diagnosticsDestination,
    setToasts,
    setPreferences,
    setDensity,
    setActivityCollapsed,
    setOperationError,
    setSearch,
    setCommandPaletteOpen,
    setSettingsOpen,
    setShortcutsOpen,
    setDiagnosticsOpen,
    setFilterFocusToken,
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
  });

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

  const {
    reviewCopyMoveDialog,
    selectedEntries,
    openExternal,
    revealEntry,
    calculateSize,
    copySelectionToFileClipboard,
    pasteClipboard,
    copyTextFromSelection,
    handleCreateFolder,
    handleCreateFile,
    handleRename,
    handleCopyOrMove,
    handleTrash,
    toggleStarredForEntry,
    handlePermanentDelete,
    handleProperties,
    runRecursiveSearch,
    toggleHidden,
    openTerminal,
    handleChecksum,
    submitCreateFolder,
    submitCreateFile,
    submitRename,
    submitCopyMove,
    submitTrash,
    submitPermanentDelete,
  } = useFileOpHandlers({
    client,
    state,
    dispatch,
    setSearch,
    setDialog,
    setClipboard,
    clipboard,
    setJobs,
    setOperationError,
    pushToast,
    preferences,
    refreshPanel,
    refreshVisiblePanels,
    refreshNavigation,
    navigatePanel,
  });

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

  const menuBarProps = useMenuBarProps({
    state,
    dispatch,
    client,
    locations,
    clipboard,
    setClipboard,
    preferences,
    setDensity,
    goHistory,
    navigatePanel,
    refreshPanel,
    refreshNavigation,
    activateEntry,
    selectedEntries,
    openExternal,
    revealEntry,
    handleCreateFolder,
    handleCreateFile,
    handleRename,
    handleTrash,
    handlePermanentDelete,
    handleProperties,
    copySelectionToFileClipboard,
    pasteClipboard,
    copyTextFromSelection,
    toggleHidden,
    updatePreference,
    pushToast,
    setPathFocusToken,
    setFilterFocusToken,
    setRecursiveSearchFocusToken,
    setSettingsOpen,
    setShortcutsOpen,
    setDiagnosticsOpen,
  });

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
