import { useState, useRef } from "react";
import type { UserPreferencesDto } from "@fileoctopus/ts-api";
import { Button } from "@fileoctopus/ui";
import { useDialogEscape } from "../hooks/useDialogEscape";
import { useFocusTrap } from "../hooks/useFocusTrap";
import {
  parseTabSessions,
  serializeTabSessions,
  type TabSession,
  type TabSessionPane,
} from "../utils/tabSessions";

interface SessionManagerDialogProps {
  open: boolean;
  preferences: UserPreferencesDto;
  currentPanes: TabSessionPane[];
  onClose: () => void;
  onChange: (key: string, value: string) => void;
  onRestoreSession: (session: TabSession) => void;
}

export function SessionManagerDialog({
  open,
  preferences,
  currentPanes,
  onClose,
  onChange,
  onRestoreSession,
}: SessionManagerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogEscape(open, onClose);
  useFocusTrap(dialogRef, open);

  const [sessions, setSessions] = useState<TabSession[]>(() =>
    parseTabSessions(preferences.tabSessions),
  );
  const [newSessionName, setNewSessionName] = useState("");

  const handleSaveSession = () => {
    const name = newSessionName.trim();
    if (!name) return;
    const session = {
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name,
      createdAt: new Date().toISOString(),
      panes: currentPanes,
    };
    const updated = [...sessions, session];
    setSessions(updated);
    onChange("tabSessions", serializeTabSessions(updated));
    setNewSessionName("");
  };

  const handleRestoreSession = (session: TabSession) => {
    onRestoreSession(session);
    onClose();
  };

  const handleDeleteSession = (id: string) => {
    const updated = sessions.filter((s) => s.id !== id);
    setSessions(updated);
    onChange("tabSessions", serializeTabSessions(updated));
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fo-dialog-backdrop" role="presentation" onClick={onClose}>
      <dialog
        ref={dialogRef}
        open
        role="dialog"
        className="fo-dialog fo-session-manager-dialog"
        aria-labelledby="session-manager-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fo-dialog-header">
          <div className="fo-dialog-titleblock">
            <h2 id="session-manager-title">Tab Sessions</h2>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>
        <div className="fo-dialog-body">
          <div className="fo-settings-field">
            <span>Save current session</span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type="text"
                placeholder="Session name"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveSession();
                }}
                style={{ flex: 1 }}
              />
              <Button
                type="button"
                size="sm"
                onClick={handleSaveSession}
                disabled={!newSessionName.trim()}
              >
                Save
              </Button>
            </div>
          </div>

          {sessions.length > 0 && (
            <div className="fo-session-list">
              {sessions.map((session) => (
                <div key={session.id} className="fo-session-item">
                  <div className="fo-session-info">
                    <strong>{session.name}</strong>
                    <span className="fo-session-meta">
                      {session.panes.length} pane
                      {session.panes.length !== 1 ? "s" : ""},{" "}
                      {session.panes.reduce((sum, p) => sum + p.tabs.length, 0)}{" "}
                      tab
                      {session.panes.reduce(
                        (sum, p) => sum + p.tabs.length,
                        0,
                      ) !== 1
                        ? "s"
                        : ""}
                    </span>
                    <span className="fo-session-date">
                      {new Date(session.createdAt).toLocaleDateString()}{" "}
                      {new Date(session.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="fo-session-actions">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleRestoreSession(session)}
                    >
                      Restore
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteSession(session.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {sessions.length === 0 && (
            <p className="fo-settings-hint">
              No saved sessions. Save your current tab layout to restore it
              later.
            </p>
          )}
        </div>
      </dialog>
    </div>
  );
}
