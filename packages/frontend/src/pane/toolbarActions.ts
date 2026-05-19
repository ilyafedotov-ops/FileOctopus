import type { CommandId } from "../commands/types";
import type { ToolbarDropdownsProps } from "./ToolbarDropdowns";

export interface ToolbarActionHandlers {
  onBack: () => void;
  onForward: () => void;
  onUp: () => void;
  onRoot: () => void;
  onHome: () => void;
  onDrives: () => void;
  onRefresh: () => void;
  onCommandSearch: () => void;
  onView: () => void;
  onCommand: (commandId: CommandId) => void;
  onCustomizeToolbar: () => void;
  dropdowns: ToolbarDropdownsProps;
}

export function runToolbarCommand(
  commandId: CommandId,
  handlers: ToolbarActionHandlers,
): void {
  const {
    onBack,
    onForward,
    onUp,
    onRefresh,
    onCommandSearch,
    onCommand,
    dropdowns,
  } = handlers;

  switch (commandId) {
    case "nav.back":
      onBack();
      return;
    case "nav.forward":
      onForward();
      return;
    case "nav.up":
      onUp();
      return;
    case "nav.root":
      handlers.onRoot();
      return;
    case "nav.home":
      handlers.onHome();
      return;
    case "nav.volumePicker":
      handlers.onDrives();
      return;
    case "nav.refresh":
      onRefresh();
      return;
    case "app.commandPalette":
      onCommandSearch();
      return;
    case "create.folder":
      dropdowns.onCreateFolder();
      return;
    case "create.file":
      dropdowns.onCreateFile();
      return;
    case "op.rename":
      dropdowns.onRename();
      return;
    case "op.copy":
      dropdowns.onCopy();
      return;
    case "op.cut":
      dropdowns.onCut();
      return;
    case "op.paste":
      dropdowns.onPaste();
      return;
    case "op.copyTo":
      dropdowns.onCopyOperation();
      return;
    case "op.moveTo":
      dropdowns.onMove();
      return;
    case "op.trash":
      dropdowns.onTrash();
      return;
    case "op.deletePermanent":
      dropdowns.onPermanentDelete();
      return;
    case "clipboard.copyPath":
      dropdowns.onCopyPath();
      return;
    case "clipboard.copyName":
      dropdowns.onCopyName();
      return;
    case "op.properties":
      dropdowns.onProperties();
      return;
    case "op.view":
      handlers.onView();
      return;
    case "op.reveal":
      dropdowns.onRevealInFileManager();
      return;
    case "op.calculateSize":
      dropdowns.onCalculateSize();
      return;
    case "op.compress":
      dropdowns.onCompress();
      return;
    case "op.extract":
      dropdowns.onExtract();
      return;
    case "op.openTerminal":
      dropdowns.onOpenTerminal();
      return;
    case "op.openTerminalExternal":
      dropdowns.onOpenTerminalExternal();
      return;
    case "op.checksum":
      dropdowns.onChecksum();
      return;
    case "selection.selectAll":
      dropdowns.onSelectAll();
      return;
    case "view.toggleHidden":
      dropdowns.onToggleHidden();
      return;
    case "view.details":
      dropdowns.onViewMode("details");
      return;
    case "view.list":
      dropdowns.onViewMode("list");
      return;
    case "view.compact":
      dropdowns.onViewMode("compact");
      return;
    case "view.icons":
      dropdowns.onViewMode("icons");
      return;
    case "view.columns":
      dropdowns.onViewMode("columns");
      return;
    default:
      onCommand(commandId);
  }
}
