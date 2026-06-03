import type { FsClient, PluginClient } from "@fileoctopus/ts-api";
import type {
  AppDataHealthResponse,
  AppInfoResponse,
  AutostartStatusDto,
  FileEntryDto,
  NetworkConnectionDraftDto,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
import type { PanelId } from "../panelStore";
import { type CommandEntry } from "./CommandPalette";
import { type OperationDialog } from "../dialogs/OperationDialogView";
import type {
  FavoriteEntryDto,
  NetworkConnectionStatusDto,
  NetworkProfileDto,
  OperationHistoryRecordDto,
  StandardLocationDto,
  RecentEntryDto,
} from "@fileoctopus/ts-api";
import {
  DialogOverlaySectionWorkspace,
  DialogOverlaySectionNavigation,
  DialogOverlaySectionOperations,
} from "./dialogOverlaySections";

export interface DialogOverlayGroupProps {
  preferences: UserPreferencesDto | null;
  settingsOpen: boolean;
  shortcutsOpen: boolean;
  commandPaletteOpen: boolean;
  previewOpen: boolean;
  viewerOpen: boolean;
  viewerEntry: FileEntryDto | null;
  setViewerOpen: (open: boolean) => void;
  viewerSiblings?: FileEntryDto[];
  onViewerNavigate?: (entry: FileEntryDto) => void;
  editorOpen: boolean;
  editorEntry: FileEntryDto | null;
  setEditorOpen: (open: boolean) => void;
  refreshActivePane?: () => void;
  diagnosticsOpen: boolean;
  aboutOpen: boolean;
  goToLocationOpen: boolean;
  manageFavoritesOpen: boolean;
  recentLocationsOpen: boolean;
  clearRecentLocationsOpen: boolean;
  closePaneTerminalConfirmOpen: boolean;
  errorDetailsOpen: boolean;
  settingsPreferenceChange?: (key: string, value: string) => void;
  onConfirmClosePaneWithTerminal: () => void;
  operationHistoryOpen: boolean;
  volumePickerOpen: boolean;
  networkLocationsOpen: boolean;
  connectServerOpen: boolean;
  connectServerProfile: NetworkProfileDto | null;
  connectServerInitial: NetworkConnectionDraftDto | null;
  removeServerProfile: NetworkProfileDto | null;
  networkProfiles: NetworkProfileDto[];
  networkStatuses: NetworkConnectionStatusDto[];
  goToLocationInitialUri: string;
  leftPanelUri: string;
  rightPanelUri: string;
  favorites: FavoriteEntryDto[];
  history: OperationHistoryRecordDto[];
  operationError: string | null;
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
  fs: FsClient;
  pluginClient?: PluginClient;
  updatePreference: (key: string, value: string) => void;
  handleSetAutostart: (enabled: boolean) => Promise<void>;
  onCustomizeToolbar?: () => void;
  handleCommandSelect: (
    id: string,
    panelId?: import("../panelStore").PanelId,
  ) => void;
  setSettingsOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setDiagnosticsOpen: (open: boolean) => void;
  setAboutOpen: (open: boolean) => void;
  setGoToLocationOpen: (open: boolean) => void;
  setManageFavoritesOpen: (open: boolean) => void;
  setRecentLocationsOpen: (open: boolean) => void;
  setClearRecentLocationsOpen: (open: boolean) => void;
  setClosePaneTerminalConfirmOpen: (open: boolean) => void;
  setErrorDetailsOpen: (open: boolean) => void;
  setOperationHistoryOpen: (open: boolean) => void;
  setVolumePickerOpen: (open: boolean) => void;
  setNetworkLocationsOpen: (open: boolean) => void;
  setConnectServerOpen: (open: boolean) => void;
  setConnectServerProfile: (profile: NetworkProfileDto | null) => void;
  setConnectServerInitial: (profile: NetworkConnectionDraftDto | null) => void;
  setRemoveServerProfile: (profile: NetworkProfileDto | null) => void;
  diffOpen: boolean;
  diffLeftUri: string;
  diffRightUri: string;
  diffLeftName: string;
  diffRightName: string;
  setDiffOpen: (open: boolean) => void;
  multiRenameOpen: boolean;
  setMultiRenameOpen: (open: boolean) => void;
  syncDirectoriesOpen: boolean;
  setSyncDirectoriesOpen: (open: boolean) => void;
  hotlistOpen: boolean;
  setHotlistOpen: (open: boolean) => void;
  manageHotlistOpen: boolean;
  setManageHotlistOpen: (open: boolean) => void;
  multiRenameEntries: FileEntryDto[];
  connectProfile: (profileId: string) => Promise<void>;
  forgetFingerprint: (profileId: string) => Promise<void>;
  disconnectProfile: (profileId: string) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
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
    password: string;
    passphrase: string;
  }) => Promise<NetworkProfileDto>;
  onOpenProfileTerminal: (profile: NetworkProfileDto) => void;
  setOperationError: (message: string | null) => void;
  refreshHistory: () => void;
  clearHistory: () => void;
  onNavigateActivePane: (uri: string) => void;
  onRemoveFavorite: (id: number) => void;
  onRenameFavorite: (id: number, label: string) => void;
  setPreviewOpen: (open: boolean) => void;
  setDialog: (dialog: OperationDialog | null) => void;
  setDiagnosticsDestination: (value: string) => void;
  refreshDiagnostics: () => Promise<void>;
  exportDiagnostics: () => Promise<void>;
  reviewCopyMoveDialog: (
    dialog: Extract<OperationDialog, { type: "copyMove" }>,
  ) => void;
  submitCreateFolder: (
    dialog: Extract<OperationDialog, { type: "createFolder" }>,
  ) => void;
  submitCreateFile: (
    dialog: Extract<OperationDialog, { type: "createFile" }>,
  ) => void;
  submitRename: (dialog: Extract<OperationDialog, { type: "rename" }>) => void;
  submitCopyMove: (
    dialog: Extract<OperationDialog, { type: "copyMove" }>,
  ) => void;
  submitTrash: (dialog: Extract<OperationDialog, { type: "trash" }>) => void;
  submitPermanentDelete: (
    dialog: Extract<OperationDialog, { type: "permanentDelete" }>,
  ) => void;
  copyTextFromSelection: (
    panelId: PanelId,
    kind: "path" | "name" | "parentPath" | "uri",
  ) => void;
  calculateSelectionSize: (
    dialog: Extract<OperationDialog, { type: "selectionProperties" }>,
  ) => void;
  revealEntry: (panelId: PanelId, entry: FileEntryDto | null) => void;
  locations: StandardLocationDto[];
  recentDestinations: RecentEntryDto[];
  recentEntries: RecentEntryDto[];
  onRemoveRecentEntry: (uri: string) => void;
  onClearRecentEntries: () => void;
}

export function DialogOverlayGroup(props: DialogOverlayGroupProps) {
  return (
    <>
      <DialogOverlaySectionWorkspace {...props} />
      <DialogOverlaySectionNavigation {...props} />
      <DialogOverlaySectionOperations {...props} />
    </>
  );
}
