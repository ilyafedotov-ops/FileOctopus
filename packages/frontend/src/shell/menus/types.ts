import { formatCommandShortcut } from "../../commands/registry";
import type { CommandId } from "../../commands/types";
import type { DropdownMenuItem } from "@fileoctopus/ui";

export function menuShortcut(commandId: CommandId): string | undefined {
  const platform =
    typeof navigator !== "undefined" && navigator.platform.startsWith("Mac")
      ? "mac"
      : "windowsLinux";
  return formatCommandShortcut(commandId, platform)?.split(" or ")[0];
}

export function platformShortcut(mac: string, windowsLinux: string): string {
  return typeof navigator !== "undefined" &&
    navigator.platform.startsWith("Mac")
    ? mac
    : windowsLinux;
}

export interface MenuBarProps {
  activePanelId: "left" | "right";
  onBack: () => void;
  onForward: () => void;
  onUp: () => void;
  onHome: () => void;
  onGoToLocation: () => void;
  onVolumePicker: () => void;
  goStandardLocation: (loc: string) => void;
  onNewFolder: () => void;
  onNewFile: () => void;
  onOpenSelected: () => void;
  onView: () => void;
  onEdit: () => void;
  onOpenWithDefaultApp: () => void;
  onRevealInFileManager: () => void;
  onRename: () => void;
  onCopyTo: () => void;
  onMoveTo: () => void;
  onDelete: () => void;
  onTrash: () => void;
  onCompress: () => void;
  onExtract: () => void;
  onDeletePermanently: () => void;
  onProperties: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onClearClipboard: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onInvertSelection: () => void;
  onCopyPath: () => void;
  onCopyName: () => void;
  onCopyParentPath: () => void;
  onCopyResourceUri: () => void;
  onViewMode: (mode: string) => void;
  onSortBy: (field: string) => void;
  onSortDirection: (dir: string) => void;
  onTheme: (theme: string) => void;
  onDensity: (density: string) => void;
  onToggleSidebar: () => void;
  onToggleToolbar: () => void;
  onToggleStatusBar: () => void;
  onToggleDualPane: () => void;
  onTogglePaneDirection: () => void;
  onToggleHidden: () => void;
  onRefresh: () => void;
  onAddFavorite: () => void;
  onManageFavorites: () => void;
  onNetworkLocations: () => void;
  onAddServer: () => void;
  onShowRecentLocations: () => void;
  onClearRecentLocations: () => void;
  recentLocations: ReadonlyArray<{ uri: string; label: string }>;
  starredLocations: ReadonlyArray<{ uri: string; label: string }>;
  onFilter: () => void;
  onSearchRecursive: () => void;
  onChecksum: () => void;
  onOpenTerminal: () => void;
  onOpenTerminalExternal: () => void;
  onToggleTerminal: () => void;
  onCalculateSize: () => void;
  onJobActivity: () => void;
  onOperationHistory: () => void;
  onDiagnostics: () => void;
  onExportDiagnostics: () => void;
  onSwitchPane: () => void;
  onSwapPanes: () => void;
  onEqualizePanes: () => void;
  onShortcuts: () => void;
  onDocumentation: () => void;
  onAbout: () => void;
  onSettings: () => void;
  onExit: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  hasSelection: boolean;
  hasClipboard: boolean;
  sidebarVisible: boolean;
  toolbarVisible: boolean;
  statusBarVisible: boolean;
  dualPane: boolean;
  paneDirection: string;
  showHidden: boolean;
  viewMode: string;
  sortField: string;
  sortDirection: string;
  theme: string;
  density: string;
  onCustomizeToolbar: () => void;
}

export type MenuId =
  | "file"
  | "edit"
  | "view"
  | "go"
  | "tools"
  | "window"
  | "help";

export const MENU_ORDER: MenuId[] = [
  "file",
  "edit",
  "view",
  "go",
  "tools",
  "window",
  "help",
];

export const MENU_MNEMONICS: Record<MenuId, string> = {
  file: "F",
  edit: "E",
  view: "V",
  go: "G",
  tools: "T",
  window: "W",
  help: "H",
};

export interface MenuHelpers {
  wrap: (fn: () => void) => () => void;
  wrapArg: (fn: (arg: string) => void, arg: string) => () => void;
  sep: (id: string) => DropdownMenuItem;
}
