import type { Dispatch } from "react";
import {
  normalizeIpcError,
  type FileOctopusClient,
  type StandardLocationDto,
  type UserPreferencesDto,
} from "@fileoctopus/ts-api";
import {
  activeTab,
  type FileOctopusState,
  type PanelAction,
  type PanelId,
  type SortField,
  type ViewMode,
} from "../panelStore";
import type { MenuBarProps } from "../shell/MenuBar";
import {
  type DensityPreference,
  applySplitRatio,
  applyDensityPreference,
} from "../applyPreferences";
import type { FileClipboardState } from "./useFileOpHandlers";
import type { ToastMessage } from "../components/ToastStack";
import { viewModeCommandId } from "../commands/viewModeCommands";

export interface UseMenuBarPropsParams {
  state: FileOctopusState;
  dispatch: Dispatch<PanelAction>;
  client: FileOctopusClient;
  locations: StandardLocationDto[];
  clipboard: FileClipboardState | null;
  preferences: UserPreferencesDto | null;
  setDensity: (d: DensityPreference) => void;
  navigatePanel: (panelId: PanelId, uri: string) => void;
  refreshNavigation: () => void;
  exportDiagnostics: () => Promise<void>;
  handleRename: (panelId: PanelId) => void;
  updatePreference: (key: string, value: string) => Promise<void>;
  pushToast: (toast: Omit<ToastMessage, "id">) => void;
  setFilterFocusToken: (fn: (v: number) => number) => void;
  setRecursiveSearchFocusToken: (fn: (v: number) => number) => void;
  setDiagnosticsOpen: (v: boolean) => void;
  runCommand: (commandId: string) => void;
}

export function useMenuBarProps(params: UseMenuBarPropsParams): MenuBarProps {
  const {
    state,
    dispatch,
    client,
    locations,
    clipboard,
    preferences,
    setDensity,
    navigatePanel,
    refreshNavigation,
    exportDiagnostics,
    handleRename,
    updatePreference,
    pushToast,
    setFilterFocusToken,
    setRecursiveSearchFocusToken,
    setDiagnosticsOpen,
    runCommand,
  } = params;

  const panelId = state.activePanelId;
  const tab = activeTab(state.panels[panelId]);

  return {
    activePanelId: panelId,
    onBack: () => runCommand("nav.back"),
    onForward: () => runCommand("nav.forward"),
    onUp: () => runCommand("nav.up"),
    onHome: () => runCommand("nav.home"),
    onGoToLocation: () => runCommand("nav.goToLocation"),
    goStandardLocation: (loc: string) => {
      const match = locations.find(
        (l) => l.id.toLowerCase() === loc.toLowerCase(),
      );
      if (match) void navigatePanel(panelId, match.uri);
    },
    onNewFolder: () => runCommand("create.folder"),
    onNewFile: () => runCommand("create.file"),
    onOpenSelected: () => runCommand("op.open"),
    onOpenWithDefaultApp: () => runCommand("op.openDefault"),
    onRevealInFileManager: () => runCommand("op.reveal"),
    onRename: () => handleRename(panelId),
    onCopyTo: () => runCommand("op.copyTo"),
    onMoveTo: () => runCommand("op.moveTo"),
    onTrash: () => runCommand("op.trash"),
    onDeletePermanently: () => runCommand("op.deletePermanent"),
    onProperties: () => runCommand("op.properties"),
    onCut: () => runCommand("op.cut"),
    onCopy: () => runCommand("op.copy"),
    onPaste: () => runCommand("op.paste"),
    onClearClipboard: () => runCommand("clipboard.clear"),
    onSelectAll: () => runCommand("selection.selectAll"),
    onClearSelection: () => runCommand("selection.clear"),
    onInvertSelection: () => runCommand("selection.invert"),
    onCopyPath: () => runCommand("clipboard.copyPath"),
    onCopyName: () => runCommand("clipboard.copyName"),
    onCopyParentPath: () => runCommand("clipboard.copyParent"),
    onCopyResourceUri: () => runCommand("clipboard.copyUri"),
    onViewMode: (mode: string) => {
      const commandId = viewModeCommandId(mode);
      if (commandId) {
        runCommand(commandId);
        return;
      }
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
    onToggleSidebar: () => runCommand("view.toggleSidebar"),
    onToggleToolbar: () => undefined,
    onToggleStatusBar: () => undefined,
    onToggleDualPane: () => runCommand("view.toggleDualPane"),
    onToggleHidden: () => runCommand("view.toggleHidden"),
    onRefresh: () => runCommand("nav.refresh"),
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
    onManageFavorites: () => runCommand("nav.manageFavorites"),
    onOperationHistory: () => runCommand("app.operationHistory"),
    onFilter: () => setFilterFocusToken((v) => v + 1),
    onSearchRecursive: () => setRecursiveSearchFocusToken((v) => v + 1),
    onJobActivity: () => {
      runCommand("view.toggleActivity");
    },
    onDiagnostics: () => runCommand("app.diagnostics"),
    onExportDiagnostics: () => {
      setDiagnosticsOpen(true);
      void exportDiagnostics();
    },
    onSwitchPane: () =>
      dispatch({
        type: "setActivePanel",
        panelId: panelId === "left" ? "right" : "left",
      }),
    onSwapPanes: () => undefined,
    onEqualizePanes: () => {
      applySplitRatio(0.5);
      void updatePreference("splitRatio", "0.5");
    },
    onShortcuts: () => runCommand("app.shortcuts"),
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
    onAbout: () => runCommand("app.about"),
    onSettings: () => runCommand("app.settings"),
    onExit: () => globalThis.close(),
    canGoBack: tab.backStack.length > 0,
    canGoForward: tab.forwardStack.length > 0,
    hasSelection: tab.selectedIds.length > 0,
    hasClipboard: clipboard !== null,
    sidebarVisible: preferences?.sidebarVisible !== false,
    toolbarVisible: true,
    statusBarVisible: true,
    dualPane: preferences?.paneMode !== "single",
    showHidden: tab.showHidden,
  };
}
