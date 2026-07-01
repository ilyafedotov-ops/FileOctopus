import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { OperationDialog } from "../../dialogs/OperationDialogView";
import type { SyncComparisonMode } from "../../components/dialogs/SyncDirectoriesDialog";
import type {
  FileEntryDto,
  NetworkConnectionDraftDto,
  NetworkProfileDto,
} from "@fileoctopus/ts-api";

export interface ModalsContextValue {
  settingsOpen: boolean;
  shortcutsOpen: boolean;
  commandPaletteOpen: boolean;
  previewOpen: boolean;
  viewerOpen: boolean;
  viewerEntry: FileEntryDto | null;
  editorOpen: boolean;
  editorEntry: FileEntryDto | null;
  diagnosticsOpen: boolean;
  debugConsoleOpen: boolean;
  helpOpen: boolean;
  aboutOpen: boolean;
  goToLocationOpen: boolean;
  manageFavoritesOpen: boolean;
  recentLocationsOpen: boolean;
  clearRecentLocationsOpen: boolean;
  closePaneTerminalConfirmOpen: boolean;
  errorDetailsOpen: boolean;
  operationHistoryOpen: boolean;
  volumePickerOpen: boolean;
  connectServerOpen: boolean;
  connectServerProfile: NetworkProfileDto | null;
  connectServerInitial: NetworkConnectionDraftDto | null;
  removeServerProfile: NetworkProfileDto | null;
  toolbarCustomizeOpen: boolean;
  diffOpen: boolean;
  diffLeftUri: string;
  diffRightUri: string;
  diffLeftName: string;
  diffRightName: string;
  dialog: OperationDialog | null;
  multiRenameOpen: boolean;
  syncDirectoriesOpen: boolean;
  syncDirectoriesComparison: SyncComparisonMode;
  hotlistOpen: boolean;
  manageHotlistOpen: boolean;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  setShortcutsOpen: Dispatch<SetStateAction<boolean>>;
  setCommandPaletteOpen: Dispatch<SetStateAction<boolean>>;
  setPreviewOpen: Dispatch<SetStateAction<boolean>>;
  setViewerOpen: Dispatch<SetStateAction<boolean>>;
  setViewerEntry: Dispatch<SetStateAction<FileEntryDto | null>>;
  setEditorOpen: Dispatch<SetStateAction<boolean>>;
  setEditorEntry: Dispatch<SetStateAction<FileEntryDto | null>>;
  setDiagnosticsOpen: Dispatch<SetStateAction<boolean>>;
  setDebugConsoleOpen: Dispatch<SetStateAction<boolean>>;
  setHelpOpen: Dispatch<SetStateAction<boolean>>;
  setAboutOpen: Dispatch<SetStateAction<boolean>>;
  setGoToLocationOpen: Dispatch<SetStateAction<boolean>>;
  setManageFavoritesOpen: Dispatch<SetStateAction<boolean>>;
  setRecentLocationsOpen: Dispatch<SetStateAction<boolean>>;
  setClearRecentLocationsOpen: Dispatch<SetStateAction<boolean>>;
  setClosePaneTerminalConfirmOpen: Dispatch<SetStateAction<boolean>>;
  setErrorDetailsOpen: Dispatch<SetStateAction<boolean>>;
  setOperationHistoryOpen: Dispatch<SetStateAction<boolean>>;
  setVolumePickerOpen: Dispatch<SetStateAction<boolean>>;
  setConnectServerOpen: Dispatch<SetStateAction<boolean>>;
  setConnectServerProfile: Dispatch<SetStateAction<NetworkProfileDto | null>>;
  setConnectServerInitial: Dispatch<
    SetStateAction<NetworkConnectionDraftDto | null>
  >;
  setRemoveServerProfile: Dispatch<SetStateAction<NetworkProfileDto | null>>;
  setToolbarCustomizeOpen: Dispatch<SetStateAction<boolean>>;
  setDiffOpen: Dispatch<SetStateAction<boolean>>;
  setDiffLeftUri: Dispatch<SetStateAction<string>>;
  setDiffRightUri: Dispatch<SetStateAction<string>>;
  setDiffLeftName: Dispatch<SetStateAction<string>>;
  setDiffRightName: Dispatch<SetStateAction<string>>;
  setDialog: Dispatch<SetStateAction<OperationDialog | null>>;
  setMultiRenameOpen: Dispatch<SetStateAction<boolean>>;
  setSyncDirectoriesOpen: Dispatch<SetStateAction<boolean>>;
  setSyncDirectoriesComparison: Dispatch<SetStateAction<SyncComparisonMode>>;
  setHotlistOpen: Dispatch<SetStateAction<boolean>>;
  setManageHotlistOpen: Dispatch<SetStateAction<boolean>>;
}

const ModalsContext = createContext<ModalsContextValue | null>(null);

export function useModals(): ModalsContextValue {
  const ctx = useContext(ModalsContext);
  if (!ctx) {
    throw new Error("useModals must be used within ModalsProvider");
  }
  return ctx;
}

export function ModalsProvider({ children }: { children: ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerEntry, setViewerEntry] = useState<FileEntryDto | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorEntry, setEditorEntry] = useState<FileEntryDto | null>(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [debugConsoleOpen, setDebugConsoleOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [goToLocationOpen, setGoToLocationOpen] = useState(false);
  const [manageFavoritesOpen, setManageFavoritesOpen] = useState(false);
  const [recentLocationsOpen, setRecentLocationsOpen] = useState(false);
  const [clearRecentLocationsOpen, setClearRecentLocationsOpen] =
    useState(false);
  const [closePaneTerminalConfirmOpen, setClosePaneTerminalConfirmOpen] =
    useState(false);
  const [errorDetailsOpen, setErrorDetailsOpen] = useState(false);
  const [operationHistoryOpen, setOperationHistoryOpen] = useState(false);
  const [volumePickerOpen, setVolumePickerOpen] = useState(false);
  const [connectServerOpen, setConnectServerOpen] = useState(false);
  const [connectServerProfile, setConnectServerProfile] =
    useState<NetworkProfileDto | null>(null);
  const [connectServerInitial, setConnectServerInitial] =
    useState<NetworkConnectionDraftDto | null>(null);
  const [removeServerProfile, setRemoveServerProfile] =
    useState<NetworkProfileDto | null>(null);
  const [toolbarCustomizeOpen, setToolbarCustomizeOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffLeftUri, setDiffLeftUri] = useState("");
  const [diffRightUri, setDiffRightUri] = useState("");
  const [diffLeftName, setDiffLeftName] = useState("");
  const [diffRightName, setDiffRightName] = useState("");
  const [dialog, setDialog] = useState<OperationDialog | null>(null);
  const [multiRenameOpen, setMultiRenameOpen] = useState(false);
  const [syncDirectoriesOpen, setSyncDirectoriesOpen] = useState(false);
  const [syncDirectoriesComparison, setSyncDirectoriesComparison] =
    useState<SyncComparisonMode>("size");
  const [hotlistOpen, setHotlistOpen] = useState(false);
  const [manageHotlistOpen, setManageHotlistOpen] = useState(false);

  const value = useMemo<ModalsContextValue>(
    () => ({
      settingsOpen,
      shortcutsOpen,
      commandPaletteOpen,
      previewOpen,
      viewerOpen,
      viewerEntry,
      editorOpen,
      editorEntry,
      diagnosticsOpen,
      debugConsoleOpen,
      helpOpen,
      aboutOpen,
      goToLocationOpen,
      manageFavoritesOpen,
      recentLocationsOpen,
      clearRecentLocationsOpen,
      closePaneTerminalConfirmOpen,
      errorDetailsOpen,
      operationHistoryOpen,
      volumePickerOpen,
      connectServerOpen,
      connectServerProfile,
      connectServerInitial,
      removeServerProfile,
      toolbarCustomizeOpen,
      diffOpen,
      diffLeftUri,
      diffRightUri,
      diffLeftName,
      diffRightName,
      dialog,
      multiRenameOpen,
      syncDirectoriesOpen,
      syncDirectoriesComparison,
      hotlistOpen,
      manageHotlistOpen,
      setSettingsOpen,
      setShortcutsOpen,
      setCommandPaletteOpen,
      setPreviewOpen,
      setViewerOpen,
      setViewerEntry,
      setEditorOpen,
      setEditorEntry,
      setDiagnosticsOpen,
      setDebugConsoleOpen,
      setHelpOpen,
      setAboutOpen,
      setGoToLocationOpen,
      setManageFavoritesOpen,
      setRecentLocationsOpen,
      setClearRecentLocationsOpen,
      setClosePaneTerminalConfirmOpen,
      setErrorDetailsOpen,
      setOperationHistoryOpen,
      setVolumePickerOpen,
      setConnectServerOpen,
      setConnectServerProfile,
      setConnectServerInitial,
      setRemoveServerProfile,
      setToolbarCustomizeOpen,
      setDiffOpen,
      setDiffLeftUri,
      setDiffRightUri,
      setDiffLeftName,
      setDiffRightName,
      setDialog,
      setMultiRenameOpen,
      setSyncDirectoriesOpen,
      setSyncDirectoriesComparison,
      setHotlistOpen,
      setManageHotlistOpen,
    }),
    [
      settingsOpen,
      shortcutsOpen,
      commandPaletteOpen,
      previewOpen,
      viewerOpen,
      viewerEntry,
      editorOpen,
      editorEntry,
      diagnosticsOpen,
      debugConsoleOpen,
      helpOpen,
      aboutOpen,
      goToLocationOpen,
      manageFavoritesOpen,
      recentLocationsOpen,
      clearRecentLocationsOpen,
      closePaneTerminalConfirmOpen,
      errorDetailsOpen,
      operationHistoryOpen,
      volumePickerOpen,
      connectServerOpen,
      connectServerProfile,
      connectServerInitial,
      removeServerProfile,
      toolbarCustomizeOpen,
      diffOpen,
      diffLeftUri,
      diffRightUri,
      diffLeftName,
      diffRightName,
      dialog,
      multiRenameOpen,
      syncDirectoriesOpen,
      syncDirectoriesComparison,
      hotlistOpen,
      manageHotlistOpen,
    ],
  );

  return (
    <ModalsContext.Provider value={value}>{children}</ModalsContext.Provider>
  );
}
