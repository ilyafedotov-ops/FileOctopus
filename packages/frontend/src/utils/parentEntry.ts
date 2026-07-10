import type { FileEntryDto } from "@fileoctopus/ts-api";
import { parentUri, providerIdFromUri } from "./paneUtils";

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
    extension: null,
    kind: "directory",
    size: null,
    modifiedAt: null,
    createdAt: null,
    accessedAt: null,
    isHidden: false,
    isSymlink: false,
    isPlaceholder: false,
    symlinkTarget: null,
    providerId: providerIdFromUri(currentUri),
    canRead: true,
    canList: true,
    canWrite: false,
    canDelete: false,
    canRename: false,
    permissions: null,
    owner: null,
  };
}

export function isParentDirectoryEntry(
  entry: FileEntryDto,
  currentUri: string,
): boolean {
  return isParentDirectoryUri(entry.uri, currentUri);
}

export function isParentDirectoryUri(uri: string, currentUri: string): boolean {
  const parent = parentUri(currentUri);
  return parent !== null && uri === parent;
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
