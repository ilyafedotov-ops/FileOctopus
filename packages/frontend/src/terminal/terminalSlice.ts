import type { PanelId } from "../panelStore";

export type ActivityRailSegment = "activity" | "history" | "terminal";

export type TerminalSessionStatus = "starting" | "running" | "exited";

export const DEFAULT_PANE_TERMINAL_SPLIT = 0.35;
export const MIN_PANE_TERMINAL_SPLIT = 0.2;
export const MAX_PANE_TERMINAL_SPLIT = 0.55;

export interface TerminalSession {
  id: string;
  uri: string;
  label: string;
  status: TerminalSessionStatus;
  exitCode?: number | null;
  panelId?: PanelId;
}

export interface PaneTerminalChrome {
  open: boolean;
  collapsed: boolean;
  splitRatio: number;
  sessionId: string | null;
}

export interface TerminalState {
  segment: ActivityRailSegment;
  sessions: TerminalSession[];
  activeSessionId: string | null;
  pane: Record<PanelId, PaneTerminalChrome>;
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
  | { type: "closeSession"; sessionId: string }
  | {
      type: "openPaneTerminal";
      panelId: PanelId;
      sessionId: string;
      splitRatio?: number;
    }
  | {
      type: "setPaneTerminalCollapsed";
      panelId: PanelId;
      collapsed: boolean;
    }
  | {
      type: "setPaneTerminalSplit";
      panelId: PanelId;
      splitRatio: number;
    }
  | { type: "closePaneTerminal"; panelId: PanelId };

function createPaneTerminalChrome(): PaneTerminalChrome {
  return {
    open: false,
    collapsed: false,
    splitRatio: DEFAULT_PANE_TERMINAL_SPLIT,
    sessionId: null,
  };
}

export function createInitialTerminalState(): TerminalState {
  return {
    segment: "activity",
    sessions: [],
    activeSessionId: null,
    pane: {
      left: createPaneTerminalChrome(),
      right: createPaneTerminalChrome(),
    },
  };
}

function clampPaneSplit(ratio: number): number {
  return Math.min(
    MAX_PANE_TERMINAL_SPLIT,
    Math.max(MIN_PANE_TERMINAL_SPLIT, ratio),
  );
}

function clearPaneBinding(
  pane: Record<PanelId, PaneTerminalChrome>,
  sessionId: string,
): Record<PanelId, PaneTerminalChrome> {
  let next = pane;
  for (const panelId of ["left", "right"] as const) {
    if (pane[panelId].sessionId === sessionId) {
      if (next === pane) {
        next = { ...pane };
      }
      next[panelId] = {
        ...pane[panelId],
        open: false,
        collapsed: false,
        sessionId: null,
      };
    }
  }
  return next;
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
      const pane =
        action.session.panelId === undefined
          ? state.pane
          : {
              ...state.pane,
              [action.session.panelId]: {
                ...state.pane[action.session.panelId],
                open: true,
                collapsed: false,
                sessionId: action.session.id,
              },
            };
      return {
        ...state,
        sessions,
        pane,
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
      const pane = clearPaneBinding(state.pane, action.sessionId);
      return {
        ...state,
        sessions,
        activeSessionId,
        pane,
        segment:
          sessions.length === 0 && state.segment === "terminal"
            ? "activity"
            : state.segment,
      };
    }
    case "openPaneTerminal":
      return {
        ...state,
        pane: {
          ...state.pane,
          [action.panelId]: {
            ...state.pane[action.panelId],
            open: true,
            collapsed: false,
            sessionId: action.sessionId,
            splitRatio: clampPaneSplit(
              action.splitRatio ?? state.pane[action.panelId].splitRatio,
            ),
          },
        },
        activeSessionId: action.sessionId,
        segment: "terminal",
      };
    case "setPaneTerminalCollapsed":
      return {
        ...state,
        pane: {
          ...state.pane,
          [action.panelId]: {
            ...state.pane[action.panelId],
            collapsed: action.collapsed,
          },
        },
      };
    case "setPaneTerminalSplit":
      return {
        ...state,
        pane: {
          ...state.pane,
          [action.panelId]: {
            ...state.pane[action.panelId],
            splitRatio: clampPaneSplit(action.splitRatio),
          },
        },
      };
    case "closePaneTerminal":
      return {
        ...state,
        pane: {
          ...state.pane,
          [action.panelId]: {
            ...state.pane[action.panelId],
            open: false,
            collapsed: false,
            sessionId: null,
          },
        },
      };
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

export function sessionsForActivityRail(
  sessions: TerminalSession[],
): TerminalSession[] {
  return sessions.filter((session) => session.panelId === undefined);
}
