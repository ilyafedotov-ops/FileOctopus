import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { ToastMessage } from "../../components/ToastStack";
import type { FileClipboardState } from "../../hooks/useFileOpHandlers";
import type { ContextMenuState } from "../../components/ContextMenu";
import type { SearchState } from "../../pane/PaneFilterBar";
import type { ContentSearchState } from "../../pane/ContentSearchPanel";
import {
  useLayoutFocusStore,
  type LayoutFocusStore,
} from "../../state/layoutStore";
import { usePreferences } from "./PreferencesProvider";

export interface WorkspaceContextValue extends LayoutFocusStore {
  toasts: ToastMessage[];
  notifications: ToastMessage[];
  notificationCenterOpen: boolean;
  clipboard: FileClipboardState | null;
  contextMenu: ContextMenuState | null;
  search: SearchState | null;
  contentSearch: ContentSearchState | null;
  diagnosticsDestination: string;
  diagnosticsMessage: string | null;
  exportingDiagnostics: boolean;
  setToasts: Dispatch<SetStateAction<ToastMessage[]>>;
  setNotifications: Dispatch<SetStateAction<ToastMessage[]>>;
  setNotificationCenterOpen: Dispatch<SetStateAction<boolean>>;
  setClipboard: Dispatch<SetStateAction<FileClipboardState | null>>;
  setContextMenu: Dispatch<SetStateAction<ContextMenuState | null>>;
  setSearch: Dispatch<SetStateAction<SearchState | null>>;
  setContentSearch: Dispatch<SetStateAction<ContentSearchState | null>>;
  setDiagnosticsDestination: Dispatch<SetStateAction<string>>;
  setDiagnosticsMessage: Dispatch<SetStateAction<string | null>>;
  setExportingDiagnostics: Dispatch<SetStateAction<boolean>>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return ctx;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { preferences } = usePreferences();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [notifications, setNotifications] = useState<ToastMessage[]>([]);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [clipboard, setClipboard] = useState<FileClipboardState | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [search, setSearch] = useState<SearchState | null>(null);
  const [contentSearch, setContentSearch] = useState<ContentSearchState | null>(
    null,
  );
  const [diagnosticsDestination, setDiagnosticsDestination] = useState(
    preferences?.diagnosticsExportPath ?? "/tmp/fileoctopus-diagnostics.zip",
  );
  const [diagnosticsMessage, setDiagnosticsMessage] = useState<string | null>(
    null,
  );
  const [exportingDiagnostics, setExportingDiagnostics] = useState(false);

  useEffect(() => {
    if (preferences?.diagnosticsExportPath) {
      setDiagnosticsDestination(preferences.diagnosticsExportPath);
    }
  }, [preferences?.diagnosticsExportPath]);

  const layoutFocus = useLayoutFocusStore();

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      toasts,
      notifications,
      notificationCenterOpen,
      clipboard,
      contextMenu,
      search,
      contentSearch,
      diagnosticsDestination,
      diagnosticsMessage,
      exportingDiagnostics,
      setToasts,
      setNotifications,
      setNotificationCenterOpen,
      setClipboard,
      setContextMenu,
      setSearch,
      setContentSearch,
      setDiagnosticsDestination,
      setDiagnosticsMessage,
      setExportingDiagnostics,
      ...layoutFocus,
    }),
    [
      toasts,
      notifications,
      notificationCenterOpen,
      clipboard,
      contextMenu,
      search,
      contentSearch,
      diagnosticsDestination,
      diagnosticsMessage,
      exportingDiagnostics,
      layoutFocus,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
