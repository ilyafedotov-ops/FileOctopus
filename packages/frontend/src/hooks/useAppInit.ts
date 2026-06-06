import {
  useEffect,
  useMemo,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { normalizeIpcError, type FileOctopusClient } from "@fileoctopus/ts-api";
import type {
  AutostartStatusDto,
  AppInfoResponse,
  FileOperationKind,
  JobSnapshot,
  StarredEntryDto,
  UserPreferencesDto,
  FolderSizeCompletedEventDto,
  NetworkConnectionStatusDto,
  RecursiveSearchMatchEventDto,
  RecursiveSearchCompletedEventDto,
  ContentSearchMatchEventDto,
  ContentSearchCompletedEventDto,
  StandardLocationDto,
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
import { resolveStartupAppInfo } from "./startupAppInfo";
import { migrateStartupPreferences } from "./startupPreferences";
import { resolveStartupNavigation } from "./startupNavigation";
import { useFileSystemWatchers } from "./useFileSystemWatchers";
import { useMetadataEventListeners } from "./useMetadataEventListeners";
import { useNetworkStatusEvents } from "./useNetworkStatusEvents";
import { useSelectedFileHash } from "./useSelectedFileHash";
import { formatSize } from "../pane/fileTableUtils";
import type { ToastMessage } from "../components/ToastStack";
import type { OperationDialog } from "../dialogs/OperationDialogView";
import type { JobMetrics } from "../app/providers/JobsProvider";
import {
  jobIdValue,
  snapshotFromStarted,
  mergeProgress,
  mergeCompleted,
  mergeFailed,
  mergeCancelled,
  mergePaused,
  mergeResumed,
} from "../dialogs/OperationDialogView";
import type { SearchState } from "../pane/PaneFilterBar";

function shouldPopupOperationCompleted(kind: FileOperationKind): boolean {
  return (
    kind !== "rename" &&
    kind !== "createFile" &&
    kind !== "createDirectory" &&
    kind !== "deleteToTrash" &&
    kind !== "deletePermanently" &&
    kind !== "writeTextFile"
  );
}

export function shouldRefreshOperationCompleted(
  kind: FileOperationKind,
): boolean {
  return kind !== "rename";
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
      backgroundRefresh?: boolean;
    },
  ) => void;
  refreshOperationTargets: (
    targets: string[] | null,
    options?: { fullReload?: boolean },
  ) => void;
  takeOperationRefreshTargets: (jobId: string) => {
    folderUris: string[];
    removedEntryUris: string[];
  } | null;
  refreshHistory: () => Promise<void>;
  refreshLocations: () => Promise<void>;
  refreshNetworkProfiles: () => Promise<void>;
  refreshNavigation: () => Promise<void>;
  refreshDiagnostics: () => void;
  setLocations: Dispatch<SetStateAction<StandardLocationDto[]>>;
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
      backgroundRefresh?: boolean;
    },
  ) => Promise<void>;
  applyFolderSizeCompleted: (event: FolderSizeCompletedEventDto) => void;
  applyRecursiveSearchMatch: (event: RecursiveSearchMatchEventDto) => void;
  applyRecursiveSearchCompleted: (
    event: RecursiveSearchCompletedEventDto,
  ) => void;
  applyContentSearchMatch: (event: ContentSearchMatchEventDto) => void;
  applyContentSearchCompleted: (event: ContentSearchCompletedEventDto) => void;
  setAutostart: Dispatch<SetStateAction<AutostartStatusDto | null>>;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  setShortcutsOpen: Dispatch<SetStateAction<boolean>>;
  setDiagnosticsOpen: Dispatch<SetStateAction<boolean>>;
  setHelpOpen: Dispatch<SetStateAction<boolean>>;
  setJobs: Dispatch<SetStateAction<Record<string, JobSnapshot>>>;
  setJobMetrics: Dispatch<SetStateAction<Record<string, JobMetrics>>>;
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
  refreshOperationTargets,
  takeOperationRefreshTargets,
  refreshHistory,
  refreshLocations,
  refreshNetworkProfiles,
  refreshNavigation,
  refreshDiagnostics,
  setLocations,
  setAppInfo,
  appInfo,
  updatePreference,
  navigatePanel,
  applyFolderSizeCompleted,
  applyRecursiveSearchMatch,
  applyRecursiveSearchCompleted,
  applyContentSearchMatch,
  applyContentSearchCompleted,
  setAutostart,
  setSettingsOpen,
  setShortcutsOpen,
  setDiagnosticsOpen,
  setHelpOpen,
  setJobs,
  setJobMetrics,
  setOperationError,
  setSearch,
  setDialog,
  setPreferences,
  setDensity,
  setActivityCollapsed,
  setNetworkStatuses,
}: UseAppInitParams): UseAppInitReturn {
  const preferencesRef = useRef(preferences);
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

  useFileSystemWatchers({
    client,
    state,
    left,
    right,
    dispatch,
    refreshPanel,
  });

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
          popup: shouldPopupOperationCompleted(event.operationKind),
        });
        if (shouldRefreshOperationCompleted(event.operationKind)) {
          const refreshPlan = takeOperationRefreshTargets(event.jobId);
          if (refreshPlan?.removedEntryUris.length) {
            dispatch({
              type: "removeEntries",
              uris: refreshPlan.removedEntryUris,
            });
          }
          refreshOperationTargets(
            refreshPlan?.folderUris.length ? refreshPlan.folderUris : null,
            {
              fullReload:
                event.operationKind === "deleteToTrash" ||
                event.operationKind === "deletePermanently",
            },
          );
        }
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
        const refreshPlan = takeOperationRefreshTargets(event.jobId);
        refreshOperationTargets(
          refreshPlan?.folderUris.length ? refreshPlan.folderUris : null,
        );
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
        const cancelledRefreshPlan = takeOperationRefreshTargets(event.jobId);
        refreshOperationTargets(
          cancelledRefreshPlan?.folderUris.length
            ? cancelledRefreshPlan.folderUris
            : null,
        );
        void refreshHistory();
      }),
      client.fileOperations.onJobPaused((event) => {
        setJobs((current) => ({
          ...current,
          [jobIdValue(event.jobId)]: mergePaused(current, event),
        }));
      }),
      client.fileOperations.onJobResumed((event) => {
        setJobs((current) => ({
          ...current,
          [jobIdValue(event.jobId)]: mergeResumed(current, event),
        }));
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

  useMetadataEventListeners({
    client,
    applyFolderSizeCompleted,
    applyRecursiveSearchMatch,
    applyRecursiveSearchCompleted,
    applyContentSearchMatch,
    applyContentSearchCompleted,
  });

  useNetworkStatusEvents({
    client,
    networkEnabled: Boolean(appInfo?.networkEnabled),
    setNetworkStatuses,
  });

  useSelectedFileHash({ client, state, left, right, dispatch });

  // ── Initialization: preferences, navigation, locations, etc. ────
  useEffect(() => {
    if (hasInitializedRef.current) {
      return;
    }
    hasInitializedRef.current = true;

    void (async () => {
      let showHidden = false;
      let initialLeftUri = activeTab(state.panels.left).uri;
      let initialRightUri = activeTab(state.panels.right).uri;

      const startupAppInfo = await resolveStartupAppInfo(client);
      if (startupAppInfo) {
        setAppInfo(startupAppInfo.appInfo);
        if (startupAppInfo.refreshNetworkProfiles) {
          void refreshNetworkProfiles();
        }
      }

      try {
        const startupNavigation = await resolveStartupNavigation(
          client,
          initialLeftUri,
          initialRightUri,
        );
        setLocations(startupNavigation.locations);
        initialLeftUri = startupNavigation.leftUri;
        initialRightUri = startupNavigation.rightUri;
      } catch {
        void refreshLocations();
      }
      void refreshNavigation();

      try {
        const response = await client.preferences.get();
        const loadedPreferences = await migrateStartupPreferences(
          client,
          response.preferences,
        );
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
        navigatePanel("left", initialLeftUri, {
          includeHidden: showHidden,
        }),
        navigatePanel("right", initialRightUri, {
          includeHidden: showHidden,
        }),
      ]);
      void refreshLocations();
      void refreshHistory();
      void refreshDiagnostics();
    })();
  }, []);

  return { starredUriSet, rowHeight, previewEntry };
}
