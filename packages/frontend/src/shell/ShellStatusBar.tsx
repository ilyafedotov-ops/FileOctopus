import { StatusBarSection } from "../components/StatusBarSection";
import { StorageGauge } from "../components/StorageGauge";
import { activeTab } from "../panelStore";
import { localPathFromUri } from "../utils/paneUtils";
import {
  COMMANDER_FUNCTION_ITEMS,
  commanderItemDisabled,
  createCommanderActions,
} from "./commanderActions";
import { useShellLayout } from "./ShellLayoutContext";

export function ShellStatusBar() {
  const ctx = useShellLayout();
  const panelId = ctx.state.activePanelId;
  const tab = activeTab(ctx.state.panels[panelId]);
  const pathLabel = localPathFromUri(tab.uri);
  const commander = createCommanderActions({
    panelId,
    tab,
    setViewerOpen: ctx.setViewerOpen,
    setViewerEntry: ctx.setViewerEntry,
    setEditorOpen: ctx.setEditorOpen,
    setEditorEntry: ctx.setEditorEntry,
    isTextEditable: ctx.isTextEditable,
    handleCommandSelect: ctx.handleCommandSelect,
    handleCopyOrMove: ctx.handleCopyOrMove,
    handleCreateFolder: ctx.handleCreateFolder,
    handleDelete: ctx.handleDelete,
    handleProperties: ctx.handleProperties,
    setOperationError: ctx.setOperationError,
  });

  return (
    <div className="fo-shell-status-stack">
      <div className="fo-bottom-path-rail">
        <span title={pathLabel}>{pathLabel}</span>
        <span className="fo-status-spacer" />
        <StorageGauge uri={tab.uri} client={ctx.client} />
      </div>
      <div className="fo-commander-bar" aria-label="Function key actions">
        {COMMANDER_FUNCTION_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className="fo-commander-key"
            aria-label={`${item.label} - ${item.key}`}
            disabled={commanderItemDisabled(item.action, commander)}
            onClick={() => commander[item.action]()}
          >
            <span className="fo-commander-keycap">{item.key}</span>
            <span className="fo-commander-label">{item.label}</span>
          </button>
        ))}
      </div>
      <StatusBarSection
        state={ctx.state}
        jobs={ctx.jobs}
        operationError={ctx.operationError}
        appHealth={ctx.appHealth}
        diagnosticsOpen={ctx.diagnosticsOpen}
        onOpenActivity={() => {
          ctx.markActivityPinnedOpen();
          ctx.setActivityCollapsed(false);
          void ctx.updatePreference("activityPanelVisible", "true");
        }}
        onShowErrorDetails={
          ctx.operationError ? () => ctx.setErrorDetailsOpen(true) : undefined
        }
      />
    </div>
  );
}
