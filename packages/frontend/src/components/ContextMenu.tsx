import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { FileEntryDto } from "@fileoctopus/ts-api";
import { MenuSurface } from "@fileoctopus/ui";
import type { PanelId, ViewMode } from "../panelStore";
import type { FileMutationCapabilities } from "../navigation/fileMutationState";
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
  selectedCount?: number;
  capabilities?: FileMutationCapabilities;
  shortcutPlatform?: "mac" | "windowsLinux";
  useTrashByDefault?: boolean;
  onClose: () => void;
  onOpen: (panelId: PanelId, entry: FileEntryDto | null) => void;
  onOpenInNewTab: (panelId: PanelId, uri: string) => void;
  onRename: (panelId: PanelId) => void;
  onCopy: (panelId: PanelId) => void;
  onCut: (panelId: PanelId) => void;
  onPaste: (panelId: PanelId) => void;
  onDelete: (panelId: PanelId) => void;
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
  onOpenTerminalExternal: (panelId: PanelId) => void;
  onChecksum: (panelId: PanelId) => void;
  onCreateFolder: (panelId: PanelId) => void;
  onCreateFile: (panelId: PanelId) => void;
  onRefresh: (panelId: PanelId) => void;
  onViewMode: (panelId: PanelId, viewMode: ViewMode) => void;
  showHidden: boolean;
  onToggleHidden: (panelId: PanelId) => void;
  onOpenWithDefaultApp: (panelId: PanelId) => void;
  onCopyTo: (panelId: PanelId) => void;
  onMoveTo: (panelId: PanelId) => void;
  onCopyParentPath: (panelId: PanelId) => void;
  onCopyResourceUri: (panelId: PanelId) => void;
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
  selectedCount,
  capabilities,
  shortcutPlatform,
  useTrashByDefault,
  onClose,
  onOpen,
  onOpenInNewTab,
  onRename,
  onCopy,
  onCut,
  onPaste,
  onDelete,
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
  onOpenTerminalExternal,
  onChecksum,
  onCreateFolder,
  onCreateFile,
  onRefresh,
  onViewMode,
  showHidden,
  onToggleHidden,
  onOpenWithDefaultApp,
  onCopyTo,
  onMoveTo,
  onCopyParentPath,
  onCopyResourceUri,
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

    const maxUsableHeight = Math.max(0, vh - pad * 2);
    if (rect.height > maxUsableHeight) {
      top = pad;
      maxHeight = maxUsableHeight;
    } else {
      top = Math.min(Math.max(pad, top), Math.max(pad, vh - rect.height - pad));
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

  const menuStyle: CSSProperties = pos
    ? {
        left: pos.left,
        top: pos.top,
        ...(pos.maxHeight !== undefined
          ? { maxHeight: pos.maxHeight, overflowY: "auto" }
          : {}),
      }
    : { left: menu.x, top: menu.y };

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
        style={menuStyle}
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
      selectedCount,
      capabilities,
      shortcutPlatform,
      useTrashByDefault,
      run,
      onOpen,
      onOpenInNewTab,
      onNavigateOtherPane,
      onOpenWithDefaultApp,
      onReveal,
      onAddFavorite,
      onCut,
      onCopy,
      onPaste,
      onCopyPath,
      onCopyName,
      onRename,
      onCopyTo,
      onMoveTo,
      onDelete,
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
      onAssignTag,
      onRemoveTag,
      entryTagColors,
    }),
  );
}
