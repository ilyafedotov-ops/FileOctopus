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
};

const PALETTE_EXCLUDED = new Set<string>([
  "app.commandPalette",
  "view.sort",
  "view.sortAscending",
  "view.sortDescending",
  "preferences.theme",
  "preferences.density",
  "layout.switchPane",
  "layout.equalizePanes",
]);

const PALETTE_LEGACY: CommandEntry[] = [
  {
    id: "switch-pane",
    label: "Switch Active Pane",
    shortcutKey: "Ctrl+Tab",
    category: "View",
  },
  {
    id: "filter",
    label: "Filter Current Folder",
    shortcutKey: "Ctrl+F",
    category: "View",
  },
];

export function buildPaletteEntries(): CommandEntry[] {
  const fromRegistry = COMMAND_DEFINITIONS.filter(
    (command) => !PALETTE_EXCLUDED.has(command.id),
  ).map((command) => ({
    id: command.id,
    label: command.label,
    shortcutKey: formatCommandShortcut(command.id, "windowsLinux"),
    category: GROUP_LABELS[command.group],
  }));

  return [...fromRegistry, ...PALETTE_LEGACY];
}
