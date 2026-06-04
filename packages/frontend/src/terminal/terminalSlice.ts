import type { TerminalProfileDto } from "@fileoctopus/ts-api";
import type { PanelId } from "../panelStore";

export type ActivityRailSegment = "activity" | "history" | "terminal";

export type TerminalSessionStatus = "starting" | "running" | "exited";

export type TerminalPaneId = PanelId | "rail";

export type TerminalTransport = "local" | "ssh";

export const DEFAULT_PANE_TERMINAL_SPLIT = 0.35;
export const MIN_PANE_TERMINAL_SPLIT = 0.15;
export const MAX_PANE_TERMINAL_SPLIT = 0.85;

export interface TerminalSession {
  id: string;
  uri: string;
  label: string;
  status: TerminalSessionStatus;
  exitCode?: number | null;
  paneId: TerminalPaneId;
  transport?: TerminalTransport;
  terminalProfileId?: string | null;
  terminalProfile?: TerminalProfileDto | null;
}

export interface PaneTerminalChrome {
  open: boolean;
  collapsed: boolean;
  maximized: boolean;
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
  | {
      type: "renameSession";
      sessionId: string;
      label: string;
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
      type: "setPaneTerminalMaximized";
      panelId: PanelId;
      maximized: boolean;
    }
  | {
      type: "setPaneTerminalSplit";
      panelId: PanelId;
      splitRatio: number;
    }
  | {
      type: "setPaneActiveSession";
      panelId: PanelId;
      sessionId: string;
    }
  | { type: "closePaneTerminal"; panelId: PanelId }
  | {
      type: "hydratePaneTerminalPreferences";
      leftHeight: number;
      rightHeight: number;
    };

function createPaneTerminalChrome(): PaneTerminalChrome {
  return {
    open: false,
    collapsed: false,
    maximized: false,
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

function isPaneBound(paneId: TerminalPaneId): paneId is PanelId {
  return paneId === "left" || paneId === "right";
}

function clearPaneBinding(
  pane: Record<PanelId, PaneTerminalChrome>,
  sessionId: string,
  remainingSessions: TerminalSession[],
): Record<PanelId, PaneTerminalChrome> {
  let next = pane;
  for (const panelId of ["left", "right"] as const) {
    if (pane[panelId].sessionId !== sessionId) {
      continue;
    }
    if (next === pane) {
      next = { ...pane };
    }
    const sibling = remainingSessions.find(
      (session) => session.paneId === panelId,
    );
    next[panelId] = {
      ...pane[panelId],
      open: sibling !== undefined,
      collapsed: false,
      maximized: false,
      sessionId: sibling?.id ?? null,
    };
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
      const session: TerminalSession = {
        ...action.session,
        paneId: action.session.paneId ?? "rail",
        transport: action.session.transport ?? "local",
      };
      const sessions = [...state.sessions, session];
      let pane = state.pane;
      if (isPaneBound(session.paneId)) {
        pane = {
          ...state.pane,
          [session.paneId]: {
            ...state.pane[session.paneId],
            open: true,
            collapsed: false,
            maximized: false,
            sessionId: session.id,
          },
        };
      }
      return {
        ...state,
        sessions,
        pane,
        activeSessionId:
          action.makeActive === false ? state.activeSessionId : session.id,
        segment: session.paneId === "rail" ? "terminal" : state.segment,
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
    case "renameSession":
      return {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === action.sessionId
            ? { ...session, label: action.label }
            : session,
        ),
      };
    case "switchSession": {
      const session = state.sessions.find(
        (item) => item.id === action.sessionId,
      );
      let pane = state.pane;
      if (session && isPaneBound(session.paneId)) {
        pane = {
          ...state.pane,
          [session.paneId]: {
            ...state.pane[session.paneId],
            open: true,
            collapsed: false,
            sessionId: session.id,
          },
        };
      }
      return {
        ...state,
        activeSessionId: action.sessionId,
        pane,
        segment: session?.paneId === "rail" ? "terminal" : state.segment,
      };
    }
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
      const pane = clearPaneBinding(state.pane, action.sessionId, sessions);
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
            maximized: false,
            sessionId: action.sessionId,
            splitRatio: clampPaneSplit(
              action.splitRatio ?? state.pane[action.panelId].splitRatio,
            ),
          },
        },
        activeSessionId: action.sessionId,
      };
    case "setPaneTerminalCollapsed":
      return {
        ...state,
        pane: {
          ...state.pane,
          [action.panelId]: {
            ...state.pane[action.panelId],
            collapsed: action.collapsed,
            maximized: action.collapsed
              ? false
              : state.pane[action.panelId].maximized,
          },
        },
      };
    case "setPaneTerminalMaximized":
      return {
        ...state,
        pane: {
          ...state.pane,
          [action.panelId]: {
            ...state.pane[action.panelId],
            maximized: action.maximized,
            collapsed: action.maximized
              ? false
              : state.pane[action.panelId].collapsed,
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
    case "setPaneActiveSession":
      return {
        ...state,
        activeSessionId: action.sessionId,
        pane: {
          ...state.pane,
          [action.panelId]: {
            ...state.pane[action.panelId],
            open: true,
            collapsed: false,
            sessionId: action.sessionId,
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
            maximized: false,
            sessionId: null,
          },
        },
      };
    case "hydratePaneTerminalPreferences":
      return {
        ...state,
        pane: {
          left: {
            ...state.pane.left,
            splitRatio: clampPaneSplit(action.leftHeight),
          },
          right: {
            ...state.pane.right,
            splitRatio: clampPaneSplit(action.rightHeight),
          },
        },
      };
    default:
      return state;
  }
}

export function hasRunningPaneSessions(
  sessions: TerminalSession[],
  paneId: PanelId,
): boolean {
  return sessionsForPane(sessions, paneId).some(
    (session) => session.status !== "exited",
  );
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
  return sessions.filter((session) => session.paneId === "rail");
}

export function sessionsForPane(
  sessions: TerminalSession[],
  paneId: PanelId,
): TerminalSession[] {
  return sessions.filter((session) => session.paneId === paneId);
}
