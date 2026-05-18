import { COMMAND_DEFINITIONS } from "./registry";
import type { CommandGroup } from "./types";

const GROUP_LABELS: Record<CommandGroup, string> = {
  navigation: "Navigation",
  creation: "Create",
  operation: "File operations",
  view: "View",
  clipboard: "Clipboard",
  selection: "Selection",
  app: "App",
};

const EXCLUDED_COMMAND_IDS = new Set<string>([
  "nav.goToLocation",
  "selection.clear",
]);

export interface ShortcutHelpEntry {
  id: string;
  label: string;
  mac: string;
  windowsLinux: string;
  category: string;
}

const SUPPLEMENTAL_SHORTCUTS: ShortcutHelpEntry[] = [
  {
    id: "switch-pane",
    label: "Switch active pane",
    mac: "Tab",
    windowsLinux: "Tab",
    category: "Navigation",
  },
  {
    id: "path-focus",
    label: "Focus path bar",
    mac: "⌘L",
    windowsLinux: "Ctrl+L",
    category: "Navigation",
  },
  {
    id: "filter",
    label: "Focus current-folder filter",
    mac: "⌘F",
    windowsLinux: "Ctrl+F",
    category: "Navigation",
  },
  {
    id: "recursive-search",
    label: "Focus recursive search",
    mac: "⌘⇧F",
    windowsLinux: "Ctrl+Shift+F",
    category: "Navigation",
  },
  {
    id: "preview",
    label: "Toggle text preview",
    mac: "Space",
    windowsLinux: "Space",
    category: "View",
  },
  {
    id: "dismiss",
    label: "Close dialog, menu, or palette",
    mac: "Esc",
    windowsLinux: "Esc",
    category: "View",
  },
  {
    id: "preview-f3",
    label: "Quick view / properties",
    mac: "F3",
    windowsLinux: "F3",
    category: "File operations",
  },
  {
    id: "edit-f4",
    label: "Open with default app",
    mac: "F4",
    windowsLinux: "F4",
    category: "File operations",
  },
  {
    id: "copy-f5",
    label: "Copy to other pane",
    mac: "F5",
    windowsLinux: "F5",
    category: "File operations",
  },
  {
    id: "move-f6",
    label: "Move to other pane",
    mac: "F6",
    windowsLinux: "F6",
    category: "File operations",
  },
  {
    id: "new-folder-f7",
    label: "New folder",
    mac: "F7",
    windowsLinux: "F7",
    category: "Create",
  },
  {
    id: "delete-f8",
    label: "Move to trash",
    mac: "F8",
    windowsLinux: "F8",
    category: "File operations",
  },
  {
    id: "nav.up-alt",
    label: "Go up one directory",
    mac: "⌥↑",
    windowsLinux: "Alt+↑",
    category: "Navigation",
  },
];

function fromRegistry(): ShortcutHelpEntry[] {
  return COMMAND_DEFINITIONS.filter(
    (command) =>
      !EXCLUDED_COMMAND_IDS.has(command.id) &&
      (command.shortcutMac || command.shortcutWin),
  ).map((command) => ({
    id: command.id,
    label: command.label,
    mac: command.shortcutMac ?? command.shortcutWin ?? "",
    windowsLinux: command.shortcutWin ?? command.shortcutMac ?? "",
    category: GROUP_LABELS[command.group],
  }));
}

export function buildShortcutHelpEntries(): ShortcutHelpEntry[] {
  const byId = new Map<string, ShortcutHelpEntry>();

  for (const entry of [...fromRegistry(), ...SUPPLEMENTAL_SHORTCUTS]) {
    byId.set(entry.id, entry);
  }

  return Array.from(byId.values());
}

export interface ShortcutHelpGroup {
  title: string;
  entries: ShortcutHelpEntry[];
}

export function buildShortcutHelpGroups(): ShortcutHelpGroup[] {
  const groups = buildShortcutHelpEntries().reduce<
    Map<string, ShortcutHelpEntry[]>
  >((acc, entry) => {
    const items = acc.get(entry.category) ?? [];
    items.push(entry);
    acc.set(entry.category, items);
    return acc;
  }, new Map());

  const order = [
    "Navigation",
    "File operations",
    "View",
    "Clipboard",
    "Selection",
    "Create",
    "App",
  ];

  return order
    .filter((title) => groups.has(title))
    .map((title) => ({
      title,
      entries: groups.get(title) ?? [],
    }));
}

export function formatShortcutHelpEntry(entry: ShortcutHelpEntry): string {
  const platform = typeof navigator !== "undefined" ? navigator.platform : "";
  return platform.includes("Mac") ? entry.mac : entry.windowsLinux;
}
