import type { CommandId } from "./types";
import {
  COMMAND_DEFINITIONS,
  commandsForSurface,
  formatCommandShortcut,
  getCommand,
} from "./registry";

export type ToolbarEntry =
  | { kind: "command"; commandId: CommandId }
  | { kind: "separator" };

export interface ToolbarCommandMeta {
  commandId: CommandId;
  label: string;
  tooltip: string;
}

const TOOLBAR_LABELS: Partial<Record<CommandId, string>> = {
  "op.view": "View",
  "op.edit": "Edit",
  "op.openDefault": "Open",
  "op.copyTo": "Copy",
  "op.moveTo": "Move",
  "create.folder": "New Folder",
  "op.delete": "Delete",
  "op.properties": "Props",
};

const TOOLBAR_DESCRIPTIONS: Partial<Record<CommandId, string>> = {
  "op.view": "View selected item",
  "op.edit": "Edit selected file in built-in editor",
  "op.openDefault": "Open selected file with system default app",
  "op.rename": "Rename selected item",
  "op.copyTo": "Copy selected items to the opposite pane",
  "op.moveTo": "Move selected items to the opposite pane",
  "create.folder": "Create a new folder in the active pane",
  "op.delete": "Delete selected items",
  "op.properties": "Show properties for selected item",
  "op.compress": "Create archive from selection",
  "op.extract": "Extract selected archive",
  "search.recursive": "Open recursive search for the active pane",
  "search.focusFilter": "Focus quick filter for the active pane",
  "op.openTerminal": "Open embedded terminal in this folder",
  "op.openTerminalExternal": "Open this folder in the system terminal",
  "terminal.runCommand": "Run a command in the active terminal",
  "terminal.spawnAndRun": "Spawn a terminal in this folder and run a command",
  "view.toggleActivity": "Open jobs and activity panel",
  "app.settings": "Open application settings",
  "nav.home": "Go to home directory",
  "nav.root": "Go to filesystem root",
  "nav.volumePicker": "Open drives and volumes",
};

export const DEFAULT_TOOLBAR_ENTRIES: ToolbarEntry[] = [
  { kind: "command", commandId: "op.view" },
  { kind: "command", commandId: "op.edit" },
  { kind: "command", commandId: "op.openDefault" },
  { kind: "command", commandId: "op.rename" },
  { kind: "command", commandId: "op.copyTo" },
  { kind: "command", commandId: "op.moveTo" },
  { kind: "command", commandId: "create.folder" },
  { kind: "command", commandId: "op.delete" },
  { kind: "command", commandId: "op.properties" },
];

const TOOLBAR_STORAGE_KEY = "fileoctopus.toolbarEntries";

const FIXED_NAV_COMMANDS = new Set<CommandId>([
  "nav.back",
  "nav.forward",
  "nav.up",
  "nav.root",
  "nav.home",
  "nav.volumePicker",
  "nav.refresh",
]);

function toolbarPlatform(): "mac" | "windowsLinux" {
  if (typeof navigator === "undefined") {
    return "windowsLinux";
  }
  return navigator.platform.startsWith("Mac") ? "mac" : "windowsLinux";
}

export function toolbarCommandMeta(commandId: CommandId): ToolbarCommandMeta {
  const command = getCommand(commandId);
  const label = TOOLBAR_LABELS[commandId] ?? command.label;
  const description =
    TOOLBAR_DESCRIPTIONS[commandId] ?? `${command.label} command`;
  const shortcut = formatCommandShortcut(commandId, toolbarPlatform());
  const tooltip = shortcut ? `${description} (${shortcut})` : description;
  return {
    commandId,
    label,
    tooltip,
  };
}

export function customizableToolbarCommands(): ToolbarCommandMeta[] {
  const seen = new Set<CommandId>();
  const toolbarCommandIds = new Set(
    commandsForSurface("toolbar").map((cmd) => cmd.id),
  );
  return COMMAND_DEFINITIONS.filter((command) => {
    if (FIXED_NAV_COMMANDS.has(command.id)) {
      return false;
    }
    if (
      command.id === "app.commandPalette" ||
      command.id === "search.recursive" ||
      command.id === "search.focusFilter" ||
      command.id === "view.toggleActivity" ||
      command.id === "app.settings" ||
      command.id === "op.compress" ||
      command.id === "op.extract" ||
      command.id === "op.openTerminal"
    ) {
      return false;
    }
    return toolbarCommandIds.has(command.id);
  })
    .map((command) => toolbarCommandMeta(command.id))
    .filter((meta) => {
      if (seen.has(meta.commandId)) {
        return false;
      }
      seen.add(meta.commandId);
      return true;
    });
}

function isCommandId(value: string): value is CommandId {
  return COMMAND_DEFINITIONS.some((command) => command.id === value);
}

function parseEntry(raw: unknown): ToolbarEntry | null {
  if (
    raw === "separator" ||
    (typeof raw === "object" && raw && "kind" in raw)
  ) {
    if (raw === "separator") {
      return { kind: "separator" };
    }
    const entry = raw as { kind?: string; commandId?: string };
    if (entry.kind === "separator") {
      return { kind: "separator" };
    }
    if (
      entry.kind === "command" &&
      entry.commandId &&
      isCommandId(entry.commandId)
    ) {
      return { kind: "command", commandId: entry.commandId };
    }
  }
  if (typeof raw === "string" && isCommandId(raw)) {
    return { kind: "command", commandId: raw };
  }
  return null;
}

export function normalizeToolbarEntries(
  entries: ToolbarEntry[],
): ToolbarEntry[] {
  const normalized: ToolbarEntry[] = [];
  for (const entry of entries) {
    if (entry.kind === "separator") {
      if (normalized[normalized.length - 1]?.kind === "separator") {
        continue;
      }
      normalized.push(entry);
      continue;
    }
    if (
      normalized.some(
        (item) => item.kind === "command" && item.commandId === entry.commandId,
      )
    ) {
      continue;
    }
    normalized.push(entry);
  }
  while (normalized[0]?.kind === "separator") {
    normalized.shift();
  }
  while (normalized[normalized.length - 1]?.kind === "separator") {
    normalized.pop();
  }
  return normalized.length > 0 ? normalized : [...DEFAULT_TOOLBAR_ENTRIES];
}

export function readStoredToolbarEntries(): ToolbarEntry[] {
  if (typeof window === "undefined") {
    return [...DEFAULT_TOOLBAR_ENTRIES];
  }
  try {
    const raw = window.localStorage.getItem(TOOLBAR_STORAGE_KEY);
    if (!raw) {
      return [...DEFAULT_TOOLBAR_ENTRIES];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_TOOLBAR_ENTRIES];
    }
    const entries = parsed
      .map((item) => parseEntry(item))
      .filter((item): item is ToolbarEntry => item !== null);
    return normalizeToolbarEntries(entries);
  } catch {
    return [...DEFAULT_TOOLBAR_ENTRIES];
  }
}

export function writeStoredToolbarEntries(entries: ToolbarEntry[]): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    TOOLBAR_STORAGE_KEY,
    JSON.stringify(normalizeToolbarEntries(entries)),
  );
}

export function clearStoredToolbarEntries(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(TOOLBAR_STORAGE_KEY);
}

export function parseToolbarEntriesJson(
  raw: string | undefined | null,
): ToolbarEntry[] | null {
  if (!raw?.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }
    const entries = parsed
      .map((item) => parseEntry(item))
      .filter((item): item is ToolbarEntry => item !== null);
    return normalizeToolbarEntries(entries);
  } catch {
    return null;
  }
}

export function toolbarEntriesFromPreference(
  raw: string | undefined | null,
): ToolbarEntry[] {
  return parseToolbarEntriesJson(raw) ?? [...DEFAULT_TOOLBAR_ENTRIES];
}
