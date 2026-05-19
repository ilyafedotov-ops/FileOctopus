import { IconButton, Icons } from "@fileoctopus/ui";
import type { FileOctopusClient } from "@fileoctopus/ts-api";
import { useTerminal } from "../app/providers/TerminalProvider";
import { TerminalView } from "../terminal/TerminalView";
import { tabLabelForUri } from "../terminal/terminalSlice";
import type { PanelId } from "../panelStore";
import { PaneTerminalResizer } from "../shell/LayoutResizers";

interface PaneTerminalSplitProps {
  client: FileOctopusClient;
  panelId: PanelId;
  sessionId: string;
  uri: string;
  splitRatio: number;
  collapsed: boolean;
  panelActive: boolean;
  onResize: (ratio: number) => void;
}

export function PaneTerminalSplit({
  client,
  panelId,
  sessionId,
  uri,
  splitRatio,
  collapsed,
  panelActive,
  onResize,
}: PaneTerminalSplitProps) {
  const { markSessionExited, closeTerminalTab, setPaneTerminalCollapsed } =
    useTerminal();

  if (collapsed) {
    return (
      <button
        type="button"
        className="fo-panel-terminal-collapsed"
        aria-label={`Expand terminal (${tabLabelForUri(uri)})`}
        onClick={() => setPaneTerminalCollapsed(panelId, false)}
      >
        {Icons.terminal()}
        <span>{tabLabelForUri(uri)}</span>
        <span className="fo-panel-terminal-collapsed-hint">Expand</span>
      </button>
    );
  }

  return (
    <>
      <PaneTerminalResizer panelId={panelId} onResize={onResize} />
      <section
        className="fo-panel-terminal"
        style={{ flex: `${splitRatio} 1 0`, minHeight: 120 }}
        aria-label="Pane terminal"
      >
        <header className="fo-panel-terminal-header">
          <span className="fo-panel-terminal-title">
            {Icons.terminal()}
            {tabLabelForUri(uri)}
          </span>
          <div className="fo-panel-terminal-actions">
            <IconButton
              label="Collapse terminal"
              size="sm"
              onClick={() => setPaneTerminalCollapsed(panelId, true)}
            >
              −
            </IconButton>
            <IconButton
              label="Close terminal"
              size="sm"
              onClick={() => closeTerminalTab(sessionId)}
            >
              ×
            </IconButton>
          </div>
        </header>
        <div className="fo-panel-terminal-view">
          {sessionId.startsWith("pending-") ? (
            <div className="fo-empty-inline">Starting shell…</div>
          ) : (
            <TerminalView
              client={client}
              sessionId={sessionId}
              active={panelActive}
              onExit={(exitCode) => {
                markSessionExited(sessionId, exitCode);
              }}
            />
          )}
        </div>
      </section>
    </>
  );
}
