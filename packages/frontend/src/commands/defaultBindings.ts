import type { KeyCombo } from "./keyCombo";
import { parseKeyCombo } from "./keyCombo";
import { COMMAND_REGISTRY } from "./registryData";

export interface KeyBinding {
  commandId: string;
  combos: KeyCombo[];
}

function parseShortcutString(str: string | undefined): KeyCombo[] {
  if (!str) return [];
  const combos: KeyCombo[] = [];
  const parts = str.split(" or ").map((p) => p.trim());
  for (const part of parts) {
    const normalized = part
      .replace(/⌘/g, "Meta+")
      .replace(/⌥/g, "Alt+")
      .replace(/⇧/g, "Shift+")
      .replace(/⌃/g, "Ctrl+");
    const combo = parseKeyCombo(normalized);
    if (combo) combos.push(combo);
  }
  return combos;
}

function addOrExtendBinding(
  bindings: KeyBinding[],
  commandId: string,
  comboStrings: string[],
): void {
  const combos: KeyCombo[] = [];
  for (const str of comboStrings) {
    const combo = parseKeyCombo(str);
    if (combo) combos.push(combo);
  }
  if (combos.length === 0) return;
  const existing = bindings.find((b) => b.commandId === commandId);
  if (existing) {
    existing.combos = combos;
  } else {
    bindings.push({ commandId, combos });
  }
}

export function buildDefaultBindings(): KeyBinding[] {
  const bindings: KeyBinding[] = [];

  for (const cmd of COMMAND_REGISTRY) {
    const shortcutStr = "shortcutWin" in cmd ? cmd.shortcutWin : undefined;
    const combos = parseShortcutString(shortcutStr);
    if (combos.length > 0) {
      bindings.push({ commandId: cmd.id, combos });
    }
  }

  bindings.push({
    commandId: "search.focusFilter",
    combos: parseKeyCombo("Ctrl+F") ? [parseKeyCombo("Ctrl+F")!] : [],
  });

  bindings.push({
    commandId: "search.recursive",
    combos: parseKeyCombo("Ctrl+Shift+F")
      ? [parseKeyCombo("Ctrl+Shift+F")!]
      : [],
  });

  bindings.push({
    commandId: "op.delete",
    combos: parseKeyCombo("Delete") ? [parseKeyCombo("Delete")!] : [],
  });

  // Commander function-key bar: F1 Help and F10 Menu close the Norton layout.
  // mergeBindings (and the registry loop) dedupe by commandId with last-wins,
  // so these entries restate the registry combos alongside the new F-keys.
  addOrExtendBinding(bindings, "app.shortcuts", ["Ctrl+/", "F1"]);
  addOrExtendBinding(bindings, "app.commandPalette", [
    "Ctrl+P",
    "Ctrl+Shift+P",
    "F10",
  ]);

  return bindings;
}

export const DEFAULT_KEY_BINDINGS = buildDefaultBindings();
