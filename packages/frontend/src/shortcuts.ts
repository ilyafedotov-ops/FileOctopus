export interface ShortcutEntry {
  id: string;
  label: string;
  mac: string;
  windowsLinux: string;
}

export const shortcutEntries: ShortcutEntry[] = [
  { id: "switch-pane", label: "Switch active pane", mac: "Tab", windowsLinux: "Tab" },
  { id: "open", label: "Open selected item", mac: "Return", windowsLinux: "Enter" },
  { id: "up", label: "Go up one directory", mac: "Backspace or ⌥↑", windowsLinux: "Backspace or Alt+↑" },
  { id: "back", label: "Go back", mac: "⌥←", windowsLinux: "Alt+←" },
  { id: "forward", label: "Go forward", mac: "⌥→", windowsLinux: "Alt+→" },
  { id: "copy", label: "Copy selection", mac: "⌘C", windowsLinux: "Ctrl+C" },
  { id: "cut", label: "Cut selection", mac: "⌘X", windowsLinux: "Ctrl+X" },
  { id: "paste", label: "Paste", mac: "⌘V", windowsLinux: "Ctrl+V" },
  { id: "rename", label: "Rename", mac: "F2", windowsLinux: "F2" },
  { id: "refresh", label: "Refresh pane", mac: "⌘R or F5", windowsLinux: "Ctrl+R or F5" },
  { id: "path", label: "Focus path bar", mac: "⌘L", windowsLinux: "Ctrl+L" },
  { id: "filter", label: "Focus filter", mac: "⌘F", windowsLinux: "Ctrl+F" },
  { id: "new-folder", label: "New folder", mac: "⌘N", windowsLinux: "Ctrl+N" },
  { id: "trash", label: "Move to trash", mac: "Delete", windowsLinux: "Delete" },
  {
    id: "delete",
    label: "Delete permanently",
    mac: "⇧Delete",
    windowsLinux: "Shift+Delete",
  },
  { id: "select-all", label: "Select all", mac: "⌘A", windowsLinux: "Ctrl+A" },
];

export function formatShortcut(entry: ShortcutEntry): string {
  const platform =
    typeof navigator !== "undefined" ? navigator.platform : "";
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
