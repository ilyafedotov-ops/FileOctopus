import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import {
  isRemoteUri,
  normalizeIpcError,
  type FileOctopusClient,
} from "@fileoctopus/ts-api";
import { useShell } from "./ShellProvider";
import type { PanelId } from "../../panelStore";
import {
  createInitialTerminalState,
  tabLabelForUri,
  terminalReducer,
  type ActivityRailSegment,
  type TerminalState,
} from "../../terminal/terminalSlice";

const MIN_TERMINAL_RAIL_WIDTH = 480;

interface TerminalSessionHandlers {
  onOutput: (data: string) => void;
  onExit: (exitCode?: number | null) => void;
}

interface TerminalContextValue {
  terminal: TerminalState;
  openEmbeddedTerminal: (uri: string, panelId: PanelId) => Promise<void>;
  openNewTerminalTab: (uri: string, panelId?: PanelId) => Promise<void>;
  togglePaneTerminal: (uri: string, panelId: PanelId) => Promise<void>;
  markSessionExited: (sessionId: string, exitCode?: number | null) => void;
  closeTerminalTab: (sessionId: string) => void;
  switchTerminalTab: (sessionId: string) => void;
  setRailSegment: (segment: ActivityRailSegment) => void;
  setPaneTerminalCollapsed: (panelId: PanelId, collapsed: boolean) => void;
  setPaneTerminalSplit: (panelId: PanelId, splitRatio: number) => void;
  openExternalTerminal: (uri: string) => Promise<void>;
  registerTerminalSessionHandlers: (
    sessionId: string,
    handlers: TerminalSessionHandlers,
  ) => () => void;
}

const TerminalContext = createContext<TerminalContextValue | null>(null);

export function useTerminal(): TerminalContextValue {
  const ctx = useContext(TerminalContext);
  if (!ctx) {
    throw new Error("useTerminal must be used within TerminalProvider");
  }
  return ctx;
}

async function spawnSession(
  client: FileOctopusClient,
  uri: string,
  cols = 80,
  rows = 24,
) {
  const response = await client.terminal.spawn({ uri, cols, rows });
  return response.sessionId;
}

function findRunningPaneSession(
  terminal: TerminalState,
  panelId: PanelId,
): TerminalState["sessions"][number] | undefined {
  const chrome = terminal.pane[panelId];
  if (chrome.sessionId) {
    const bound = terminal.sessions.find(
      (session) =>
        session.id === chrome.sessionId && session.status !== "exited",
    );
    if (bound) {
      return bound;
    }
  }
  return terminal.sessions.find(
    (session) => session.panelId === panelId && session.status !== "exited",
  );
}

export function TerminalProvider({
  children,
  updatePreference,
  preferences,
  onExpandActivity,
}: {
  children: ReactNode;
  updatePreference: (key: string, value: string) => Promise<void>;
  preferences: { activityPanelWidth: number } | null;
  onExpandActivity: () => void;
}) {
  const { client } = useShell();
  const [terminal, dispatch] = useReducer(
    terminalReducer,
    undefined,
    createInitialTerminalState,
  );
  const terminalRef = useRef(terminal);
  terminalRef.current = terminal;
  const sessionHandlers = useRef(new Map<string, TerminalSessionHandlers>());

  const registerTerminalSessionHandlers = useCallback(
    (sessionId: string, handlers: TerminalSessionHandlers) => {
      sessionHandlers.current.set(sessionId, handlers);
      return () => {
        sessionHandlers.current.delete(sessionId);
      };
    },
    [],
  );

  const ensureRailWidth = useCallback(async () => {
    if (
      preferences &&
      preferences.activityPanelWidth < MIN_TERMINAL_RAIL_WIDTH
    ) {
      await updatePreference(
        "activityPanelWidth",
        String(MIN_TERMINAL_RAIL_WIDTH),
      );
    }
  }, [preferences, updatePreference]);

  const openEmbeddedTerminal = useCallback(
    async (uri: string, panelId: PanelId) => {
      if (isRemoteUri(uri)) {
        throw new Error("Embedded terminal supports local folders only");
      }

      const existing = findRunningPaneSession(terminalRef.current, panelId);
      if (existing) {
        dispatch({
          type: "openPaneTerminal",
          panelId,
          sessionId: existing.id,
        });
        return;
      }

      dispatch({ type: "setSegment", segment: "terminal" });
      const sessionId = await spawnSession(client, uri);
      dispatch({
        type: "addSession",
        session: {
          id: sessionId,
          uri,
          label: tabLabelForUri(uri),
          status: "running",
          panelId,
        },
      });
    },
    [client],
  );

  const openNewTerminalTab = useCallback(
    async (uri: string, panelId?: PanelId) => {
      if (panelId) {
        await openEmbeddedTerminal(uri, panelId);
        return;
      }
      if (isRemoteUri(uri)) {
        throw new Error("Embedded terminal supports local folders only");
      }
      onExpandActivity();
      dispatch({ type: "setSegment", segment: "terminal" });
      await ensureRailWidth();
      const sessionId = await spawnSession(client, uri);
      dispatch({
        type: "addSession",
        session: {
          id: sessionId,
          uri,
          label: tabLabelForUri(uri),
          status: "running",
        },
      });
    },
    [client, ensureRailWidth, onExpandActivity, openEmbeddedTerminal],
  );

  const togglePaneTerminal = useCallback(
    async (uri: string, panelId: PanelId) => {
      const chrome = terminalRef.current.pane[panelId];
      if (chrome.open && !chrome.collapsed) {
        dispatch({
          type: "setPaneTerminalCollapsed",
          panelId,
          collapsed: true,
        });
        return;
      }
      if (chrome.open && chrome.collapsed) {
        dispatch({
          type: "setPaneTerminalCollapsed",
          panelId,
          collapsed: false,
        });
        return;
      }
      await openEmbeddedTerminal(uri, panelId);
    },
    [openEmbeddedTerminal],
  );

  const markSessionExited = useCallback(
    (sessionId: string, exitCode?: number | null) => {
      dispatch({ type: "setSessionExited", sessionId, exitCode });
    },
    [],
  );

  const closeTerminalTab = useCallback(
    (sessionId: string) => {
      if (!sessionId.startsWith("pending-")) {
        void client.terminal.kill({ sessionId });
      }
      dispatch({ type: "closeSession", sessionId });
    },
    [client],
  );

  const switchTerminalTab = useCallback((sessionId: string) => {
    dispatch({ type: "switchSession", sessionId });
    const session = terminalRef.current.sessions.find(
      (item) => item.id === sessionId,
    );
    if (session?.panelId) {
      dispatch({
        type: "openPaneTerminal",
        panelId: session.panelId,
        sessionId,
      });
    }
  }, []);

  const setRailSegment = useCallback((segment: ActivityRailSegment) => {
    dispatch({ type: "setSegment", segment });
  }, []);

  const setPaneTerminalCollapsed = useCallback(
    (panelId: PanelId, collapsed: boolean) => {
      dispatch({ type: "setPaneTerminalCollapsed", panelId, collapsed });
    },
    [],
  );

  const setPaneTerminalSplit = useCallback(
    (panelId: PanelId, splitRatio: number) => {
      dispatch({ type: "setPaneTerminalSplit", panelId, splitRatio });
    },
    [],
  );

  const openExternalTerminal = useCallback(
    async (uri: string) => {
      try {
        await client.fs.openTerminal({ uri });
      } catch (error) {
        throw normalizeIpcError(error);
      }
    },
    [client],
  );

  useEffect(() => {
    if (!client.terminal?.onOutput || !client.terminal?.onExit) {
      return;
    }

    let cancelled = false;
    let unlistenOutput: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;

    void client.terminal
      .onOutput((event) => {
        if (cancelled) {
          return;
        }
        sessionHandlers.current.get(event.sessionId)?.onOutput(event.data);
      })
      .then((unlisten) => {
        if (!cancelled) {
          unlistenOutput = unlisten;
        } else {
          unlisten();
        }
      });

    void client.terminal
      .onExit((event) => {
        if (cancelled) {
          return;
        }
        dispatch({
          type: "setSessionExited",
          sessionId: event.sessionId,
          exitCode: event.exitCode,
        });
        sessionHandlers.current.get(event.sessionId)?.onExit(event.exitCode);
      })
      .then((unlisten) => {
        if (!cancelled) {
          unlistenExit = unlisten;
        } else {
          unlisten();
        }
      });

    return () => {
      cancelled = true;
      unlistenOutput?.();
      unlistenExit?.();
    };
  }, [client]);

  const value = useMemo(
    () => ({
      terminal,
      openEmbeddedTerminal,
      openNewTerminalTab,
      togglePaneTerminal,
      markSessionExited,
      closeTerminalTab,
      switchTerminalTab,
      setRailSegment,
      setPaneTerminalCollapsed,
      setPaneTerminalSplit,
      openExternalTerminal,
      registerTerminalSessionHandlers,
    }),
    [
      terminal,
      openEmbeddedTerminal,
      openNewTerminalTab,
      togglePaneTerminal,
      markSessionExited,
      closeTerminalTab,
      switchTerminalTab,
      setRailSegment,
      setPaneTerminalCollapsed,
      setPaneTerminalSplit,
      openExternalTerminal,
      registerTerminalSessionHandlers,
    ],
  );

  return (
    <TerminalContext.Provider value={value}>
      {children}
    </TerminalContext.Provider>
  );
}

export function StubTerminalProvider({ children }: { children: ReactNode }) {
  const value = useMemo<TerminalContextValue>(
    () => ({
      terminal: createInitialTerminalState(),
      openEmbeddedTerminal: async () => {},
      openNewTerminalTab: async () => {},
      togglePaneTerminal: async () => {},
      markSessionExited: () => {},
      closeTerminalTab: () => {},
      switchTerminalTab: () => {},
      setRailSegment: () => {},
      setPaneTerminalCollapsed: () => {},
      setPaneTerminalSplit: () => {},
      openExternalTerminal: async () => {},
      registerTerminalSessionHandlers: () => () => {},
    }),
    [],
  );

  return (
    <TerminalContext.Provider value={value}>
      {children}
    </TerminalContext.Provider>
  );
}
