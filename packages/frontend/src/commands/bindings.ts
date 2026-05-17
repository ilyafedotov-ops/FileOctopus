import type { CommandId } from "./types";

export type CommandBindingTarget =
  | "menu"
  | "toolbar"
  | "context"
  | "palette"
  | "shortcut";

export interface CommandBinding {
  commandId: CommandId;
  targets: CommandBindingTarget[];
}

export const COMMAND_BINDINGS: CommandBinding[] = [
  { commandId: "nav.goToLocation", targets: ["menu", "palette"] },
  { commandId: "nav.manageFavorites", targets: ["menu"] },
  { commandId: "app.operationHistory", targets: ["menu", "palette"] },
  { commandId: "view.toggleSidebar", targets: ["menu", "palette"] },
  { commandId: "view.toggleDualPane", targets: ["menu"] },
  {
    commandId: "op.rename",
    targets: ["menu", "toolbar", "context", "shortcut"],
  },
  { commandId: "op.properties", targets: ["menu", "toolbar", "context"] },
  { commandId: "op.copy", targets: ["menu", "toolbar", "context", "shortcut"] },
  { commandId: "op.cut", targets: ["menu", "toolbar", "context", "shortcut"] },
  {
    commandId: "op.paste",
    targets: ["menu", "toolbar", "context", "shortcut"],
  },
  { commandId: "op.trash", targets: ["menu", "toolbar", "context"] },
];

export function commandTargets(commandId: CommandId): CommandBindingTarget[] {
  return (
    COMMAND_BINDINGS.find((binding) => binding.commandId === commandId)
      ?.targets ?? []
  );
}
