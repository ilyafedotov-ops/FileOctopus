import {
  createContext,
  useContext,
  type ReactNode,
  type RefObject,
} from "react";
import type {
  AppDataHealthResponse,
  AppInfoResponse,
  AutostartStatusDto,
  FavoriteEntryDto,
  FileEntryDto,
  FileOctopusClient,
  JobSnapshot,
  OperationHistoryRecordDto,
  RecentEntryDto,
  StarredEntryDto,
  StandardLocationDto,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
import type { FileOctopusState, PanelAction, PanelId } from "../panelStore";
import type { FilePanelProps } from "../pane/FilePanel";
import type { ContextMenuState } from "../components/ContextMenu";
import type { CommandEntry } from "../components/CommandPalette";
import type { ToastMessage } from "../components/ToastStack";
import type { OperationDialog } from "../dialogs/OperationDialogView";
import type { MenuBarProps } from "./MenuBar";
import type { FileClipboardState } from "../hooks/useFileOpHandlers";
import type { DialogOverlayGroup } from "../components/DialogOverlayGroup";

export interface ShellLayoutContextValue {
  workspaceRef: RefObject<HTMLElement | null>;
  handleShellKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  makeFilePanelProps: (pid: "left" | "right") => FilePanelProps;
  menuBarProps: MenuBarProps;
  state: FileOctopusState;
  activeTabUri: string;
  locations: StandardLocationDto[];
  favorites: FavoriteEntryDto[];
  recentToday: RecentEntryDto[];
  recentWeek: RecentEntryDto[];
  starred: StarredEntryDto[];
  preferences: UserPreferencesDto | null;
  updatePreference: (key: string, value: string) => Promise<void>;
  client: FileOctopusClient;
  jobs: Record<string, JobSnapshot>;
  jobMetrics: Record<
    string,
    {
      speedLabel: string | null;
      etaLabel: string | null;
      lastBytes: number;
      lastAt: number;
    }
  >;
  history: OperationHistoryRecordDto[];
  operationError: string | null;
  activityCollapsed: boolean;
  markActivityPinnedOpen: () => void;
  setActivityCollapsed: (v: boolean) => void;
  refreshHistory: () => Promise<void>;
  clearHistory: () => Promise<void>;
  settingsOpen: boolean;
  shortcutsOpen: boolean;
  commandPaletteOpen: boolean;
  previewOpen: boolean;
  diagnosticsOpen: boolean;
  aboutOpen: boolean;
  goToLocationOpen: boolean;
  manageFavoritesOpen: boolean;
  errorDetailsOpen: boolean;
  setGoToLocationOpen: (v: boolean) => void;
  setManageFavoritesOpen: (v: boolean) => void;
  setErrorDetailsOpen: (v: boolean) => void;
  dialog: OperationDialog | null;
  autostart: AutostartStatusDto | null;
  commandEntries: CommandEntry[];
  previewEntry: FileEntryDto | null;
  appInfo: AppInfoResponse | null;
  appHealth: AppDataHealthResponse | null;
  diagnosticsDestination: string;
  diagnosticsMessage: string | null;
  exportingDiagnostics: boolean;
  isProductionBuild: boolean;
  setSettingsOpen: (v: boolean) => void;
  setShortcutsOpen: (v: boolean) => void;
  setCommandPaletteOpen: (v: boolean) => void;
  setPreviewOpen: (v: boolean) => void;
  setDiagnosticsOpen: (v: boolean) => void;
  setAboutOpen: (v: boolean) => void;
  setDialog: (d: OperationDialog | null) => void;
  setDiagnosticsDestination: (v: string) => void;
  refreshDiagnostics: () => Promise<void>;
  exportDiagnostics: () => Promise<void>;
  reviewCopyMoveDialog: Parameters<
    typeof DialogOverlayGroup
  >[0]["reviewCopyMoveDialog"];
  submitCreateFolder: Parameters<
    typeof DialogOverlayGroup
  >[0]["submitCreateFolder"];
  submitCreateFile: Parameters<
    typeof DialogOverlayGroup
  >[0]["submitCreateFile"];
  submitRename: Parameters<typeof DialogOverlayGroup>[0]["submitRename"];
  submitCopyMove: Parameters<typeof DialogOverlayGroup>[0]["submitCopyMove"];
  submitTrash: Parameters<typeof DialogOverlayGroup>[0]["submitTrash"];
  submitPermanentDelete: Parameters<
    typeof DialogOverlayGroup
  >[0]["submitPermanentDelete"];
  copyTextFromSelection: (
    panelId: PanelId,
    kind: "path" | "name" | "parentPath" | "uri",
  ) => Promise<void>;
  revealEntry: (panelId: PanelId, entry: FileEntryDto | null) => Promise<void>;
  handleSetAutostart: (enabled: boolean) => Promise<void>;
  handleCommandSelect: (id: string) => void;
  toasts: ToastMessage[];
  setToasts: React.Dispatch<React.SetStateAction<ToastMessage[]>>;
  contextMenu: ContextMenuState | null;
  setContextMenu: (m: ContextMenuState | null) => void;
  clipboard: FileClipboardState | null;
  starredUriSet: Set<string>;
  dispatch: React.Dispatch<PanelAction>;
  activateEntry: (panelId: PanelId, entry: FileEntryDto | null) => void;
  handleRename: (panelId: PanelId) => void;
  triggerInlineRename: (panelId: PanelId) => void;
  copySelectionToFileClipboard: (
    panelId: PanelId,
    mode: "copy" | "move",
  ) => void;
  pasteClipboard: (panelId: PanelId) => Promise<void>;
  handleTrash: (panelId: PanelId) => void;
  toggleStarredForEntry: (entry: FileEntryDto) => Promise<void>;
  handlePermanentDelete: (panelId: PanelId) => void;
  handleProperties: (
    panelId: PanelId,
    entry: FileEntryDto | null,
  ) => Promise<void>;
  openTerminal: (uri: string) => void;
  handleChecksum: (panelId: PanelId) => Promise<void>;
  handleCompress: (panelId: PanelId) => Promise<void>;
  handleExtract: (panelId: PanelId) => Promise<void>;
  handleCreateFolder: (panelId: PanelId) => void;
  handleCreateFile: (panelId: PanelId) => void;
  refreshPanel: (panelId: PanelId) => void;
  handleCopyOrMove: (panelId: PanelId, mode: "copy" | "move") => void;
  openExternal: (entry: FileEntryDto) => Promise<void>;
  toggleHidden: (panelId: PanelId) => void;
  navigatePanel: (panelId: PanelId, uri: string) => void;
  navigateOtherPane: (uri: string) => void;
  addFavorite: (uri: string) => void;
  refreshNavigation: () => Promise<void>;
  setOperationError: (error: string | null) => void;
  applySplitRatioFn: (ratio: number) => number;
}

const ShellLayoutContext = createContext<ShellLayoutContextValue | null>(null);

export function ShellLayoutProvider({
  value,
  children,
}: {
  value: ShellLayoutContextValue;
  children: ReactNode;
}) {
  return (
    <ShellLayoutContext.Provider value={value}>
      {children}
    </ShellLayoutContext.Provider>
  );
}

export function useShellLayout(): ShellLayoutContextValue {
  const ctx = useContext(ShellLayoutContext);
  if (!ctx) {
    throw new Error("useShellLayout must be used within ShellLayoutProvider");
  }
  return ctx;
}
