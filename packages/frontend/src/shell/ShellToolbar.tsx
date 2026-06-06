import { useMemo } from "react";
import { createPortal } from "react-dom";
import { Icons, ToolbarButton } from "@fileoctopus/ui";
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
import { NotificationCenter } from "../components/NotificationCenter";

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
    setViewerOpen: ctx.setViewerOpen,
    setViewerEntry: ctx.setViewerEntry,
    setEditorOpen: ctx.setEditorOpen,
    setEditorEntry: ctx.setEditorEntry,
    openPreviewInOppositePane: ctx.openPreviewInOppositePane,
    openEditorInOppositePane: ctx.openEditorInOppositePane,
    isTextEditable: ctx.isTextEditable,
    handleCommandSelect: ctx.handleCommandSelect,
    handleCopyOrMove: ctx.handleCopyOrMove,
    handleCreateFolder: ctx.handleCreateFolder,
    handleDelete: ctx.handleDelete,
    handleProperties: ctx.handleProperties,
    setOperationError: ctx.setOperationError,
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
        starred: ctx.starred,
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
      ctx.starred,
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

  const currentTheme = ctx.preferences?.theme ?? "system";
  const themeIcon =
    currentTheme === "dark"
      ? Icons.moon()
      : currentTheme === "light"
        ? Icons.sun()
        : Icons.monitor();
  const themeLabel =
    currentTheme === "dark"
      ? "Dark"
      : currentTheme === "light"
        ? "Light"
        : "System";
  const notificationCount = ctx.notifications.length;
  const notificationLabel =
    notificationCount === 0
      ? "Notifications"
      : `Notifications: ${notificationCount} unread`;
  const notificationCenter = (
    <NotificationCenter
      open={ctx.notificationCenterOpen}
      notifications={ctx.notifications}
      onClear={() => ctx.setNotifications([])}
      onDismiss={(id) =>
        ctx.setNotifications((current) =>
          current.filter((notification) => notification.id !== id),
        )
      }
    />
  );

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
          onDelete={() => ctx.handleDelete(pid)}
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
          onOpenTerminalExternal={() =>
            handleCommand("op.openTerminalExternal")
          }
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
        <span className="fo-toolbar-separator" aria-hidden="true" />
        <div className="fo-notification-toolbar">
          <ToolbarButton
            onClick={() =>
              ctx.setNotificationCenterOpen(!ctx.notificationCenterOpen)
            }
            title={notificationLabel}
            aria-label={notificationLabel}
            className="fo-toolbar-nav-btn fo-notification-button"
          >
            {Icons.info()}
            {notificationCount > 0 ? (
              <span className="fo-notification-count">{notificationCount}</span>
            ) : null}
          </ToolbarButton>
        </div>
        <span className="fo-toolbar-separator" aria-hidden="true" />
        <ToolbarButton
          onClick={() => handleCommand("preferences.cycleTheme")}
          title={`Theme: ${themeLabel} (Ctrl+Shift+T to cycle)`}
          aria-label={`Theme: ${themeLabel}`}
          className="fo-toolbar-nav-btn"
        >
          {themeIcon}
        </ToolbarButton>
      </div>
      <ToolbarCustomizeDialog
        open={ctx.toolbarCustomizeOpen}
        entries={entries}
        onClose={() => ctx.setToolbarCustomizeOpen(false)}
        onSave={saveEntries}
      />
      {typeof document === "undefined"
        ? notificationCenter
        : createPortal(notificationCenter, document.body)}
    </>
  );
}
