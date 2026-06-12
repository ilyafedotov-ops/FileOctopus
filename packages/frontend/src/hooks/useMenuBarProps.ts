import type { Dispatch } from "react";
import type {
  RecentEntryDto,
  StandardLocationDto,
  StarredEntryDto,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
import {
  activeTab,
  countOperationalSelection,
  type FileOctopusState,
  type PanelAction,
  type PanelId,
  type SortField,
  type ViewMode,
} from "../panelStore";
import type { MenuBarProps } from "../shell/MenuBar";
import type { FileClipboardState } from "./useFileOpHandlers";
import { viewModeCommandId } from "../commands/viewModeCommands";

export interface UseMenuBarPropsParams {
  state: FileOctopusState;
  dispatch: Dispatch<PanelAction>;
  locations: StandardLocationDto[];
  clipboard: FileClipboardState | null;
  preferences: UserPreferencesDto | null;
  navigatePanel: (panelId: PanelId, uri: string) => void;
  handleRename: (panelId: PanelId) => void;
  setDiagnosticsOpen: (v: boolean) => void;
  onRequestExit?: () => void;
  runCommand: (
    commandId: string,
    panelId?: PanelId,
    context?: import("../commands/invokeContext").CommandInvokeArg,
  ) => void;
  statusBarVisible: boolean;
  toolbarVisible: boolean;
  onCustomizeToolbar: () => void;
  recentLocations: RecentEntryDto[];
  starredLocations: StarredEntryDto[];
}

export function useMenuBarProps(params: UseMenuBarPropsParams): MenuBarProps {
  const {
    state,
    dispatch,
    locations,
    clipboard,
    preferences,
    navigatePanel,
    handleRename,
    setDiagnosticsOpen,
    onRequestExit,
    runCommand,
    statusBarVisible,
    toolbarVisible,
    recentLocations,
    starredLocations,
    onCustomizeToolbar,
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
    onVolumePicker: () => runCommand("nav.volumePicker"),
    goStandardLocation: (loc: string) => {
      const match = locations.find(
        (l) => l.id.toLowerCase() === loc.toLowerCase(),
      );
      if (match) void navigatePanel(panelId, match.uri);
    },
    onNewFolder: () => runCommand("create.folder"),
    onNewFile: () => runCommand("create.file"),
    onOpenSelected: () => runCommand("op.open"),
    onView: () => runCommand("op.view"),
    onEdit: () => runCommand("op.edit"),
    onOpenWithDefaultApp: () => runCommand("op.openDefault"),
    onRevealInFileManager: () => runCommand("op.reveal"),
    onRename: () => handleRename(panelId),
    onCopyTo: () => runCommand("op.copyTo"),
    onMoveTo: () => runCommand("op.moveTo"),
    onDelete: () => runCommand("op.delete"),
    onTrash: () => runCommand("op.trash"),
    onCompress: () => runCommand("op.compress"),
    onExtract: () => runCommand("op.extract"),
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
    onSortBy: (field: string) =>
      runCommand("view.sort", panelId, { sortField: field as SortField }),
    onSortDirection: (dir: string) =>
      runCommand(
        dir === "ascending" ? "view.sortAscending" : "view.sortDescending",
        panelId,
      ),
    onTheme: (theme: string) =>
      runCommand("preferences.theme", undefined, { preferenceValue: theme }),
    onDensity: (density: string) =>
      runCommand("preferences.density", undefined, {
        preferenceValue: density,
      }),
    onToggleSidebar: () => runCommand("view.toggleSidebar"),
    onToggleToolbar: () => runCommand("view.toggleToolbar"),
    onToggleStatusBar: () => runCommand("view.toggleStatusBar"),
    onToggleDualPane: () => runCommand("view.toggleDualPane"),
    onTogglePaneDirection: () => runCommand("layout.togglePaneDirection"),
    onToggleHidden: () => runCommand("view.toggleHidden"),
    onRefresh: () => runCommand("nav.refresh"),
    onAddFavorite: () => runCommand("nav.addFavorite", panelId),
    onManageFavorites: () => runCommand("nav.manageFavorites"),
    onNetworkLocations: () => runCommand("nav.networkLocations"),
    onAddServer: () => runCommand("nav.addServer"),
    onShowRecentLocations: () => runCommand("nav.recentLocations"),
    onClearRecentLocations: () => runCommand("nav.clearRecentLocations"),
    recentLocations: recentLocations,
    starredLocations: starredLocations.map((s) => ({
      uri: s.uri,
      label: s.label ?? s.uri.split("/").filter(Boolean).pop() ?? s.uri,
    })),
    onOperationHistory: () => runCommand("app.operationHistory"),
    onFilter: () => runCommand("filter"),
    onSearchRecursive: () => runCommand("recursive-search"),
    onChecksum: () => runCommand("op.checksum"),
    onOpenTerminal: () => runCommand("op.openTerminal"),
    onOpenTerminalExternal: () => runCommand("op.openTerminalExternal"),
    onToggleTerminal: () => runCommand("view.toggleTerminal"),
    onCalculateSize: () => runCommand("op.calculateSize"),
    onJobActivity: () => {
      runCommand("view.toggleActivity");
    },
    onDiagnostics: () => runCommand("app.diagnostics"),
    onExportDiagnostics: () => setDiagnosticsOpen(true),
    onSwitchPane: () => runCommand("layout.switchPane", panelId),
    onSwapPanes: () => runCommand("layout.swapPanes"),
    onEqualizePanes: () => runCommand("layout.equalizePanes"),
    onShortcuts: () => runCommand("app.shortcuts"),
    onDocumentation: () => runCommand("app.documentation"),
    onAbout: () => runCommand("app.about"),
    onSettings: () => runCommand("app.settings"),
    onExit: () => {
      if (onRequestExit) {
        onRequestExit();
        return;
      }
      globalThis.close();
    },
    canGoBack: tab.backStack.length > 0,
    canGoForward: tab.forwardStack.length > 0,
    hasSelection: countOperationalSelection(tab) > 0,
    hasClipboard: clipboard !== null,
    sidebarVisible: preferences?.sidebarVisible !== false,
    toolbarVisible,
    statusBarVisible,
    dualPane: preferences?.paneMode !== "single",
    paneDirection: preferences?.paneDirection ?? "horizontal",
    showHidden: tab.showHidden,
    viewMode: tab.viewMode,
    sortField: tab.sort.field,
    sortDirection: tab.sort.direction,
    theme: preferences?.theme ?? "system",
    density: preferences?.density ?? "comfortable",
    onCustomizeToolbar,
  };
}
