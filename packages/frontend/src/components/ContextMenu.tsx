import { useCallback, useEffect, useRef, useState } from "react";
import type { FileEntryDto } from "@fileoctopus/ts-api";
import { Button } from "@fileoctopus/ui";
import type { PanelId, SortField, ViewMode } from "../panelStore";

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

function ContextMenuSeparator() {
  return <div className="fo-context-menu-separator" role="separator" />;
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
  onRevealBreadcrumb,
  onAddFavorite,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    maxHeight?: number;
  } | null>(null);

  // Viewport-aware positioning: adjust so menu stays within window
  useEffect(() => {
    if (!menu || !menuRef.current) {
      setPos(null);
      return;
    }
    const el = menuRef.current;
    const pad = 8;
    // First render at click position to measure natural size
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = menu.x;
    let top = menu.y;
    let maxHeight: number | undefined;

    // Clamp horizontal
    if (left + rect.width > vw - pad) {
      left = Math.max(pad, vw - rect.width - pad);
    }

    // Clamp vertical — compute maxHeight so menu fits below click point
    const availableBelow = vh - top - pad;
    if (rect.height > availableBelow) {
      // Try shifting up
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
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  if (!menu) {
    return null;
  }

  const itemMenu = Boolean(menu.entry);
  const run = (action: () => void) => {
    action();
    onClose();
  };

  return (
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
        {/* Breadcrumb context menu — spec §13.6 */}
        {menu.breadcrumbPath ? (
          <>
            <ContextMenuItem
              onClick={() =>
                run(() => onNavigateTo(menu.panelId, menu.breadcrumbPath!))
              }
            >
              Open This Location
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() =>
                run(() => onNavigateOtherPane(menu.breadcrumbPath!))
              }
            >
              Open in Other Pane
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() =>
                run(() => onCopyBreadcrumbPath(menu.breadcrumbPath!))
              }
            >
              Copy Path
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() =>
                run(() => onRevealBreadcrumb(menu.breadcrumbPath!))
              }
            >
              Reveal in File Manager
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => run(() => onAddFavorite(menu.breadcrumbPath!))}
            >
              Add to Favorites
            </ContextMenuItem>
          </>
        ) : null}
        {/* File actions */}
        <ContextMenuItem
          disabled={!itemMenu}
          onClick={() => run(() => onOpen(menu.panelId, menu.entry))}
        >
          Open
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!itemMenu}
          onClick={() => run(() => onOpenWithDefaultApp(menu.panelId))}
        >
          Open With Default App
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!itemMenu}
          onClick={() => run(() => onRename(menu.panelId))}
        >
          Rename
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!itemMenu}
          onClick={() => run(() => onCopyTo(menu.panelId))}
        >
          Copy To…
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!itemMenu}
          onClick={() => run(() => onMoveTo(menu.panelId))}
        >
          Move To…
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Clipboard */}
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
        <ContextMenuItem
          disabled={!canPaste}
          onClick={() => run(() => onPaste(menu.panelId))}
        >
          Paste
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Create */}
        <ContextMenuItem
          onClick={() => run(() => onCreateFolder(menu.panelId))}
        >
          New Folder
        </ContextMenuItem>
        <ContextMenuItem onClick={() => run(() => onCreateFile(menu.panelId))}>
          New File
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Delete */}
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

        <ContextMenuSeparator />

        {/* Info & tools */}
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
          onClick={() => run(() => onCopyParentPath(menu.panelId))}
        >
          Copy Parent Folder Path
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!itemMenu}
          onClick={() => run(() => onCopyResourceUri(menu.panelId))}
        >
          Copy Resource URI
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
          disabled={!itemMenu}
          onClick={() => run(() => onCompress(menu.panelId))}
        >
          Compress…
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!itemMenu}
          onClick={() => run(() => onExtract(menu.panelId))}
        >
          Extract…
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => run(() => onOpenTerminal(menu.panelId))}
        >
          Open Terminal
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!itemMenu}
          onClick={() => run(() => onChecksum(menu.panelId))}
        >
          Checksum…
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!itemMenu || !menu.entry}
          onClick={() => run(() => onToggleStarred(menu.panelId, menu.entry!))}
        >
          {isStarred ? "Remove Star" : "Add Star"}
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* View & selection */}
        <ContextMenuItem onClick={() => run(() => onRefresh(menu.panelId))}>
          Refresh
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => run(() => onToggleHidden(menu.panelId))}
        >
          {showHidden ? "Hide Hidden Files" : "Show Hidden Files"}
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

        {/* View modes */}
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

        <ContextMenuSeparator />

        {/* Sort submenu */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="fo-context-menu-item fo-context-menu-item--submenu"
          role="menuitem"
        >
          Sort by…
          <div className="fo-context-submenu" role="menu">
            <ContextMenuItem
              onClick={() => run(() => onSort(menu.panelId, "name"))}
            >
              Name
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => run(() => onSort(menu.panelId, "modified"))}
            >
              Modified
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => run(() => onSort(menu.panelId, "size"))}
            >
              Size
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => run(() => onSort(menu.panelId, "type"))}
            >
              Type
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => run(() => onSort(menu.panelId, "created"))}
            >
              Created
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => run(() => onSort(menu.panelId, "extension"))}
            >
              Extension
            </ContextMenuItem>
          </div>
        </Button>
      </div>
    </div>
  );
}
