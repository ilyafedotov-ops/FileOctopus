import { useModals } from "../app/providers/ModalsProvider";
import { DiagnosticsDialog } from "./DiagnosticsDialog";
import { SettingsDialog } from "./SettingsDialog";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { CommandPalette } from "./CommandPalette";
import { PreviewPanel } from "./PreviewPanel";
import { ViewerDialog } from "./viewer/ViewerDialog";
import { DiffDialog } from "./diff/DiffDialog";
import { EditorDialog } from "./editor/EditorDialog";
import { setRememberSessionPaths } from "../pane/sessionPaths";
import { OperationDialogView } from "../dialogs/OperationDialogView";
import { AboutDialog } from "./dialogs/AboutDialog";
import { DocumentationDialog } from "./dialogs/DocumentationDialog";
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
import { MultiRenameDialog } from "./MultiRenameDialog";
import { SyncDirectoriesDialog } from "./dialogs/SyncDirectoriesDialog";
import { HotlistDialog } from "../dialogs/HotlistDialog";
import { ManageHotlistDialog } from "../dialogs/ManageHotlistDialog";
import {
  createHotlistEntry,
  parseHotlistEntries,
  serializeHotlistEntries,
} from "../utils/hotlist";
import { FALLBACK_PREFERENCES } from "./fallbackPreferences";
import type { DialogOverlayGroupProps } from "./DialogOverlayGroup";

export function DialogOverlaySectionWorkspace(props: DialogOverlayGroupProps) {
  const {
    preferences,
    settingsOpen,
    shortcutsOpen,
    commandPaletteOpen,
    previewOpen,
    viewerOpen,
    viewerEntry,
    setViewerOpen,
    setViewerEntry,
    viewerSiblings,
    onViewerNavigate,
    editorOpen,
    editorEntry,
    setEditorOpen,
    setEditorEntry,
    refreshActivePane,
    helpOpen,
    setHelpOpen,
    aboutOpen,
    settingsPreferenceChange,
    goToLocationInitialUri,
    leftPanelUri,
    rightPanelUri,
    autostart,
    commandEntries,
    previewEntry,
    appInfo,
    fs,
    pluginClient,
    updatePreference,
    handleSetAutostart,
    onCustomizeToolbar,
    handleCommandSelect,
    setSettingsOpen,
    setShortcutsOpen,
    setCommandPaletteOpen,
    setAboutOpen,
    diffOpen,
    diffLeftUri,
    diffRightUri,
    diffLeftName,
    diffRightName,
    setDiffOpen,
    multiRenameOpen,
    setMultiRenameOpen,
    syncDirectoriesOpen,
    setSyncDirectoriesOpen,
    hotlistOpen,
    setHotlistOpen,
    manageHotlistOpen,
    setManageHotlistOpen,
    multiRenameEntries,
    onNavigateActivePane,
    setPreviewOpen,
  } = props;
  return (
    <>
      <SettingsDialog
        open={settingsOpen}
        preferences={preferences ?? FALLBACK_PREFERENCES}
        autostart={autostart}
        pluginClient={pluginClient}
        terminalClient={props.terminalClient}
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
        onEntryChange={setViewerEntry}
      />
      <EditorDialog
        open={editorOpen}
        entry={editorEntry}
        fs={fs}
        onClose={() => setEditorOpen(false)}
        onSaved={() => refreshActivePane?.()}
        onEntryChange={setEditorEntry}
      />
      <DiffDialog
        open={diffOpen}
        leftUri={diffLeftUri}
        rightUri={diffRightUri}
        leftName={diffLeftName}
        rightName={diffRightName}
        fs={fs}
        onClose={() => setDiffOpen(false)}
      />
      <MultiRenameDialog
        open={multiRenameOpen}
        entries={multiRenameEntries}
        onClose={() => setMultiRenameOpen(false)}
        onExecute={() => setMultiRenameOpen(false)}
      />
      <SyncDirectoriesDialog
        open={syncDirectoriesOpen}
        leftUri={leftPanelUri}
        rightUri={rightPanelUri}
        fs={fs}
        onClose={() => setSyncDirectoriesOpen(false)}
      />
      <HotlistDialog
        open={hotlistOpen}
        onNavigate={(uri) => {
          setHotlistOpen(false);
          onNavigateActivePane(uri);
        }}
        onManage={() => setManageHotlistOpen(true)}
        onClose={() => setHotlistOpen(false)}
        onAddCurrent={(label, uri) => {
          const STORAGE_KEY = "fileoctopus_hotlist";
          const raw = localStorage.getItem(STORAGE_KEY) ?? "";
          const existing = parseHotlistEntries(raw);
          existing.push(createHotlistEntry(label, uri));
          localStorage.setItem(STORAGE_KEY, serializeHotlistEntries(existing));
        }}
        currentUri={goToLocationInitialUri}
      />
      <ManageHotlistDialog
        open={manageHotlistOpen}
        onClose={() => setManageHotlistOpen(false)}
      />
      <DocumentationDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <AboutDialog
        open={aboutOpen}
        appInfo={appInfo}
        onClose={() => setAboutOpen(false)}
        onOpenDocumentation={() => {
          setAboutOpen(false);
          setHelpOpen(true);
        }}
      />
    </>
  );
}

export function DialogOverlaySectionNavigation(props: DialogOverlayGroupProps) {
  const { setDebugConsoleOpen } = useModals();
  const {
    diagnosticsOpen,
    goToLocationOpen,
    manageFavoritesOpen,
    recentLocationsOpen,
    clearRecentLocationsOpen,
    closePaneTerminalConfirmOpen,
    errorDetailsOpen,
    onConfirmClosePaneWithTerminal,
    operationHistoryOpen,
    goToLocationInitialUri,
    favorites,
    history,
    operationError,
    appInfo,
    appHealth,
    diagnosticsDestination,
    diagnosticsMessage,
    exportingDiagnostics,
    isProductionBuild,
    setDiagnosticsOpen,
    setGoToLocationOpen,
    setManageFavoritesOpen,
    setRecentLocationsOpen,
    setClearRecentLocationsOpen,
    setClosePaneTerminalConfirmOpen,
    setErrorDetailsOpen,
    setOperationHistoryOpen,
    setOperationError,
    refreshHistory,
    clearHistory,
    onNavigateActivePane,
    onRemoveFavorite,
    onRenameFavorite,
    setDiagnosticsDestination,
    refreshDiagnostics,
    exportDiagnostics,
    recentEntries,
    onRemoveRecentEntry,
    onClearRecentEntries,
  } = props;
  return (
    <>
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
        onOpenLiveConsole={() => {
          setDiagnosticsOpen(false);
          setDebugConsoleOpen(true);
        }}
      />
    </>
  );
}

export function DialogOverlaySectionOperations(props: DialogOverlayGroupProps) {
  const {
    volumePickerOpen,
    networkLocationsOpen,
    connectServerOpen,
    connectServerProfile,
    connectServerInitial,
    removeServerProfile,
    networkProfiles,
    networkStatuses,
    favorites,
    preferences,
    dialog,
    fs,
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
    testConnection,
    testConnectionDraft,
    onOpenProfileTerminal,
    onNavigateActivePane,
    setDialog,
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
  } = props;
  return (
    <>
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
        networkProfiles={networkProfiles}
        onClose={() => {
          setConnectServerOpen(false);
          setConnectServerProfile(null);
          setConnectServerInitial(null);
        }}
        onSave={saveProfile}
        onConnectProfile={(profile) => {
          if (profile.scheme === "ssh") {
            onOpenProfileTerminal(profile);
          } else if (profile.defaultUri) {
            onNavigateActivePane(profile.defaultUri);
          } else {
            void connectProfile(profile.id);
          }
          setConnectServerOpen(false);
          setConnectServerProfile(null);
          setConnectServerInitial(null);
        }}
        onForgetFingerprint={forgetFingerprint}
        onTest={testConnection}
        onTestDraft={testConnectionDraft}
        preferences={preferences ?? FALLBACK_PREFERENCES}
        locations={locations}
        fs={fs}
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
