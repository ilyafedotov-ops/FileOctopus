import { Icons } from "@fileoctopus/ui";
import type { TerminalSession } from "./terminalSlice";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

interface TerminalTabBarProps {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  onSwitch: (sessionId: string) => void;
  onClose: (sessionId: string) => void;
  onNew: () => void;
}

export function TerminalTabBar({
  sessions,
  activeSessionId,
  onSwitch,
  onClose,
  onNew,
}: TerminalTabBarProps) {
  return (
    <div className="fo-tab-bar fo-terminal-tab-bar" aria-label="Terminal tabs">
      <TerminalTabList
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSwitch={onSwitch}
        onClose={onClose}
      />
      <button
        type="button"
        className="fo-tab fo-tab--new"
        aria-label="New terminal tab"
        title="New terminal"
        onClick={onNew}
      >
        +
      </button>
    </div>
  );
}

function TerminalTabList({
  sessions,
  activeSessionId,
  onSwitch,
  onClose,
}: Pick<
  TerminalTabBarProps,
  "sessions" | "activeSessionId" | "onSwitch" | "onClose"
>) {
  return (
    <div className="fo-tab-list" role="tablist" aria-label="Open terminals">
      {sessions.map((session) => {
        const isActive = session.id === activeSessionId;
        return (
          <button
            key={session.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={cx(
              "fo-tab",
              isActive && "fo-tab--active",
              session.status === "exited" && "fo-tab--exited",
            )}
            onClick={() => onSwitch(session.id)}
            title={session.uri}
          >
            <span className="fo-tab-label">{session.label}</span>
            <span
              className="fo-tab-close"
              role="button"
              aria-label="Close terminal tab"
              onClick={(event) => {
                event.stopPropagation();
                onClose(session.id);
              }}
            >
              {Icons.x()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
