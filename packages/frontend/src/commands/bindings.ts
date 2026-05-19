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
  { commandId: "op.view", targets: ["menu", "toolbar", "context"] },
  { commandId: "op.properties", targets: ["menu", "toolbar", "context"] },
  { commandId: "op.openDefault", targets: ["menu", "toolbar", "context"] },
  { commandId: "op.copyTo", targets: ["menu", "toolbar", "context"] },
  { commandId: "op.moveTo", targets: ["menu", "toolbar", "context"] },
  {
    commandId: "create.folder",
    targets: ["menu", "toolbar", "context", "shortcut"],
  },
  { commandId: "create.file", targets: ["menu", "toolbar", "context"] },
  { commandId: "nav.home", targets: ["menu", "toolbar", "palette"] },
  { commandId: "nav.root", targets: ["menu", "toolbar"] },
  { commandId: "nav.volumePicker", targets: ["menu", "toolbar"] },
  { commandId: "nav.refresh", targets: ["menu", "toolbar", "shortcut"] },
  { commandId: "search.recursive", targets: ["menu", "toolbar", "palette"] },
  { commandId: "search.focusFilter", targets: ["toolbar", "palette"] },
  { commandId: "op.copy", targets: ["menu", "toolbar", "context", "shortcut"] },
  { commandId: "op.cut", targets: ["menu", "toolbar", "context", "shortcut"] },
  {
    commandId: "op.paste",
    targets: ["menu", "toolbar", "context", "shortcut"],
  },
  { commandId: "op.trash", targets: ["menu", "toolbar", "context"] },
  { commandId: "op.compress", targets: ["toolbar", "context"] },
  { commandId: "op.extract", targets: ["toolbar", "context"] },
  { commandId: "op.checksum", targets: ["toolbar", "context"] },
  { commandId: "op.openTerminal", targets: ["toolbar", "context", "menu"] },
  {
    commandId: "op.openTerminalExternal",
    targets: ["toolbar", "menu", "context"],
  },
  { commandId: "view.toggleTerminal", targets: ["menu", "palette"] },
  { commandId: "op.calculateSize", targets: ["toolbar"] },
  { commandId: "op.reveal", targets: ["toolbar", "context"] },
  { commandId: "view.toggleActivity", targets: ["menu", "toolbar"] },
  { commandId: "layout.equalizePanes", targets: ["menu", "toolbar"] },
  { commandId: "layout.swapPanes", targets: ["menu", "toolbar"] },
  { commandId: "app.settings", targets: ["menu", "toolbar"] },
  { commandId: "app.customizeToolbar", targets: ["menu", "palette"] },
  { commandId: "nav.addFavorite", targets: ["context"] },
  { commandId: "op.toggleStarred", targets: ["context"] },
];

export function commandTargets(commandId: CommandId): CommandBindingTarget[] {
  return (
    COMMAND_BINDINGS.find((binding) => binding.commandId === commandId)
      ?.targets ?? []
  );
}
