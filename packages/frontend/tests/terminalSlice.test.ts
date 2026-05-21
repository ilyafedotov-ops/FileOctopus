import { describe, expect, it } from "vitest";
import {
  createInitialTerminalState,
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
});
