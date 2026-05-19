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
import type { NetworkProfileDto } from "@fileoctopus/ts-api";

export interface ModalsContextValue {
  settingsOpen: boolean;
  shortcutsOpen: boolean;
  commandPaletteOpen: boolean;
  previewOpen: boolean;
  diagnosticsOpen: boolean;
  helpOpen: boolean;
  aboutOpen: boolean;
  goToLocationOpen: boolean;
  manageFavoritesOpen: boolean;
  recentLocationsOpen: boolean;
  clearRecentLocationsOpen: boolean;
  errorDetailsOpen: boolean;
  operationHistoryOpen: boolean;
  volumePickerOpen: boolean;
  networkLocationsOpen: boolean;
  connectServerOpen: boolean;
  connectServerProfile: NetworkProfileDto | null;
  removeServerProfile: NetworkProfileDto | null;
  toolbarCustomizeOpen: boolean;
  dialog: OperationDialog | null;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  setShortcutsOpen: Dispatch<SetStateAction<boolean>>;
  setCommandPaletteOpen: Dispatch<SetStateAction<boolean>>;
  setPreviewOpen: Dispatch<SetStateAction<boolean>>;
  setDiagnosticsOpen: Dispatch<SetStateAction<boolean>>;
  setHelpOpen: Dispatch<SetStateAction<boolean>>;
  setAboutOpen: Dispatch<SetStateAction<boolean>>;
  setGoToLocationOpen: Dispatch<SetStateAction<boolean>>;
  setManageFavoritesOpen: Dispatch<SetStateAction<boolean>>;
  setRecentLocationsOpen: Dispatch<SetStateAction<boolean>>;
  setClearRecentLocationsOpen: Dispatch<SetStateAction<boolean>>;
  setErrorDetailsOpen: Dispatch<SetStateAction<boolean>>;
  setOperationHistoryOpen: Dispatch<SetStateAction<boolean>>;
  setVolumePickerOpen: Dispatch<SetStateAction<boolean>>;
  setNetworkLocationsOpen: Dispatch<SetStateAction<boolean>>;
  setConnectServerOpen: Dispatch<SetStateAction<boolean>>;
  setConnectServerProfile: Dispatch<SetStateAction<NetworkProfileDto | null>>;
  setRemoveServerProfile: Dispatch<SetStateAction<NetworkProfileDto | null>>;
  setToolbarCustomizeOpen: Dispatch<SetStateAction<boolean>>;
  setDialog: Dispatch<SetStateAction<OperationDialog | null>>;
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
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [goToLocationOpen, setGoToLocationOpen] = useState(false);
  const [manageFavoritesOpen, setManageFavoritesOpen] = useState(false);
  const [recentLocationsOpen, setRecentLocationsOpen] = useState(false);
  const [clearRecentLocationsOpen, setClearRecentLocationsOpen] =
    useState(false);
  const [errorDetailsOpen, setErrorDetailsOpen] = useState(false);
  const [operationHistoryOpen, setOperationHistoryOpen] = useState(false);
  const [volumePickerOpen, setVolumePickerOpen] = useState(false);
  const [networkLocationsOpen, setNetworkLocationsOpen] = useState(false);
  const [connectServerOpen, setConnectServerOpen] = useState(false);
  const [connectServerProfile, setConnectServerProfile] =
    useState<NetworkProfileDto | null>(null);
  const [removeServerProfile, setRemoveServerProfile] =
    useState<NetworkProfileDto | null>(null);
  const [toolbarCustomizeOpen, setToolbarCustomizeOpen] = useState(false);
  const [dialog, setDialog] = useState<OperationDialog | null>(null);

  const value = useMemo<ModalsContextValue>(
    () => ({
      settingsOpen,
      shortcutsOpen,
      commandPaletteOpen,
      previewOpen,
      diagnosticsOpen,
      helpOpen,
      aboutOpen,
      goToLocationOpen,
      manageFavoritesOpen,
      recentLocationsOpen,
      clearRecentLocationsOpen,
      errorDetailsOpen,
      operationHistoryOpen,
      volumePickerOpen,
      networkLocationsOpen,
      connectServerOpen,
      connectServerProfile,
      removeServerProfile,
      toolbarCustomizeOpen,
      dialog,
      setSettingsOpen,
      setShortcutsOpen,
      setCommandPaletteOpen,
      setPreviewOpen,
      setDiagnosticsOpen,
      setHelpOpen,
      setAboutOpen,
      setGoToLocationOpen,
      setManageFavoritesOpen,
      setRecentLocationsOpen,
      setClearRecentLocationsOpen,
      setErrorDetailsOpen,
      setOperationHistoryOpen,
      setVolumePickerOpen,
      setNetworkLocationsOpen,
      setConnectServerOpen,
      setConnectServerProfile,
      setRemoveServerProfile,
      setToolbarCustomizeOpen,
      setDialog,
    }),
    [
      settingsOpen,
      shortcutsOpen,
      commandPaletteOpen,
      previewOpen,
      diagnosticsOpen,
      helpOpen,
      aboutOpen,
      goToLocationOpen,
      manageFavoritesOpen,
      recentLocationsOpen,
      clearRecentLocationsOpen,
      errorDetailsOpen,
      operationHistoryOpen,
      volumePickerOpen,
      networkLocationsOpen,
      connectServerOpen,
      connectServerProfile,
      removeServerProfile,
      toolbarCustomizeOpen,
      dialog,
    ],
  );

  return (
    <ModalsContext.Provider value={value}>{children}</ModalsContext.Provider>
  );
}
