import type { FileOctopusClient } from "@fileoctopus/ts-api";
import { IconButton, Icons } from "@fileoctopus/ui";
import { useTerminal } from "../app/providers/TerminalProvider";
import type { PanelId } from "../panelStore";
import { PaneTerminalResizer } from "../shell/LayoutResizers";
import { PaneTerminalRegion } from "./PaneTerminalRegion";
import type { TerminalSession } from "../terminal/terminalSlice";
import { tabLabelForUri, sessionsForPane } from "../terminal/terminalSlice";

interface PaneTerminalSplitProps {
  client: FileOctopusClient;
  panelId: PanelId;
  sessions: TerminalSession[];
  activeSessionId: string | null;
  splitRatio: number;
  collapsed: boolean;
  maximized: boolean;
  panelActive: boolean;
  onResize: (ratio: number) => void;
  onSwitch: (sessionId: string) => void;
  onNewSession: () => void;
}

export function PaneTerminalSplit({
  client,
  panelId,
  sessions,
  activeSessionId,
  splitRatio,
  collapsed,
  maximized,
  panelActive,
  onResize,
  onSwitch,
  onNewSession,
}: PaneTerminalSplitProps) {
  const {
    markSessionExited,
    closeTerminalTab,
    setPaneTerminalCollapsed,
    setPaneTerminalMaximized,
    closePaneTerminal,
  } = useTerminal();
  const paneSessions = sessionsForPane(sessions, panelId);
  const activeSession =
    paneSessions.find((session) => session.id === activeSessionId) ??
    paneSessions[paneSessions.length - 1] ??
    null;

  if (paneSessions.length === 0) {
    return null;
  }

  if (collapsed) {
    const label = activeSession
      ? tabLabelForUri(activeSession.uri)
      : "Terminal";
    return (
      <div className="fo-panel-terminal-collapsed">
        <button
          type="button"
          className="fo-panel-terminal-collapsed-expand"
          aria-label={`Expand terminal (${label})`}
          onClick={() => setPaneTerminalCollapsed(panelId, false)}
        >
          {Icons.terminal()}
          <span>{label}</span>
          <span className="fo-panel-terminal-collapsed-hint">Expand</span>
        </button>
        <IconButton
          label="Close terminal"
          size="sm"
          onClick={() => closePaneTerminal(panelId)}
        >
          {Icons.x()}
        </IconButton>
      </div>
    );
  }

  return (
    <>
      {maximized ? null : (
        <PaneTerminalResizer panelId={panelId} onResize={onResize} />
      )}
      <section
        className={
          maximized
            ? "fo-panel-terminal fo-panel-terminal-maximized"
            : "fo-panel-terminal"
        }
        style={
          maximized ? undefined : { flex: `${splitRatio} 1 0`, minHeight: 120 }
        }
        aria-label="Pane terminal"
      >
        <PaneTerminalRegion
          paneId={panelId}
          sessions={sessions}
          activeSessionId={activeSessionId}
          client={client}
          panelActive={panelActive}
          onSwitch={onSwitch}
          onClose={(sessionId) => closeTerminalTab(sessionId)}
          onNewSession={onNewSession}
          onSessionExited={(sessionId, exitCode) => {
            markSessionExited(sessionId, exitCode);
          }}
        />
        <div className="fo-panel-terminal-actions fo-panel-terminal-actions-inline">
          <IconButton
            label={maximized ? "Restore terminal" : "Maximize terminal"}
            size="sm"
            onClick={() => setPaneTerminalMaximized(panelId, !maximized)}
          >
            {maximized ? Icons.minimize() : Icons.maximize()}
          </IconButton>
          <IconButton
            label="Collapse terminal"
            size="sm"
            onClick={() => setPaneTerminalCollapsed(panelId, true)}
            disabled={maximized}
          >
            −
          </IconButton>
          <IconButton
            label="Close terminal"
            size="sm"
            onClick={() => closePaneTerminal(panelId)}
          >
            {Icons.x()}
          </IconButton>
        </div>
      </section>
    </>
  );
}
