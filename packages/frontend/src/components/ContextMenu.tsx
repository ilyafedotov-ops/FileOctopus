import type { FileEntryDto } from "@fileoctopus/ts-api";
import { Button } from "@fileoctopus/ui";
import type { PanelId, SortField, ViewMode } from "../panelStore";

export interface ContextMenuState {
  panelId: PanelId;
  x: number;
  y: number;
  entry: FileEntryDto | null;
}

interface ContextMenuProps {
  menu: ContextMenuState | null;
  canPaste: boolean;
  isStarred: boolean;
  onClose: () => void;
  onOpen: (panelId: PanelId, entry: FileEntryDto | null) => void;
  onRename: (panelId: PanelId) => void;
  onCopy: (panelId: PanelId) => void;
  onCut: (panelId: PanelId) => void;
  onPaste: (panelId: PanelId) => void;
  onTrash: (panelId: PanelId) => void;
  onToggleStarred: (panelId: PanelId, entry: FileEntryDto) => void;
  onPermanentDelete: (panelId: PanelId) => void;
  onCopyPath: (panelId: PanelId) => void;
  onCopyName: (panelId: PanelId) => void;
  onProperties: (panelId: PanelId, entry: FileEntryDto | null) => void;
  onReveal: (panelId: PanelId, entry: FileEntryDto | null) => void;
  onCreateFolder: (panelId: PanelId) => void;
  onCreateFile: (panelId: PanelId) => void;
  onRefresh: (panelId: PanelId) => void;
  onSelectAll: (panelId: PanelId) => void;
  onViewMode: (panelId: PanelId, viewMode: ViewMode) => void;
  onSort: (panelId: PanelId, field: SortField) => void;
}

function ContextMenuItem({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="fo-context-menu-item"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function ContextMenu({
  menu,
  canPaste,
  isStarred,
  onClose,
  onOpen,
  onRename,
  onCopy,
  onCut,
  onPaste,
  onTrash,
  onToggleStarred,
  onPermanentDelete,
  onCopyPath,
  onCopyName,
  onProperties,
  onReveal,
  onCreateFolder,
  onCreateFile,
  onRefresh,
  onSelectAll,
  onViewMode,
  onSort,
}: ContextMenuProps) {
  if (!menu) {
    return null;
  }

  const itemMenu = Boolean(menu.entry);
  const run = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div className="fo-menu-backdrop" onClick={onClose} role="presentation">
      <div
        className="fo-context-menu"
        role="menu"
        style={{ left: menu.x, top: menu.y }}
        onClick={(event) => event.stopPropagation()}
      >
        <ContextMenuItem
          disabled={!itemMenu}
          onClick={() => run(() => onOpen(menu.panelId, menu.entry))}
        >
          Open
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!itemMenu}
          onClick={() => run(() => onRename(menu.panelId))}
        >
          Rename
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!itemMenu}
          onClick={() => run(() => onCopy(menu.panelId))}
        >
          Copy
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!itemMenu}
          onClick={() => run(() => onCut(menu.panelId))}
        >
          Cut
        </ContextMenuItem>
        <ContextMenuItem disabled={!canPaste} onClick={() => run(() => onPaste(menu.panelId))}>
          Paste
        </ContextMenuItem>
        <ContextMenuItem onClick={() => run(() => onCreateFolder(menu.panelId))}>
          New Folder
        </ContextMenuItem>
        <ContextMenuItem onClick={() => run(() => onCreateFile(menu.panelId))}>
          New File
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!itemMenu}
          onClick={() => run(() => onTrash(menu.panelId))}
        >
          Move to Trash
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!itemMenu}
          onClick={() => run(() => onPermanentDelete(menu.panelId))}
        >
          Delete Permanently
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!itemMenu}
          onClick={() => run(() => onCopyPath(menu.panelId))}
        >
          Copy Path
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!itemMenu}
          onClick={() => run(() => onCopyName(menu.panelId))}
        >
          Copy Name
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!itemMenu}
          onClick={() => run(() => onProperties(menu.panelId, menu.entry))}
        >
          Properties
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!itemMenu}
          onClick={() => run(() => onReveal(menu.panelId, menu.entry))}
        >
          Reveal
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!itemMenu || !menu.entry}
          onClick={() => run(() => onToggleStarred(menu.panelId, menu.entry!))}
        >
          {isStarred ? "Remove Star" : "Add Star"}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => run(() => onRefresh(menu.panelId))}>
          Refresh
        </ContextMenuItem>
        <ContextMenuItem onClick={() => run(() => onSelectAll(menu.panelId))}>
          Select All
        </ContextMenuItem>
        <ContextMenuItem onClick={() => run(() => onViewMode(menu.panelId, "details"))}>
          Details View
        </ContextMenuItem>
        <ContextMenuItem onClick={() => run(() => onViewMode(menu.panelId, "list"))}>
          List View
        </ContextMenuItem>
        <ContextMenuItem onClick={() => run(() => onViewMode(menu.panelId, "icons"))}>
          Icon View
        </ContextMenuItem>
        <ContextMenuItem onClick={() => run(() => onViewMode(menu.panelId, "columns"))}>
          Columns View
        </ContextMenuItem>
        <ContextMenuItem onClick={() => run(() => onSort(menu.panelId, "name"))}>
          Sort Name
        </ContextMenuItem>
        <ContextMenuItem onClick={() => run(() => onSort(menu.panelId, "modified"))}>
          Sort Modified
        </ContextMenuItem>
      </div>
    </div>
  );
}
