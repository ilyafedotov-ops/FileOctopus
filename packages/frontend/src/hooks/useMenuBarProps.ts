import type { Dispatch } from "react";
import {
  normalizeIpcError,
  type FileOctopusClient,
  type FileEntryDto,
  type StandardLocationDto,
  type UserPreferencesDto,
} from "@fileoctopus/ts-api";
import {
  activeTab,
  homeUri,
  parentUri,
  type FileOctopusState,
  type PanelAction,
  type PanelId,
  type SortField,
  type ViewMode,
} from "../panelStore";
import type { MenuBarProps } from "../shell/MenuBar";
import {
  type DensityPreference,
  applyDensityPreference,
} from "../applyPreferences";
import type { FileClipboardState } from "./useFileOpHandlers";
import type { ToastMessage } from "../components/ToastStack";

export interface UseMenuBarPropsParams {
  state: FileOctopusState;
  dispatch: Dispatch<PanelAction>;
  client: FileOctopusClient;
  locations: StandardLocationDto[];
  clipboard: FileClipboardState | null;
  setClipboard: (value: FileClipboardState | null) => void;
  preferences: UserPreferencesDto | null;
  setDensity: (d: DensityPreference) => void;
  goHistory: (panelId: PanelId, direction: "back" | "forward") => Promise<void>;
  navigatePanel: (panelId: PanelId, uri: string) => void;
  refreshPanel: (panelId: PanelId) => void;
  refreshNavigation: () => void;
  activateEntry: (panelId: PanelId, entry: FileEntryDto | null) => void;
  selectedEntries: (panelId: PanelId) => FileEntryDto[];
  openExternal: (entry: FileEntryDto) => Promise<void>;
  revealEntry: (panelId: PanelId, entry: FileEntryDto | null) => Promise<void>;
  handleCreateFolder: (panelId: PanelId) => void;
  handleCreateFile: (panelId: PanelId) => void;
  handleRename: (panelId: PanelId) => void;
  handleTrash: (panelId: PanelId) => void;
  handlePermanentDelete: (panelId: PanelId) => void;
  handleProperties: (
    panelId: PanelId,
    entry: FileEntryDto | null,
  ) => Promise<void>;
  copySelectionToFileClipboard: (
    panelId: PanelId,
    mode: "copy" | "move",
  ) => void;
  pasteClipboard: (panelId: PanelId) => Promise<void>;
  copyTextFromSelection: (
    panelId: PanelId,
    kind: "path" | "name" | "parentPath" | "uri",
  ) => Promise<void>;
  toggleHidden: (panelId: PanelId) => void;
  updatePreference: (key: string, value: string) => Promise<void>;
  pushToast: (toast: Omit<ToastMessage, "id">) => void;
  setPathFocusToken: (fn: (v: number) => number) => void;
  setFilterFocusToken: (fn: (v: number) => number) => void;
  setRecursiveSearchFocusToken: (fn: (v: number) => number) => void;
  setSettingsOpen: (v: boolean) => void;
  setShortcutsOpen: (v: boolean) => void;
  setDiagnosticsOpen: (v: boolean) => void;
}

export function useMenuBarProps(params: UseMenuBarPropsParams): MenuBarProps {
  const {
    state,
    dispatch,
    client,
    locations,
    clipboard,
    setClipboard,
    preferences,
    setDensity,
    goHistory,
    navigatePanel,
    refreshPanel,
    refreshNavigation,
    activateEntry,
    selectedEntries,
    openExternal,
    revealEntry,
    handleCreateFolder,
    handleCreateFile,
    handleRename,
    handleTrash,
    handlePermanentDelete,
    handleProperties,
    copySelectionToFileClipboard,
    pasteClipboard,
    copyTextFromSelection,
    toggleHidden,
    updatePreference,
    pushToast,
    setPathFocusToken,
    setFilterFocusToken,
    setRecursiveSearchFocusToken,
    setSettingsOpen,
    setShortcutsOpen,
    setDiagnosticsOpen,
  } = params;

  const panelId = state.activePanelId;
  const tab = activeTab(state.panels[panelId]);

  return {
    activePanelId: panelId,
    onBack: () => void goHistory(panelId, "back"),
    onForward: () => void goHistory(panelId, "forward"),
    onUp: () => {
      const upUri = parentUri(tab.uri);
      if (upUri) void navigatePanel(panelId, upUri);
    },
    onHome: () => void navigatePanel(panelId, homeUri()),
    onGoToLocation: () => setPathFocusToken((v) => v + 1),
    goStandardLocation: (loc: string) => {
      const match = locations.find(
        (l) => l.id.toLowerCase() === loc.toLowerCase(),
      );
      if (match) void navigatePanel(panelId, match.uri);
    },
    onNewFolder: () => handleCreateFolder(panelId),
    onNewFile: () => handleCreateFile(panelId),
    onOpenSelected: () => {
      const entry = selectedEntries(panelId)[0];
      if (entry) activateEntry(panelId, entry);
    },
    onOpenWithDefaultApp: () => {
      const entry = selectedEntries(panelId)[0];
      if (entry) void openExternal(entry);
    },
    onRevealInFileManager: () => {
      const entry = selectedEntries(panelId)[0];
      if (entry) void revealEntry(panelId, entry);
    },
    onRename: () => handleRename(panelId),
    onCopyTo: () => pushToast({ tone: "info", title: "Copy To… coming soon" }),
    onMoveTo: () => pushToast({ tone: "info", title: "Move To… coming soon" }),
    onTrash: () => handleTrash(panelId),
    onDeletePermanently: () => handlePermanentDelete(panelId),
    onProperties: () => void handleProperties(panelId, null),
    onCut: () => copySelectionToFileClipboard(panelId, "move"),
    onCopy: () => copySelectionToFileClipboard(panelId, "copy"),
    onPaste: () => void pasteClipboard(panelId),
    onClearClipboard: () => setClipboard(null),
    onSelectAll: () => dispatch({ type: "selectAll", panelId }),
    onClearSelection: () => dispatch({ type: "clearSelection", panelId }),
    onInvertSelection: () =>
      pushToast({ tone: "info", title: "Invert Selection coming soon" }),
    onCopyPath: () => void copyTextFromSelection(panelId, "path"),
    onCopyName: () => void copyTextFromSelection(panelId, "name"),
    onCopyParentPath: () => void copyTextFromSelection(panelId, "parentPath"),
    onCopyResourceUri: () => void copyTextFromSelection(panelId, "uri"),
    onViewMode: (mode: string) => {
      dispatch({
        type: "setViewMode",
        panelId,
        viewMode: mode as ViewMode,
      });
    },
    onSortBy: (field: string) => {
      dispatch({
        type: "setSort",
        panelId,
        field: field as SortField,
      });
    },
    onSortDirection: (dir: string) => {
      const ascending = dir === "ascending";
      if ((tab.sort.direction === "asc") !== ascending) {
        dispatch({
          type: "setSort",
          panelId,
          field: tab.sort.field,
        });
      }
    },
    onTheme: (theme: string) => {
      void updatePreference("theme", theme);
    },
    onDensity: (density: string) => {
      const d = density as DensityPreference;
      setDensity(d);
      applyDensityPreference(d);
      void updatePreference("density", density);
    },
    onToggleSidebar: () => {
      void updatePreference(
        "sidebarVisible",
        String(preferences?.sidebarVisible === false),
      );
    },
    onToggleToolbar: () =>
      pushToast({ tone: "info", title: "Toggle Toolbar coming soon" }),
    onToggleStatusBar: () =>
      pushToast({ tone: "info", title: "Toggle Status Bar coming soon" }),
    onToggleDualPane: () => {
      pushToast({ tone: "info", title: "Dual Pane coming soon" });
    },
    onToggleHidden: () => toggleHidden(panelId),
    onRefresh: () => refreshPanel(panelId),
    onAddFavorite: () => {
      const uri = tab.uri;
      const name = uri.split("/").filter(Boolean).pop() ?? "Untitled";
      void client.navigation
        .addFavorite({ uri, label: name })
        .then(() => refreshNavigation())
        .catch((error) =>
          pushToast({ tone: "error", title: normalizeIpcError(error).message }),
        );
    },
    onManageFavorites: () => setSettingsOpen(true),
    onFilter: () => setFilterFocusToken((v) => v + 1),
    onSearchRecursive: () => setRecursiveSearchFocusToken((v) => v + 1),
    onJobActivity: () =>
      pushToast({ tone: "info", title: "Job Activity coming soon" }),
    onDiagnostics: () => setDiagnosticsOpen(true),
    onExportDiagnostics: () =>
      pushToast({ tone: "info", title: "Export Diagnostics coming soon" }),
    onSwitchPane: () =>
      dispatch({
        type: "setActivePanel",
        panelId: panelId === "left" ? "right" : "left",
      }),
    onSwapPanes: () =>
      pushToast({ tone: "info", title: "Swap Panes coming soon" }),
    onEqualizePanes: () =>
      pushToast({ tone: "info", title: "Equalize Panes coming soon" }),
    onShortcuts: () => setShortcutsOpen(true),
    onDocumentation: () => {
      void globalThis.open(
        "https://github.com/nous-research/fileoctopus",
        "_blank",
      );
    },
    onReportIssue: () => {
      void globalThis.open(
        "https://github.com/nous-research/fileoctopus/issues",
        "_blank",
      );
    },
    onAbout: () =>
      pushToast({ tone: "info", title: "About FileOctopus coming soon" }),
    onSettings: () => setSettingsOpen(true),
    onExit: () => pushToast({ tone: "info", title: "Exit coming soon" }),
    canGoBack: tab.backStack.length > 0,
    canGoForward: tab.forwardStack.length > 0,
    hasSelection: tab.selectedIds.length > 0,
    hasClipboard: clipboard !== null,
    sidebarVisible: preferences?.sidebarVisible !== false,
    toolbarVisible: true,
    statusBarVisible: true,
    dualPane: false,
    showHidden: tab.showHidden,
  };
}
