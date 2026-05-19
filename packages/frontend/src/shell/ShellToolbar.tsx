import { useMemo } from "react";
import { isPreviewable } from "../components/PreviewPanel";
import { ToolbarCustomizeDialog } from "../components/ToolbarCustomizeDialog";
import { useToolbarConfig } from "../hooks/useToolbarConfig";
import { OperationToolbar } from "../pane/OperationToolbar";
import { createCommanderActions } from "./commanderActions";
import {
  buildDriveTargets,
  driveTargetToolbarLabel,
} from "../navigation/driveTargets";
import { buildHotlistTargets } from "./hotlistTargets";
import { useShellLayout } from "./ShellLayoutContext";
import {
  activeTab,
  countOperationalSelection,
  selectVisibleEntries,
  parentUri,
} from "../panelStore";
import { viewModeCommandId } from "../commands/viewModeCommands";
import { rootUri } from "../utils/paneUtils";
import { toolbarJobsDisplay } from "../pane/toolbarJobsLabel";

export function ShellToolbar() {
  const ctx = useShellLayout();
  const pid = ctx.state.activePanelId;
  const tab = activeTab(ctx.state.panels[pid]);
  const selectedCount = countOperationalSelection(tab);
  const canPaste = Boolean(ctx.clipboard);
  const upUri = parentUri(tab.uri);
  const { entries, saveEntries } = useToolbarConfig(
    ctx.preferences,
    ctx.updatePreference,
  );

  const selectedEntry =
    selectVisibleEntries(tab).find((entry) => entry.uri === tab.selectedId) ??
    null;
  const commander = createCommanderActions({
    panelId: pid,
    tab,
    setPreviewOpen: ctx.setPreviewOpen,
    handleCommandSelect: ctx.handleCommandSelect,
    handleCopyOrMove: ctx.handleCopyOrMove,
    handleCreateFolder: ctx.handleCreateFolder,
    handleTrash: ctx.handleTrash,
    handleProperties: ctx.handleProperties,
    setOperationError: ctx.setOperationError,
    isPreviewable,
  });

  const hotlist = useMemo(
    () =>
      buildHotlistTargets({
        activeUri: tab.uri,
        parentUri: upUri,
        locations: ctx.locations,
        networkProfiles: ctx.networkProfiles,
        networkStatuses: ctx.networkStatuses,
        favorites: ctx.favorites,
        recentToday: ctx.recentToday,
        recentWeek: ctx.recentWeek,
      }),
    [
      tab.uri,
      upUri,
      ctx.locations,
      ctx.networkProfiles,
      ctx.networkStatuses,
      ctx.favorites,
      ctx.recentToday,
      ctx.recentWeek,
    ],
  );

  const driveVolumes = useMemo(
    () =>
      buildDriveTargets(
        ctx.locations,
        ctx.networkProfiles,
        ctx.networkStatuses,
      ).map((target) => ({
        id: target.id,
        label: driveTargetToolbarLabel(target),
        uri: target.uri,
        isNetwork: target.kind === "network",
      })),
    [ctx.locations, ctx.networkProfiles, ctx.networkStatuses],
  );

  const jobsDisplay = useMemo(() => toolbarJobsDisplay(ctx.jobs), [ctx.jobs]);

  const handleCommand = (
    commandId: string,
    context?: import("../commands/invokeContext").CommandInvokeArg,
  ) => ctx.handleCommandSelect(commandId, pid, context);

  return (
    <>
      <div className="fo-workbench-toolbar">
        <OperationToolbar
          toolbarEntries={entries}
          selectedCount={selectedCount}
          canRename={commander.canRename}
          canPaste={canPaste}
          canView={Boolean(selectedEntry) || selectedCount === 0}
          canEdit={commander.canEdit}
          hotlistTargets={hotlist.visible}
          hotlistOverflow={hotlist.overflow}
          driveVolumes={driveVolumes}
          jobsDisplay={jobsDisplay}
          showHidden={tab.showHidden}
          viewMode={tab.viewMode}
          canGoBack={tab.backStack.length > 0}
          canGoForward={tab.forwardStack.length > 0}
          canGoUp={Boolean(upUri)}
          onBack={() => handleCommand("nav.back")}
          onForward={() => handleCommand("nav.forward")}
          onUp={() => upUri && ctx.navigatePanel(pid, upUri)}
          onRoot={() => ctx.navigatePanel(pid, rootUri(tab.uri))}
          onHome={() => handleCommand("nav.home")}
          onDrives={() => handleCommand("nav.volumePicker")}
          onView={() => commander.view()}
          onCommand={(commandId) => handleCommand(commandId)}
          onCustomizeToolbar={() => ctx.setToolbarCustomizeOpen(true)}
          onOpenHotlistTarget={(uri) =>
            handleCommand("nav.openUri", { targetUri: uri })
          }
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
            void ctx.handleCommandSelect(
              "op.calculateSize",
              pid,
              entry ?? null,
            );
          }}
          onCompress={() => handleCommand("op.compress")}
          onExtract={() => handleCommand("op.extract")}
          onOpenTerminal={() => handleCommand("op.openTerminal")}
          onChecksum={() => void handleCommand("op.checksum")}
          onRefresh={() => ctx.refreshPanel(pid)}
          onCommandSearch={() => ctx.setCommandPaletteOpen(true)}
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
      <ToolbarCustomizeDialog
        open={ctx.toolbarCustomizeOpen}
        entries={entries}
        onClose={() => ctx.setToolbarCustomizeOpen(false)}
        onSave={saveEntries}
      />
    </>
  );
}
