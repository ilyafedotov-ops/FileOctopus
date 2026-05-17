import { StatusBarSection } from "../components/StatusBarSection";
import { activeTab } from "../panelStore";
import { localPathFromUri } from "../utils/paneUtils";
import { useShellLayout } from "./ShellLayoutContext";

export function ShellStatusBar() {
  const ctx = useShellLayout();
  const panelId = ctx.state.activePanelId;
  const tab = activeTab(ctx.state.panels[panelId]);
  const selectedCount = tab.selectedIds.length;
  const hasSelection = selectedCount > 0;
  const pathLabel = localPathFromUri(tab.uri);
  const functionItems = [
    {
      key: "F3",
      label: "View",
      disabled: !hasSelection,
      onClick: () => ctx.setPreviewOpen(true),
    },
    {
      key: "F4",
      label: "Edit",
      disabled: !hasSelection,
      onClick: () => ctx.handleCommandSelect("op.openDefault", panelId),
    },
    {
      key: "F5",
      label: "Copy",
      disabled: !hasSelection,
      onClick: () => ctx.handleCopyOrMove(panelId, "copy"),
    },
    {
      key: "F6",
      label: "Move",
      disabled: !hasSelection,
      onClick: () => ctx.handleCopyOrMove(panelId, "move"),
    },
    {
      key: "F7",
      label: "New Folder",
      onClick: () => ctx.handleCreateFolder(panelId),
    },
    {
      key: "F8",
      label: "Delete",
      disabled: !hasSelection,
      onClick: () => ctx.handleTrash(panelId),
    },
  ];

  return (
    <div className="fo-shell-status-stack">
      <div className="fo-bottom-path-rail">
        <span title={pathLabel}>{pathLabel}</span>
      </div>
      <div className="fo-commander-bar" aria-label="Function key actions">
        {functionItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className="fo-commander-key"
            disabled={item.disabled}
            onClick={item.onClick}
          >
            <span className="fo-commander-label">{item.label}</span>
            <span className="fo-commander-keycap">- {item.key}</span>
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
