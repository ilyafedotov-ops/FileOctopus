import type { CommandId } from "./types";

export interface ToolbarCommandContext {
  selectedCount: number;
  canRename: boolean;
  canPaste: boolean;
  canView: boolean;
  canEdit: boolean;
}

export function isToolbarCommandDisabled(
  commandId: CommandId,
  ctx: ToolbarCommandContext,
): boolean {
  if (commandId === "op.view") {
    return false;
  }
  if (commandId === "op.edit" || commandId === "op.openDefault") {
    return !ctx.canEdit;
  }
  if (commandId === "op.rename") {
    return !ctx.canRename;
  }
  if (commandId === "op.paste") {
    return !ctx.canPaste;
  }
  if (commandId === "op.properties") {
    return ctx.selectedCount === 0;
  }

  const needsSelection =
    commandId === "op.copy" ||
    commandId === "op.cut" ||
    commandId === "op.copyTo" ||
    commandId === "op.moveTo" ||
    commandId === "op.delete" ||
    commandId === "op.trash" ||
    commandId === "op.deletePermanent" ||
    commandId === "op.reveal" ||
    commandId === "op.compress" ||
    commandId === "op.extract" ||
    commandId === "op.checksum" ||
    commandId === "clipboard.copyPath" ||
    commandId === "clipboard.copyName" ||
    commandId === "op.calculateSize" ||
    commandId === "op.toggleStarred";

  if (needsSelection) {
    return ctx.selectedCount === 0;
  }
  return false;
}
