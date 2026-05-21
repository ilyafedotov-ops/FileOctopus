import { DialogOverlayGroup } from "../components/DialogOverlayGroup";
import { ContextMenuOverlay } from "../components/ContextMenuOverlay";
import { ToastStack } from "../components/ToastStack";
import { useShellLayout } from "./ShellLayoutContext";

export function ShellOverlays() {
  const ctx = useShellLayout();

  return (
    <>
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
        editorOpen={ctx.editorOpen}
        editorEntry={ctx.editorEntry}
        setEditorOpen={ctx.setEditorOpen}
        refreshActivePane={ctx.refreshActivePane}
        diagnosticsOpen={ctx.diagnosticsOpen}
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
        favorites={ctx.favorites}
        operationError={ctx.operationError}
        operationHistoryOpen={ctx.operationHistoryOpen}
        volumePickerOpen={ctx.volumePickerOpen}
        networkLocationsOpen={ctx.networkLocationsOpen}
        connectServerOpen={ctx.connectServerOpen}
        connectServerProfile={ctx.connectServerProfile}
        removeServerProfile={ctx.removeServerProfile}
        networkProfiles={ctx.networkProfiles}
        networkStatuses={ctx.networkStatuses}
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
        updatePreference={ctx.updatePreference}
        handleSetAutostart={ctx.handleSetAutostart}
        onCustomizeToolbar={() =>
          ctx.handleCommandSelect("app.customizeToolbar")
        }
        handleCommandSelect={ctx.handleCommandSelect}
        setSettingsOpen={ctx.setSettingsOpen}
        setShortcutsOpen={ctx.setShortcutsOpen}
        setCommandPaletteOpen={ctx.setCommandPaletteOpen}
        setDiagnosticsOpen={ctx.setDiagnosticsOpen}
        setAboutOpen={ctx.setAboutOpen}
        setGoToLocationOpen={ctx.setGoToLocationOpen}
        setManageFavoritesOpen={ctx.setManageFavoritesOpen}
        setRecentLocationsOpen={ctx.setRecentLocationsOpen}
        setClearRecentLocationsOpen={ctx.setClearRecentLocationsOpen}
        setClosePaneTerminalConfirmOpen={ctx.setClosePaneTerminalConfirmOpen}
        setErrorDetailsOpen={ctx.setErrorDetailsOpen}
        setOperationHistoryOpen={ctx.setOperationHistoryOpen}
        setVolumePickerOpen={ctx.setVolumePickerOpen}
        setNetworkLocationsOpen={ctx.setNetworkLocationsOpen}
        setConnectServerOpen={ctx.setConnectServerOpen}
        setConnectServerProfile={ctx.setConnectServerProfile}
        setRemoveServerProfile={ctx.setRemoveServerProfile}
        connectProfile={ctx.connectProfile}
        disconnectProfile={ctx.disconnectProfile}
        deleteProfile={ctx.deleteProfile}
        saveProfile={ctx.saveProfile}
        forgetFingerprint={ctx.forgetFingerprint}
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
