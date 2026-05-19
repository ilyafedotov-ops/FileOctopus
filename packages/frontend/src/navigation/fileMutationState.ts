import type { FileEntryDto } from "@fileoctopus/ts-api";
import { isRemoteUri } from "@fileoctopus/ts-api";
import type { PanelTabState } from "../panelStore";
import { countOperationalSelection } from "../panelStore";

export interface FileMutationCapabilities {
  canCopy: boolean;
  canMove: boolean;
  canRename: boolean;
  canDelete: boolean;
  canNewFolder: boolean;
  canCreateFile: boolean;
  canEdit: boolean;
}

export function paneDirectoryCanWrite(tab: PanelTabState): boolean {
  const directoryEntry = tab.entriesById[tab.uri];
  if (directoryEntry?.kind === "directory") {
    return directoryEntry.canWrite;
  }

  if (!isRemoteUri(tab.uri)) {
    return true;
  }

  const entries = Object.values(tab.entriesById);
  if (entries.length === 0) {
    return true;
  }

  return entries.some((entry) => entry.canWrite);
}

export function fileMutationState(
  tab: PanelTabState,
  selectedEntries: FileEntryDto[],
): FileMutationCapabilities {
  const selectionCount = countOperationalSelection(tab);
  const hasSelection = selectionCount > 0;
  const remotePane = isRemoteUri(tab.uri);
  const paneWritable = paneDirectoryCanWrite(tab);

  return {
    canCopy: hasSelection && selectedEntries.every((entry) => entry.canRead),
    canMove:
      hasSelection &&
      selectedEntries.every((entry) => entry.canWrite && entry.canDelete),
    canRename: selectionCount === 1 && Boolean(selectedEntries[0]?.canRename),
    canDelete:
      hasSelection && selectedEntries.every((entry) => entry.canDelete),
    canNewFolder: paneWritable,
    canCreateFile: paneWritable,
    canEdit: Boolean(selectedEntries[0]) && !remotePane,
  };
}
