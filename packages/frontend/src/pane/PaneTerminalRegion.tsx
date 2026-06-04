import type { ReactNode } from "react";
import { useRef } from "react";
import type { FileOctopusClient } from "@fileoctopus/ts-api";
import type { PanelId } from "../panelStore";
import {
  TerminalTabBar,
  type TerminalSearchDirection,
} from "../terminal/TerminalTabBar";
import {
  TerminalView,
  type TerminalViewHandle,
} from "../terminal/TerminalView";
import type { TerminalSession } from "../terminal/terminalSlice";
import { sessionsForPane } from "../terminal/terminalSlice";

export interface PaneTerminalRegionProps {
  paneId: PanelId;
  sessions: TerminalSession[];
  activeSessionId: string | null;
  client: FileOctopusClient;
  panelActive: boolean;
  onSwitch: (sessionId: string) => void;
  onClose: (sessionId: string) => void;
  onNewSession: () => void;
  onRename: (sessionId: string, label: string) => void;
  onDuplicate: (sessionId: string) => void;
  onSessionExited: (sessionId: string, exitCode?: number | null) => void;
  tabBarActions?: ReactNode;
}

export function PaneTerminalRegion({
  paneId,
  sessions,
  activeSessionId,
  client,
  panelActive,
  onSwitch,
  onClose,
  onNewSession,
  onRename,
  onDuplicate,
  onSessionExited,
  tabBarActions,
}: PaneTerminalRegionProps) {
  const terminalRefs = useRef(new Map<string, TerminalViewHandle | null>());
  const paneSessions = sessionsForPane(sessions, paneId);
  if (paneSessions.length === 0) {
    return null;
  }

  const resolvedActiveId =
    activeSessionId &&
    paneSessions.some((session) => session.id === activeSessionId)
      ? activeSessionId
      : (paneSessions[paneSessions.length - 1]?.id ?? null);

  return (
    <div
      className="fo-pane-terminal-inner"
      role="region"
      aria-label={`Pane ${paneId} terminal`}
    >
      <TerminalTabBar
        sessions={paneSessions}
        activeSessionId={resolvedActiveId}
        onSwitch={onSwitch}
        onClose={onClose}
        onNew={onNewSession}
        onRename={onRename}
        onDuplicate={onDuplicate}
        onSearch={(query: string, direction: TerminalSearchDirection) => {
          if (resolvedActiveId) {
            terminalRefs.current
              .get(resolvedActiveId)
              ?.search(query, direction);
          }
        }}
        actions={tabBarActions}
      />
      <div className="fo-pane-terminal-views">
        {paneSessions.map((session) => (
          <div
            key={session.id}
            className="fo-pane-terminal-view-wrap"
            hidden={session.id !== resolvedActiveId}
          >
            {session.id.startsWith("pending-") ? (
              <div className="fo-empty-inline">Starting shell…</div>
            ) : (
              <TerminalView
                ref={(handle) => {
                  terminalRefs.current.set(session.id, handle);
                }}
                client={client}
                sessionId={session.id}
                active={panelActive && session.id === resolvedActiveId}
                profile={session.terminalProfile ?? null}
                onExit={(exitCode) => onSessionExited(session.id, exitCode)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
