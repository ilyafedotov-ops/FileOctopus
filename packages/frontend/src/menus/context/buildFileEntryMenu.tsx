import type { ReactNode } from "react";
import type { FileEntryDto } from "@fileoctopus/ts-api";
import { isRemoteUri } from "@fileoctopus/ts-api";
import { Button } from "@fileoctopus/ui";
import type { PanelId, SortField, ViewMode } from "../../panelStore";
import { isParentDirectoryEntry } from "../../utils/parentEntry";
import { ContextMenuItem, ContextMenuSeparator } from "./ContextMenuPrimitives";

interface FileEntryMenuParams {
  panelId: PanelId;
  currentTabUri: string;
  entry: FileEntryDto;
  canPaste: boolean;
  isStarred: boolean;
  run: (action: () => void) => void;
  onOpen: (panelId: PanelId, entry: FileEntryDto | null) => void;
  onNavigateOtherPane: (uri: string) => void;
  onOpenWithDefaultApp: (panelId: PanelId) => void;
  onReveal: (panelId: PanelId, entry: FileEntryDto | null) => void;
  onAddFavorite: (uri: string) => void;
  onCut: (panelId: PanelId) => void;
  onCopy: (panelId: PanelId) => void;
  onPaste: (panelId: PanelId) => void;
  onCopyPath: (panelId: PanelId) => void;
  onCopyName: (panelId: PanelId) => void;
  onView: (panelId: PanelId, entry: FileEntryDto | null) => void;
  onRename: (panelId: PanelId) => void;
  onCopyTo: (panelId: PanelId) => void;
  onMoveTo: (panelId: PanelId) => void;
  onTrash: (panelId: PanelId) => void;
  onPermanentDelete: (panelId: PanelId) => void;
  onToggleStarred: (panelId: PanelId, entry: FileEntryDto) => void;
  onProperties: (panelId: PanelId, entry: FileEntryDto | null) => void;
  onCopyParentPath: (panelId: PanelId) => void;
  onCopyResourceUri: (panelId: PanelId) => void;
  onCompress: (panelId: PanelId) => void;
  onExtract: (panelId: PanelId) => void;
  onOpenTerminal: (panelId: PanelId) => void;
  onChecksum: (panelId: PanelId) => void;
  onRefresh: (panelId: PanelId) => void;
  onSelectAll: (panelId: PanelId) => void;
  onClearSelection: (panelId: PanelId) => void;
  onViewMode: (panelId: PanelId, viewMode: ViewMode) => void;
  onSort: (panelId: PanelId, field: SortField) => void;
}

export function buildFileEntryMenu({
  panelId,
  currentTabUri,
  entry,
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
  onChecksum,
  onRefresh,
  onSelectAll,
  onClearSelection,
  onViewMode,
  onSort,
}: FileEntryMenuParams): ReactNode {
  if (isParentDirectoryEntry(entry, currentTabUri)) {
    return (
      <ContextMenuItem onClick={() => run(() => onOpen(panelId, entry))}>
        Open
      </ContextMenuItem>
    );
  }

  const isDirectory = entry.kind === "directory";
  const remotePane = isRemoteUri(currentTabUri);

  return (
    <>
      <ContextMenuItem onClick={() => run(() => onOpen(panelId, entry))}>
        Open
      </ContextMenuItem>
      {isDirectory ? (
        <ContextMenuItem
          onClick={() => run(() => onNavigateOtherPane(entry.uri))}
        >
          Open in Other Pane
        </ContextMenuItem>
      ) : (
        <ContextMenuItem
          onClick={() => run(() => onOpenWithDefaultApp(panelId))}
        >
          Open With Default App
        </ContextMenuItem>
      )}
      <ContextMenuItem onClick={() => run(() => onView(panelId, entry))}>
        View…
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(() => onReveal(panelId, entry))}>
        Reveal in System File Manager
      </ContextMenuItem>
      {isDirectory ? (
        <ContextMenuItem onClick={() => run(() => onAddFavorite(entry.uri))}>
          Add to Favorites
        </ContextMenuItem>
      ) : null}
      <ContextMenuSeparator />
      <ContextMenuItem
        disabled={!entry.canWrite || !entry.canDelete}
        onClick={() => run(() => onCut(panelId))}
      >
        Cut
      </ContextMenuItem>
      <ContextMenuItem
        disabled={!entry.canRead}
        onClick={() => run(() => onCopy(panelId))}
      >
        Copy
      </ContextMenuItem>
      <ContextMenuItem
        disabled={!canPaste}
        onClick={() => run(() => onPaste(panelId))}
      >
        {isDirectory ? "Paste Into Folder" : "Paste"}
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(() => onCopyPath(panelId))}>
        Copy Path
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(() => onCopyName(panelId))}>
        Copy Name
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        disabled={!entry.canRename}
        onClick={() => run(() => onRename(panelId))}
      >
        Rename…
      </ContextMenuItem>
      <ContextMenuItem
        disabled={!entry.canRead}
        onClick={() => run(() => onCopyTo(panelId))}
      >
        Copy To…
      </ContextMenuItem>
      <ContextMenuItem
        disabled={!entry.canWrite || !entry.canDelete}
        onClick={() => run(() => onMoveTo(panelId))}
      >
        Move To…
      </ContextMenuItem>
      <ContextMenuItem
        disabled={!entry.canDelete}
        onClick={() => run(() => onTrash(panelId))}
      >
        {remotePane ? "Delete…" : "Move to Trash…"}
      </ContextMenuItem>
      <ContextMenuItem
        disabled={!entry.canDelete}
        onClick={() => run(() => onPermanentDelete(panelId))}
      >
        Delete Permanently…
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={() => run(() => onToggleStarred(panelId, entry))}
      >
        {isStarred ? "Remove Star" : "Add Star"}
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(() => onProperties(panelId, entry))}>
        Properties…
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(() => onCopyParentPath(panelId))}>
        Copy Parent Folder Path
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(() => onCopyResourceUri(panelId))}>
        Copy Resource URI
      </ContextMenuItem>
      <ContextMenuItem
        disabled={remotePane}
        onClick={() => run(() => onCompress(panelId))}
      >
        Pack…
      </ContextMenuItem>
      <ContextMenuItem
        disabled={remotePane}
        onClick={() => run(() => onExtract(panelId))}
      >
        Unpack…
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(() => onOpenTerminal(panelId))}>
        Open Terminal
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(() => onChecksum(panelId))}>
        Checksum…
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => run(() => onRefresh(panelId))}>
        Refresh
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(() => onSelectAll(panelId))}>
        Select All
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(() => onClearSelection(panelId))}>
        Clear Selection
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={() => run(() => onViewMode(panelId, "details"))}
      >
        Details View
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(() => onViewMode(panelId, "list"))}>
        List View
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(() => onViewMode(panelId, "icons"))}>
        Icon View
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => run(() => onViewMode(panelId, "columns"))}
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
              onClick={() => run(() => onSort(panelId, field))}
            >
              {field[0].toUpperCase() + field.slice(1)}
            </ContextMenuItem>
          ))}
        </div>
      </Button>
    </>
  );
}
