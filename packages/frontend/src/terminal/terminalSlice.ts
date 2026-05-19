export type ActivityRailSegment = "activity" | "history" | "terminal";

export type TerminalSessionStatus = "starting" | "running" | "exited";

export interface TerminalSession {
  id: string;
  uri: string;
  label: string;
  status: TerminalSessionStatus;
  exitCode?: number | null;
}

export interface TerminalState {
  segment: ActivityRailSegment;
  sessions: TerminalSession[];
  activeSessionId: string | null;
}

export type TerminalAction =
  | { type: "setSegment"; segment: ActivityRailSegment }
  | {
      type: "addSession";
      session: TerminalSession;
      makeActive?: boolean;
    }
  | {
      type: "setSessionStatus";
      sessionId: string;
      status: TerminalSessionStatus;
    }
  | {
      type: "setSessionExited";
      sessionId: string;
      exitCode?: number | null;
    }
  | { type: "switchSession"; sessionId: string }
  | { type: "closeSession"; sessionId: string };

export function createInitialTerminalState(): TerminalState {
  return {
    segment: "activity",
    sessions: [],
    activeSessionId: null,
  };
}

export function terminalReducer(
  state: TerminalState,
  action: TerminalAction,
): TerminalState {
  switch (action.type) {
    case "setSegment":
      return { ...state, segment: action.segment };
    case "addSession": {
      const sessions = [...state.sessions, action.session];
      return {
        ...state,
        sessions,
        activeSessionId:
          action.makeActive === false
            ? state.activeSessionId
            : action.session.id,
        segment: "terminal",
      };
    }
    case "setSessionStatus":
      return {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === action.sessionId
            ? { ...session, status: action.status }
            : session,
        ),
      };
    case "setSessionExited":
      return {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === action.sessionId
            ? {
                ...session,
                status: "exited",
                exitCode: action.exitCode,
              }
            : session,
        ),
      };
    case "switchSession":
      return {
        ...state,
        activeSessionId: action.sessionId,
        segment: "terminal",
      };
    case "closeSession": {
      const sessions = state.sessions.filter(
        (session) => session.id !== action.sessionId,
      );
      let activeSessionId = state.activeSessionId;
      if (activeSessionId === action.sessionId) {
        const index = state.sessions.findIndex(
          (session) => session.id === action.sessionId,
        );
        const fallback =
          sessions[Math.max(0, index - 1)] ?? sessions[0] ?? null;
        activeSessionId = fallback?.id ?? null;
      }
      return {
        ...state,
        sessions,
        activeSessionId,
        segment:
          sessions.length === 0 && state.segment === "terminal"
            ? "activity"
            : state.segment,
      };
    }
    default:
      return state;
  }
}

export function tabLabelForUri(uri: string): string {
  const trimmed = uri.replace(/\/$/, "");
  const parts = trimmed.split("/").filter(Boolean);
  if (parts.length === 0) {
    return "Shell";
  }
  return parts[parts.length - 1] ?? "Shell";
}
