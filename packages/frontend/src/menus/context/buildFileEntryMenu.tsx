import type { ReactNode } from "react";
import type { FileEntryDto } from "@fileoctopus/ts-api";
import { isRemoteUri } from "@fileoctopus/ts-api";
import { Icons } from "@fileoctopus/ui";
import { formatCommandShortcut } from "../../commands/registry";
import type { FileMutationCapabilities } from "../../navigation/fileMutationState";
import type { PanelId } from "../../panelStore";
import { isArchiveFile } from "../../utils/archiveUtils";
import type { TagColor } from "../../utils/tagStore";
import { tagColorValues } from "../../utils/tagStore";
import { isParentDirectoryEntry } from "../../utils/parentEntry";
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSubmenu,
} from "./ContextMenuPrimitives";

type ShortcutPlatform = "mac" | "windowsLinux";

interface FileEntryMenuParams {
  panelId: PanelId;
  currentTabUri: string;
  entry: FileEntryDto;
  canPaste: boolean;
  isStarred: boolean;
  selectedCount?: number;
  capabilities?: FileMutationCapabilities;
  shortcutPlatform?: ShortcutPlatform;
  useTrashByDefault?: boolean;
  entryTagColors?: TagColor[];
  run: (action: () => void) => void;
  onOpen: (panelId: PanelId, entry: FileEntryDto | null) => void;
  onOpenInNewTab: (panelId: PanelId, uri: string) => void;
  onNavigateOtherPane: (uri: string) => void;
  onOpenWithDefaultApp: (panelId: PanelId) => void;
  onReveal: (panelId: PanelId, entry: FileEntryDto | null) => void;
  onAddFavorite: (uri: string) => void;
  onCut: (panelId: PanelId) => void;
  onCopy: (panelId: PanelId) => void;
  onPaste: (panelId: PanelId) => void;
  onCopyPath: (panelId: PanelId) => void;
  onCopyName: (panelId: PanelId) => void;
  onRename: (panelId: PanelId) => void;
  onCopyTo: (panelId: PanelId) => void;
  onMoveTo: (panelId: PanelId) => void;
  onDelete: (panelId: PanelId) => void;
  onTrash: (panelId: PanelId) => void;
  onPermanentDelete: (panelId: PanelId) => void;
  onToggleStarred: (panelId: PanelId, entry: FileEntryDto) => void;
  onProperties: (panelId: PanelId, entry: FileEntryDto | null) => void;
  onCopyParentPath: (panelId: PanelId) => void;
  onCopyResourceUri: (panelId: PanelId) => void;
  onCompress: (panelId: PanelId) => void;
  onExtract: (panelId: PanelId) => void;
  onOpenTerminal: (panelId: PanelId) => void;
  onOpenTerminalExternal: (panelId: PanelId) => void;
  onChecksum: (panelId: PanelId) => void;
  onAssignTag?: (entry: FileEntryDto, color: TagColor) => void;
  onRemoveTag?: (entry: FileEntryDto, color: TagColor) => void;
}

export function buildFileEntryMenu({
  panelId,
  currentTabUri,
  entry,
  canPaste,
  isStarred,
  selectedCount = 1,
  capabilities,
  shortcutPlatform = "windowsLinux",
  useTrashByDefault = false,
  entryTagColors,
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
}: FileEntryMenuParams): ReactNode {
  if (isParentDirectoryEntry(entry, currentTabUri)) {
    return (
      <ContextMenuItem
        icon={Icons.folder()}
        label="Open"
        onClick={() => run(() => onOpen(panelId, entry))}
        shortcut={formatCommandShortcut("op.open", shortcutPlatform)}
      />
    );
  }

  const isDirectory = entry.kind === "directory";
  const remotePane = isRemoteUri(currentTabUri);
  const singleSelection = selectedCount <= 1;
  const canCopy =
    capabilities?.canCopy ?? (isDirectory ? entry.canList : entry.canRead);
  const canMove = capabilities?.canMove ?? (entry.canWrite && entry.canDelete);
  const canRename = capabilities?.canRename ?? entry.canRename;
  const canDelete = capabilities?.canDelete ?? entry.canDelete;
  const canEdit = capabilities?.canEdit ?? !remotePane;
  const canUnpack =
    !remotePane && entry.kind === "file" && isArchiveFile(entry.name);
  const selectionLabel =
    selectedCount > 1 ? `${selectedCount} selected items` : entry.name;

  return (
    <>
      <ContextMenuItem
        icon={isDirectory ? Icons.folder() : Icons.file()}
        label="Open"
        onClick={() => run(() => onOpen(panelId, entry))}
        shortcut={formatCommandShortcut("op.open", shortcutPlatform)}
      />
      {isDirectory ? (
        <>
          <ContextMenuItem
            disabled={!singleSelection}
            disabledReason="Open in New Tab is available for one folder at a time"
            icon={Icons.plus()}
            label="Open in New Tab"
            onClick={() => run(() => onOpenInNewTab(panelId, entry.uri))}
          />
          <ContextMenuItem
            disabled={!singleSelection}
            disabledReason="Open in Other Pane is available for one folder at a time"
            icon={Icons.chevronRight()}
            label="Open in Other Pane"
            onClick={() => run(() => onNavigateOtherPane(entry.uri))}
          />
        </>
      ) : (
        <ContextMenuItem
          disabled={!singleSelection || !canEdit}
          disabledReason={
            !singleSelection
              ? "Open With Default App is available for one file at a time"
              : "Open With Default App is unavailable for this provider"
          }
          icon={Icons.externalLink()}
          label="Open With Default App"
          onClick={() => run(() => onOpenWithDefaultApp(panelId))}
        />
      )}
      <ContextMenuItem
        disabled={!singleSelection}
        disabledReason="Reveal is available for one item at a time"
        icon={Icons.externalLink()}
        label="Reveal in System File Manager"
        onClick={() => run(() => onReveal(panelId, entry))}
      />
      <ContextMenuSeparator />
      <ContextMenuItem
        disabled={!canMove}
        disabledReason={`${selectionLabel} cannot be moved from this location`}
        label="Cut"
        onClick={() => run(() => onCut(panelId))}
        shortcut={formatCommandShortcut("op.cut", shortcutPlatform)}
      />
      <ContextMenuItem
        disabled={!canCopy}
        disabledReason={`${selectionLabel} cannot be copied from this location`}
        icon={Icons.copy()}
        label="Copy"
        onClick={() => run(() => onCopy(panelId))}
        shortcut={formatCommandShortcut("op.copy", shortcutPlatform)}
      />
      {canPaste ? (
        <ContextMenuItem
          icon={Icons.clipboardCopy()}
          label={isDirectory ? "Paste Into Folder" : "Paste"}
          onClick={() => run(() => onPaste(panelId))}
          shortcut={formatCommandShortcut("op.paste", shortcutPlatform)}
        />
      ) : null}
      <ContextMenuSeparator />
      <ContextMenuItem
        disabled={!singleSelection || !canRename}
        disabledReason={
          !singleSelection
            ? "Rename is available for one item at a time"
            : `${entry.name} cannot be renamed`
        }
        icon={Icons.pencil()}
        label="Rename…"
        onClick={() => run(() => onRename(panelId))}
        shortcut={formatCommandShortcut("op.rename", shortcutPlatform)}
      />
      <ContextMenuItem
        disabled={!canCopy}
        disabledReason={`${selectionLabel} cannot be copied from this location`}
        icon={Icons.copy()}
        label="Copy To…"
        onClick={() => run(() => onCopyTo(panelId))}
        shortcut={formatCommandShortcut("op.copyTo", shortcutPlatform)}
      />
      <ContextMenuItem
        disabled={!canMove}
        disabledReason={`${selectionLabel} cannot be moved from this location`}
        icon={Icons.move()}
        label="Move To…"
        onClick={() => run(() => onMoveTo(panelId))}
        shortcut={formatCommandShortcut("op.moveTo", shortcutPlatform)}
      />
      <ContextMenuSeparator />
      {isDirectory && singleSelection ? (
        <ContextMenuItem
          icon={Icons.star()}
          label="Add to Favorites"
          onClick={() => run(() => onAddFavorite(entry.uri))}
        />
      ) : null}
      <ContextMenuItem
        disabled={!singleSelection}
        disabledReason="Stars are available for one item at a time"
        icon={Icons.star()}
        label={isStarred ? "Remove Star" : "Add Star"}
        onClick={() => run(() => onToggleStarred(panelId, entry))}
      />
      {onAssignTag && singleSelection ? (
        <ContextMenuSubmenu icon={Icons.hash()} label="Tags">
          <>
            {tagColorValues.map((color) => {
              const hasColor = entryTagColors?.indexOf(color) !== -1;
              return (
                <ContextMenuItem
                  key={color}
                  label={
                    <>
                      <span
                        className={`fo-context-tag-color-swatch`}
                        style={{
                          backgroundColor: tagColorHex(color),
                        }}
                      />
                      {color[0].toUpperCase() + color.slice(1)}
                      {hasColor ? " ✓" : ""}
                    </>
                  }
                  onClick={() =>
                    run(() => {
                      if (hasColor && onRemoveTag) {
                        onRemoveTag(entry, color);
                      } else {
                        onAssignTag(entry, color);
                      }
                    })
                  }
                />
              );
            })}
          </>
        </ContextMenuSubmenu>
      ) : null}
      <ContextMenuSeparator />
      <ContextMenuSubmenu icon={Icons.clipboardCopy()} label="Copy">
        <>
          <ContextMenuItem
            label="Copy Path"
            onClick={() => run(() => onCopyPath(panelId))}
          />
          <ContextMenuItem
            label="Copy Name"
            onClick={() => run(() => onCopyName(panelId))}
          />
          <ContextMenuItem
            label="Copy Parent Folder Path"
            onClick={() => run(() => onCopyParentPath(panelId))}
          />
          <ContextMenuItem
            label="Copy Resource URI"
            onClick={() => run(() => onCopyResourceUri(panelId))}
          />
        </>
      </ContextMenuSubmenu>
      <ContextMenuSubmenu icon={Icons.externalLink()} label="Open With">
        <>
          <ContextMenuItem
            icon={Icons.terminal()}
            label="Open Terminal"
            onClick={() => run(() => onOpenTerminal(panelId))}
          />
          <ContextMenuItem
            icon={Icons.externalLink()}
            label="Open External Terminal"
            onClick={() => run(() => onOpenTerminalExternal(panelId))}
          />
          <ContextMenuItem
            icon={Icons.externalLink()}
            label="Reveal in System File Manager"
            onClick={() => run(() => onReveal(panelId, entry))}
          />
        </>
      </ContextMenuSubmenu>
      <ContextMenuSubmenu icon={Icons.archive()} label="Tools">
        <>
          <ContextMenuItem
            disabled={remotePane}
            disabledReason="Packing is available only for local selections"
            icon={Icons.archive()}
            label="Pack…"
            onClick={() => run(() => onCompress(panelId))}
          />
          {canUnpack ? (
            <ContextMenuItem
              icon={Icons.archive()}
              label="Unpack…"
              onClick={() => run(() => onExtract(panelId))}
            />
          ) : null}
          <ContextMenuItem
            icon={Icons.hash()}
            label="Checksum…"
            onClick={() => run(() => onChecksum(panelId))}
          />
          <ContextMenuSeparator />
          <ContextMenuItem
            disabled={!canDelete}
            disabledReason={`${selectionLabel} cannot be permanently deleted`}
            icon={Icons.trash()}
            label="Delete Permanently…"
            onClick={() => run(() => onPermanentDelete(panelId))}
            shortcut={formatCommandShortcut(
              "op.deletePermanent",
              shortcutPlatform,
            )}
            tone="danger"
          />
        </>
      </ContextMenuSubmenu>
      <ContextMenuSeparator />
      <ContextMenuItem
        disabled={!canDelete}
        disabledReason={`${selectionLabel} cannot be deleted`}
        icon={Icons.trash()}
        label="Delete…"
        onClick={() => run(() => onDelete(panelId))}
        shortcut={formatCommandShortcut("op.delete", shortcutPlatform)}
      />
      {useTrashByDefault && !remotePane ? (
        <ContextMenuItem
          disabled={!canDelete}
          disabledReason={`${selectionLabel} cannot be moved to Trash`}
          icon={Icons.trash()}
          label="Move to Trash…"
          onClick={() => run(() => onTrash(panelId))}
        />
      ) : null}
      <ContextMenuSeparator />
      <ContextMenuItem
        icon={Icons.info()}
        label="Properties…"
        onClick={() => run(() => onProperties(panelId, entry))}
        shortcut={formatCommandShortcut("op.properties", shortcutPlatform)}
      />
    </>
  );
}

const TAG_COLOR_HEX: Record<TagColor, string> = {
  red: "#e53e3e",
  orange: "#ed8936",
  amber: "#d69e2e",
  yellow: "#ecc94b",
  green: "#38a169",
  teal: "#319795",
  blue: "#3182ce",
  indigo: "#5a67d8",
  violet: "#805ad5",
  pink: "#d53f8c",
};

function tagColorHex(color: TagColor): string {
  return TAG_COLOR_HEX[color];
}
