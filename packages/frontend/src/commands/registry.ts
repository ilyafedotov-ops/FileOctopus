import type { CommandDefinition, CommandGroup, CommandId } from "./types";

export const COMMAND_DEFINITIONS: CommandDefinition[] = [
  {
    id: "nav.back",
    label: "Back",
    group: "navigation",
    shortcutMac: "⌥←",
    shortcutWin: "Alt+←",
  },
  {
    id: "nav.forward",
    label: "Forward",
    group: "navigation",
    shortcutMac: "⌥→",
    shortcutWin: "Alt+→",
  },
  {
    id: "nav.up",
    label: "Up",
    group: "navigation",
    shortcutMac: "Backspace",
    shortcutWin: "Backspace",
  },
  {
    id: "nav.refresh",
    label: "Refresh",
    group: "navigation",
    shortcutMac: "⌘R",
    shortcutWin: "Ctrl+R",
  },
  {
    id: "nav.home",
    label: "Home",
    group: "navigation",
  },
  {
    id: "nav.goToLocation",
    label: "Go to Location…",
    group: "navigation",
    shortcutMac: "⌘L",
    shortcutWin: "Ctrl+L",
  },
  {
    id: "nav.manageFavorites",
    label: "Manage Favorites…",
    group: "navigation",
  },
  {
    id: "create.folder",
    label: "New Folder",
    group: "creation",
    shortcutMac: "⌘⇧N",
    shortcutWin: "Ctrl+Shift+N",
  },
  {
    id: "create.file",
    label: "New File",
    group: "creation",
  },
  {
    id: "op.copy",
    label: "Copy",
    group: "operation",
    shortcutMac: "⌘C",
    shortcutWin: "Ctrl+C",
  },
  {
    id: "op.cut",
    label: "Cut",
    group: "operation",
    shortcutMac: "⌘X",
    shortcutWin: "Ctrl+X",
  },
  {
    id: "op.paste",
    label: "Paste",
    group: "operation",
    shortcutMac: "⌘V",
    shortcutWin: "Ctrl+V",
  },
  {
    id: "op.copyTo",
    label: "Copy To…",
    group: "operation",
  },
  {
    id: "op.moveTo",
    label: "Move To…",
    group: "operation",
  },
  {
    id: "op.rename",
    label: "Rename",
    group: "operation",
    shortcutMac: "F2",
    shortcutWin: "F2",
  },
  {
    id: "op.trash",
    label: "Move to Trash",
    group: "operation",
    shortcutMac: "Delete",
    shortcutWin: "Delete",
  },
  {
    id: "op.deletePermanent",
    label: "Delete Permanently",
    group: "operation",
    shortcutMac: "⇧Delete",
    shortcutWin: "Shift+Delete",
    destructive: true,
  },
  {
    id: "op.properties",
    label: "Properties",
    group: "operation",
  },
  {
    id: "op.reveal",
    label: "Reveal in System File Manager",
    group: "operation",
  },
  {
    id: "op.open",
    label: "Open",
    group: "operation",
    shortcutMac: "Return",
    shortcutWin: "Enter",
  },
  {
    id: "op.openDefault",
    label: "Open With Default App",
    group: "operation",
  },
  {
    id: "view.details",
    label: "Details",
    group: "view",
  },
  {
    id: "view.list",
    label: "List",
    group: "view",
  },
  {
    id: "view.compact",
    label: "Compact",
    group: "view",
  },
  {
    id: "view.icons",
    label: "Icons",
    group: "view",
  },
  {
    id: "view.columns",
    label: "Columns",
    group: "view",
  },
  {
    id: "view.toggleHidden",
    label: "Show Hidden Files",
    group: "view",
  },
  {
    id: "view.toggleSidebar",
    label: "Toggle Sidebar",
    group: "view",
  },
  {
    id: "view.toggleDualPane",
    label: "Toggle Dual Pane",
    group: "view",
  },
  {
    id: "view.toggleStatusBar",
    label: "Toggle Status Bar",
    group: "view",
  },
  {
    id: "view.toggleActivity",
    label: "Jobs & Activity",
    group: "view",
  },
  {
    id: "selection.selectAll",
    label: "Select All",
    group: "selection",
    shortcutMac: "⌘A",
    shortcutWin: "Ctrl+A",
  },
  {
    id: "selection.clear",
    label: "Clear Selection",
    group: "selection",
    shortcutMac: "Escape",
    shortcutWin: "Escape",
  },
  {
    id: "selection.invert",
    label: "Invert Selection",
    group: "selection",
  },
  {
    id: "clipboard.copyPath",
    label: "Copy Full Path",
    group: "clipboard",
  },
  {
    id: "clipboard.copyName",
    label: "Copy File Name",
    group: "clipboard",
  },
  {
    id: "clipboard.copyParent",
    label: "Copy Parent Folder Path",
    group: "clipboard",
  },
  {
    id: "clipboard.copyUri",
    label: "Copy Resource URI",
    group: "clipboard",
  },
  {
    id: "clipboard.clear",
    label: "Clear File Clipboard",
    group: "clipboard",
  },
  {
    id: "app.settings",
    label: "Settings",
    group: "app",
    shortcutMac: "⌘,",
    shortcutWin: "Ctrl+,",
  },
  {
    id: "app.shortcuts",
    label: "Keyboard Shortcuts",
    group: "app",
    shortcutMac: "⌘/",
    shortcutWin: "Ctrl+/",
  },
  {
    id: "app.diagnostics",
    label: "Diagnostics",
    group: "app",
  },
  {
    id: "app.commandPalette",
    label: "Command Palette",
    group: "app",
    shortcutMac: "⌘P",
    shortcutWin: "Ctrl+P",
  },
  {
    id: "app.about",
    label: "About FileOctopus",
    group: "app",
  },
];

const byId = new Map<CommandId, CommandDefinition>(
  COMMAND_DEFINITIONS.map((command) => [command.id, command]),
);

export function getCommand(id: CommandId): CommandDefinition {
  const command = byId.get(id);
  if (!command) {
    throw new Error(`Unknown command: ${id}`);
  }
  return command;
}

export function commandsInGroup(group: CommandGroup): CommandDefinition[] {
  return COMMAND_DEFINITIONS.filter((command) => command.group === group);
}

export const TOOLBAR_GROUPS: CommandGroup[] = [
  "navigation",
  "creation",
  "operation",
  "view",
];

export function formatCommandShortcut(
  id: CommandId,
  platform: "mac" | "windowsLinux" = "windowsLinux",
): string | undefined {
  const command = byId.get(id);
  if (!command) {
    return undefined;
  }
  return platform === "mac" ? command.shortcutMac : command.shortcutWin;
}
