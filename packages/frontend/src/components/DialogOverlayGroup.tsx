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
import { ErrorDetailsDialog } from "./dialogs/ErrorDetailsDialog";
import type { FavoriteEntryDto } from "@fileoctopus/ts-api";

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
  errorDetailsOpen: boolean;
  goToLocationInitialUri: string;
  favorites: FavoriteEntryDto[];
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
  handleCommandSelect: (id: string) => void;
  setSettingsOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setDiagnosticsOpen: (open: boolean) => void;
  setAboutOpen: (open: boolean) => void;
  setGoToLocationOpen: (open: boolean) => void;
  setManageFavoritesOpen: (open: boolean) => void;
  setErrorDetailsOpen: (open: boolean) => void;
  setOperationError: (message: string | null) => void;
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
  copyTextFromSelection: (panelId: PanelId, kind: "path") => void;
  revealEntry: (panelId: PanelId, entry: FileEntryDto | null) => void;
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
  errorDetailsOpen,
  goToLocationInitialUri,
  favorites,
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
  setErrorDetailsOpen,
  setOperationError,
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
  revealEntry,
}: DialogOverlayGroupProps) {
  return (
    <>
      {preferences ? (
        <SettingsDialog
          open={settingsOpen}
          preferences={preferences}
          autostart={autostart}
          onClose={() => setSettingsOpen(false)}
          onChange={(key, value) => void updatePreference(key, value)}
          onSetAutostart={handleSetAutostart}
        />
      ) : null}
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
      <ErrorDetailsDialog
        open={errorDetailsOpen}
        message={operationError}
        onClose={() => setErrorDetailsOpen(false)}
        onClear={() => setOperationError(null)}
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
        onReveal={(panelId, entry) => void revealEntry(panelId, entry)}
      />
    </>
  );
}
