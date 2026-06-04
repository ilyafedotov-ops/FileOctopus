import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { DropdownMenu, Icons, type DropdownMenuItem } from "@fileoctopus/ui";
import type { TerminalSession } from "./terminalSlice";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type TerminalSearchDirection = "next" | "previous";

interface TerminalTabBarProps {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  onSwitch: (sessionId: string) => void;
  onClose: (sessionId: string) => void;
  onNew: () => void;
  onRename?: (sessionId: string, label: string) => void;
  onDuplicate?: (sessionId: string) => void;
  onSearch?: (query: string, direction: TerminalSearchDirection) => void;
  actions?: ReactNode;
}

export function TerminalTabBar({
  sessions,
  activeSessionId,
  onSwitch,
  onClose,
  onNew,
  onRename,
  onDuplicate,
  onSearch,
  actions,
}: TerminalTabBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(
    null,
  );
  const [renameDraft, setRenameDraft] = useState("");
  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ??
    sessions[0] ??
    null;
  const exitedSessions = sessions.filter(
    (session) => session.status === "exited",
  );
  const otherSessions = activeSession
    ? sessions.filter((session) => session.id !== activeSession.id)
    : [];
  const actionItems = useMemo<DropdownMenuItem[]>(
    () => [
      {
        id: "rename",
        label: "Rename tab",
        icon: Icons.pencil(),
        disabled: !activeSession || !onRename,
        onSelect: () => {
          if (!activeSession) {
            return;
          }
          setRenameDraft(activeSession.label);
          setRenamingSessionId(activeSession.id);
        },
      },
      {
        id: "duplicate",
        label: "Duplicate tab",
        icon: Icons.copy(),
        disabled: !activeSession || !onDuplicate,
        onSelect: () => {
          if (activeSession) {
            onDuplicate?.(activeSession.id);
          }
        },
      },
      {
        id: "close-exited",
        label: "Close exited tabs",
        icon: Icons.x(),
        separatorBefore: true,
        disabled: exitedSessions.length === 0,
        onSelect: () => {
          for (const session of exitedSessions) {
            onClose(session.id);
          }
        },
      },
      {
        id: "close-others",
        label: "Close other tabs",
        icon: Icons.x(),
        danger: otherSessions.some((session) => session.status === "running"),
        disabled: !activeSession || otherSessions.length === 0,
        onSelect: () => {
          for (const session of otherSessions) {
            onClose(session.id);
          }
        },
      },
    ],
    [
      activeSession,
      exitedSessions,
      onClose,
      onDuplicate,
      onRename,
      otherSessions,
    ],
  );

  return (
    <div className="fo-tab-bar fo-terminal-tab-bar" aria-label="Terminal tabs">
      <TerminalTabList
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSwitch={onSwitch}
        onClose={onClose}
        onRename={onRename}
        renamingSessionId={renamingSessionId}
        renameDraft={renameDraft}
        setRenameDraft={setRenameDraft}
        clearRenamingSession={() => setRenamingSessionId(null)}
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
      {onSearch ? <TerminalSearchForm onSearch={onSearch} /> : null}
      <DropdownMenu
        label="Terminal tab actions"
        open={menuOpen}
        items={actionItems}
        onOpenChange={setMenuOpen}
        triggerClassName="fo-terminal-tab-actions-trigger"
        triggerAriaLabel="Terminal tab actions"
      >
        {Icons.more()}
      </DropdownMenu>
      {actions ? (
        <div className="fo-terminal-tab-bar-actions">{actions}</div>
      ) : null}
    </div>
  );
}

function TerminalTabList({
  sessions,
  activeSessionId,
  onSwitch,
  onClose,
  onRename,
  renamingSessionId,
  renameDraft,
  setRenameDraft,
  clearRenamingSession,
}: Pick<
  TerminalTabBarProps,
  "sessions" | "activeSessionId" | "onSwitch" | "onClose" | "onRename"
> & {
  renamingSessionId: string | null;
  renameDraft: string;
  setRenameDraft: (value: string) => void;
  clearRenamingSession: () => void;
}) {
  return (
    <div className="fo-tab-list" role="tablist" aria-label="Open terminals">
      {sessions.map((session) => {
        const isActive = session.id === activeSessionId;
        if (session.id === renamingSessionId) {
          const submit = () => {
            const label = renameDraft.trim();
            if (label) {
              onRename?.(session.id, label);
            }
            clearRenamingSession();
          };
          return (
            <form
              key={session.id}
              role="tab"
              aria-selected={isActive}
              className={cx(
                "fo-tab",
                "fo-tab--renaming",
                isActive && "fo-tab--active",
                session.status === "exited" && "fo-tab--exited",
              )}
              title={session.uri}
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <input
                aria-label="Rename terminal tab"
                value={renameDraft}
                onChange={(event) => setRenameDraft(event.target.value)}
                onBlur={submit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submit();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    clearRenamingSession();
                  }
                }}
                autoFocus
              />
            </form>
          );
        }
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

function TerminalSearchForm({
  onSearch,
}: {
  onSearch: (query: string, direction: TerminalSearchDirection) => void;
}) {
  const [query, setQuery] = useState("");

  const submit = (direction: TerminalSearchDirection) => {
    const trimmed = query.trim();
    if (trimmed) {
      onSearch(trimmed, direction);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit(event.shiftKey ? "previous" : "next");
    } else if (event.key === "Escape") {
      setQuery("");
    }
  };

  return (
    <div className="fo-terminal-search" role="search">
      {Icons.search()}
      <input
        aria-label="Search terminal output"
        className="fo-terminal-search-input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Find"
      />
      <button
        type="button"
        className="fo-terminal-search-step"
        aria-label="Find previous terminal match"
        disabled={!query.trim()}
        onClick={() => submit("previous")}
      >
        {Icons.chevronLeft()}
      </button>
      <button
        type="button"
        className="fo-terminal-search-step"
        aria-label="Find next terminal match"
        disabled={!query.trim()}
        onClick={() => submit("next")}
      >
        {Icons.chevronRight()}
      </button>
    </div>
  );
}
