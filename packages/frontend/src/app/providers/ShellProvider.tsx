import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from "react";
import {
  createFileOctopusClient,
  type FileOctopusClient,
} from "@fileoctopus/ts-api";
import type {
  AppDataHealthResponse,
  AppInfoResponse,
  AutostartStatusDto,
  FavoriteEntryDto,
  RecentEntryDto,
  StandardLocationDto,
  StarredEntryDto,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
import {
  createInitialState,
  panelReducer,
  type FileOctopusState,
  type PanelAction,
} from "../../panelStore";
import type { DensityPreference } from "../../applyPreferences";
import {
  restoreSessionPaths,
  persistSessionPaths,
} from "../../pane/sessionPaths";
import type { ToastMessage } from "../../components/ToastStack";
import type { FileClipboardState } from "../../hooks/useFileOpHandlers";
import type { ContextMenuState } from "../../components/ContextMenu";
import type { SearchState } from "../../pane/PaneFilterBar";
import { useLayoutFocusStore } from "../../state/layoutStore";

export interface ShellContextValue {
  client: FileOctopusClient;
  state: FileOctopusState;
  dispatch: Dispatch<PanelAction>;
  preferences: UserPreferencesDto | null;
  density: DensityPreference;
  locations: StandardLocationDto[];
  favorites: FavoriteEntryDto[];
  recentToday: RecentEntryDto[];
  recentWeek: RecentEntryDto[];
  starred: StarredEntryDto[];
  appInfo: AppInfoResponse | null;
  appHealth: AppDataHealthResponse | null;
  autostart: AutostartStatusDto | null;
  toasts: ToastMessage[];
  clipboard: FileClipboardState | null;
  contextMenu: ContextMenuState | null;
  search: SearchState | null;
  pathFocusToken: number;
  renameFocusToken: number;
  filterFocusToken: number;
  recursiveSearchFocusToken: number;
  statusBarVisible: boolean;
  toolbarVisible: boolean;
  diagnosticsDestination: string;
  diagnosticsMessage: string | null;
  exportingDiagnostics: boolean;
  workspaceRef: RefObject<HTMLElement | null>;
  hasInitializedRef: RefObject<boolean>;

  setPreferences: Dispatch<SetStateAction<UserPreferencesDto | null>>;
  setDensity: Dispatch<SetStateAction<DensityPreference>>;
  setLocations: Dispatch<SetStateAction<StandardLocationDto[]>>;
  setFavorites: Dispatch<SetStateAction<FavoriteEntryDto[]>>;
  setRecentToday: Dispatch<SetStateAction<RecentEntryDto[]>>;
  setRecentWeek: Dispatch<SetStateAction<RecentEntryDto[]>>;
  setStarred: Dispatch<SetStateAction<StarredEntryDto[]>>;
  setAppInfo: Dispatch<SetStateAction<AppInfoResponse | null>>;
  setAppHealth: Dispatch<SetStateAction<AppDataHealthResponse | null>>;
  setAutostart: Dispatch<SetStateAction<AutostartStatusDto | null>>;
  setToasts: Dispatch<SetStateAction<ToastMessage[]>>;
  setClipboard: Dispatch<SetStateAction<FileClipboardState | null>>;
  setContextMenu: Dispatch<SetStateAction<ContextMenuState | null>>;
  setSearch: Dispatch<SetStateAction<SearchState | null>>;
  setPathFocusToken: Dispatch<SetStateAction<number>>;
  setRenameFocusToken: Dispatch<SetStateAction<number>>;
  setFilterFocusToken: Dispatch<SetStateAction<number>>;
  setRecursiveSearchFocusToken: Dispatch<SetStateAction<number>>;
  setDiagnosticsDestination: Dispatch<SetStateAction<string>>;
  setDiagnosticsMessage: Dispatch<SetStateAction<string | null>>;
  setExportingDiagnostics: Dispatch<SetStateAction<boolean>>;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) {
    throw new Error("useShell must be used within ShellProvider");
  }
  return ctx;
}

export function ShellProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => createFileOctopusClient(), []);
  const [state, dispatch] = useReducer(panelReducer, undefined, () => {
    const saved = restoreSessionPaths();
    return createInitialState(
      saved.left ?? undefined,
      saved.right ?? undefined,
    );
  });
  const workspaceRef = useRef<HTMLElement | null>(null);
  const hasInitializedRef = useRef(false);

  // Persist panel paths to localStorage whenever they change
  useEffect(() => {
    const leftUri = state.panels.left.tabs[state.panels.left.activeTabId]?.uri;
    const rightUri =
      state.panels.right.tabs[state.panels.right.activeTabId]?.uri;
    if (leftUri && rightUri) {
      persistSessionPaths(leftUri, rightUri);
    }
  }, [
    state.panels.left.tabs[state.panels.left.activeTabId]?.uri,
    state.panels.right.tabs[state.panels.right.activeTabId]?.uri,
  ]);

  const [preferences, setPreferences] = useState<UserPreferencesDto | null>(
    null,
  );
  const [density, setDensity] = useState<DensityPreference>("comfortable");
  const [locations, setLocations] = useState<StandardLocationDto[]>([]);
  const [favorites, setFavorites] = useState<FavoriteEntryDto[]>([]);
  const [recentToday, setRecentToday] = useState<RecentEntryDto[]>([]);
  const [recentWeek, setRecentWeek] = useState<RecentEntryDto[]>([]);
  const [starred, setStarred] = useState<StarredEntryDto[]>([]);
  const [appInfo, setAppInfo] = useState<AppInfoResponse | null>(null);
  const [appHealth, setAppHealth] = useState<AppDataHealthResponse | null>(
    null,
  );
  const [autostart, setAutostart] = useState<AutostartStatusDto | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [clipboard, setClipboard] = useState<FileClipboardState | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [search, setSearch] = useState<SearchState | null>(null);
  const layoutFocus = useLayoutFocusStore();
  const statusBarVisible = preferences?.statusBarVisible !== false;
  const toolbarVisible = preferences?.toolbarVisible !== false;
  const [diagnosticsDestination, setDiagnosticsDestination] = useState(
    "/tmp/fileoctopus-diagnostics.zip",
  );
  const [diagnosticsMessage, setDiagnosticsMessage] = useState<string | null>(
    null,
  );
  const [exportingDiagnostics, setExportingDiagnostics] = useState(false);

  const value = useMemo<ShellContextValue>(
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
      appInfo,
      appHealth,
      autostart,
      toasts,
      clipboard,
      contextMenu,
      search,
      pathFocusToken: layoutFocus.pathFocusToken,
      renameFocusToken: layoutFocus.renameFocusToken,
      filterFocusToken: layoutFocus.filterFocusToken,
      recursiveSearchFocusToken: layoutFocus.recursiveSearchFocusToken,
      statusBarVisible,
      toolbarVisible,
      diagnosticsDestination,
      diagnosticsMessage,
      exportingDiagnostics,
      workspaceRef,
      hasInitializedRef,
      setPreferences,
      setDensity,
      setLocations,
      setFavorites,
      setRecentToday,
      setRecentWeek,
      setStarred,
      setAppInfo,
      setAppHealth,
      setAutostart,
      setToasts,
      setClipboard,
      setContextMenu,
      setSearch,
      setPathFocusToken: layoutFocus.setPathFocusToken,
      setRenameFocusToken: layoutFocus.setRenameFocusToken,
      setFilterFocusToken: layoutFocus.setFilterFocusToken,
      setRecursiveSearchFocusToken: layoutFocus.setRecursiveSearchFocusToken,
      setDiagnosticsDestination,
      setDiagnosticsMessage,
      setExportingDiagnostics,
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
      appInfo,
      appHealth,
      autostart,
      toasts,
      clipboard,
      contextMenu,
      search,
      layoutFocus,
      statusBarVisible,
      toolbarVisible,
      diagnosticsDestination,
      diagnosticsMessage,
      exportingDiagnostics,
      workspaceRef,
      hasInitializedRef,
    ],
  );

  return (
    <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
  );
}
