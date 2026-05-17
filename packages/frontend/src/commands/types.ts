export type CommandGroup =
  | "navigation"
  | "creation"
  | "operation"
  | "view"
  | "clipboard"
  | "selection"
  | "app";

export type CommandId =
  | "nav.back"
  | "nav.forward"
  | "nav.up"
  | "nav.refresh"
  | "nav.home"
  | "nav.goToLocation"
  | "nav.manageFavorites"
  | "create.folder"
  | "create.file"
  | "op.copy"
  | "op.cut"
  | "op.paste"
  | "op.copyTo"
  | "op.moveTo"
  | "op.rename"
  | "op.trash"
  | "op.deletePermanent"
  | "op.properties"
  | "op.reveal"
  | "op.open"
  | "op.openDefault"
  | "view.details"
  | "view.list"
  | "view.compact"
  | "view.icons"
  | "view.columns"
  | "view.toggleHidden"
  | "view.toggleSidebar"
  | "view.toggleDualPane"
  | "view.toggleStatusBar"
  | "view.toggleActivity"
  | "selection.selectAll"
  | "selection.clear"
  | "selection.invert"
  | "clipboard.copyPath"
  | "clipboard.copyName"
  | "clipboard.copyParent"
  | "clipboard.copyUri"
  | "clipboard.clear"
  | "app.settings"
  | "app.shortcuts"
  | "app.diagnostics"
  | "app.commandPalette"
  | "app.about"
  | "app.operationHistory";

export interface CommandDefinition {
  id: CommandId;
  label: string;
  group: CommandGroup;
  shortcutMac?: string;
  shortcutWin?: string;
  destructive?: boolean;
}
