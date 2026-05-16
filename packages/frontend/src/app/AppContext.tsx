import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useReducer,
} from "react";
import type { ReactNode } from "react";
import {
  createFileOctopusClient,
  normalizeIpcError,
  type FileOctopusClient,
} from "@fileoctopus/ts-api";
import type {
  UserPreferencesDto,
  StandardLocationDto,
  FavoriteEntryDto,
  RecentEntryDto,
  StarredEntryDto,
  JobSnapshot,
  OperationHistoryRecordDto,
  AppInfoResponse,
  AutostartStatusDto,
} from "@fileoctopus/ts-api";
import type { PanelAction, FileOctopusState } from "../panelStore";
import { createInitialState, panelReducer } from "../panelStore";
import {
  applyAllPreferences,
  applyLayoutPreferences,
  applyDensityPreference,
  type DensityPreference,
} from "../applyPreferences";
import { mergeToast } from "../toastNotifications";
import type { ToastMessage } from "../components/ToastStack";
import { createRequestId } from "../paneTypes";

export interface AppContextValue {
  client: FileOctopusClient;
  state: FileOctopusState;
  dispatch: React.Dispatch<PanelAction>;
  preferences: UserPreferencesDto | null;
  density: DensityPreference;
  locations: StandardLocationDto[];
  favorites: FavoriteEntryDto[];
  recentToday: RecentEntryDto[];
  recentWeek: RecentEntryDto[];
  starred: StarredEntryDto[];
  starredUriSet: Set<string>;
  jobs: Record<string, JobSnapshot>;
  history: OperationHistoryRecordDto[];
  appInfo: AppInfoResponse | null;
  autostart: AutostartStatusDto | null;
  operationError: string | null;
  toasts: ToastMessage[];

  setPreferences: React.Dispatch<
    React.SetStateAction<UserPreferencesDto | null>
  >;
  setDensity: React.Dispatch<React.SetStateAction<DensityPreference>>;
  setLocations: React.Dispatch<React.SetStateAction<StandardLocationDto[]>>;
  setFavorites: React.Dispatch<React.SetStateAction<FavoriteEntryDto[]>>;
  setRecentToday: React.Dispatch<React.SetStateAction<RecentEntryDto[]>>;
  setRecentWeek: React.Dispatch<React.SetStateAction<RecentEntryDto[]>>;
  setStarred: React.Dispatch<React.SetStateAction<StarredEntryDto[]>>;
  setJobs: React.Dispatch<React.SetStateAction<Record<string, JobSnapshot>>>;
  setHistory: React.Dispatch<React.SetStateAction<OperationHistoryRecordDto[]>>;
  setAppInfo: React.Dispatch<React.SetStateAction<AppInfoResponse | null>>;
  setAutostart: React.Dispatch<React.SetStateAction<AutostartStatusDto | null>>;
  setOperationError: React.Dispatch<React.SetStateAction<string | null>>;
  setToasts: React.Dispatch<React.SetStateAction<ToastMessage[]>>;

  pushToast: (toast: Omit<ToastMessage, "id">) => void;
  updatePreference: (key: string, value: string) => Promise<void>;
  refreshVisiblePanels: () => void;
  setActivityCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  activityCollapsed: boolean;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useAppContext must be used within an AppContextProvider");
  }
  return ctx;
}

export interface AppContextProviderProps {
  children: ReactNode;
  refreshVisiblePanels: () => void;
}

export function AppContextProvider({
  children,
  refreshVisiblePanels,
}: AppContextProviderProps) {
  const client = useMemo(() => createFileOctopusClient(), []);
  const [state, dispatch] = useReducer(
    panelReducer,
    undefined,
    createInitialState,
  );

  const [preferences, setPreferences] = useState<UserPreferencesDto | null>(
    null,
  );
  const [density, setDensity] = useState<DensityPreference>("comfortable");
  const [locations, setLocations] = useState<StandardLocationDto[]>([]);
  const [favorites, setFavorites] = useState<FavoriteEntryDto[]>([]);
  const [recentToday, setRecentToday] = useState<RecentEntryDto[]>([]);
  const [recentWeek, setRecentWeek] = useState<RecentEntryDto[]>([]);
  const [starred, setStarred] = useState<StarredEntryDto[]>([]);
  const [jobs, setJobs] = useState<Record<string, JobSnapshot>>({});
  const [history, setHistory] = useState<OperationHistoryRecordDto[]>([]);
  const [appInfo, setAppInfo] = useState<AppInfoResponse | null>(null);
  const [autostart, setAutostart] = useState<AutostartStatusDto | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activityCollapsed, setActivityCollapsed] = useState(false);

  const starredUriSet = useMemo(
    () => new Set(starred.map((entry) => entry.uri)),
    [starred],
  );

  const pushToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    let toastId = createRequestId();
    setToasts((current) => {
      const merged = mergeToast(current, toast, createRequestId);
      toastId = merged.toastId;
      return merged.toasts;
    });
    globalThis.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== toastId));
    }, 6000);
  }, []);

  const updatePreference = useCallback(
    async (key: string, value: string) => {
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
    },
    [client, refreshVisiblePanels],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      client,
      state,
      dispatch,
      preferences,
      density,
      locations,
      favorites,
      recentToday,
      recentWeek,
      starred,
      starredUriSet,
      jobs,
      history,
      appInfo,
      autostart,
      operationError,
      toasts,
      activityCollapsed,

      setPreferences,
      setDensity,
      setLocations,
      setFavorites,
      setRecentToday,
      setRecentWeek,
      setStarred,
      setJobs,
      setHistory,
      setAppInfo,
      setAutostart,
      setOperationError,
      setToasts,
      setActivityCollapsed,

      pushToast,
      updatePreference,
      refreshVisiblePanels,
    }),
    [
      client,
      state,
      preferences,
      density,
      locations,
      favorites,
      recentToday,
      recentWeek,
      starred,
      starredUriSet,
      jobs,
      history,
      appInfo,
      autostart,
      operationError,
      toasts,
      activityCollapsed,
      pushToast,
      updatePreference,
      refreshVisiblePanels,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
