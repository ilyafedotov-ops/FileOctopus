import type { Dispatch, SetStateAction } from "react";
import type { FileEntryDto, UserPreferencesDto } from "@fileoctopus/ts-api";
import type { DensityPreference } from "../applyPreferences";
import {
  activeTab,
  parentUri,
  homeUri,
  type FileOctopusState,
  type PanelAction,
  type PanelId,
  type ViewMode,
} from "../panelStore";
import { rootUri } from "../utils/paneUtils";
import type { ActivityRailSegment } from "../terminal/terminalSlice";
import type { CommandInvokeContext } from "./invokeContext";

const LEGACY_COMMAND_ALIASES: Record<string, string> = {
  settings: "app.settings",
  shortcuts: "app.shortcuts",
  diagnostics: "app.diagnostics",
  up: "nav.up",
  refresh: "nav.refresh",
  "toggle-hidden": "view.toggleHidden",
  "switch-pane": "layout.switchPane",
};

export interface CommandDispatchDeps {
  state: FileOctopusState;
  dispatch: Dispatch<PanelAction>;
  preferences: UserPreferencesDto | null;
  navigatePanel: (panelId: PanelId, uri: string) => Promise<void>;
  goHistory: (panelId: PanelId, direction: "back" | "forward") => Promise<void>;
  refreshPanel: (panelId: PanelId) => void;
  updatePreference: (key: string, value: string) => Promise<void>;
  requestPaneModeChange: (next: "single" | "dual") => void;
  setSettingsOpen: (open: boolean) => void;
  setToolbarCustomizeOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setDiagnosticsOpen: (open: boolean) => void;
  setDebugConsoleOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
  setAboutOpen: (open: boolean) => void;
  setGoToLocationOpen: (open: boolean) => void;
  setManageFavoritesOpen: (open: boolean) => void;
  setRecentLocationsOpen: (open: boolean) => void;
  setClearRecentLocationsOpen: (open: boolean) => void;
  removeRecentEntry: (uri: string) => Promise<void>;
  clearRecentEntries: () => Promise<void>;
  setOperationHistoryOpen: (open: boolean) => void;
  setVolumePickerOpen: (open: boolean) => void;
  setConnectServerOpen: (open: boolean) => void;
  setConnectServerProfile: (
    profile: import("@fileoctopus/ts-api").NetworkProfileDto | null,
  ) => void;
  setConnectServerInitial?: (
    profile: import("@fileoctopus/ts-api").NetworkConnectionDraftDto | null,
  ) => void;
  setFilterFocusToken: Dispatch<SetStateAction<number>>;
  setRecursiveSearchFocusToken: Dispatch<SetStateAction<number>>;
  setPreviewOpen: (open: boolean) => void;
  setViewerOpen: (open: boolean) => void;
  setViewerEntry: (entry: FileEntryDto | null) => void;
  setEditorOpen: (open: boolean) => void;
  setEditorEntry: (entry: FileEntryDto | null) => void;
  openPreviewInOppositePane?: (
    sourcePanelId: PanelId,
    entry: FileEntryDto,
  ) => void;
  openEditorInOppositePane?: (
    sourcePanelId: PanelId,
    entry: FileEntryDto,
  ) => void;
  isTextEditable: (entry: FileEntryDto | null) => boolean;
  isPreviewable: (entry: FileEntryDto | null) => boolean;
  activityCollapsed: boolean;
  activityPanelVisible: boolean;
  setActivityCollapsed: (collapsed: boolean) => void;
  markActivityPinnedOpen?: () => void;
  terminalRailSegment: ActivityRailSegment;
  setTerminalRailSegment: (segment: ActivityRailSegment) => void;
  handleCreateFolder: (panelId: PanelId) => void;
  handleCreateFile: (panelId: PanelId) => void;
  startInlineRename: (panelId: PanelId) => void;
  handleDelete: (panelId: PanelId) => void;
  handleTrash: (panelId: PanelId) => void;
  handlePermanentDelete: (panelId: PanelId) => void;
  handleProperties: (
    panelId: PanelId,
    entry: FileEntryDto | null,
    focusPermissions?: boolean,
  ) => Promise<void>;
  setOperationError: (error: string | null) => void;
  copySelectionToFileClipboard: (
    panelId: PanelId,
    mode: "copy" | "move",
  ) => void;
  pasteClipboard: (panelId: PanelId) => Promise<void>;
  selectedEntries: (panelId: PanelId) => FileEntryDto[];
  activateEntry: (panelId: PanelId, entry: FileEntryDto | null) => void;
  copyTextFromSelection: (
    panelId: PanelId,
    kind: "path" | "name" | "parentPath" | "uri",
  ) => Promise<void>;
  revealEntry: (panelId: PanelId, entry: FileEntryDto | null) => Promise<void>;
  openExternal: (entry: FileEntryDto) => Promise<void>;
  clearClipboard: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  handleCopyOrMove: (panelId: PanelId, mode: "copy" | "move") => void;
  toggleHidden: (panelId: PanelId) => void;
  handleCompress: (panelId: PanelId) => void;
  handleExtract: (panelId: PanelId) => void;
  handleChecksum: (panelId: PanelId) => Promise<void>;
  openEmbeddedTerminal: (panelId: PanelId) => void;
  openTerminalExternal: (panelId: PanelId) => void;
  togglePaneTerminal: (panelId: PanelId) => void;
  requestTerminalCommand?: (
    label: string,
    onSubmit?: (command: string) => void,
  ) => string | null;
  runTerminalCommand?: (command: string) => void;
  spawnAndRunTerminalCommand?: (panelId: PanelId, command: string) => void;
  calculateSize: (
    panelId: PanelId,
    entry: FileEntryDto | null,
  ) => Promise<void>;
  toggleStarredForEntry: (entry: FileEntryDto) => Promise<void>;
  addFavorite: (
    panelId: PanelId,
    uri?: string,
    label?: string,
  ) => Promise<void>;
  revealUri: (uri: string) => Promise<void>;
  removeFavorite: (id: number) => Promise<void>;
  renameFavorite: (id: number, label: string) => Promise<void>;
  setTheme: (theme: string) => void;
  setDensity: (density: DensityPreference) => void;
  equalizePanes: () => void;
  toggleStatusBar: () => void;
  toggleToolbar: () => void;
  setMultiRenameOpen: (open: boolean) => void;
  setSyncDirectoriesOpen: (open: boolean) => void;
  setHotlistOpen: (open: boolean) => void;
  setManageHotlistOpen: (open: boolean) => void;
}

function resolveCommandId(id: string): string {
  return LEGACY_COMMAND_ALIASES[id] ?? id;
}

function terminalCommandFromOptions(
  deps: CommandDispatchDeps,
  options: DispatchCommandOptions | undefined,
  label: string,
  onSubmit: (command: string) => void,
): string | null {
  const command =
    options?.terminalCommand ?? deps.requestTerminalCommand?.(label, onSubmit);
  const trimmed = command?.trim() ?? "";
  return trimmed ? trimmed : null;
}

export type DispatchCommandOptions = CommandInvokeContext & {
  panelId?: PanelId;
};

export function dispatchCommand(
  id: string,
  deps: CommandDispatchDeps,
  options?: DispatchCommandOptions,
): boolean {
  const commandId = resolveCommandId(id);
  const panelId = options?.panelId ?? deps.state.activePanelId;
  const tab = activeTab(deps.state.panels[panelId]);
  const selection = deps.selectedEntries(panelId);
  const selectedEntry =
    options?.entry !== undefined ? options.entry : (selection[0] ?? null);

  switch (commandId) {
    case "app.settings":
      deps.setSettingsOpen(true);
      return true;
    case "app.customizeToolbar":
      deps.setToolbarCustomizeOpen(true);
      return true;
    case "app.shortcuts":
      deps.setShortcutsOpen(true);
      return true;
    case "app.diagnostics":
      deps.setDiagnosticsOpen(true);
      return true;
    case "app.debugConsole":
      deps.setDebugConsoleOpen(true);
      return true;
    case "app.documentation":
      deps.setHelpOpen(true);
      return true;
    case "app.about":
      deps.setAboutOpen(true);
      return true;
    case "app.operationHistory":
      deps.setOperationHistoryOpen(true);
      return true;
    case "app.commandPalette":
      deps.setCommandPaletteOpen(true);
      return true;
    case "view.toggleSidebar":
      void deps.updatePreference(
        "sidebarVisible",
        String(deps.preferences?.sidebarVisible === false),
      );
      return true;
    case "view.toggleDualPane": {
      const next = deps.preferences?.paneMode === "single" ? "dual" : "single";
      deps.requestPaneModeChange(next);
      return true;
    }
    case "view.toggleActivity": {
      const next = !deps.activityCollapsed;
      if (!next) {
        deps.markActivityPinnedOpen?.();
      }
      deps.setActivityCollapsed(next);
      void deps.updatePreference("activityPanelVisible", String(!next));
      return true;
    }
    case "view.toggleStatusBar":
      deps.toggleStatusBar();
      return true;
    case "view.toggleToolbar":
      deps.toggleToolbar();
      return true;
    case "view.sort":
      if (options?.sortField) {
        deps.dispatch({
          type: "setSort",
          panelId,
          field: options.sortField,
        });
        return true;
      }
      return false;
    case "view.sortAscending":
      if (tab.sort.direction !== "asc") {
        deps.dispatch({
          type: "setSort",
          panelId,
          field: tab.sort.field,
        });
      }
      return true;
    case "view.sortDescending":
      if (tab.sort.direction !== "desc") {
        deps.dispatch({
          type: "setSort",
          panelId,
          field: tab.sort.field,
        });
      }
      return true;
    case "preferences.theme": {
      const theme = options?.preferenceValue ?? "system";
      deps.setTheme(theme);
      void deps.updatePreference("theme", theme);
      return true;
    }
    case "preferences.cycleTheme": {
      const current = deps.preferences?.theme ?? "system";
      const next =
        current === "system"
          ? "light"
          : current === "light"
            ? "dark"
            : "system";
      deps.setTheme(next);
      void deps.updatePreference("theme", next);
      return true;
    }
    case "preferences.accentColor":
    case "preferences.fontScale":
    case "preferences.iconScale":
      deps.setSettingsOpen(true);
      return true;
    case "preferences.density": {
      const density = options?.preferenceValue ?? "comfortable";
      deps.setDensity(density as DensityPreference);
      void deps.updatePreference("density", density);
      return true;
    }
    case "layout.switchPane":
      deps.dispatch({
        type: "setActivePanel",
        panelId: panelId === "left" ? "right" : "left",
      });
      return true;
    case "layout.equalizePanes":
      deps.equalizePanes();
      return true;
    case "layout.swapPanes":
      deps.dispatch({ type: "swapPanes" });
      return true;
    case "layout.togglePaneDirection": {
      const current = deps.preferences?.paneDirection ?? "horizontal";
      void deps.updatePreference(
        "paneDirection",
        current === "horizontal" ? "vertical" : "horizontal",
      );
      return true;
    }
    case "nav.back":
      void deps.goHistory(panelId, "back");
      return true;
    case "nav.forward":
      void deps.goHistory(panelId, "forward");
      return true;
    case "nav.up": {
      const upUri = parentUri(tab.uri);
      if (upUri) void deps.navigatePanel(panelId, upUri);
      return true;
    }
    case "nav.home":
      void deps.navigatePanel(panelId, homeUri());
      return true;
    case "nav.root":
      void deps.navigatePanel(panelId, rootUri(tab.uri));
      return true;
    case "nav.refresh":
      deps.refreshPanel(panelId);
      return true;
    case "nav.openUri": {
      const uri = options?.targetUri;
      if (uri) {
        void deps.navigatePanel(panelId, uri);
        return true;
      }
      return false;
    }
    case "nav.revealUri": {
      const uri = options?.targetUri;
      if (uri) {
        void deps.revealUri(uri);
        return true;
      }
      return false;
    }
    case "nav.goToLocation":
      deps.setGoToLocationOpen(true);
      return true;
    case "nav.volumePicker":
      deps.setVolumePickerOpen(true);
      return true;
    case "nav.networkLocations":
      void deps.navigatePanel(panelId, "network:///");
      return true;
    case "nav.addServer":
      deps.setConnectServerProfile(null);
      deps.setConnectServerInitial?.(null);
      deps.setConnectServerOpen(true);
      return true;
    case "nav.connectServer": {
      const profile = options?.networkProfile;
      if (profile) {
        deps.setConnectServerProfile(profile);
        deps.setConnectServerInitial?.(null);
        deps.setConnectServerOpen(true);
        return true;
      }
      return false;
    }
    case "nav.manageFavorites":
      deps.setManageFavoritesOpen(true);
      return true;
    case "nav.recentLocations":
      deps.setRecentLocationsOpen(true);
      return true;
    case "nav.clearRecentLocations":
      deps.setClearRecentLocationsOpen(true);
      return true;
    case "nav.clearRecent":
      void deps.clearRecentEntries();
      return true;
    case "nav.removeRecent": {
      const uri = options?.targetUri;
      if (uri) {
        void deps.removeRecentEntry(uri);
        return true;
      }
      return false;
    }
    case "view.toggleHidden":
      deps.toggleHidden(panelId);
      return true;
    case "view.details":
      deps.dispatch({ type: "setViewMode", panelId, viewMode: "details" });
      return true;
    case "view.list":
      deps.dispatch({ type: "setViewMode", panelId, viewMode: "list" });
      return true;
    case "view.compact":
      deps.dispatch({ type: "setViewMode", panelId, viewMode: "compact" });
      return true;
    case "view.icons":
      deps.dispatch({ type: "setViewMode", panelId, viewMode: "icons" });
      return true;
    case "view.columns":
      deps.dispatch({ type: "setViewMode", panelId, viewMode: "columns" });
      return true;
    case "create.folder":
      deps.handleCreateFolder(panelId);
      return true;
    case "create.file":
      deps.handleCreateFile(panelId);
      return true;
    case "op.rename":
      deps.startInlineRename(panelId);
      return true;
    case "op.copy":
      deps.copySelectionToFileClipboard(panelId, "copy");
      return true;
    case "op.cut":
      deps.copySelectionToFileClipboard(panelId, "move");
      return true;
    case "op.paste":
      void deps.pasteClipboard(panelId);
      return true;
    case "op.delete":
      deps.handleDelete(panelId);
      return true;
    case "op.trash":
      deps.handleTrash(panelId);
      return true;
    case "op.deletePermanent":
      deps.handlePermanentDelete(panelId);
      return true;
    case "search.recursive":
      deps.setRecursiveSearchFocusToken((value) => value + 1);
      return true;
    case "search.focusFilter":
      deps.setFilterFocusToken((value) => value + 1);
      return true;
    case "op.view": {
      const entry = selectedEntry;
      if (entry) {
        deps.setOperationError(null);
        if (deps.openPreviewInOppositePane) {
          deps.openPreviewInOppositePane(panelId, entry);
        } else {
          deps.setViewerEntry(entry);
          deps.setViewerOpen(true);
        }
        return true;
      }
      void deps.handleProperties(panelId, entry);
      return true;
    }
    case "op.properties":
      void deps.handleProperties(panelId, selectedEntry);
      return true;
    case "op.permissions":
      void deps.handleProperties(panelId, selectedEntry, true);
      return true;
    case "op.compress":
      void deps.handleCompress(panelId);
      return true;
    case "op.extract":
      void deps.handleExtract(panelId);
      return true;
    case "op.checksum":
      void deps.handleChecksum(panelId);
      return true;
    case "op.openTerminal":
      deps.openEmbeddedTerminal(panelId);
      return true;
    case "op.openTerminalExternal":
      deps.openTerminalExternal(panelId);
      return true;
    case "terminal.runCommand": {
      if (!deps.runTerminalCommand) {
        return false;
      }
      const command = terminalCommandFromOptions(
        deps,
        options,
        "Run command in active terminal",
        deps.runTerminalCommand,
      );
      if (!command) {
        return true;
      }
      deps.runTerminalCommand(command);
      return true;
    }
    case "terminal.spawnAndRun": {
      if (!deps.spawnAndRunTerminalCommand) {
        return false;
      }
      const command = terminalCommandFromOptions(
        deps,
        options,
        "Spawn terminal and run command",
        (command) => deps.spawnAndRunTerminalCommand?.(panelId, command),
      );
      if (!command) {
        return true;
      }
      deps.spawnAndRunTerminalCommand(panelId, command);
      return true;
    }
    case "view.toggleTerminal":
      deps.togglePaneTerminal(panelId);
      return true;
    case "op.calculateSize":
      void deps.calculateSize(panelId, selectedEntry);
      return true;
    case "op.toggleStarred":
      if (selectedEntry) {
        void deps.toggleStarredForEntry(selectedEntry);
      }
      return true;
    case "nav.addFavorite": {
      const uri = options?.targetUri ?? selectedEntry?.uri ?? tab.uri;
      const label =
        options?.preferenceValue ?? uri.split("/").filter(Boolean).pop() ?? uri;
      void deps.addFavorite(panelId, uri, label);
      return true;
    }
    case "nav.removeFavorite": {
      const id = options?.favoriteId;
      if (id != null) {
        void deps.removeFavorite(id);
        return true;
      }
      return false;
    }
    case "nav.renameFavorite": {
      const id = options?.favoriteId;
      const label = options?.preferenceValue?.trim();
      if (id != null && label) {
        void deps.renameFavorite(id, label);
        return true;
      }
      return false;
    }
    case "op.copyTo":
      deps.handleCopyOrMove(panelId, "copy");
      return true;
    case "op.moveTo":
      deps.handleCopyOrMove(panelId, "move");
      return true;
    case "op.open":
      deps.activateEntry(panelId, selectedEntry);
      return true;
    case "op.edit": {
      const entry = selectedEntry;
      if (!entry) return true;
      if (deps.isTextEditable(entry)) {
        deps.setOperationError(null);
        if (deps.openEditorInOppositePane) {
          deps.openEditorInOppositePane(panelId, entry);
        } else {
          deps.setEditorEntry(entry);
          deps.setEditorOpen(true);
        }
        return true;
      }
      if (deps.openPreviewInOppositePane) {
        deps.openPreviewInOppositePane(panelId, entry);
      } else {
        void deps.openExternal(entry);
      }
      return true;
    }
    case "op.openDefault":
      if (selectedEntry) {
        if (deps.openPreviewInOppositePane) {
          deps.openPreviewInOppositePane(panelId, selectedEntry);
        } else {
          void deps.openExternal(selectedEntry);
        }
      }
      return true;
    case "op.reveal":
      void deps.revealEntry(panelId, selectedEntry);
      return true;
    case "clipboard.copyPath":
      void deps.copyTextFromSelection(panelId, "path");
      return true;
    case "clipboard.copyName":
      void deps.copyTextFromSelection(panelId, "name");
      return true;
    case "clipboard.copyParent":
      void deps.copyTextFromSelection(panelId, "parentPath");
      return true;
    case "clipboard.copyUri":
      void deps.copyTextFromSelection(panelId, "uri");
      return true;
    case "clipboard.clear":
      deps.clearClipboard();
      return true;
    case "selection.invert":
      deps.dispatch({ type: "invertSelection", panelId });
      return true;
    case "selection.selectAll":
      deps.dispatch({ type: "selectAll", panelId });
      return true;
    case "selection.clear":
      deps.dispatch({ type: "clearSelection", panelId });
      return true;
    case "tools.multiRename":
      deps.setMultiRenameOpen(true);
      return true;
    case "tools.syncDirectories":
      deps.setSyncDirectoriesOpen(true);
      return true;
    case "tools.openHotlist":
      deps.setHotlistOpen(true);
      return true;
    case "tools.manageHotlist":
      deps.setManageHotlistOpen(true);
      return true;
    default:
      return false;
  }
}

export function dispatchViewMode(
  panelId: PanelId,
  viewMode: ViewMode,
  dispatch: Dispatch<PanelAction>,
): void {
  dispatch({ type: "setViewMode", panelId, viewMode });
}
