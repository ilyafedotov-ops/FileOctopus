import type { FsClient } from "@fileoctopus/ts-api";
import type {
  AppDataHealthResponse,
  AppInfoResponse,
  AutostartStatusDto,
  FileEntryDto,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
import type { PanelId } from "../panelStore";
import { DiagnosticsDialog } from "./DiagnosticsDialog";
import { SettingsDialog } from "./SettingsDialog";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { CommandPalette, type CommandEntry } from "./CommandPalette";
import { PreviewPanel } from "./PreviewPanel";
import {
  OperationDialogView,
  type OperationDialog,
} from "../dialogs/OperationDialogView";
import { AboutDialog } from "./dialogs/AboutDialog";
import { GoToLocationDialog } from "./dialogs/GoToLocationDialog";
import { ManageFavoritesDialog } from "./dialogs/ManageFavoritesDialog";
import { RecentLocationsDialog } from "./dialogs/RecentLocationsDialog";
import { ClearRecentLocationsDialog } from "./dialogs/ClearRecentLocationsDialog";
import { ErrorDetailsDialog } from "./dialogs/ErrorDetailsDialog";
import { OperationHistoryDialog } from "./dialogs/OperationHistoryDialog";
import { VolumePickerDialog } from "./dialogs/VolumePickerDialog";
import type {
  FavoriteEntryDto,
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
  paneMode: "dual",
  jobDrawerBehavior: "manual",
};

export interface DialogOverlayGroupProps {
  preferences: UserPreferencesDto | null;
  settingsOpen: boolean;
  shortcutsOpen: boolean;
  commandPaletteOpen: boolean;
  previewOpen: boolean;
  diagnosticsOpen: boolean;
  aboutOpen: boolean;
  goToLocationOpen: boolean;
  manageFavoritesOpen: boolean;
  recentLocationsOpen: boolean;
  clearRecentLocationsOpen: boolean;
  errorDetailsOpen: boolean;
  operationHistoryOpen: boolean;
  volumePickerOpen: boolean;
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
  setErrorDetailsOpen: (open: boolean) => void;
  setOperationHistoryOpen: (open: boolean) => void;
  setVolumePickerOpen: (open: boolean) => void;
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
  diagnosticsOpen,
  aboutOpen,
  goToLocationOpen,
  manageFavoritesOpen,
  recentLocationsOpen,
  clearRecentLocationsOpen,
  errorDetailsOpen,
  operationHistoryOpen,
  volumePickerOpen,
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
  setErrorDetailsOpen,
  setOperationHistoryOpen,
  setVolumePickerOpen,
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
        onChange={(key, value) => void updatePreference(key, value)}
        onSetAutostart={handleSetAutostart}
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
      />
      <VolumePickerDialog
        open={volumePickerOpen}
        fs={fs}
        onClose={() => setVolumePickerOpen(false)}
        onSelect={(uri) => {
          setVolumePickerOpen(false);
          onNavigateActivePane(uri);
        }}
      />
    </>
  );
}
