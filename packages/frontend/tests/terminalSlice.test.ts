import { describe, expect, it } from "vitest";
import {
  createInitialTerminalState,
  tabLabelForUri,
  terminalReducer,
} from "../src/terminal/terminalSlice";

describe("terminalReducer", () => {
  it("opens a session and selects the terminal segment", () => {
    const state = terminalReducer(createInitialTerminalState(), {
      type: "addSession",
      session: {
        id: "session-1",
        uri: "local:///Users/demo/Projects",
        label: "Projects",
        status: "running",
      },
    });

    expect(state.segment).toBe("terminal");
    expect(state.activeSessionId).toBe("session-1");
    expect(state.sessions).toHaveLength(1);
  });

  it("marks a session as exited without removing it", () => {
    const initial = terminalReducer(createInitialTerminalState(), {
      type: "addSession",
      session: {
        id: "session-1",
        uri: "local:///tmp",
        label: "tmp",
        status: "running",
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

  it("closes the active tab and falls back to a neighbor", () => {
    let state = createInitialTerminalState();
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "a",
        uri: "local:///a",
        label: "a",
        status: "running",
      },
    });
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "b",
        uri: "local:///b",
        label: "b",
        status: "running",
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
