import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { FileEntryDto } from "@fileoctopus/ts-api";
import { MenuSurface } from "@fileoctopus/ui";
import type { PanelId, SortField, ViewMode } from "../panelStore";
import type { TagColor } from "../utils/tagStore";
import { buildBreadcrumbMenu } from "../menus/context/buildBreadcrumbMenu";
import { buildFileEntryMenu } from "../menus/context/buildFileEntryMenu";
import { buildPaneBackgroundMenu } from "../menus/context/buildPaneBackgroundMenu";

export interface ContextMenuState {
  panelId: PanelId;
  x: number;
  y: number;
  entry: FileEntryDto | null;
  breadcrumbPath?: string;
}

interface ContextMenuProps {
  menu: ContextMenuState | null;
  currentTabUri: string;
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
  onView: (panelId: PanelId, entry: FileEntryDto | null) => void;
  onProperties: (panelId: PanelId, entry: FileEntryDto | null) => void;
  onReveal: (panelId: PanelId, entry: FileEntryDto | null) => void;
  onCompress: (panelId: PanelId) => void;
  onExtract: (panelId: PanelId) => void;
  onOpenTerminal: (panelId: PanelId) => void;
  onOpenTerminalExternal: (panelId: PanelId) => void;
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
  onAssignTag?: (entry: FileEntryDto, color: TagColor) => void;
  onRemoveTag?: (entry: FileEntryDto, color: TagColor) => void;
  entryTagColors?: TagColor[];
}

export function ContextMenu({
  menu,
  currentTabUri,
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
  onView,
  onProperties,
  onReveal,
  onCompress,
  onExtract,
  onOpenTerminal,
  onOpenTerminalExternal,
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
  onAssignTag,
  onRemoveTag,
  entryTagColors,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    maxHeight?: number;
  } | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

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

  useEffect(() => {
    if (menu && menuRef.current) {
      menuRef.current.focus();
    }
    setFocusedIndex(-1);
  }, [menu]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      const container = menuRef.current;
      if (!container) return;

      const items = Array.from(
        container.querySelectorAll<HTMLButtonElement>(
          '[role="menuitem"]:not([disabled])',
        ),
      );
      if (items.length === 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev < items.length - 1 ? prev + 1 : 0;
          items[next]?.focus();
          return next;
        });
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : items.length - 1;
          items[next]?.focus();
          return next;
        });
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < items.length) {
          items[focusedIndex]?.click();
        }
      }
    },
    [onClose, focusedIndex],
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
      <MenuSurface
        ref={menuRef}
        className="fo-context-menu"
        role="menu"
        tabIndex={-1}
        style={
          pos
            ? { left: pos.left, top: pos.top, maxHeight: pos.maxHeight }
            : { left: menu.x, top: menu.y }
        }
        onClick={(event) => event.stopPropagation()}
      >
        {content}
      </MenuSurface>
    </div>
  );

  if (menu.breadcrumbPath) {
    return shell(
      buildBreadcrumbMenu({
        panelId: menu.panelId,
        breadcrumbPath: menu.breadcrumbPath,
        run,
        onNavigateTo,
        onNavigateOtherPane,
        onCopyBreadcrumbPath,
        onRevealBreadcrumb,
        onAddFavorite,
      }),
    );
  }

  if (!menu.entry) {
    return shell(
      buildPaneBackgroundMenu({
        panelId: menu.panelId,
        canPaste,
        showHidden,
        run,
        onPaste,
        onCreateFolder,
        onCreateFile,
        onRefresh,
        onToggleHidden,
        onViewMode,
        onProperties,
      }),
    );
  }

  return shell(
    buildFileEntryMenu({
      panelId: menu.panelId,
      currentTabUri,
      entry: menu.entry,
      canPaste,
      isStarred,
      run,
      onOpen,
      onNavigateOtherPane,
      onOpenWithDefaultApp,
      onReveal,
      onAddFavorite,
      onCut,
      onCopy,
      onPaste,
      onCopyPath,
      onCopyName,
      onView,
      onRename,
      onCopyTo,
      onMoveTo,
      onTrash,
      onPermanentDelete,
      onToggleStarred,
      onProperties,
      onCopyParentPath,
      onCopyResourceUri,
      onCompress,
      onExtract,
      onOpenTerminal,
      onOpenTerminalExternal,
      onChecksum,
      onRefresh,
      onSelectAll,
      onClearSelection,
      onViewMode,
      onSort,
      onAssignTag,
      onRemoveTag,
      entryTagColors,
    }),
  );
}
