import { OperationToolbar } from "../pane/OperationToolbar";
import { useShellLayout } from "./ShellLayoutContext";
import { activeTab, selectVisibleEntries, parentUri } from "../panelStore";
import { viewModeCommandId } from "../commands/viewModeCommands";

export function ShellToolbar() {
  const ctx = useShellLayout();
  const pid = ctx.state.activePanelId;
  const tab = activeTab(ctx.state.panels[pid]);
  const selectedCount = tab.selectedIds.length;
  const canPaste = Boolean(ctx.clipboard);
  const upUri = parentUri(tab.uri);
  const locationStrip = ctx.locations.filter(
    (location) =>
      location.section === "Devices/Volumes" ||
      location.section === "Favorites" ||
      location.section === "User folders",
  );

  const handleCommand = (
    commandId: string,
    context?: import("../commands/invokeContext").CommandInvokeArg,
  ) => ctx.handleCommandSelect(commandId, pid, context);

  return (
    <div className="fo-workbench-toolbar">
      <div className="fo-location-strip" aria-label="Quick locations">
        {locationStrip.map((location) => (
          <button
            key={location.id}
            type="button"
            className="fo-location-chip"
            onClick={() =>
              ctx.handleCommandSelect("nav.openUri", pid, {
                targetUri: location.uri,
              })
            }
          >
            <span aria-hidden="true">
              {location.section === "Devices/Volumes" ? "▣" : "☁"}
            </span>
            {location.name}
          </button>
        ))}
      </div>
      <OperationToolbar
        selectedCount={selectedCount}
        canRename={selectedCount === 1}
        canPaste={canPaste}
        showHidden={tab.showHidden}
        viewMode={tab.viewMode}
        canGoBack={tab.backStack.length > 0}
        canGoForward={tab.forwardStack.length > 0}
        canGoUp={Boolean(upUri)}
        onBack={() => handleCommand("nav.back")}
        onForward={() => handleCommand("nav.forward")}
        onUp={() => upUri && ctx.navigatePanel(pid, upUri)}
        onCreateFolder={() => ctx.handleCreateFolder(pid)}
        onCreateFile={() => ctx.handleCreateFile(pid)}
        onRename={() => ctx.triggerInlineRename(pid)}
        onCopy={() => ctx.copySelectionToFileClipboard(pid, "copy")}
        onCut={() => ctx.copySelectionToFileClipboard(pid, "move")}
        onCopyOperation={() => ctx.handleCopyOrMove(pid, "copy")}
        onMove={() => ctx.handleCopyOrMove(pid, "move")}
        onPaste={() => void ctx.pasteClipboard(pid)}
        onTrash={() => ctx.handleTrash(pid)}
        onPermanentDelete={() => ctx.handlePermanentDelete(pid)}
        onCopyPath={() => void ctx.copyTextFromSelection(pid, "path")}
        onCopyName={() => void ctx.copyTextFromSelection(pid, "name")}
        onProperties={() => void ctx.handleProperties(pid, null)}
        onRevealInFileManager={() => void ctx.revealEntry(pid, null)}
        onCalculateSize={() => {
          const entry = selectVisibleEntries(tab).find(
            (e) => e.uri === tab.selectedId,
          );
          void ctx.handleCommandSelect("op.calculateSize", pid, entry ?? null);
        }}
        onCompress={() => handleCommand("op.compress")}
        onExtract={() => handleCommand("op.extract")}
        onOpenTerminal={() => handleCommand("op.openTerminal")}
        onChecksum={() => void handleCommand("op.checksum")}
        onRefresh={() => ctx.refreshPanel(pid)}
        onToggleHidden={() => ctx.toggleHidden(pid)}
        onSelectAll={() => handleCommand("selection.selectAll")}
        onViewMode={(viewMode) => {
          const commandId = viewModeCommandId(viewMode);
          if (commandId) {
            handleCommand(commandId);
          }
        }}
      />
    </div>
  );
}
