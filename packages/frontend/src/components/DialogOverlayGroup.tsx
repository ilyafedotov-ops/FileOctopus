import type { FsClient } from "@fileoctopus/ts-api";
import type {
  AppDataHealthResponse,
  AppInfoResponse,
  AutostartStatusDto,
  FileEntryDto,
  NetworkConnectionDraftDto,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
import type { PanelId } from "../panelStore";
import { DiagnosticsDialog } from "./DiagnosticsDialog";
import { SettingsDialog } from "./SettingsDialog";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { CommandPalette, type CommandEntry } from "./CommandPalette";
import { PreviewPanel } from "./PreviewPanel";
import { ViewerDialog } from "./viewer/ViewerDialog";
import { EditorDialog } from "./editor/EditorDialog";
import { setRememberSessionPaths } from "../pane/sessionPaths";
import {
  OperationDialogView,
  type OperationDialog,
} from "../dialogs/OperationDialogView";
import { AboutDialog } from "./dialogs/AboutDialog";
import { GoToLocationDialog } from "./dialogs/GoToLocationDialog";
import { ManageFavoritesDialog } from "./dialogs/ManageFavoritesDialog";
import { RecentLocationsDialog } from "./dialogs/RecentLocationsDialog";
import { ClearRecentLocationsDialog } from "./dialogs/ClearRecentLocationsDialog";
import { ClosePaneTerminalDialog } from "./dialogs/ClosePaneTerminalDialog";
import { ErrorDetailsDialog } from "./dialogs/ErrorDetailsDialog";
import { OperationHistoryDialog } from "./dialogs/OperationHistoryDialog";
import { VolumePickerDialog } from "./dialogs/VolumePickerDialog";
import { NetworkLocationsDialog } from "./dialogs/NetworkLocationsDialog";
import { ConnectServerDialog } from "./dialogs/ConnectServerDialog";
import { RemoveServerDialog } from "./dialogs/RemoveServerDialog";
import type {
  FavoriteEntryDto,
  NetworkConnectionStatusDto,
  NetworkProfileDto,
  OperationHistoryRecordDto,
  StandardLocationDto,
  RecentEntryDto,
} from "@fileoctopus/ts-api";

const FALLBACK_PREFERENCES: UserPreferencesDto = {
  theme: "system",
  density: "comfortable",
  defaultViewMode: "details",
  showHiddenFiles: false,
  sidebarWidth: 240,
  splitRatio: 0.5,
  activityPanelVisible: false,
  activityPanelWidth: 288,
  confirmDelete: true,
  confirmPermanentDelete: true,
  useTrashByDefault: true,
  defaultConflictPolicy: "fail",
  accentColor: "blue",
  fontScale: "medium",
  iconScale: "medium",
  confirmOverwrite: true,
  sidebarVisible: true,
  statusBarVisible: true,
  toolbarVisible: true,
  toolbarEntries: "",
  paneMode: "dual",
  paneDirection: "horizontal",
  jobDrawerBehavior: "manual",
  showAdvancedCopyOptions: false,
  paneTerminalHeightLeft: 0.35,
  paneTerminalHeightRight: 0.35,
  paneTerminalDefaultOpen: false,
  terminalCdOnNavigate: false,
  confirmClosePaneWithTerminal: true,
  terminalShell: "",
  terminalArgs: "",
  rememberLastUsedPanes: true,
  diagnosticsExportPath: "/tmp/fileoctopus-diagnostics.zip",
  customShortcuts: "",
  fileTypeColorRules: "",
  layoutProfiles: "",
  columnPresets: "",
  tabSessions: "",
  logLevel: "warn",
  experimentalFeatures: false,
  cacheSizeLimit: 256,
  fileOperationThreads: 4,
  networkConnectionTimeout: 30,
  networkAutoReconnect: true,
  networkDefaultProtocol: "sftp",
  networkSshKeyPath: "",
  editorFontFamily: "monospace",
  editorFontSize: 14,
  editorTabSize: 4,
  editorWordWrap: true,
  editorAutoSave: false,
  editorSyntaxHighlighting: true,
  editorLineNumbers: true,
  viewerDefaultViewMode: "text",
  viewerImageZoom: "fit",
  viewerMediaAutoplay: false,
  viewerMaxPreviewSize: 10,
};

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
  connectProfile: (profileId: string) => Promise<void>;
  forgetFingerprint: (profileId: string) => Promise<void>;
  disconnectProfile: (profileId: string) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
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

export function DialogOverlayGroup({
  preferences,
  settingsOpen,
  shortcutsOpen,
  commandPaletteOpen,
  previewOpen,
  viewerOpen,
  viewerEntry,
  setViewerOpen,
  viewerSiblings,
  onViewerNavigate,
  editorOpen,
  editorEntry,
  setEditorOpen,
  refreshActivePane,
  diagnosticsOpen,
  aboutOpen,
  goToLocationOpen,
  manageFavoritesOpen,
  recentLocationsOpen,
  clearRecentLocationsOpen,
  closePaneTerminalConfirmOpen,
  errorDetailsOpen,
  settingsPreferenceChange,
  onConfirmClosePaneWithTerminal,
  operationHistoryOpen,
  volumePickerOpen,
  networkLocationsOpen,
  connectServerOpen,
  connectServerProfile,
  connectServerInitial,
  removeServerProfile,
  networkProfiles,
  networkStatuses,
  goToLocationInitialUri,
  favorites,
  history,
  operationError,
  dialog,
  autostart,
  commandEntries,
  previewEntry,
  appInfo,
  appHealth,
  diagnosticsDestination,
  diagnosticsMessage,
  exportingDiagnostics,
  isProductionBuild,
  fs,
  updatePreference,
  handleSetAutostart,
  onCustomizeToolbar,
  handleCommandSelect,
  setSettingsOpen,
  setShortcutsOpen,
  setCommandPaletteOpen,
  setDiagnosticsOpen,
  setAboutOpen,
  setGoToLocationOpen,
  setManageFavoritesOpen,
  setRecentLocationsOpen,
  setClearRecentLocationsOpen,
  setClosePaneTerminalConfirmOpen,
  setErrorDetailsOpen,
  setOperationHistoryOpen,
  setVolumePickerOpen,
  setNetworkLocationsOpen,
  setConnectServerOpen,
  setConnectServerProfile,
  setConnectServerInitial,
  setRemoveServerProfile,
  connectProfile,
  disconnectProfile,
  deleteProfile,
  saveProfile,
  forgetFingerprint,
  onOpenProfileTerminal,
  setOperationError,
  refreshHistory,
  clearHistory,
  onNavigateActivePane,
  onRemoveFavorite,
  onRenameFavorite,
  setPreviewOpen,
  setDialog,
  setDiagnosticsDestination,
  refreshDiagnostics,
  exportDiagnostics,
  reviewCopyMoveDialog,
  submitCreateFolder,
  submitCreateFile,
  submitRename,
  submitCopyMove,
  submitTrash,
  submitPermanentDelete,
  copyTextFromSelection,
  calculateSelectionSize,
  revealEntry,
  locations,
  recentDestinations,
  recentEntries,
  onRemoveRecentEntry,
  onClearRecentEntries,
}: DialogOverlayGroupProps) {
  return (
    <>
      <SettingsDialog
        open={settingsOpen}
        preferences={preferences ?? FALLBACK_PREFERENCES}
        autostart={autostart}
        onClose={() => setSettingsOpen(false)}
        onChange={(key, value) => {
          if (key === "rememberLastUsedPanes") {
            setRememberSessionPaths(value === "true");
          }
          const change = settingsPreferenceChange ?? updatePreference;
          void change(key, value);
        }}
        onSetAutostart={handleSetAutostart}
        onCustomizeToolbar={onCustomizeToolbar}
      />
      <ShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      <CommandPalette
        open={commandPaletteOpen}
        commands={commandEntries}
        onSelect={handleCommandSelect}
        onClose={() => setCommandPaletteOpen(false)}
      />
      {previewOpen && (
        <PreviewPanel
          entry={previewEntry}
          fs={fs}
          onClose={() => setPreviewOpen(false)}
        />
      )}
      <ViewerDialog
        open={viewerOpen}
        entry={viewerEntry}
        fs={fs}
        onClose={() => setViewerOpen(false)}
        siblings={viewerSiblings}
        onNavigate={onViewerNavigate}
      />
      <EditorDialog
        open={editorOpen}
        entry={editorEntry}
        fs={fs}
        onClose={() => setEditorOpen(false)}
        onSaved={() => refreshActivePane?.()}
      />
      <AboutDialog
        open={aboutOpen}
        appInfo={appInfo}
        onClose={() => setAboutOpen(false)}
      />
      <GoToLocationDialog
        open={goToLocationOpen}
        initialUri={goToLocationInitialUri}
        onClose={() => setGoToLocationOpen(false)}
        onNavigate={onNavigateActivePane}
      />
      <ManageFavoritesDialog
        open={manageFavoritesOpen}
        favorites={favorites}
        onClose={() => setManageFavoritesOpen(false)}
        onNavigate={onNavigateActivePane}
        onRemove={onRemoveFavorite}
        onRename={onRenameFavorite}
      />
      <RecentLocationsDialog
        open={recentLocationsOpen}
        entries={recentEntries}
        onClose={() => setRecentLocationsOpen(false)}
        onOpen={onNavigateActivePane}
        onRemove={onRemoveRecentEntry}
        onClearAll={() => setClearRecentLocationsOpen(true)}
      />
      <ClearRecentLocationsDialog
        open={clearRecentLocationsOpen}
        onClose={() => setClearRecentLocationsOpen(false)}
        onConfirm={onClearRecentEntries}
      />
      <ClosePaneTerminalDialog
        open={closePaneTerminalConfirmOpen}
        onClose={() => setClosePaneTerminalConfirmOpen(false)}
        onConfirm={onConfirmClosePaneWithTerminal}
      />
      <ErrorDetailsDialog
        open={errorDetailsOpen}
        message={operationError}
        onClose={() => setErrorDetailsOpen(false)}
        onClear={() => setOperationError(null)}
      />
      <OperationHistoryDialog
        open={operationHistoryOpen}
        history={history}
        onClose={() => setOperationHistoryOpen(false)}
        onRefresh={() => void refreshHistory()}
        onClear={() => void clearHistory()}
      />
      <DiagnosticsDialog
        open={diagnosticsOpen}
        appInfo={appInfo}
        appHealth={appHealth}
        destination={diagnosticsDestination}
        message={diagnosticsMessage}
        exporting={exportingDiagnostics}
        showDeveloperFields={!isProductionBuild}
        onClose={() => setDiagnosticsOpen(false)}
        onDestinationChange={setDiagnosticsDestination}
        onRefresh={() => void refreshDiagnostics()}
        onExport={() => void exportDiagnostics()}
      />
      <OperationDialogView
        dialog={dialog}
        fs={fs}
        onClose={() => setDialog(null)}
        onUpdate={(next) => setDialog(next)}
        onReviewCopyMove={(current) => void reviewCopyMoveDialog(current)}
        onSubmitCreateFolder={(current) => void submitCreateFolder(current)}
        onSubmitCreateFile={(current) => void submitCreateFile(current)}
        onSubmitRename={(current) => void submitRename(current)}
        onSubmitCopyMove={(current) => void submitCopyMove(current)}
        onSubmitTrash={(current) => void submitTrash(current)}
        onSubmitPermanentDelete={(current) =>
          void submitPermanentDelete(current)
        }
        onCopyPath={(panelId) => void copyTextFromSelection(panelId, "path")}
        onCopySelectionPaths={(panelId) =>
          void copyTextFromSelection(panelId, "path")
        }
        onCalculateSelectionSize={(current) =>
          void calculateSelectionSize(current)
        }
        onReveal={(panelId, entry) => void revealEntry(panelId, entry)}
        locations={locations}
        favorites={favorites}
        recentDestinations={recentDestinations}
        networkProfiles={networkProfiles}
      />
      <NetworkLocationsDialog
        open={networkLocationsOpen}
        profiles={networkProfiles}
        statuses={networkStatuses}
        onClose={() => setNetworkLocationsOpen(false)}
        onNavigate={onNavigateActivePane}
        onConnect={connectProfile}
        onDisconnect={disconnectProfile}
        onAddServer={() => {
          setNetworkLocationsOpen(false);
          setConnectServerProfile(null);
          setConnectServerInitial(null);
          setConnectServerOpen(true);
        }}
        onEditServer={(profile) => {
          setNetworkLocationsOpen(false);
          setConnectServerProfile(profile);
          setConnectServerInitial(null);
          setConnectServerOpen(true);
        }}
        onDeleteServer={(profileId) => {
          const profile = networkProfiles.find((item) => item.id === profileId);
          if (profile) {
            setRemoveServerProfile(profile);
          }
        }}
        onOpenTerminal={onOpenProfileTerminal}
      />
      <ConnectServerDialog
        open={connectServerOpen}
        editingProfile={connectServerProfile}
        initialDraft={connectServerInitial}
        onClose={() => {
          setConnectServerOpen(false);
          setConnectServerProfile(null);
          setConnectServerInitial(null);
        }}
        onSave={saveProfile}
        onForgetFingerprint={forgetFingerprint}
      />
      <RemoveServerDialog
        open={removeServerProfile !== null}
        profile={removeServerProfile}
        onClose={() => setRemoveServerProfile(null)}
        onConfirm={() => {
          if (removeServerProfile) {
            void deleteProfile(removeServerProfile.id);
          }
        }}
      />
      <VolumePickerDialog
        open={volumePickerOpen}
        fs={fs}
        networkProfiles={networkProfiles}
        onClose={() => setVolumePickerOpen(false)}
        onSelect={(uri) => {
          setVolumePickerOpen(false);
          onNavigateActivePane(uri);
        }}
        onOpenNetwork={() => {
          setVolumePickerOpen(false);
          onNavigateActivePane("network:///");
        }}
      />
    </>
  );
}
