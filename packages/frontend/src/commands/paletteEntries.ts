import type { CommandEntry } from "../components/CommandPalette";
import { COMMAND_DEFINITIONS, formatCommandShortcut } from "./registry";
import type { CommandGroup } from "./types";

const GROUP_LABELS: Record<CommandGroup, string> = {
  navigation: "Navigation",
  creation: "Create",
  operation: "Operations",
  view: "View",
  clipboard: "Clipboard",
  selection: "Selection",
  app: "App",
  tools: "Tools",
  git: "Git",
};

const PALETTE_EXCLUDED = new Set<string>([
  "app.commandPalette",
  "view.sort",
  "view.sortAscending",
  "view.sortDescending",
  "preferences.theme",
  "preferences.density",
  "preferences.accentColor",
  "preferences.fontScale",
  "preferences.iconScale",
  "layout.switchPane",
  "layout.equalizePanes",
  "nav.openUri",
  "nav.revealUri",
  "nav.removeFavorite",
  "nav.renameFavorite",
]);

function palettePlatform(): "mac" | "windowsLinux" {
  return typeof navigator !== "undefined" &&
    navigator.platform.startsWith("Mac")
    ? "mac"
    : "windowsLinux";
}

function legacyEntries(): CommandEntry[] {
  const mac = palettePlatform() === "mac";
  return [
    {
      id: "switch-pane",
      label: "Switch Active Pane",
      shortcutKey: mac ? "⌃Tab" : "Ctrl+Tab",
      category: "View",
    },
    {
      id: "filter",
      label: "Filter Current Folder",
      shortcutKey: mac ? "⌘F" : "Ctrl+F",
      category: "View",
    },
  ];
}

export function buildPaletteEntries(): CommandEntry[] {
  const platform = palettePlatform();
  const fromRegistry = COMMAND_DEFINITIONS.filter(
    (command) => !PALETTE_EXCLUDED.has(command.id),
  ).map((command) => ({
    id: command.id,
    label: command.label,
    shortcutKey: formatCommandShortcut(command.id, platform)?.split(" or ")[0],
    category: GROUP_LABELS[command.group],
  }));

  return [...fromRegistry, ...legacyEntries()];
}
