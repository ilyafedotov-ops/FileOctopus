import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type {
  AppDataHealthResponse,
  AppInfoResponse,
  AutostartStatusDto,
  FavoriteEntryDto,
  FileEntryDto,
  NetworkConnectionStatusDto,
  NetworkProfileDto,
  RecentEntryDto,
  StandardLocationDto,
  StarredEntryDto,
} from "@fileoctopus/ts-api";

export interface NavigationDataContextValue {
  locations: StandardLocationDto[];
  favorites: FavoriteEntryDto[];
  recentToday: RecentEntryDto[];
  recentWeek: RecentEntryDto[];
  starred: StarredEntryDto[];
  networkProfiles: NetworkProfileDto[];
  networkStatuses: NetworkConnectionStatusDto[];
  networkQuickEntries: FileEntryDto[];
  appInfo: AppInfoResponse | null;
  appHealth: AppDataHealthResponse | null;
  autostart: AutostartStatusDto | null;
  setLocations: Dispatch<SetStateAction<StandardLocationDto[]>>;
  setFavorites: Dispatch<SetStateAction<FavoriteEntryDto[]>>;
  setRecentToday: Dispatch<SetStateAction<RecentEntryDto[]>>;
  setRecentWeek: Dispatch<SetStateAction<RecentEntryDto[]>>;
  setStarred: Dispatch<SetStateAction<StarredEntryDto[]>>;
  setNetworkProfiles: Dispatch<SetStateAction<NetworkProfileDto[]>>;
  setNetworkStatuses: Dispatch<SetStateAction<NetworkConnectionStatusDto[]>>;
  setNetworkQuickEntries: Dispatch<SetStateAction<FileEntryDto[]>>;
  setAppInfo: Dispatch<SetStateAction<AppInfoResponse | null>>;
  setAppHealth: Dispatch<SetStateAction<AppDataHealthResponse | null>>;
  setAutostart: Dispatch<SetStateAction<AutostartStatusDto | null>>;
}

const NavigationDataContext = createContext<NavigationDataContextValue | null>(
  null,
);

export function useNavigationData(): NavigationDataContextValue {
  const ctx = useContext(NavigationDataContext);
  if (!ctx) {
    throw new Error(
      "useNavigationData must be used within NavigationDataProvider",
    );
  }
  return ctx;
}

export function NavigationDataProvider({ children }: { children: ReactNode }) {
  const [locations, setLocations] = useState<StandardLocationDto[]>([]);
  const [favorites, setFavorites] = useState<FavoriteEntryDto[]>([]);
  const [recentToday, setRecentToday] = useState<RecentEntryDto[]>([]);
  const [recentWeek, setRecentWeek] = useState<RecentEntryDto[]>([]);
  const [starred, setStarred] = useState<StarredEntryDto[]>([]);
  const [networkProfiles, setNetworkProfiles] = useState<NetworkProfileDto[]>(
    [],
  );
  const [networkStatuses, setNetworkStatuses] = useState<
    NetworkConnectionStatusDto[]
  >([]);
  const [networkQuickEntries, setNetworkQuickEntries] = useState<
    FileEntryDto[]
  >([]);
  const [appInfo, setAppInfo] = useState<AppInfoResponse | null>(null);
  const [appHealth, setAppHealth] = useState<AppDataHealthResponse | null>(
    null,
  );
  const [autostart, setAutostart] = useState<AutostartStatusDto | null>(null);

  const value = useMemo<NavigationDataContextValue>(
    () => ({
      locations,
      favorites,
      recentToday,
      recentWeek,
      starred,
      networkProfiles,
      networkStatuses,
      networkQuickEntries,
      appInfo,
      appHealth,
      autostart,
      setLocations,
      setFavorites,
      setRecentToday,
      setRecentWeek,
      setStarred,
      setNetworkProfiles,
      setNetworkStatuses,
      setNetworkQuickEntries,
      setAppInfo,
      setAppHealth,
      setAutostart,
    }),
    [
      locations,
      favorites,
      recentToday,
      recentWeek,
      starred,
      networkProfiles,
      networkStatuses,
      networkQuickEntries,
      appInfo,
      appHealth,
      autostart,
    ],
  );

  return (
    <NavigationDataContext.Provider value={value}>
      {children}
    </NavigationDataContext.Provider>
  );
}
