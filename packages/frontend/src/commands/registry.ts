import type {
  CommandDefinition,
  CommandGroup,
  CommandId,
  CommandSurface,
} from "./types";
import { COMMAND_REGISTRY } from "./registryData";

export const COMMAND_DEFINITIONS: readonly CommandDefinition[] =
  COMMAND_REGISTRY as unknown as readonly CommandDefinition[];

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

/**
 * Return commands that should appear on a given surface.
 * Uses the explicit `surfaces` field when present; otherwise falls back
 * to the legacy group-based filtering for backward compatibility.
 *
 * UPP-B1: Surface-aware command discovery.
 */
export function commandsForSurface(
  surface: CommandSurface,
): CommandDefinition[] {
  return COMMAND_DEFINITIONS.filter((cmd) => {
    if (cmd.surfaces) {
      return cmd.surfaces.includes(surface);
    }
    // Legacy fallback: toolbar gets TOOLBAR_GROUPS, palette & menu get everything
    if (surface === "toolbar") return TOOLBAR_GROUPS.includes(cmd.group);
    if (surface === "fkey") return FKEY_COMMAND_IDS.has(cmd.id);
    return true;
  });
}

/**
 * Commander-style function-key commands (classic TC/Norton mapping).
 */
const FKEY_COMMAND_IDS: ReadonlySet<string> = new Set([
  "op.view", // F3
  "op.edit", // F4
  "op.copyTo", // F5
  "op.moveTo", // F6
  "create.folder", // F7
  "op.trash", // F8
  "op.rename", // F2 (often shown on function bar)
  "app.settings", // F10 → Settings/Exit
]);

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
