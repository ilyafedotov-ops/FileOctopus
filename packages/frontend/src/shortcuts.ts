export interface ShortcutEntry {
  id: string;
  label: string;
  mac: string;
  windowsLinux: string;
  category: string;
}

export const shortcutEntries: ShortcutEntry[] = [
  {
    id: "switch-pane",
    label: "Switch active pane",
    mac: "Tab",
    windowsLinux: "Tab",
    category: "Navigation",
  },
  {
    id: "open",
    label: "Open selected item",
    mac: "Return",
    windowsLinux: "Enter",
    category: "Navigation",
  },
  {
    id: "up",
    label: "Go up one directory",
    mac: "Backspace or ⌥↑",
    windowsLinux: "Backspace or Alt+↑",
    category: "Navigation",
  },
  {
    id: "back",
    label: "Go back",
    mac: "⌥←",
    windowsLinux: "Alt+←",
    category: "Navigation",
  },
  {
    id: "forward",
    label: "Go forward",
    mac: "⌥→",
    windowsLinux: "Alt+→",
    category: "Navigation",
  },
  {
    id: "path",
    label: "Focus path bar",
    mac: "⌘L",
    windowsLinux: "Ctrl+L",
    category: "Navigation",
  },
  {
    id: "filter",
    label: "Focus search / filter",
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
    id: "preferences",
    label: "Open Preferences",
    mac: "⌘,",
    windowsLinux: "Ctrl+,",
    category: "Navigation",
  },
  {
    id: "shortcuts-help",
    label: "Keyboard shortcuts",
    mac: "⌘/",
    windowsLinux: "Ctrl+/",
    category: "Navigation",
  },
  {
    id: "toggle-hidden",
    label: "Toggle hidden files",
    mac: "⌘.",
    windowsLinux: "Ctrl+.",
    category: "View",
  },
  {
    id: "dismiss",
    label: "Close dialog or menu",
    mac: "Esc",
    windowsLinux: "Esc",
    category: "View",
  },
  {
    id: "copy",
    label: "Copy selection",
    mac: "⌘C",
    windowsLinux: "Ctrl+C",
    category: "File operations",
  },
  {
    id: "cut",
    label: "Cut selection",
    mac: "⌘X",
    windowsLinux: "Ctrl+X",
    category: "File operations",
  },
  {
    id: "paste",
    label: "Paste",
    mac: "⌘V",
    windowsLinux: "Ctrl+V",
    category: "File operations",
  },
  {
    id: "rename",
    label: "Rename",
    mac: "F2",
    windowsLinux: "F2",
    category: "File operations",
  },
  {
    id: "new-folder",
    label: "New folder",
    mac: "⌘N",
    windowsLinux: "Ctrl+N",
    category: "File operations",
  },
  {
    id: "trash",
    label: "Move to trash",
    mac: "Delete",
    windowsLinux: "Delete",
    category: "File operations",
  },
  {
    id: "delete",
    label: "Delete permanently",
    mac: "⇧Delete",
    windowsLinux: "Shift+Delete",
    category: "File operations",
  },
  {
    id: "refresh",
    label: "Refresh pane",
    mac: "⌘R or F5",
    windowsLinux: "Ctrl+R or F5",
    category: "View",
  },
  {
    id: "select-all",
    label: "Select all",
    mac: "⌘A",
    windowsLinux: "Ctrl+A",
    category: "View",
  },
];

export const shortcutGroups = Array.from(
  shortcutEntries.reduce<Map<string, ShortcutEntry[]>>((groups, entry) => {
    const items = groups.get(entry.category) ?? [];
    items.push(entry);
    groups.set(entry.category, items);
    return groups;
  }, new Map()),
).map(([title, entries]) => ({ title, entries }));

export function formatShortcut(entry: ShortcutEntry): string {
  const platform = typeof navigator !== "undefined" ? navigator.platform : "";
  return platform.includes("Mac") ? entry.mac : entry.windowsLinux;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName.toLowerCase();

  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}
