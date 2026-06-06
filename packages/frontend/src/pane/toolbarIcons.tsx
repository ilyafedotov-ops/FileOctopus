import type { ReactNode } from "react";
import { Icons } from "@fileoctopus/ui";
import type { CommandId } from "../commands/types";

export function toolbarCommandIcon(commandId: CommandId): ReactNode | null {
  switch (commandId) {
    case "op.view":
      return Icons.file();
    case "op.edit":
      return Icons.pencil();
    case "op.openDefault":
      return Icons.desktop();
    case "op.rename":
      return Icons.pencil();
    case "op.copyTo":
    case "op.copy":
      return Icons.copy();
    case "op.moveTo":
    case "op.cut":
      return Icons.move();
    case "create.folder":
      return Icons.folderPlus();
    case "op.delete":
    case "op.trash":
      return Icons.trash();
    case "op.properties":
      return Icons.info();
    case "op.paste":
      return Icons.copy();
    case "create.file":
      return Icons.filePlus();
    case "nav.home":
      return Icons.home();
    case "op.openTerminal":
    case "terminal.runCommand":
    case "terminal.spawnAndRun":
      return Icons.terminal();
    case "op.compress":
      return Icons.archive();
    case "op.extract":
      return Icons.archive();
    case "search.recursive":
      return Icons.search();
    case "view.toggleActivity":
      return Icons.activity();
    case "app.settings":
      return Icons.settings();
    default:
      return null;
  }
}
