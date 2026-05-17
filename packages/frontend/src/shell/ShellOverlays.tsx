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
        diagnosticsOpen={ctx.diagnosticsOpen}
        aboutOpen={ctx.aboutOpen}
        goToLocationOpen={ctx.goToLocationOpen}
        manageFavoritesOpen={ctx.manageFavoritesOpen}
        errorDetailsOpen={ctx.errorDetailsOpen}
        goToLocationInitialUri={ctx.activeTabUri}
        favorites={ctx.favorites}
        operationError={ctx.operationError}
        operationHistoryOpen={ctx.operationHistoryOpen}
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
        handleCommandSelect={ctx.handleCommandSelect}
        setSettingsOpen={ctx.setSettingsOpen}
        setShortcutsOpen={ctx.setShortcutsOpen}
        setCommandPaletteOpen={ctx.setCommandPaletteOpen}
        setDiagnosticsOpen={ctx.setDiagnosticsOpen}
        setAboutOpen={ctx.setAboutOpen}
        setGoToLocationOpen={ctx.setGoToLocationOpen}
        setManageFavoritesOpen={ctx.setManageFavoritesOpen}
        setErrorDetailsOpen={ctx.setErrorDetailsOpen}
        setOperationHistoryOpen={ctx.setOperationHistoryOpen}
        setOperationError={ctx.setOperationError}
        refreshHistory={ctx.refreshHistory}
        clearHistory={ctx.clearHistory}
        onNavigateActivePane={(uri) =>
          void ctx.navigatePanel(ctx.state.activePanelId, uri)
        }
        onRemoveFavorite={(id) => {
          void ctx.client.navigation
            .removeFavorite({ id })
            .then(() => ctx.refreshNavigation())
            .catch((error) =>
              ctx.setOperationError(
                error instanceof Error ? error.message : String(error),
              ),
            );
        }}
        onRenameFavorite={(id, label) => {
          void ctx.client.navigation
            .renameFavorite({ id, label })
            .then(() => ctx.refreshNavigation())
            .catch((error) =>
              ctx.setOperationError(
                error instanceof Error ? error.message : String(error),
              ),
            );
        }}
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
        revealEntry={ctx.revealEntry}
      />
      <ContextMenuOverlay
        menu={ctx.contextMenu}
        state={ctx.state}
        clipboard={ctx.clipboard}
        starredUriSet={ctx.starredUriSet}
        dispatch={ctx.dispatch}
        onClose={() => ctx.setContextMenu(null)}
        runPanelCommand={(panelId, commandId) =>
          ctx.handleCommandSelect(commandId, panelId)
        }
        activateEntry={ctx.activateEntry}
        toggleStarredForEntry={ctx.toggleStarredForEntry}
        handleProperties={ctx.handleProperties}
        revealEntry={ctx.revealEntry}
        openTerminal={ctx.openTerminal}
        handleChecksum={ctx.handleChecksum}
        handleCompress={ctx.handleCompress}
        handleExtract={ctx.handleExtract}
        openExternal={ctx.openExternal}
        navigatePanel={ctx.navigatePanel}
        navigateOtherPane={ctx.navigateOtherPane}
        addFavorite={ctx.addFavorite}
      />
    </>
  );
}
