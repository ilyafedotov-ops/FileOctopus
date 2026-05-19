import { StatusBarSection } from "../components/StatusBarSection";
import { activeTab } from "../panelStore";
import { localPathFromUri } from "../utils/paneUtils";
import { isPreviewable } from "../components/PreviewPanel";
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
    setPreviewOpen: ctx.setPreviewOpen,
    handleCommandSelect: ctx.handleCommandSelect,
    handleCopyOrMove: ctx.handleCopyOrMove,
    handleCreateFolder: ctx.handleCreateFolder,
    handleTrash: ctx.handleTrash,
    handleProperties: ctx.handleProperties,
    setOperationError: ctx.setOperationError,
    isPreviewable,
  });

  return (
    <div className="fo-shell-status-stack">
      <div className="fo-bottom-path-rail">
        <span title={pathLabel}>{pathLabel}</span>
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
