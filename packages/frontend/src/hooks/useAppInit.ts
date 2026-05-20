import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { normalizeIpcError, type FileOctopusClient } from "@fileoctopus/ts-api";
import type {
  AutostartStatusDto,
  AppInfoResponse,
  JobSnapshot,
  StarredEntryDto,
  UserPreferencesDto,
  FolderSizeCompletedEventDto,
  NetworkConnectionStatusDto,
  RecursiveSearchMatchEventDto,
  RecursiveSearchCompletedEventDto,
} from "@fileoctopus/ts-api";
import {
  activeTab,
  selectVisibleEntries,
  type FileOctopusState,
  type PanelAction,
  type PanelId,
  type PanelTabState,
} from "../panelStore";
import {
  applyAllPreferences,
  applyDensityPreference,
  applyLayoutPreferences,
  rowHeightForDensity,
  viewModeFromPreference,
  type DensityPreference,
} from "../applyPreferences";
import { migrateLegacyChromePreferences } from "../state/chromeStore";
import { formatSize } from "../pane/fileTableUtils";
import type { ToastMessage } from "../components/ToastStack";
import type { OperationDialog } from "../dialogs/OperationDialogView";
import {
  jobIdValue,
  snapshotFromStarted,
  mergeProgress,
  mergeCompleted,
  mergeFailed,
  mergeCancelled,
} from "../dialogs/OperationDialogView";
import type { SearchState } from "../pane/PaneFilterBar";

const DEFAULT_VIEW_MODE_DETAILS_MIGRATION_KEY =
  "fileoctopus.defaultViewModeDetailsMigrated";

function isDefaultViewModeDetailsMigrationDone(): boolean {
  try {
    return (
      localStorage.getItem(DEFAULT_VIEW_MODE_DETAILS_MIGRATION_KEY) === "true"
    );
  } catch {
    return false;
  }
}

function markDefaultViewModeDetailsMigrationDone() {
  try {
    localStorage.setItem(DEFAULT_VIEW_MODE_DETAILS_MIGRATION_KEY, "true");
  } catch {
    return;
  }
}

export interface UseAppInitParams {
  client: FileOctopusClient;
  state: FileOctopusState;
  dispatch: Dispatch<PanelAction>;
  hasInitializedRef: MutableRefObject<boolean>;
  settingsOpen: boolean;
  left: PanelTabState;
  right: PanelTabState;
  density: DensityPreference;
  preferences: UserPreferencesDto | null;
  starred: StarredEntryDto[];
  pushToast: (toast: Omit<ToastMessage, "id">) => void;
  refreshPanel: (
    panelId: PanelId,
    options?: {
      replace?: boolean;
      includeHidden?: boolean;
      softRefresh?: boolean;
    },
  ) => void;
  refreshVisiblePanels: () => void;
  refreshHistory: () => Promise<void>;
  refreshLocations: () => Promise<void>;
  refreshNetworkProfiles: () => Promise<void>;
  refreshNavigation: () => Promise<void>;
  refreshDiagnostics: () => void;
  setAppInfo: Dispatch<SetStateAction<AppInfoResponse | null>>;
  appInfo: AppInfoResponse | null;
  updatePreference: (key: string, value: string) => Promise<void>;
  navigatePanel: (
    panelId: PanelId,
    input: string,
    options?: {
      replace?: boolean;
      includeHidden?: boolean;
      softRefresh?: boolean;
    },
  ) => Promise<void>;
  applyFolderSizeCompleted: (event: FolderSizeCompletedEventDto) => void;
  applyRecursiveSearchMatch: (event: RecursiveSearchMatchEventDto) => void;
  applyRecursiveSearchCompleted: (
    event: RecursiveSearchCompletedEventDto,
  ) => void;
  setAutostart: Dispatch<SetStateAction<AutostartStatusDto | null>>;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  setShortcutsOpen: Dispatch<SetStateAction<boolean>>;
  setDiagnosticsOpen: Dispatch<SetStateAction<boolean>>;
  setHelpOpen: Dispatch<SetStateAction<boolean>>;
  setJobs: Dispatch<SetStateAction<Record<string, JobSnapshot>>>;
  setOperationError: Dispatch<SetStateAction<string | null>>;
  setSearch: Dispatch<SetStateAction<SearchState | null>>;
  setDialog: Dispatch<SetStateAction<OperationDialog | null>>;
  setPreferences: Dispatch<SetStateAction<UserPreferencesDto | null>>;
  setDensity: Dispatch<SetStateAction<DensityPreference>>;
  setActivityCollapsed: Dispatch<SetStateAction<boolean>>;
  setNetworkStatuses: Dispatch<SetStateAction<NetworkConnectionStatusDto[]>>;
}

export interface UseAppInitReturn {
  starredUriSet: Set<string>;
  rowHeight: number;
  previewEntry:
    | import("../panelStore").PanelTabState["entriesById"][string]
    | null;
  jobMetrics: Record<
    string,
    {
      speedLabel: string | null;
      etaLabel: string | null;
      lastBytes: number;
      lastAt: number;
    }
  >;
}

export function useAppInit({
  client,
  state,
  dispatch,
  hasInitializedRef,
  settingsOpen,
  left,
  right,
  density,
  preferences,
  starred,
  pushToast,
  refreshPanel,
  refreshVisiblePanels,
  refreshHistory,
  refreshLocations,
  refreshNetworkProfiles,
  refreshNavigation,
  refreshDiagnostics,
  setAppInfo,
  appInfo,
  updatePreference,
  navigatePanel,
  applyFolderSizeCompleted,
  applyRecursiveSearchMatch,
  applyRecursiveSearchCompleted,
  setAutostart,
  setSettingsOpen,
  setShortcutsOpen,
  setDiagnosticsOpen,
  setHelpOpen,
  setJobs,
  setOperationError,
  setSearch,
  setDialog,
  setPreferences,
  setDensity,
  setActivityCollapsed,
  setNetworkStatuses,
}: UseAppInitParams): UseAppInitReturn {
  const preferencesRef = useRef(preferences);
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

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  const previewEntry = useMemo(() => {
    const tab = activeTab(state.panels[state.activePanelId]);
    return (
      selectVisibleEntries(tab).find((e) => e.uri === tab.selectedId) ?? null
    );
  }, [state]);

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

  // ── File system watcher: directory batch ────────────────────────
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
  }, [client]);

  // ── Active URI navigation: watch changed ────────────────────────
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

  // ── Job event listeners with metrics ────────────────────────────
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
        if (preferencesRef.current?.jobDrawerBehavior === "openOnStart") {
          setActivityCollapsed(false);
          void updatePreference("activityPanelVisible", "true");
        }
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
        if (preferencesRef.current?.jobDrawerBehavior === "openOnError") {
          setActivityCollapsed(false);
          void updatePreference("activityPanelVisible", "true");
        }
        setSearch((current) =>
          current?.jobId === jobIdValue(event.jobId)
            ? { ...current, running: false, error: event.message }
            : current,
        );
        setDialog((current) => {
          const jobId = jobIdValue(event.jobId);
          if (
            current?.type === "selectionProperties" &&
            current.folderSizeJobIds.includes(jobId)
          ) {
            const pendingFolderSizeJobs = current.pendingFolderSizeJobs - 1;
            if (pendingFolderSizeJobs > 0) {
              return {
                ...current,
                pendingFolderSizeJobs,
                error: event.message,
              };
            }
            return {
              ...current,
              pendingFolderSizeJobs: 0,
              calculatingSize: false,
              error: event.message,
            };
          }
          if (
            current?.type === "properties" &&
            current.folderSizeJobId === jobId
          ) {
            return { ...current, loading: false, error: event.message };
          }
          return current;
        });
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
        setDialog((current) => {
          const jobId = jobIdValue(event.jobId);
          if (
            current?.type === "selectionProperties" &&
            current.folderSizeJobIds.includes(jobId)
          ) {
            const pendingFolderSizeJobs = current.pendingFolderSizeJobs - 1;
            if (pendingFolderSizeJobs > 0) {
              return { ...current, pendingFolderSizeJobs };
            }
            return {
              ...current,
              pendingFolderSizeJobs: 0,
              calculatingSize: false,
              totalSize:
                current.folderSizeBytes > 0
                  ? current.fileSizeBaseline + current.folderSizeBytes
                  : current.totalSize,
            };
          }
          if (
            current?.type === "properties" &&
            current.folderSizeJobId === jobId
          ) {
            return { ...current, loading: false };
          }
          return current;
        });
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

  // ── Folder-size + recursive-search listeners ────────────────────
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
    if (!appInfo?.networkEnabled) {
      return;
    }

    let dispose: (() => void) | null = null;
    void client.network
      .subscribeStatusEvents((event) => {
        setNetworkStatuses((current) => {
          const others = current.filter(
            (status) => status.profileId !== event.profileId,
          );
          return [
            ...others,
            {
              profileId: event.profileId,
              status: event.status,
              message: event.message,
            },
          ];
        });
      })
      .then((unsub) => {
        dispose = unsub;
      })
      .catch(() => undefined);

    return () => {
      dispose?.();
    };
  }, [appInfo?.networkEnabled, client, setNetworkStatuses]);

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

  // ── Initialization: preferences, navigation, locations, etc. ────
  useEffect(() => {
    if (hasInitializedRef.current) {
      return;
    }
    hasInitializedRef.current = true;

    void (async () => {
      let showHidden = false;

      try {
        const info = await client.getAppInfo();
        setAppInfo(info);
        if (info.networkEnabled) {
          void refreshNetworkProfiles();
        }
      } catch {
        /* app info unavailable */
      }

      void refreshLocations();
      void refreshNavigation();

      try {
        const response = await client.preferences.get();
        let loadedPreferences = response.preferences;
        try {
          loadedPreferences = await migrateLegacyChromePreferences(
            client,
            loadedPreferences,
          );
        } catch {
          /* keep loaded preferences */
        }
        const shouldMigrateDefaultViewMode =
          loadedPreferences.defaultViewMode !== "details" &&
          !isDefaultViewModeDetailsMigrationDone();

        if (shouldMigrateDefaultViewMode) {
          try {
            const updated = await client.preferences.set({
              key: "defaultViewMode",
              value: "details",
            });
            loadedPreferences = updated.preferences;
            markDefaultViewModeDetailsMigrationDone();
          } catch {
            loadedPreferences = {
              ...loadedPreferences,
              defaultViewMode: "details",
            };
          }
        }
        setPreferences(loadedPreferences);
        applyAllPreferences(loadedPreferences);
        applyLayoutPreferences(loadedPreferences);
        setDensity(applyDensityPreference(loadedPreferences.density));
        setActivityCollapsed(!loadedPreferences.activityPanelVisible);
        showHidden = loadedPreferences.showHiddenFiles;
        dispatch({
          type: "hydratePreferences",
          showHidden,
          viewMode: viewModeFromPreference(loadedPreferences.defaultViewMode),
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

  return { starredUriSet, rowHeight, previewEntry, jobMetrics };
}
