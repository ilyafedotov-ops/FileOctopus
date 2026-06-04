import { cx } from "@fileoctopus/ui";
import { Icons } from "@fileoctopus/ui";
import { toolbarCommandMeta } from "../commands/toolbarConfig";
import type { PanelId, PanelState } from "../panelStore";
import { localPathFromUri } from "../utils/paneUtils";

export interface TabBarProps {
  panelId: PanelId;
  panel: PanelState;
  onSwitchTab: (panelId: PanelId, tabId: string) => void;
  onCloseTab: (panelId: PanelId, tabId: string) => void;
  onOpenTab: (panelId: PanelId) => void;
  onOpenTerminal?: () => void;
  terminalDisabled?: boolean;
}

function tabLabel(uri: string): string {
  const path = localPathFromUri(uri).replace(/\/+$/, "");
  const last = path.split("/").pop();
  return last || "/";
}

export function TabBar({
  panelId,
  panel,
  onSwitchTab,
  onCloseTab,
  onOpenTab,
  onOpenTerminal,
  terminalDisabled = false,
}: TabBarProps) {
  const tabIds = Object.keys(panel.tabs);
  const paneLabel = panelId === "left" ? "L" : "R";
  const terminalMeta = toolbarCommandMeta("op.openTerminal");

  return (
    <div className="fo-tab-bar" aria-label={`${paneLabel} pane tabs`}>
      <span className="fo-tab-pane-label" aria-hidden="true">
        {paneLabel}:
      </span>
      <div className="fo-tab-list" role="tablist" aria-label="Open tabs">
        {tabIds.map((tabId) => {
          const tab = panel.tabs[tabId];
          if (!tab) return null;
          const isActive = tabId === panel.activeTabId;
          return (
            <button
              key={tabId}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={cx("fo-tab", isActive && "fo-tab--active")}
              onClick={() => onSwitchTab(panelId, tabId)}
              title={localPathFromUri(tab.uri)}
            >
              <span className="fo-tab-label">{tabLabel(tab.uri)}</span>
              {tabIds.length > 1 && (
                <span
                  className="fo-tab-close"
                  role="button"
                  aria-label="Close tab"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(panelId, tabId);
                  }}
                >
                  {Icons.x()}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="fo-tab fo-tab--new"
        aria-label="New tab"
        title="Open new tab"
        onClick={() => onOpenTab(panelId)}
      >
        +
      </button>
      {onOpenTerminal ? (
        <button
          type="button"
          className="fo-tab fo-tab--action"
          disabled={terminalDisabled}
          aria-label={terminalMeta.label}
          title={terminalMeta.tooltip}
          onClick={(event) => {
            event.stopPropagation();
            onOpenTerminal();
          }}
        >
          {Icons.terminal()}
        </button>
      ) : null}
    </div>
  );
}
