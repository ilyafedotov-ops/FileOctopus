import { useMemo, useState } from "react";
import { FirstRunOverlay } from "../components/FirstRunOverlay";
import { DialogOverlayGroup } from "../components/DialogOverlayGroup";
import { ContextMenuOverlay } from "../components/ContextMenuOverlay";
import { ToastStack } from "../components/ToastStack";
import {
  markFirstRunOverlayDismissed,
  shouldShowFirstRunOverlay,
} from "../onboarding/firstRun";
import { useShellLayout } from "./ShellLayoutContext";
import { activeTab, selectVisibleEntries } from "../panelStore";
import { isImagePreviewable } from "../components/PreviewPanel";
import { isParentDirectoryUri } from "../utils/parentEntry";

export function ShellOverlays() {
  const ctx = useShellLayout();
  const [firstRunOpen, setFirstRunOpen] = useState(shouldShowFirstRunOverlay);

  const dismissFirstRun = () => {
    markFirstRunOverlayDismissed();
    setFirstRunOpen(false);
  };

  const viewerSiblings = useMemo(() => {
    if (!ctx.viewerEntry) return [];
    const tab = activeTab(ctx.state.panels[ctx.state.activePanelId]);
    return selectVisibleEntries(tab).filter(isImagePreviewable);
  }, [ctx.state, ctx.viewerEntry]);

  const multiRenameEntries = useMemo(() => {
    const tab = activeTab(ctx.state.panels[ctx.state.activePanelId]);
    const selectedIds = tab.selectedIds;
    if (selectedIds.length === 0) {
      const focused = tab.selectedId ? tab.entriesById[tab.selectedId] : null;
      return focused && !isParentDirectoryUri(focused.uri, tab.uri)
        ? [focused]
        : [];
    }
    return selectedIds
      .map((id) => tab.entriesById[id])
      .filter(
        (entry) => entry && !isParentDirectoryUri(entry.uri, tab.uri),
      ) as import("@fileoctopus/ts-api").FileEntryDto[];
  }, [ctx.state]);

  return (
    <>
      <FirstRunOverlay
        open={firstRunOpen}
        onDismiss={dismissFirstRun}
        onOpenSettings={() => ctx.setSettingsOpen(true)}
        onOpenShortcuts={() => ctx.setShortcutsOpen(true)}
        onOpenNetwork={() =>
          ctx.navigatePanel(ctx.state.activePanelId, "network:///")
        }
      />
      <ToastStack
        toasts={ctx.toasts}
        onDismiss={(id) =>
          ctx.setToasts((current) => current.filter((toast) => toast.id !== id))
        }
      />
      <DialogOverlayGroup
        preferences={ctx.preferences}
        settingsOpen={ctx.settingsOpen}
        shortcutsOpen={ctx.shortcutsOpen}
        commandPaletteOpen={ctx.commandPaletteOpen}
        previewOpen={ctx.previewOpen}
        viewerOpen={ctx.viewerOpen}
        viewerEntry={ctx.viewerEntry}
        setViewerOpen={ctx.setViewerOpen}
        setViewerEntry={ctx.setViewerEntry}
        viewerSiblings={viewerSiblings}
        onViewerNavigate={ctx.setViewerEntry}
        editorOpen={ctx.editorOpen}
        editorEntry={ctx.editorEntry}
        setEditorOpen={ctx.setEditorOpen}
        setEditorEntry={ctx.setEditorEntry}
        refreshActivePane={ctx.refreshActivePane}
        diffOpen={ctx.diffOpen}
        diffLeftUri={ctx.diffLeftUri}
        diffRightUri={ctx.diffRightUri}
        diffLeftName={ctx.diffLeftName}
        diffRightName={ctx.diffRightName}
        setDiffOpen={ctx.setDiffOpen}
        multiRenameOpen={ctx.multiRenameOpen}
        setMultiRenameOpen={ctx.setMultiRenameOpen}
        syncDirectoriesOpen={ctx.syncDirectoriesOpen}
        syncDirectoriesComparison={ctx.syncDirectoriesComparison}
        setSyncDirectoriesOpen={ctx.setSyncDirectoriesOpen}
        hotlistOpen={ctx.hotlistOpen}
        setHotlistOpen={ctx.setHotlistOpen}
        manageHotlistOpen={ctx.manageHotlistOpen}
        setManageHotlistOpen={ctx.setManageHotlistOpen}
        multiRenameEntries={multiRenameEntries}
        diagnosticsOpen={ctx.diagnosticsOpen}
        helpOpen={ctx.helpOpen}
        aboutOpen={ctx.aboutOpen}
        goToLocationOpen={ctx.goToLocationOpen}
        manageFavoritesOpen={ctx.manageFavoritesOpen}
        recentLocationsOpen={ctx.recentLocationsOpen}
        clearRecentLocationsOpen={ctx.clearRecentLocationsOpen}
        closePaneTerminalConfirmOpen={ctx.closePaneTerminalConfirmOpen}
        errorDetailsOpen={ctx.errorDetailsOpen}
        settingsPreferenceChange={ctx.settingsPreferenceChange}
        onConfirmClosePaneWithTerminal={ctx.onConfirmClosePaneWithTerminal}
        goToLocationInitialUri={ctx.activeTabUri}
        leftPanelUri={ctx.leftPanelUri}
        rightPanelUri={ctx.rightPanelUri}
        favorites={ctx.favorites}
        operationError={ctx.operationError}
        operationHistoryOpen={ctx.operationHistoryOpen}
        volumePickerOpen={ctx.volumePickerOpen}
        connectServerOpen={ctx.connectServerOpen}
        connectServerProfile={ctx.connectServerProfile}
        connectServerInitial={ctx.connectServerInitial}
        removeServerProfile={ctx.removeServerProfile}
        networkProfiles={ctx.networkProfiles}
        history={ctx.history}
        dialog={ctx.dialog}
        autostart={ctx.autostart}
        commandEntries={ctx.commandEntries}
        previewEntry={ctx.previewEntry}
        appInfo={ctx.appInfo}
        appHealth={ctx.appHealth}
        diagnosticsDestination={ctx.diagnosticsDestination}
        diagnosticsMessage={ctx.diagnosticsMessage}
        exportingDiagnostics={ctx.exportingDiagnostics}
        isProductionBuild={ctx.isProductionBuild}
        fs={ctx.client.fs}
        pluginClient={ctx.client.plugin}
        terminalClient={ctx.client.terminal}
        updatePreference={ctx.updatePreference}
        pickLocalPath={ctx.pickLocalPath}
        handleSetAutostart={ctx.handleSetAutostart}
        onCustomizeToolbar={() =>
          ctx.handleCommandSelect("app.customizeToolbar")
        }
        handleCommandSelect={ctx.handleCommandSelect}
        setSettingsOpen={ctx.setSettingsOpen}
        setShortcutsOpen={ctx.setShortcutsOpen}
        setCommandPaletteOpen={ctx.setCommandPaletteOpen}
        setDiagnosticsOpen={ctx.setDiagnosticsOpen}
        setHelpOpen={ctx.setHelpOpen}
        setAboutOpen={ctx.setAboutOpen}
        setGoToLocationOpen={ctx.setGoToLocationOpen}
        setManageFavoritesOpen={ctx.setManageFavoritesOpen}
        setRecentLocationsOpen={ctx.setRecentLocationsOpen}
        setClearRecentLocationsOpen={ctx.setClearRecentLocationsOpen}
        setClosePaneTerminalConfirmOpen={ctx.setClosePaneTerminalConfirmOpen}
        setErrorDetailsOpen={ctx.setErrorDetailsOpen}
        setOperationHistoryOpen={ctx.setOperationHistoryOpen}
        setVolumePickerOpen={ctx.setVolumePickerOpen}
        setConnectServerOpen={ctx.setConnectServerOpen}
        setConnectServerProfile={ctx.setConnectServerProfile}
        setConnectServerInitial={ctx.setConnectServerInitial}
        setRemoveServerProfile={ctx.setRemoveServerProfile}
        connectProfile={ctx.connectProfile}
        deleteProfile={ctx.deleteProfile}
        saveProfile={ctx.saveProfile}
        forgetFingerprint={ctx.forgetFingerprint}
        trustFingerprint={ctx.trustFingerprint}
        testConnection={ctx.testConnection}
        testConnectionDraft={ctx.testConnectionDraft}
        onOpenProfileTerminal={(profile) =>
          void ctx.openProfileTerminalTab(profile)
        }
        setOperationError={ctx.setOperationError}
        refreshHistory={ctx.refreshHistory}
        clearHistory={ctx.clearHistory}
        onNavigateActivePane={(uri) =>
          ctx.handleCommandSelect("nav.openUri", ctx.state.activePanelId, {
            targetUri: uri,
          })
        }
        onRemoveFavorite={(id) =>
          ctx.handleCommandSelect("nav.removeFavorite", undefined, {
            favoriteId: id,
          })
        }
        onRenameFavorite={(id, label) =>
          ctx.handleCommandSelect("nav.renameFavorite", undefined, {
            favoriteId: id,
            preferenceValue: label,
          })
        }
        setPreviewOpen={ctx.setPreviewOpen}
        setDialog={ctx.setDialog}
        setDiagnosticsDestination={ctx.setDiagnosticsDestination}
        refreshDiagnostics={ctx.refreshDiagnostics}
        exportDiagnostics={ctx.exportDiagnostics}
        reviewCopyMoveDialog={ctx.reviewCopyMoveDialog}
        submitCreateFolder={ctx.submitCreateFolder}
        submitCreateFile={ctx.submitCreateFile}
        submitRename={ctx.submitRename}
        submitMultiRename={ctx.submitMultiRename}
        submitCopyMove={ctx.submitCopyMove}
        submitTrash={ctx.submitTrash}
        submitPermanentDelete={ctx.submitPermanentDelete}
        copyTextFromSelection={ctx.copyTextFromSelection}
        calculateSelectionSize={ctx.calculateSelectionSize}
        revealEntry={ctx.revealEntry}
        locations={ctx.locations}
        recentDestinations={[...ctx.recentToday, ...ctx.recentWeek]}
        recentEntries={[...ctx.recentToday, ...ctx.recentWeek]}
        onRemoveRecentEntry={(uri) =>
          ctx.handleCommandSelect("nav.removeRecent", undefined, {
            targetUri: uri,
          })
        }
        onClearRecentEntries={() => ctx.handleCommandSelect("nav.clearRecent")}
      />
      <ContextMenuOverlay
        menu={ctx.contextMenu}
        state={ctx.state}
        clipboard={ctx.clipboard}
        preferences={ctx.preferences}
        starredUriSet={ctx.starredUriSet}
        dispatch={ctx.dispatch}
        onClose={() => ctx.setContextMenu(null)}
        runPanelCommand={(panelId, commandId, entry) =>
          ctx.handleCommandSelect(commandId, panelId, entry)
        }
        activateEntry={ctx.activateEntry}
        revealEntry={ctx.revealEntry}
        openExternal={ctx.openExternal}
        navigatePanel={ctx.navigatePanel}
        navigateOtherPane={ctx.navigateOtherPane}
      />
    </>
  );
}
