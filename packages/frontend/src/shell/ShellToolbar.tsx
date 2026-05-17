import { OperationToolbar } from "../pane/OperationToolbar";
import { useShellLayout } from "./ShellLayoutContext";
import { activeTab, selectVisibleEntries, parentUri } from "../panelStore";

export function ShellToolbar() {
  const ctx = useShellLayout();
  const pid = ctx.state.activePanelId;
  const tab = activeTab(ctx.state.panels[pid]);
  const selectedCount = tab.selectedIds.length;
  const canPaste = Boolean(ctx.clipboard);
  const upUri = parentUri(tab.uri);

  const handleCommand = (
    commandId: string,
    context?: import("../commands/invokeContext").CommandInvokeArg,
  ) => ctx.handleCommandSelect(commandId, pid, context);

  return (
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
        const commandId =
          viewMode === "details"
            ? "view.details"
            : viewMode === "list"
              ? "view.list"
              : viewMode === "icons"
                ? "view.icons"
                : viewMode === "columns"
                  ? "view.columns"
                  : null;
        if (commandId) {
          handleCommand(commandId);
        }
      }}
    />
  );
}
