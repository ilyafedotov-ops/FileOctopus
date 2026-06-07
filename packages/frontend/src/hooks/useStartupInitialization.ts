import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type {
  AppInfoResponse,
  FileOctopusClient,
  StandardLocationDto,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
import {
  activeTab,
  type FileOctopusState,
  type PanelAction,
  type PanelId,
} from "../panelStore";
import {
  applyAllPreferences,
  applyDensityPreference,
  applyLayoutPreferences,
  viewModeFromPreference,
  type DensityPreference,
} from "../applyPreferences";
import { resolveStartupAppInfo } from "./startupAppInfo";
import { resolveStartupNavigation } from "./startupNavigation";
import { migrateStartupPreferences } from "./startupPreferences";

export interface UseStartupInitializationParams {
  client: FileOctopusClient;
  state: FileOctopusState;
  dispatch: Dispatch<PanelAction>;
  hasInitializedRef: MutableRefObject<boolean>;
  refreshHistory: () => Promise<void>;
  refreshLocations: () => Promise<void>;
  refreshNetworkProfiles: () => Promise<void>;
  refreshNetworkQuickEntries: () => Promise<void>;
  refreshNavigation: () => Promise<void>;
  refreshDiagnostics: () => void;
  setLocations: Dispatch<SetStateAction<StandardLocationDto[]>>;
  setAppInfo: Dispatch<SetStateAction<AppInfoResponse | null>>;
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
  setPreferences: Dispatch<SetStateAction<UserPreferencesDto | null>>;
  setDensity: Dispatch<SetStateAction<DensityPreference>>;
  setActivityCollapsed: Dispatch<SetStateAction<boolean>>;
}

export function useStartupInitialization({
  client,
  state,
  dispatch,
  hasInitializedRef,
  refreshHistory,
  refreshLocations,
  refreshNetworkProfiles,
  refreshNetworkQuickEntries,
  refreshNavigation,
  refreshDiagnostics,
  setLocations,
  setAppInfo,
  navigatePanel,
  setPreferences,
  setDensity,
  setActivityCollapsed,
}: UseStartupInitializationParams) {
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
          void refreshNetworkQuickEntries();
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
}
