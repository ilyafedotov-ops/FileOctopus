import type { Dispatch, SetStateAction } from "react";
import type { FileEntryDto, UserPreferencesDto } from "@fileoctopus/ts-api";
import {
  activeTab,
  parentUri,
  homeUri,
  type FileOctopusState,
  type PanelAction,
  type PanelId,
  type ViewMode,
} from "../panelStore";

const LEGACY_COMMAND_ALIASES: Record<string, string> = {
  settings: "app.settings",
  shortcuts: "app.shortcuts",
  diagnostics: "app.diagnostics",
  up: "nav.up",
  refresh: "nav.refresh",
  "toggle-hidden": "view.toggleHidden",
};

export interface CommandDispatchDeps {
  state: FileOctopusState;
  dispatch: Dispatch<PanelAction>;
  preferences: UserPreferencesDto | null;
  navigatePanel: (panelId: PanelId, uri: string) => Promise<void>;
  goHistory: (panelId: PanelId, direction: "back" | "forward") => Promise<void>;
  refreshPanel: (panelId: PanelId) => void;
  updatePreference: (key: string, value: string) => Promise<void>;
  setSettingsOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setDiagnosticsOpen: (open: boolean) => void;
  setAboutOpen: (open: boolean) => void;
  setGoToLocationOpen: (open: boolean) => void;
  setManageFavoritesOpen: (open: boolean) => void;
  setOperationHistoryOpen: (open: boolean) => void;
  setFilterFocusToken: Dispatch<SetStateAction<number>>;
  setActivityCollapsed: (collapsed: boolean) => void;
  markActivityPinnedOpen?: () => void;
  handleCreateFolder: (panelId: PanelId) => void;
  handleCreateFile: (panelId: PanelId) => void;
  startInlineRename: (panelId: PanelId) => void;
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
}

function resolveCommandId(id: string): string {
  return LEGACY_COMMAND_ALIASES[id] ?? id;
}

export interface DispatchCommandOptions {
  panelId?: PanelId;
}

export function dispatchCommand(
  id: string,
  deps: CommandDispatchDeps,
  options?: DispatchCommandOptions,
): boolean {
  const commandId = resolveCommandId(id);
  const panelId = options?.panelId ?? deps.state.activePanelId;
  const tab = activeTab(deps.state.panels[panelId]);
  const selection = deps.selectedEntries(panelId);
  const selectedEntry = selection[0] ?? null;

  switch (commandId) {
    case "app.settings":
      deps.setSettingsOpen(true);
      return true;
    case "app.shortcuts":
      deps.setShortcutsOpen(true);
      return true;
    case "app.diagnostics":
      deps.setDiagnosticsOpen(true);
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
      void deps.updatePreference("paneMode", next);
      return true;
    }
    case "view.toggleActivity":
      deps.markActivityPinnedOpen?.();
      deps.setActivityCollapsed(false);
      void deps.updatePreference("activityPanelVisible", "true");
      return true;
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
    case "nav.refresh":
      deps.refreshPanel(panelId);
      return true;
    case "nav.goToLocation":
      deps.setGoToLocationOpen(true);
      return true;
    case "nav.manageFavorites":
      deps.setManageFavoritesOpen(true);
      return true;
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
    case "op.trash":
      deps.handleTrash(panelId);
      return true;
    case "op.deletePermanent":
      deps.handlePermanentDelete(panelId);
      return true;
    case "op.properties":
      void deps.handleProperties(panelId, selectedEntry);
      return true;
    case "op.copyTo":
      deps.handleCopyOrMove(panelId, "copy");
      return true;
    case "op.moveTo":
      deps.handleCopyOrMove(panelId, "move");
      return true;
    case "op.open":
      deps.activateEntry(panelId, selectedEntry);
      return true;
    case "op.openDefault":
      if (selectedEntry) {
        void deps.openExternal(selectedEntry);
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
