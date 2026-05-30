import { COMMAND_REGISTRY } from "./registryData";

export type CommandId = (typeof COMMAND_REGISTRY)[number]["id"];

export type CommandGroup = (typeof COMMAND_REGISTRY)[number]["group"];

/**
 * UI surfaces where a command may appear.
 * Used to drive toolbar buttons, menu items, function-key bar,
 * command palette, and context menus from a single source of truth.
 *
 * UPP-B1: Command surface model for premium polish.
 */
export type CommandSurface =
  | "toolbar" // Toolbar / command strip
  | "menu" // Top menu bar
  | "fkey" // Function-key bar (F5=Copy, F6=Move, etc.)
  | "palette" // Command palette (Ctrl+P)
  | "context"; // Right-click context menu

export interface CommandDefinition {
  readonly id: CommandId;
  readonly label: string;
  readonly group: CommandGroup;
  readonly shortcutMac?: string;
  readonly shortcutWin?: string;
  readonly destructive?: boolean;
  /** Surfaces where this command should appear. Omit or leave undefined to use legacy group-based filtering. */
  readonly surfaces?: readonly CommandSurface[];
}
