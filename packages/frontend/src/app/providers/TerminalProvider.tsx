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
  profileIdFromRemoteUri,
  type FileOctopusClient,
  type NetworkProfileDto,
  type UserPreferencesDto,
} from "@fileoctopus/ts-api";
import { useShell } from "./ShellProvider";
import { useNavigationData } from "./NavigationDataProvider";
import type { PanelId } from "../../panelStore";
import { localPathFromUri } from "../../utils/paneUtils";
import {
  encodeTerminalInput,
  shellEscapePosixPath,
} from "../../terminal/shellEscape";
import {
  createInitialTerminalState,
  tabLabelForUri,
  terminalReducer,
  type ActivityRailSegment,
  type TerminalState,
} from "../../terminal/terminalSlice";

const PANE_TERMINAL_HEIGHT_DEBOUNCE_MS = 400;

const MIN_TERMINAL_RAIL_WIDTH = 480;

interface TerminalSessionHandlers {
  onOutput: (data: string) => void;
  onExit: (exitCode?: number | null) => void;
}

interface TerminalContextValue {
  terminal: TerminalState;
  openEmbeddedTerminal: (uri: string, panelId: PanelId) => Promise<void>;
  openPaneTerminal: (panelId: PanelId, uri: string) => Promise<void>;
  openAdditionalPaneTab: (panelId: PanelId, uri: string) => Promise<void>;
  openNewTerminalTab: (uri: string, panelId?: PanelId) => Promise<void>;
  openProfileTerminalTab: (
    profile: NetworkProfileDto,
    panelId?: PanelId,
  ) => Promise<void>;
  togglePaneTerminal: (uri: string, panelId: PanelId) => Promise<void>;
  markSessionExited: (sessionId: string, exitCode?: number | null) => void;
  closeTerminalTab: (sessionId: string) => void;
  switchTerminalTab: (sessionId: string) => void;
  setRailSegment: (segment: ActivityRailSegment) => void;
  setPaneTerminalCollapsed: (panelId: PanelId, collapsed: boolean) => void;
  setPaneTerminalMaximized: (panelId: PanelId, maximized: boolean) => void;
  setPaneTerminalSplit: (panelId: PanelId, splitRatio: number) => void;
  setPaneActiveSession: (panelId: PanelId, sessionId: string) => void;
  closePaneTerminal: (panelId: PanelId) => void;
  syncTerminalCwd: (panelId: PanelId, uri: string) => void;
  openExternalTerminal: (uri: string) => Promise<void>;
  registerTerminalSessionHandlers: (
    sessionId: string,
    handlers: TerminalSessionHandlers,
  ) => () => void;
}

export const TerminalContext = createContext<TerminalContextValue | null>(null);

const fallbackTerminalContext: TerminalContextValue = {
  terminal: createInitialTerminalState(),
  openEmbeddedTerminal: async () => {},
  openPaneTerminal: async () => {},
  openAdditionalPaneTab: async () => {},
  openNewTerminalTab: async () => {},
  openProfileTerminalTab: async () => {},
  togglePaneTerminal: async () => {},
  markSessionExited: () => {},
  closeTerminalTab: () => {},
  switchTerminalTab: () => {},
  setRailSegment: () => {},
  setPaneTerminalCollapsed: () => {},
  setPaneTerminalMaximized: () => {},
  setPaneTerminalSplit: () => {},
  setPaneActiveSession: () => {},
  closePaneTerminal: () => {},
  syncTerminalCwd: () => {},
  openExternalTerminal: async () => {},
  registerTerminalSessionHandlers: () => () => {},
};

export function useTerminal(): TerminalContextValue {
  const ctx = useContext(TerminalContext);
  if (!ctx) {
    console.error("useTerminal must be used within TerminalProvider");
    return fallbackTerminalContext;
  }
  return ctx;
}

async function spawnSession(
  client: FileOctopusClient,
  uri: string,
  preferences: UserPreferencesDto | null,
  profileId?: string | null,
  cols = 80,
  rows = 24,
) {
  const shell = preferences?.terminalShell.trim() || null;
  const args = preferences?.terminalArgs
    .split(/\r?\n/)
    .map((arg) => arg.trim())
    .filter(Boolean);
  const response = profileId
    ? await client.terminal.spawn({
        profileId,
        cols,
        rows,
      })
    : await client.terminal.spawn({
        uri,
        cols,
        rows,
        shell,
        args: args && args.length > 0 ? args : null,
      });
  return response.sessionId;
}

function profileTerminalUri(profile: NetworkProfileDto): string {
  return profile.defaultUri || `${profile.scheme}://${profile.id}`;
}

function profileTerminalLabel(profile: NetworkProfileDto): string {
  return `${profile.label || `${profile.username}@${profile.host}`} SSH`;
}

function profileForUri(
  profiles: NetworkProfileDto[],
  uri: string,
): NetworkProfileDto | null {
  const profileId = profileIdFromRemoteUri(uri);
  return profiles.find((profile) => profile.id === profileId) ?? null;
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
    (session) => session.paneId === panelId && session.status !== "exited",
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
  preferences: UserPreferencesDto | null;
  onExpandActivity: () => void;
}) {
  const { client } = useShell();
  const { networkProfiles } = useNavigationData();
  const [terminal, dispatch] = useReducer(
    terminalReducer,
    undefined,
    createInitialTerminalState,
  );
  const terminalRef = useRef(terminal);
  terminalRef.current = terminal;
  const sessionHandlers = useRef(new Map<string, TerminalSessionHandlers>());
  const outputBuffer = useRef(new Map<string, string[]>());
  const heightPersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedPreferencesRef = useRef(false);

  const registerTerminalSessionHandlers = useCallback(
    (sessionId: string, handlers: TerminalSessionHandlers) => {
      sessionHandlers.current.set(sessionId, handlers);
      const pending = outputBuffer.current.get(sessionId);
      if (pending) {
        outputBuffer.current.delete(sessionId);
        for (const data of pending) {
          handlers.onOutput(data);
        }
      }
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

  const paneSplitRatio = useCallback(
    (panelId: PanelId) => {
      if (!preferences) {
        return undefined;
      }
      return panelId === "left"
        ? preferences.paneTerminalHeightLeft
        : preferences.paneTerminalHeightRight;
    },
    [preferences],
  );

  const openPaneTerminal = useCallback(
    async (panelId: PanelId, uri: string) => {
      if (isRemoteUri(uri)) {
        const profile = profileForUri(networkProfiles, uri);
        const profileId = profile?.id ?? profileIdFromRemoteUri(uri);
        if (!profileId) {
          throw new Error("Remote terminal requires a saved server profile");
        }
        const splitRatio = paneSplitRatio(panelId);
        const sessionId = await spawnSession(
          client,
          uri,
          preferences,
          profileId,
        );
        dispatch({
          type: "addSession",
          session: {
            id: sessionId,
            uri,
            label: profile
              ? profileTerminalLabel(profile)
              : tabLabelForUri(uri),
            status: "running",
            paneId: panelId,
            transport: "ssh",
          },
        });
        dispatch({
          type: "openPaneTerminal",
          panelId,
          sessionId,
          splitRatio,
        });
        return;
      }

      const splitRatio = paneSplitRatio(panelId);
      const existing = findRunningPaneSession(terminalRef.current, panelId);
      if (existing) {
        dispatch({
          type: "openPaneTerminal",
          panelId,
          sessionId: existing.id,
          splitRatio,
        });
        return;
      }

      const sessionId = await spawnSession(client, uri, preferences);
      dispatch({
        type: "addSession",
        session: {
          id: sessionId,
          uri,
          label: tabLabelForUri(uri),
          status: "running",
          paneId: panelId,
          transport: "local",
        },
      });
      dispatch({
        type: "openPaneTerminal",
        panelId,
        sessionId,
        splitRatio,
      });
    },
    [client, networkProfiles, paneSplitRatio, preferences],
  );

  const openEmbeddedTerminal = useCallback(
    async (uri: string, panelId: PanelId) => {
      await openPaneTerminal(panelId, uri);
    },
    [openPaneTerminal],
  );

  const openAdditionalPaneTab = useCallback(
    async (panelId: PanelId, uri: string) => {
      if (isRemoteUri(uri)) {
        const profile = profileForUri(networkProfiles, uri);
        const profileId = profile?.id ?? profileIdFromRemoteUri(uri);
        if (!profileId) {
          throw new Error("Remote terminal requires a saved server profile");
        }
        const splitRatio = paneSplitRatio(panelId);
        const sessionId = await spawnSession(
          client,
          uri,
          preferences,
          profileId,
        );
        dispatch({
          type: "addSession",
          session: {
            id: sessionId,
            uri,
            label: profile
              ? profileTerminalLabel(profile)
              : tabLabelForUri(uri),
            status: "running",
            paneId: panelId,
            transport: "ssh",
          },
        });
        dispatch({
          type: "openPaneTerminal",
          panelId,
          sessionId,
          splitRatio,
        });
        return;
      }
      const splitRatio = paneSplitRatio(panelId);
      const sessionId = await spawnSession(client, uri, preferences);
      dispatch({
        type: "addSession",
        session: {
          id: sessionId,
          uri,
          label: tabLabelForUri(uri),
          status: "running",
          paneId: panelId,
          transport: "local",
        },
      });
      dispatch({
        type: "openPaneTerminal",
        panelId,
        sessionId,
        splitRatio,
      });
    },
    [client, networkProfiles, paneSplitRatio, preferences],
  );

  const openNewTerminalTab = useCallback(
    async (uri: string, panelId?: PanelId) => {
      if (panelId) {
        await openPaneTerminal(panelId, uri);
        return;
      }
      onExpandActivity();
      dispatch({ type: "setSegment", segment: "terminal" });
      await ensureRailWidth();
      const profile = isRemoteUri(uri)
        ? profileForUri(networkProfiles, uri)
        : null;
      const profileId = profile?.id ?? profileIdFromRemoteUri(uri);
      const sessionId = await spawnSession(client, uri, preferences, profileId);
      dispatch({
        type: "addSession",
        session: {
          id: sessionId,
          uri,
          label: profile ? profileTerminalLabel(profile) : tabLabelForUri(uri),
          status: "running",
          paneId: "rail",
          transport: profileId ? "ssh" : "local",
        },
      });
    },
    [
      client,
      ensureRailWidth,
      networkProfiles,
      onExpandActivity,
      openPaneTerminal,
      preferences,
    ],
  );

  const openProfileTerminalTab = useCallback(
    async (profile: NetworkProfileDto, panelId?: PanelId) => {
      const uri = profileTerminalUri(profile);
      if (panelId) {
        const splitRatio = paneSplitRatio(panelId);
        const sessionId = await spawnSession(
          client,
          uri,
          preferences,
          profile.id,
        );
        dispatch({
          type: "addSession",
          session: {
            id: sessionId,
            uri,
            label: profileTerminalLabel(profile),
            status: "running",
            paneId: panelId,
            transport: "ssh",
          },
        });
        dispatch({
          type: "openPaneTerminal",
          panelId,
          sessionId,
          splitRatio,
        });
        return;
      }
      onExpandActivity();
      dispatch({ type: "setSegment", segment: "terminal" });
      await ensureRailWidth();
      const sessionId = await spawnSession(
        client,
        uri,
        preferences,
        profile.id,
      );
      dispatch({
        type: "addSession",
        session: {
          id: sessionId,
          uri,
          label: profileTerminalLabel(profile),
          status: "running",
          paneId: "rail",
          transport: "ssh",
        },
      });
    },
    [client, ensureRailWidth, onExpandActivity, paneSplitRatio, preferences],
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
      await openPaneTerminal(panelId, uri);
    },
    [openPaneTerminal],
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

  const setPaneTerminalCollapsed = useCallback(
    (panelId: PanelId, collapsed: boolean) => {
      dispatch({ type: "setPaneTerminalCollapsed", panelId, collapsed });
    },
    [],
  );

  const setPaneTerminalMaximized = useCallback(
    (panelId: PanelId, maximized: boolean) => {
      dispatch({ type: "setPaneTerminalMaximized", panelId, maximized });
    },
    [],
  );

  const persistPaneTerminalHeight = useCallback(
    (panelId: PanelId, splitRatio: number) => {
      const key =
        panelId === "left"
          ? "paneTerminalHeightLeft"
          : "paneTerminalHeightRight";
      if (heightPersistTimer.current) {
        clearTimeout(heightPersistTimer.current);
      }
      heightPersistTimer.current = setTimeout(() => {
        heightPersistTimer.current = null;
        void updatePreference(key, String(splitRatio));
      }, PANE_TERMINAL_HEIGHT_DEBOUNCE_MS);
    },
    [updatePreference],
  );

  const setPaneTerminalSplit = useCallback(
    (panelId: PanelId, splitRatio: number) => {
      dispatch({ type: "setPaneTerminalSplit", panelId, splitRatio });
      persistPaneTerminalHeight(panelId, splitRatio);
    },
    [persistPaneTerminalHeight],
  );

  const syncTerminalCwd = useCallback(
    (panelId: PanelId, uri: string) => {
      if (!preferences?.terminalCdOnNavigate || isRemoteUri(uri)) {
        return;
      }
      const chrome = terminalRef.current.pane[panelId];
      const sessionId = chrome.sessionId;
      if (!sessionId) {
        return;
      }
      const session = terminalRef.current.sessions.find(
        (item) => item.id === sessionId,
      );
      if (!session || session.status === "exited") {
        return;
      }
      const path = localPathFromUri(uri);
      const command = `cd ${shellEscapePosixPath(path)}\n`;
      void client.terminal.write({
        sessionId,
        data: encodeTerminalInput(command),
      });
    },
    [client, preferences?.terminalCdOnNavigate],
  );

  useEffect(() => {
    if (!preferences || hydratedPreferencesRef.current) {
      return;
    }
    hydratedPreferencesRef.current = true;
    dispatch({
      type: "hydratePaneTerminalPreferences",
      leftHeight: preferences.paneTerminalHeightLeft,
      rightHeight: preferences.paneTerminalHeightRight,
    });
  }, [preferences]);

  useEffect(() => {
    return () => {
      if (heightPersistTimer.current) {
        clearTimeout(heightPersistTimer.current);
      }
    };
  }, []);

  const setPaneActiveSession = useCallback(
    (panelId: PanelId, sessionId: string) => {
      dispatch({ type: "setPaneActiveSession", panelId, sessionId });
    },
    [],
  );

  const closePaneTerminal = useCallback((panelId: PanelId) => {
    dispatch({ type: "closePaneTerminal", panelId });
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
        const handler = sessionHandlers.current.get(event.sessionId);
        if (handler) {
          handler.onOutput(event.data);
          return;
        }
        const pending = outputBuffer.current.get(event.sessionId) ?? [];
        pending.push(event.data);
        if (pending.length > 100) {
          pending.splice(0, pending.length - 100);
        }
        outputBuffer.current.set(event.sessionId, pending);
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
      openPaneTerminal,
      openAdditionalPaneTab,
      openNewTerminalTab,
      openProfileTerminalTab,
      togglePaneTerminal,
      markSessionExited,
      closeTerminalTab,
      switchTerminalTab,
      setRailSegment,
      setPaneTerminalCollapsed,
      setPaneTerminalMaximized,
      setPaneTerminalSplit,
      setPaneActiveSession,
      closePaneTerminal,
      syncTerminalCwd,
      openExternalTerminal,
      registerTerminalSessionHandlers,
    }),
    [
      terminal,
      openEmbeddedTerminal,
      openPaneTerminal,
      openAdditionalPaneTab,
      openNewTerminalTab,
      openProfileTerminalTab,
      togglePaneTerminal,
      markSessionExited,
      closeTerminalTab,
      switchTerminalTab,
      setRailSegment,
      setPaneTerminalCollapsed,
      setPaneTerminalMaximized,
      setPaneTerminalSplit,
      setPaneActiveSession,
      closePaneTerminal,
      syncTerminalCwd,
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
    () => fallbackTerminalContext,
    [],
  );

  return (
    <TerminalContext.Provider value={value}>
      {children}
    </TerminalContext.Provider>
  );
}
