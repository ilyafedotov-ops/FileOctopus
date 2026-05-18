import type { FileEntryDto } from "@fileoctopus/ts-api";
import { parentUri } from "./paneUtils";

export const PARENT_DIRECTORY_NAME = "..";

export function createParentDirectoryEntry(
  currentUri: string,
): FileEntryDto | null {
  const uri = parentUri(currentUri);
  if (!uri) {
    return null;
  }

  return {
    uri,
    name: PARENT_DIRECTORY_NAME,
    kind: "directory",
    isHidden: false,
    isSymlink: false,
    providerId: "local",
    canRead: true,
    canList: true,
    canWrite: false,
    canDelete: false,
    canRename: false,
  };
}

export function isParentDirectoryEntry(
  entry: FileEntryDto,
  currentUri: string,
): boolean {
  const parent = parentUri(currentUri);
  return (
    entry.name === PARENT_DIRECTORY_NAME &&
    parent !== null &&
    entry.uri === parent
  );
}

export function prependParentDirectoryEntry(
  currentUri: string,
  entries: FileEntryDto[],
): FileEntryDto[] {
  const parentEntry = createParentDirectoryEntry(currentUri);
  if (!parentEntry) {
    return entries;
  }

  if (entries.some((entry) => entry.name === PARENT_DIRECTORY_NAME)) {
    return entries;
  }

  return [parentEntry, ...entries];
}
