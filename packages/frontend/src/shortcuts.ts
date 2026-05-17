import {
  buildShortcutHelpEntries,
  buildShortcutHelpGroups,
  formatShortcutHelpEntry,
  type ShortcutHelpEntry,
} from "./commands/shortcutHelp";

export type ShortcutEntry = ShortcutHelpEntry;

export const shortcutEntries = buildShortcutHelpEntries();
export const shortcutGroups = buildShortcutHelpGroups();

export function formatShortcut(entry: ShortcutEntry): string {
  return formatShortcutHelpEntry(entry);
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
