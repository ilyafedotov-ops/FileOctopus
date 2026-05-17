import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { FileEntryDto } from "@fileoctopus/ts-api";
import { Button } from "@fileoctopus/ui";
import type { PanelId, SortField, ViewMode } from "../panelStore";
import {
  ContextMenuItem,
  ContextMenuSeparator,
} from "../menus/context/ContextMenuPrimitives";

export interface ContextMenuState {
  panelId: PanelId;
  x: number;
  y: number;
  entry: FileEntryDto | null;
  breadcrumbPath?: string;
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
  onCompress: (panelId: PanelId) => void;
  onExtract: (panelId: PanelId) => void;
  onOpenTerminal: (panelId: PanelId) => void;
  onChecksum: (panelId: PanelId) => void;
  onCreateFolder: (panelId: PanelId) => void;
  onCreateFile: (panelId: PanelId) => void;
  onRefresh: (panelId: PanelId) => void;
  onSelectAll: (panelId: PanelId) => void;
  onViewMode: (panelId: PanelId, viewMode: ViewMode) => void;
  onSort: (panelId: PanelId, field: SortField) => void;
  showHidden: boolean;
  onToggleHidden: (panelId: PanelId) => void;
  onOpenWithDefaultApp: (panelId: PanelId) => void;
  onCopyTo: (panelId: PanelId) => void;
  onMoveTo: (panelId: PanelId) => void;
  onCopyParentPath: (panelId: PanelId) => void;
  onCopyResourceUri: (panelId: PanelId) => void;
  onClearSelection: (panelId: PanelId) => void;
  onNavigateTo: (panelId: PanelId, uri: string) => void;
  onNavigateOtherPane: (uri: string) => void;
  onCopyBreadcrumbPath: (path: string) => void;
  onRevealBreadcrumb: (path: string) => void;
  onAddFavorite: (uri: string) => void;
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
  onCompress,
  onExtract,
  onOpenTerminal,
  onChecksum,
  onCreateFolder,
  onCreateFile,
  onRefresh,
  onSelectAll,
  onViewMode,
  onSort,
  showHidden,
  onToggleHidden,
  onOpenWithDefaultApp,
  onCopyTo,
  onMoveTo,
  onCopyParentPath,
  onCopyResourceUri,
  onClearSelection,
  onNavigateTo,
  onNavigateOtherPane,
  onCopyBreadcrumbPath,
  onAddFavorite,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    maxHeight?: number;
  } | null>(null);

  useEffect(() => {
    if (!menu || !menuRef.current) {
      setPos(null);
      return;
    }

    const rect = menuRef.current.getBoundingClientRect();
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = menu.x;
    let top = menu.y;
    let maxHeight: number | undefined;

    if (left + rect.width > vw - pad) {
      left = Math.max(pad, vw - rect.width - pad);
    }

    const availableBelow = vh - top - pad;
    if (rect.height > availableBelow) {
      const availableAbove = top - pad;
      if (availableAbove > availableBelow) {
        top = Math.max(pad, vh - rect.height - pad);
        maxHeight = vh - top - pad;
      } else {
        maxHeight = availableBelow;
      }
    }

    setPos({ left, top, maxHeight });
  }, [menu]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  if (!menu) {
    return null;
  }

  const run = (action: () => void) => {
    action();
    onClose();
  };

  const shell = (content: ReactNode) => (
    <div
      className="fo-menu-backdrop"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        ref={menuRef}
        className="fo-context-menu"
        role="menu"
        style={
          pos
            ? { left: pos.left, top: pos.top, maxHeight: pos.maxHeight }
            : { left: menu.x, top: menu.y }
        }
        onClick={(event) => event.stopPropagation()}
      >
        {content}
      </div>
    </div>
  );

  if (menu.breadcrumbPath) {
    return shell(
      <>
        <ContextMenuItem
          onClick={() =>
            run(() => onNavigateTo(menu.panelId, menu.breadcrumbPath!))
          }
        >
          Open This Location
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => run(() => onNavigateOtherPane(menu.breadcrumbPath!))}
        >
          Open in Other Pane
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => run(() => onCopyBreadcrumbPath(menu.breadcrumbPath!))}
        >
          Copy Path
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => run(() => onAddFavorite(menu.breadcrumbPath!))}
        >
          Add to Favorites
        </ContextMenuItem>
      </>,
    );
  }

  if (!menu.entry) {
    return shell(
      <>
        <ContextMenuItem
          disabled={!canPaste}
          onClick={() => run(() => onPaste(menu.panelId))}
        >
          Paste
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => run(() => onCreateFolder(menu.panelId))}
        >
          New Folder
        </ContextMenuItem>
        <ContextMenuItem onClick={() => run(() => onCreateFile(menu.panelId))}>
          New File
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => run(() => onRefresh(menu.panelId))}>
          Refresh
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => run(() => onToggleHidden(menu.panelId))}
        >
          {showHidden ? "Hide Hidden Files" : "Show Hidden Files"}
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => run(() => onViewMode(menu.panelId, "details"))}
        >
          Details View
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => run(() => onProperties(menu.panelId, null))}
        >
          Current Folder Properties
        </ContextMenuItem>
      </>,
    );
  }

  const isDirectory = menu.entry.kind === "directory";

  return shell(
    <>
      <ContextMenuItem
        onClick={() => run(() => onOpen(menu.panelId, menu.entry))}
      >
        Open
      </ContextMenuItem>
      {isDirectory ? (
        <ContextMenuItem
          onClick={() => run(() => onNavigateOtherPane(menu.entry!.uri))}
        >
          Open in Other Pane
        </ContextMenuItem>
      ) : (
        <ContextMenuItem
          onClick={() => run(() => onOpenWithDefaultApp(menu.panelId))}
        >
          Open With Default App
        </ContextMenuItem>
      )}
      <ContextMenuItem
        onClick={() => run(() => onReveal(menu.panelId, menu.entry))}
      >
        Reveal in System File Manager
      </ContextMenuItem>
      {isDirectory ? (
        <ContextMenuItem
          onClick={() => run(() => onAddFavorite(menu.entry!.uri))}
        >
          Add to Favorites
        </ContextMenuItem>
      ) : null}
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => run(() => onCut(menu.panelId))}>
        Cut
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(() => onCopy(menu.panelId))}>
        Copy
      </ContextMenuItem>
      <ContextMenuItem
        disabled={!canPaste}
        onClick={() => run(() => onPaste(menu.panelId))}
      >
        {isDirectory ? "Paste Into Folder" : "Paste"}
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(() => onCopyPath(menu.panelId))}>
        Copy Path
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(() => onCopyName(menu.panelId))}>
        Copy Name
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => run(() => onRename(menu.panelId))}>
        Rename…
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(() => onCopyTo(menu.panelId))}>
        Copy To…
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(() => onMoveTo(menu.panelId))}>
        Move To…
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(() => onTrash(menu.panelId))}>
        Move to Trash…
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => run(() => onPermanentDelete(menu.panelId))}
      >
        Delete Permanently…
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={() => run(() => onToggleStarred(menu.panelId, menu.entry!))}
      >
        {isStarred ? "Remove Star" : "Add Star"}
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => run(() => onProperties(menu.panelId, menu.entry))}
      >
        Properties…
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => run(() => onCopyParentPath(menu.panelId))}
      >
        Copy Parent Folder Path
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => run(() => onCopyResourceUri(menu.panelId))}
      >
        Copy Resource URI
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(() => onCompress(menu.panelId))}>
        Compress…
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(() => onExtract(menu.panelId))}>
        Extract…
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(() => onOpenTerminal(menu.panelId))}>
        Open Terminal
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(() => onChecksum(menu.panelId))}>
        Checksum…
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => run(() => onRefresh(menu.panelId))}>
        Refresh
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(() => onSelectAll(menu.panelId))}>
        Select All
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => run(() => onClearSelection(menu.panelId))}
      >
        Clear Selection
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={() => run(() => onViewMode(menu.panelId, "details"))}
      >
        Details View
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => run(() => onViewMode(menu.panelId, "list"))}
      >
        List View
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => run(() => onViewMode(menu.panelId, "icons"))}
      >
        Icon View
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => run(() => onViewMode(menu.panelId, "columns"))}
      >
        Columns View
      </ContextMenuItem>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="fo-context-menu-item fo-context-menu-item--submenu"
        role="menuitem"
      >
        Sort by…
        <div className="fo-context-submenu" role="menu">
          {(
            [
              "name",
              "modified",
              "size",
              "type",
              "created",
              "extension",
            ] as const
          ).map((field) => (
            <ContextMenuItem
              key={field}
              onClick={() => run(() => onSort(menu.panelId, field))}
            >
              {field[0].toUpperCase() + field.slice(1)}
            </ContextMenuItem>
          ))}
        </div>
      </Button>
    </>,
  );
}
