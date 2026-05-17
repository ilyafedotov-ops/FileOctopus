import type { Dispatch, SetStateAction } from "react";
import type { UserPreferencesDto } from "@fileoctopus/ts-api";
import {
  activeTab,
  parentUri,
  type FileOctopusState,
  type PanelAction,
  type PanelId,
} from "../panelStore";

const LEGACY_COMMAND_ALIASES: Record<string, string> = {
  settings: "app.settings",
  shortcuts: "app.shortcuts",
  diagnostics: "app.diagnostics",
  "toggle-sidebar": "view.toggleSidebar",
  up: "nav.up",
  refresh: "nav.refresh",
  "toggle-hidden": "view.toggleHidden",
};

export interface CommandDispatchDeps {
  state: FileOctopusState;
  dispatch: Dispatch<PanelAction>;
  preferences: UserPreferencesDto | null;
  navigatePanel: (panelId: PanelId, uri: string) => Promise<void>;
  refreshPanel: (panelId: PanelId) => void;
  updatePreference: (key: string, value: string) => Promise<void>;
  setSettingsOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setDiagnosticsOpen: (open: boolean) => void;
  setAboutOpen: (open: boolean) => void;
  setGoToLocationOpen: (open: boolean) => void;
  setManageFavoritesOpen: (open: boolean) => void;
  setFilterFocusToken: Dispatch<SetStateAction<number>>;
  setActivityCollapsed: (collapsed: boolean) => void;
  markActivityPinnedOpen?: () => void;
}

function resolveCommandId(id: string): string {
  return LEGACY_COMMAND_ALIASES[id] ?? id;
}

export function dispatchCommand(
  id: string,
  deps: CommandDispatchDeps,
): boolean {
  const commandId = resolveCommandId(id);
  const panelId = deps.state.activePanelId;
  const tab = activeTab(deps.state.panels[panelId]);

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
    case "nav.up": {
      const upUri = parentUri(tab.uri);
      if (upUri) void deps.navigatePanel(panelId, upUri);
      return true;
    }
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
      deps.dispatch({ type: "toggleHidden", panelId });
      return true;
    default:
      return false;
  }
}
