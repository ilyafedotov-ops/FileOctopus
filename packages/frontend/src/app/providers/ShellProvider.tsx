import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
  type RefObject,
} from "react";
import {
  createFileOctopusClient,
  type FileOctopusClient,
} from "@fileoctopus/ts-api";
import {
  createInitialState,
  documentsUri,
  homeUri,
  panelReducer,
  type FileOctopusState,
  type PanelAction,
} from "../../panelStore";
import {
  persistSessionPaths,
  restoreSessionPaths,
} from "../../pane/sessionPaths";

export interface ShellContextValue {
  client: FileOctopusClient;
  state: FileOctopusState;
  dispatch: Dispatch<PanelAction>;
  workspaceRef: RefObject<HTMLElement | null>;
  hasInitializedRef: RefObject<boolean>;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) {
    throw new Error("useShell must be used within ShellProvider");
  }
  return ctx;
}

export function ShellProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => createFileOctopusClient(), []);
  const [state, dispatch] = useReducer(panelReducer, undefined, () => {
    const saved = restoreSessionPaths();
    return createInitialState(
      saved.left ?? undefined,
      saved.right ?? undefined,
    );
  });
  const workspaceRef = useRef<HTMLElement | null>(null);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    const leftUri = state.panels.left.tabs[state.panels.left.activeTabId]?.uri;
    const rightUri =
      state.panels.right.tabs[state.panels.right.activeTabId]?.uri;
    const hasMovedPastInitialFallbacks =
      leftUri !== homeUri() || rightUri !== documentsUri();

    if (!hasMovedPastInitialFallbacks) {
      return;
    }

    if (leftUri && rightUri) {
      persistSessionPaths(leftUri, rightUri);
    }
  }, [
    state.panels.left.tabs[state.panels.left.activeTabId]?.uri,
    state.panels.right.tabs[state.panels.right.activeTabId]?.uri,
  ]);

  const value = useMemo<ShellContextValue>(
    () => ({
      client,
      state,
      dispatch,
      workspaceRef,
      hasInitializedRef,
    }),
    [client, state],
  );

  return (
    <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
  );
}
