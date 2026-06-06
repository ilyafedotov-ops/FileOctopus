import {
  useEffect,
  useMemo,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { FileOctopusClient } from "@fileoctopus/ts-api";
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
  rowHeightForDensity,
  type DensityPreference,
} from "../applyPreferences";
import { useFileSystemWatchers } from "./useFileSystemWatchers";
import { useJobEventListeners } from "./useJobEventListeners";
import { useMetadataEventListeners } from "./useMetadataEventListeners";
import { useNetworkStatusEvents } from "./useNetworkStatusEvents";
import { useSelectedFileHash } from "./useSelectedFileHash";
import { useStartupInitialization } from "./useStartupInitialization";
import type { ToastMessage } from "../components/ToastStack";
import type { OperationDialog } from "../dialogs/OperationDialogView";
import type { JobMetrics } from "../app/providers/JobsProvider";
import type { SearchState } from "../pane/PaneFilterBar";

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

  useJobEventListeners({
    client,
    leftUri: left.uri,
    rightUri: right.uri,
    preferencesRef,
    setJobs,
    setJobMetrics,
    setActivityCollapsed,
    updatePreference,
    pushToast,
    takeOperationRefreshTargets,
    dispatch,
    refreshOperationTargets,
    refreshHistory,
    setOperationError,
    setSearch,
    setDialog,
  });

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

  useStartupInitialization({
    client,
    state,
    dispatch,
    hasInitializedRef,
    refreshHistory,
    refreshLocations,
    refreshNetworkProfiles,
    refreshNavigation,
    refreshDiagnostics,
    setLocations,
    setAppInfo,
    navigatePanel,
    setPreferences,
    setDensity,
    setActivityCollapsed,
  });

  return { starredUriSet, rowHeight, previewEntry };
}
