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
  openEmbeddedTerminal: (uri: string) => Promise<void>;
  openNewTerminalTab: (uri: string) => Promise<void>;
  markSessionExited: (sessionId: string, exitCode?: number | null) => void;
  closeTerminalTab: (sessionId: string) => void;
  switchTerminalTab: (sessionId: string) => void;
  setRailSegment: (segment: ActivityRailSegment) => void;
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
    async (uri: string) => {
      if (isRemoteUri(uri)) {
        throw new Error("Embedded terminal supports local folders only");
      }
      onExpandActivity();
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
    [client, ensureRailWidth, onExpandActivity],
  );

  const openNewTerminalTab = useCallback(
    async (uri: string) => {
      await openEmbeddedTerminal(uri);
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
  }, []);

  const setRailSegment = useCallback((segment: ActivityRailSegment) => {
    dispatch({ type: "setSegment", segment });
  }, []);

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
      markSessionExited,
      closeTerminalTab,
      switchTerminalTab,
      setRailSegment,
      openExternalTerminal,
      registerTerminalSessionHandlers,
    }),
    [
      terminal,
      openEmbeddedTerminal,
      openNewTerminalTab,
      markSessionExited,
      closeTerminalTab,
      switchTerminalTab,
      setRailSegment,
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
      markSessionExited: () => {},
      closeTerminalTab: () => {},
      switchTerminalTab: () => {},
      setRailSegment: () => {},
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
