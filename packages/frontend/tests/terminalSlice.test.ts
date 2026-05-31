import { describe, expect, it } from "vitest";
import {
  createInitialTerminalState,
  hasRunningPaneSessions,
  tabLabelForUri,
  terminalReducer,
  type TerminalSession,
} from "../src/terminal/terminalSlice";

describe("terminalReducer", () => {
  it("opens a session and selects the terminal segment for rail sessions", () => {
    const state = terminalReducer(createInitialTerminalState(), {
      type: "addSession",
      session: {
        id: "session-1",
        uri: "local:///Users/demo/Projects",
        label: "Projects",
        status: "running",
        paneId: "rail",
      },
    });

    expect(state.segment).toBe("terminal");
    expect(state.activeSessionId).toBe("session-1");
    expect(state.sessions).toHaveLength(1);
  });

  it("addSession preserves the paneId field", () => {
    const session: TerminalSession = {
      id: "s1",
      uri: "local:///tmp",
      label: "tmp",
      status: "running",
      paneId: "left",
      transport: "local",
    };
    const next = terminalReducer(createInitialTerminalState(), {
      type: "addSession",
      session,
    });
    expect(next.sessions).toHaveLength(1);
    expect(next.sessions[0]?.paneId).toBe("left");
    expect(next.sessions[0]?.transport).toBe("local");
  });

  it("preserves ssh terminal transport for pane and rail sessions", () => {
    let state = createInitialTerminalState();
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "ssh-pane",
        uri: "sftp://550e8400-e29b-41d4-a716-446655440000/",
        label: "Prod SSH",
        status: "running",
        paneId: "left",
        transport: "ssh",
      },
    });
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "ssh-rail",
        uri: "ssh://550e8400-e29b-41d4-a716-446655440000",
        label: "Prod SSH",
        status: "running",
        paneId: "rail",
        transport: "ssh",
      },
    });

    expect(state.sessions.map((session) => session.transport)).toEqual([
      "ssh",
      "ssh",
    ]);
    expect(state.pane.left.sessionId).toBe("ssh-pane");
  });

  it("addSession defaults paneId to rail if missing", () => {
    const next = terminalReducer(createInitialTerminalState(), {
      type: "addSession",
      session: {
        id: "s1",
        uri: "local:///tmp",
        label: "tmp",
        status: "running",
      } as TerminalSession,
    });
    expect(next.sessions[0]?.paneId).toBe("rail");
  });

  it("marks a session as exited without removing it", () => {
    const initial = terminalReducer(createInitialTerminalState(), {
      type: "addSession",
      session: {
        id: "session-1",
        uri: "local:///tmp",
        label: "tmp",
        status: "running",
        paneId: "rail",
      },
    });

    const next = terminalReducer(initial, {
      type: "setSessionExited",
      sessionId: "session-1",
      exitCode: 1,
    });

    expect(next.sessions[0]?.status).toBe("exited");
    expect(next.sessions[0]?.exitCode).toBe(1);
  });

  it("opens a pane terminal split and binds the session", () => {
    let state = createInitialTerminalState();
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "session-1",
        uri: "local:///tmp",
        label: "tmp",
        status: "running",
        paneId: "left",
      },
    });

    expect(state.pane.left.open).toBe(true);
    expect(state.pane.left.sessionId).toBe("session-1");
    expect(state.pane.left.splitRatio).toBe(0.35);
  });

  it("hides a pane terminal without destroying its session", () => {
    let state = createInitialTerminalState();
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "session-1",
        uri: "local:///tmp",
        label: "tmp",
        status: "running",
        paneId: "left",
      },
    });
    state = terminalReducer(state, {
      type: "closePaneTerminal",
      panelId: "left",
    });

    expect(state.pane.left.open).toBe(false);
    expect(state.pane.left.sessionId).toBeNull();
    expect(state.sessions).toHaveLength(1);
  });

  it("maximizes and restores a pane terminal without changing split size", () => {
    let state = createInitialTerminalState();
    state = terminalReducer(state, {
      type: "setPaneTerminalSplit",
      panelId: "left",
      splitRatio: 0.42,
    });
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "session-1",
        uri: "local:///tmp",
        label: "tmp",
        status: "running",
        paneId: "left",
      },
    });
    state = terminalReducer(state, {
      type: "setPaneTerminalMaximized",
      panelId: "left",
      maximized: true,
    });

    expect(state.pane.left.maximized).toBe(true);
    expect(state.pane.left.collapsed).toBe(false);
    expect(state.pane.left.splitRatio).toBe(0.42);

    state = terminalReducer(state, {
      type: "setPaneTerminalMaximized",
      panelId: "left",
      maximized: false,
    });

    expect(state.pane.left.maximized).toBe(false);
    expect(state.pane.left.splitRatio).toBe(0.42);
  });

  it("closes the active tab and falls back to a neighbor", () => {
    let state = createInitialTerminalState();
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "a",
        uri: "local:///a",
        label: "a",
        status: "running",
        paneId: "rail",
      },
    });
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "b",
        uri: "local:///b",
        label: "b",
        status: "running",
        paneId: "rail",
      },
    });
    state = terminalReducer(state, { type: "switchSession", sessionId: "b" });
    state = terminalReducer(state, { type: "closeSession", sessionId: "b" });

    expect(state.activeSessionId).toBe("a");
    expect(state.sessions).toHaveLength(1);
  });
});

describe("tabLabelForUri", () => {
  it("uses the final path segment", () => {
    expect(tabLabelForUri("local:///Users/demo/Projects/")).toBe("Projects");
  });

  it("returns Shell for empty URI", () => {
    expect(tabLabelForUri("")).toBe("Shell");
  });

  it("returns Shell for root slash URI", () => {
    expect(tabLabelForUri("/")).toBe("Shell");
  });

  it("returns Shell for URI that is only slashes", () => {
    expect(tabLabelForUri("///")).toBe("Shell");
  });

  it("returns the last non-empty segment", () => {
    expect(tabLabelForUri("local:///Users/demo")).toBe("demo");
  });
});

describe("terminalReducer uncovered branches", () => {
  it("returns state unchanged for unknown action type (default case)", () => {
    const initial = createInitialTerminalState();
    const next = terminalReducer(initial, {
      type: "unknownAction" as never,
    });
    expect(next).toBe(initial);
  });

  it("addSession with makeActive false preserves current activeSessionId", () => {
    let state = createInitialTerminalState();
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "first",
        uri: "local:///tmp",
        label: "first",
        status: "running",
        paneId: "rail",
      },
    });
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "second",
        uri: "local:///tmp",
        label: "second",
        status: "running",
        paneId: "rail",
      },
      makeActive: false,
    });
    expect(state.activeSessionId).toBe("first");
    expect(state.sessions).toHaveLength(2);
  });

  it("addSession defaults transport to local when missing", () => {
    const next = terminalReducer(createInitialTerminalState(), {
      type: "addSession",
      session: {
        id: "s1",
        uri: "local:///tmp",
        label: "tmp",
        status: "running",
        paneId: "rail",
      } as TerminalSession,
    });
    expect(next.sessions[0]?.transport).toBe("local");
  });

  it("switchSession sets segment to terminal for rail session", () => {
    let state = createInitialTerminalState();
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "s1",
        uri: "local:///tmp",
        label: "tmp",
        status: "running",
        paneId: "rail",
      },
    });
    state = { ...state, segment: "activity" };
    state = terminalReducer(state, { type: "switchSession", sessionId: "s1" });
    expect(state.segment).toBe("terminal");
  });

  it("switchSession does not change segment for pane session", () => {
    let state = createInitialTerminalState();
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "s1",
        uri: "local:///tmp",
        label: "tmp",
        status: "running",
        paneId: "left",
      },
    });
    expect(state.segment).toBe("activity");
    state = terminalReducer(state, { type: "switchSession", sessionId: "s1" });
    expect(state.segment).toBe("activity");
    expect(state.pane.left.sessionId).toBe("s1");
  });

  it("switchSession with unknown sessionId does not change pane", () => {
    let state = createInitialTerminalState();
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "s1",
        uri: "local:///tmp",
        label: "tmp",
        status: "running",
        paneId: "left",
      },
    });
    const paneBefore = state.pane;
    state = terminalReducer(state, {
      type: "switchSession",
      sessionId: "nonexistent",
    });
    expect(state.pane).toBe(paneBefore);
    expect(state.activeSessionId).toBe("nonexistent");
  });

  it("closeSession switches segment from terminal to activity when no sessions remain", () => {
    let state = createInitialTerminalState();
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "s1",
        uri: "local:///tmp",
        label: "tmp",
        status: "running",
        paneId: "rail",
      },
    });
    expect(state.segment).toBe("terminal");
    state = terminalReducer(state, { type: "closeSession", sessionId: "s1" });
    expect(state.segment).toBe("activity");
    expect(state.sessions).toHaveLength(0);
  });

  it("closeSession does not switch segment when not in terminal segment", () => {
    let state = createInitialTerminalState();
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "s1",
        uri: "local:///tmp",
        label: "tmp",
        status: "running",
        paneId: "left",
      },
    });
    expect(state.segment).toBe("activity");
    state = terminalReducer(state, { type: "closeSession", sessionId: "s1" });
    expect(state.segment).toBe("activity");
  });

  it("closeSession preserves activeSessionId when closing inactive session", () => {
    let state = createInitialTerminalState();
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "a",
        uri: "local:///a",
        label: "a",
        status: "running",
        paneId: "rail",
      },
    });
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "b",
        uri: "local:///b",
        label: "b",
        status: "running",
        paneId: "rail",
      },
    });
    expect(state.activeSessionId).toBe("b");
    state = terminalReducer(state, { type: "closeSession", sessionId: "a" });
    expect(state.activeSessionId).toBe("b");
  });

  it("closeSession falls back to next session when active session is closed as last one", () => {
    let state = createInitialTerminalState();
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "a",
        uri: "local:///a",
        label: "a",
        status: "running",
        paneId: "rail",
      },
    });
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "b",
        uri: "local:///b",
        label: "b",
        status: "running",
        paneId: "rail",
      },
    });
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "c",
        uri: "local:///c",
        label: "c",
        status: "running",
        paneId: "rail",
      },
    });
    // close the first session (not active) — should keep "c" active
    state = terminalReducer(state, { type: "closeSession", sessionId: "a" });
    expect(state.activeSessionId).toBe("c");
  });

  it("closeSession rebinds pane to another session for the same panelId", () => {
    let state = createInitialTerminalState();
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "L1",
        uri: "local:///a",
        label: "a",
        status: "running",
        paneId: "left",
      },
    });
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "L2",
        uri: "local:///b",
        label: "b",
        status: "running",
        paneId: "left",
      },
    });
    // L2 should be the active one bound to left pane
    expect(state.pane.left.sessionId).toBe("L2");
    state = terminalReducer(state, { type: "closeSession", sessionId: "L2" });
    // Should rebind to L1
    expect(state.pane.left.sessionId).toBe("L1");
    expect(state.pane.left.open).toBe(true);
  });

  it("closeSession closes pane when no other session for same panelId", () => {
    let state = createInitialTerminalState();
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "L1",
        uri: "local:///a",
        label: "a",
        status: "running",
        paneId: "left",
      },
    });
    state = terminalReducer(state, { type: "closeSession", sessionId: "L1" });
    expect(state.pane.left.sessionId).toBeNull();
    expect(state.pane.left.open).toBe(false);
  });

  it("setSegment changes the segment", () => {
    const state = terminalReducer(createInitialTerminalState(), {
      type: "setSegment",
      segment: "history",
    });
    expect(state.segment).toBe("history");
  });

  it("setSessionStatus updates the session status", () => {
    let state = createInitialTerminalState();
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "s1",
        uri: "local:///tmp",
        label: "tmp",
        status: "starting",
        paneId: "rail",
      },
    });
    state = terminalReducer(state, {
      type: "setSessionStatus",
      sessionId: "s1",
      status: "running",
    });
    expect(state.sessions[0]?.status).toBe("running");
  });

  it("setPaneTerminalCollapsed clears maximized when collapsing", () => {
    let state = createInitialTerminalState();
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "s1",
        uri: "local:///tmp",
        label: "tmp",
        status: "running",
        paneId: "left",
      },
    });
    state = terminalReducer(state, {
      type: "setPaneTerminalMaximized",
      panelId: "left",
      maximized: true,
    });
    expect(state.pane.left.maximized).toBe(true);
    state = terminalReducer(state, {
      type: "setPaneTerminalCollapsed",
      panelId: "left",
      collapsed: true,
    });
    expect(state.pane.left.collapsed).toBe(true);
    expect(state.pane.left.maximized).toBe(false);
  });

  it("setPaneTerminalCollapsed preserves maximized when uncollapsing", () => {
    let state = createInitialTerminalState();
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "s1",
        uri: "local:///tmp",
        label: "tmp",
        status: "running",
        paneId: "left",
      },
    });
    state = terminalReducer(state, {
      type: "setPaneTerminalMaximized",
      panelId: "left",
      maximized: true,
    });
    state = terminalReducer(state, {
      type: "setPaneTerminalCollapsed",
      panelId: "left",
      collapsed: true,
    });
    state = terminalReducer(state, {
      type: "setPaneTerminalCollapsed",
      panelId: "left",
      collapsed: false,
    });
    expect(state.pane.left.collapsed).toBe(false);
    expect(state.pane.left.maximized).toBe(false);
  });

  it("setPaneTerminalMaximized clears collapsed when maximizing", () => {
    let state = createInitialTerminalState();
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "s1",
        uri: "local:///tmp",
        label: "tmp",
        status: "running",
        paneId: "left",
      },
    });
    state = terminalReducer(state, {
      type: "setPaneTerminalCollapsed",
      panelId: "left",
      collapsed: true,
    });
    state = terminalReducer(state, {
      type: "setPaneTerminalMaximized",
      panelId: "left",
      maximized: true,
    });
    expect(state.pane.left.maximized).toBe(true);
    expect(state.pane.left.collapsed).toBe(false);
  });

  it("openPaneTerminal clamps splitRatio to max", () => {
    let state = createInitialTerminalState();
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "s1",
        uri: "local:///tmp",
        label: "tmp",
        status: "running",
        paneId: "rail",
      },
    });
    state = terminalReducer(state, {
      type: "openPaneTerminal",
      panelId: "left",
      sessionId: "s1",
      splitRatio: 0.99,
    });
    expect(state.pane.left.splitRatio).toBe(0.85);
  });

  it("openPaneTerminal clamps splitRatio to min", () => {
    let state = createInitialTerminalState();
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "s1",
        uri: "local:///tmp",
        label: "tmp",
        status: "running",
        paneId: "rail",
      },
    });
    state = terminalReducer(state, {
      type: "openPaneTerminal",
      panelId: "left",
      sessionId: "s1",
      splitRatio: 0.05,
    });
    expect(state.pane.left.splitRatio).toBe(0.15);
  });

  it("hydratePaneTerminalPreferences sets split ratios", () => {
    const state = terminalReducer(createInitialTerminalState(), {
      type: "hydratePaneTerminalPreferences",
      leftHeight: 0.5,
      rightHeight: 0.6,
    });
    expect(state.pane.left.splitRatio).toBe(0.5);
    expect(state.pane.right.splitRatio).toBe(0.6);
  });

  it("setPaneActiveSession opens the pane and binds the session", () => {
    let state = createInitialTerminalState();
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "s1",
        uri: "local:///tmp",
        label: "tmp",
        status: "running",
        paneId: "left",
      },
    });
    state = terminalReducer(state, {
      type: "closePaneTerminal",
      panelId: "left",
    });
    expect(state.pane.left.open).toBe(false);

    state = terminalReducer(state, {
      type: "setPaneActiveSession",
      panelId: "left",
      sessionId: "s1",
    });
    expect(state.pane.left.open).toBe(true);
    expect(state.pane.left.collapsed).toBe(false);
    expect(state.pane.left.sessionId).toBe("s1");
    expect(state.activeSessionId).toBe("s1");
  });
});

describe("hasRunningPaneSessions", () => {
  it("returns false when no sessions exist for the pane", () => {
    expect(hasRunningPaneSessions([], "left")).toBe(false);
  });

  it("returns true when a running session exists for the pane", () => {
    const sessions: TerminalSession[] = [
      {
        id: "s1",
        uri: "local:///tmp",
        label: "tmp",
        status: "running",
        paneId: "left",
      },
    ];
    expect(hasRunningPaneSessions(sessions, "left")).toBe(true);
  });

  it("returns false when all sessions for the pane are exited", () => {
    const sessions: TerminalSession[] = [
      {
        id: "s1",
        uri: "local:///tmp",
        label: "tmp",
        status: "exited",
        paneId: "left",
      },
    ];
    expect(hasRunningPaneSessions(sessions, "left")).toBe(false);
  });

  it("returns true when mix of running and exited sessions exist", () => {
    const sessions: TerminalSession[] = [
      {
        id: "s1",
        uri: "local:///tmp",
        label: "tmp",
        status: "exited",
        paneId: "left",
      },
      {
        id: "s2",
        uri: "local:///tmp",
        label: "tmp",
        status: "running",
        paneId: "left",
      },
    ];
    expect(hasRunningPaneSessions(sessions, "left")).toBe(true);
  });

  it("ignores sessions from other panes", () => {
    const sessions: TerminalSession[] = [
      {
        id: "s1",
        uri: "local:///tmp",
        label: "tmp",
        status: "running",
        paneId: "right",
      },
    ];
    expect(hasRunningPaneSessions(sessions, "left")).toBe(false);
  });

  it("returns true for starting session", () => {
    const sessions: TerminalSession[] = [
      {
        id: "s1",
        uri: "local:///tmp",
        label: "tmp",
        status: "starting",
        paneId: "left",
      },
    ];
    expect(hasRunningPaneSessions(sessions, "left")).toBe(true);
  });
});
