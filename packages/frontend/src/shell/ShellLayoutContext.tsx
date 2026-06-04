import {
  createContext,
  useContext,
  type ReactNode,
  type RefObject,
} from "react";
import type {
  AppDataHealthResponse,
  AppInfoResponse,
  AutostartStatusDto,
  FavoriteEntryDto,
  FileEntryDto,
  FileOctopusClient,
  JobSnapshot,
  OperationHistoryRecordDto,
  NetworkConnectionStatusDto,
  NetworkConnectionDraftDto,
  NetworkProtocolOptionsDto,
  NetworkProfileDto,
  RecentEntryDto,
  StarredEntryDto,
  StandardLocationDto,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
import type { FileOctopusState, PanelAction, PanelId } from "../panelStore";
import type { FilePanelProps } from "../pane/FilePanel";
import type { ContextMenuState } from "../components/ContextMenu";
import type { CommandEntry } from "../components/CommandPalette";
import type { ToastMessage } from "../components/ToastStack";
import type { OperationDialog } from "../dialogs/OperationDialogView";
import type { MenuBarProps } from "./MenuBar";
import type { FileClipboardState } from "../hooks/useFileOpHandlers";
import type { DialogOverlayGroup } from "../components/DialogOverlayGroup";
import type { WindowControlHandlers } from "./TitleBar";

export interface ShellLayoutContextValue {
  workspaceRef: RefObject<HTMLElement | null>;
  handleShellKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  makeFilePanelProps: (pid: "left" | "right") => FilePanelProps;
  menuBarProps: MenuBarProps;
  windowControls?: WindowControlHandlers;
  state: FileOctopusState;
  activeTabUri: string;
  leftPanelUri: string;
  rightPanelUri: string;
  locations: StandardLocationDto[];
  favorites: FavoriteEntryDto[];
  recentToday: RecentEntryDto[];
  recentWeek: RecentEntryDto[];
  starred: StarredEntryDto[];
  networkProfiles: NetworkProfileDto[];
  networkStatuses: NetworkConnectionStatusDto[];
  preferences: UserPreferencesDto | null;
  updatePreference: (key: string, value: string) => Promise<void>;
  settingsPreferenceChange: (key: string, value: string) => void;
  closePaneTerminalConfirmOpen: boolean;
  setClosePaneTerminalConfirmOpen: (open: boolean) => void;
  onConfirmClosePaneWithTerminal: () => void;
  client: FileOctopusClient;
  jobs: Record<string, JobSnapshot>;
  jobMetrics: Record<
    string,
    {
      speedLabel: string | null;
      etaLabel: string | null;
      lastBytes: number;
      lastAt: number;
    }
  >;
  history: OperationHistoryRecordDto[];
  operationError: string | null;
  activityCollapsed: boolean;
  markActivityPinnedOpen: () => void;
  setActivityCollapsed: (v: boolean) => void;
  refreshHistory: () => Promise<void>;
  clearHistory: () => Promise<void>;
  onCancelJob: (jobId: string) => void;
  settingsOpen: boolean;
  shortcutsOpen: boolean;
  commandPaletteOpen: boolean;
  previewOpen: boolean;
  viewerOpen: boolean;
  viewerEntry: FileEntryDto | null;
  editorOpen: boolean;
  editorEntry: FileEntryDto | null;
  diagnosticsOpen: boolean;
  helpOpen: boolean;
  aboutOpen: boolean;
  goToLocationOpen: boolean;
  manageFavoritesOpen: boolean;
  recentLocationsOpen: boolean;
  clearRecentLocationsOpen: boolean;
  errorDetailsOpen: boolean;
  operationHistoryOpen: boolean;
  volumePickerOpen: boolean;
  networkLocationsOpen: boolean;
  connectServerOpen: boolean;
  connectServerProfile: NetworkProfileDto | null;
  connectServerInitial: NetworkConnectionDraftDto | null;
  removeServerProfile: NetworkProfileDto | null;
  toolbarCustomizeOpen: boolean;
  busyProfileIds: Set<string>;
  setToolbarCustomizeOpen: (v: boolean) => void;
  setGoToLocationOpen: (v: boolean) => void;
  setManageFavoritesOpen: (v: boolean) => void;
  setRecentLocationsOpen: (v: boolean) => void;
  setClearRecentLocationsOpen: (v: boolean) => void;
  setErrorDetailsOpen: (v: boolean) => void;
  setOperationHistoryOpen: (v: boolean) => void;
  setVolumePickerOpen: (v: boolean) => void;
  setNetworkLocationsOpen: (v: boolean) => void;
  setConnectServerOpen: (v: boolean) => void;
  setConnectServerProfile: (profile: NetworkProfileDto | null) => void;
  setConnectServerInitial: (profile: NetworkConnectionDraftDto | null) => void;
  setRemoveServerProfile: (profile: NetworkProfileDto | null) => void;
  connectProfile: (profileId: string) => Promise<void>;
  disconnectProfile: (profileId: string) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
  forgetFingerprint: (profileId: string) => Promise<void>;
  testConnection: (
    profileId: string,
  ) => Promise<{ ok: boolean; message: string }>;
  saveProfile: (payload: {
    id?: string;
    scheme: "sftp" | "ssh" | "smb" | "s3" | "webdav";
    label: string;
    host: string;
    port: number;
    username: string;
    authKind: "password" | "privateKey" | "accessKey";
    privateKeyPath: string | null;
    defaultPath: string;
    options: NetworkProtocolOptionsDto;
    password: string;
    passphrase: string;
  }) => Promise<NetworkProfileDto>;
  refreshNetworkProfiles: () => Promise<void>;
  openProfileTerminalTab: (
    profile: NetworkProfileDto,
    panelId?: PanelId,
  ) => Promise<void>;
  dialog: OperationDialog | null;
  autostart: AutostartStatusDto | null;
  commandEntries: CommandEntry[];
  previewEntry: FileEntryDto | null;
  appInfo: AppInfoResponse | null;
  appHealth: AppDataHealthResponse | null;
  diagnosticsDestination: string;
  diagnosticsMessage: string | null;
  exportingDiagnostics: boolean;
  isProductionBuild: boolean;
  multiRenameOpen: boolean;
  syncDirectoriesOpen: boolean;
  hotlistOpen: boolean;
  manageHotlistOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  setShortcutsOpen: (v: boolean) => void;
  setCommandPaletteOpen: (v: boolean) => void;
  setPreviewOpen: (v: boolean) => void;
  setViewerOpen: (v: boolean) => void;
  setViewerEntry: (entry: FileEntryDto | null) => void;
  setEditorOpen: (v: boolean) => void;
  setEditorEntry: (entry: FileEntryDto | null) => void;
  diffOpen: boolean;
  diffLeftUri: string;
  diffRightUri: string;
  diffLeftName: string;
  diffRightName: string;
  setDiffOpen: (v: boolean) => void;
  setDiffLeftUri: (v: string) => void;
  setDiffRightUri: (v: string) => void;
  setDiffLeftName: (v: string) => void;
  setDiffRightName: (v: string) => void;
  setMultiRenameOpen: (v: boolean) => void;
  setSyncDirectoriesOpen: (v: boolean) => void;
  setHotlistOpen: (v: boolean) => void;
  setManageHotlistOpen: (v: boolean) => void;
  isTextEditable: (entry: FileEntryDto | null) => boolean;
  refreshActivePane: () => void;
  setDiagnosticsOpen: (v: boolean) => void;
  setHelpOpen: (v: boolean) => void;
  setAboutOpen: (v: boolean) => void;
  setDialog: (d: OperationDialog | null) => void;
  setDiagnosticsDestination: (v: string) => void;
  refreshDiagnostics: () => Promise<void>;
  exportDiagnostics: () => Promise<void>;
  reviewCopyMoveDialog: Parameters<
    typeof DialogOverlayGroup
  >[0]["reviewCopyMoveDialog"];
  submitCreateFolder: Parameters<
    typeof DialogOverlayGroup
  >[0]["submitCreateFolder"];
  submitCreateFile: Parameters<
    typeof DialogOverlayGroup
  >[0]["submitCreateFile"];
  submitRename: Parameters<typeof DialogOverlayGroup>[0]["submitRename"];
  submitCopyMove: Parameters<typeof DialogOverlayGroup>[0]["submitCopyMove"];
  submitTrash: Parameters<typeof DialogOverlayGroup>[0]["submitTrash"];
  submitPermanentDelete: Parameters<
    typeof DialogOverlayGroup
  >[0]["submitPermanentDelete"];
  copyTextFromSelection: (
    panelId: PanelId,
    kind: "path" | "name" | "parentPath" | "uri",
  ) => Promise<void>;
  calculateSelectionSize: (
    dialog: Extract<OperationDialog, { type: "selectionProperties" }>,
  ) => Promise<void>;
  revealEntry: (panelId: PanelId, entry: FileEntryDto | null) => Promise<void>;
  handleSetAutostart: (enabled: boolean) => Promise<void>;
  handleCommandSelect: (
    id: string,
    panelId?: PanelId,
    context?: import("../commands/invokeContext").CommandInvokeArg,
  ) => void;
  toasts: ToastMessage[];
  notifications: ToastMessage[];
  notificationCenterOpen: boolean;
  setToasts: React.Dispatch<React.SetStateAction<ToastMessage[]>>;
  setNotifications: React.Dispatch<React.SetStateAction<ToastMessage[]>>;
  setNotificationCenterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  contextMenu: ContextMenuState | null;
  setContextMenu: (m: ContextMenuState | null) => void;
  clipboard: FileClipboardState | null;
  starredUriSet: Set<string>;
  dispatch: React.Dispatch<PanelAction>;
  activateEntry: (panelId: PanelId, entry: FileEntryDto | null) => void;
  handleRename: (panelId: PanelId) => void;
  triggerInlineRename: (panelId: PanelId) => void;
  copySelectionToFileClipboard: (
    panelId: PanelId,
    mode: "copy" | "move",
  ) => void;
  pasteClipboard: (panelId: PanelId) => Promise<void>;
  handleTrash: (panelId: PanelId) => void;
  handleDelete: (panelId: PanelId) => void;
  toggleStarredForEntry: (entry: FileEntryDto) => Promise<void>;
  handlePermanentDelete: (panelId: PanelId) => void;
  handleProperties: (
    panelId: PanelId,
    entry: FileEntryDto | null,
  ) => Promise<void>;
  handleCreateFolder: (panelId: PanelId) => void;
  handleCreateFile: (panelId: PanelId) => void;
  refreshPanel: (panelId: PanelId) => void;
  handleCopyOrMove: (panelId: PanelId, mode: "copy" | "move") => void;
  openExternal: (entry: FileEntryDto) => Promise<void>;
  toggleHidden: (panelId: PanelId) => void;
  navigatePanel: (panelId: PanelId, uri: string) => void;
  navigateOtherPane: (uri: string) => void;
  refreshNavigation: () => Promise<void>;
  setOperationError: (error: string | null) => void;
  runRecursiveSearch: (panelId: PanelId) => Promise<void>;
  applySplitRatioFn: (ratio: number) => number;
}

const ShellLayoutContext = createContext<ShellLayoutContextValue | null>(null);

export function ShellLayoutProvider({
  value,
  children,
}: {
  value: ShellLayoutContextValue;
  children: ReactNode;
}) {
  return (
    <ShellLayoutContext.Provider value={value}>
      {children}
    </ShellLayoutContext.Provider>
  );
}

export function useShellLayout(): ShellLayoutContextValue {
  const ctx = useContext(ShellLayoutContext);
  if (!ctx) {
    throw new Error("useShellLayout must be used within ShellLayoutProvider");
  }
  return ctx;
}
