import type {
  FileEntryDto,
  PathPropertiesDto,
  RecursiveSearchResultDto,
} from "@fileoctopus/ts-api";
import {
  breadcrumbSegmentsFromUri,
  displayPathFromUri,
  parentUriFromUri,
  rootUriForUri,
  uriScheme,
} from "@fileoctopus/ts-api";

export function propertyType(properties: PathPropertiesDto): string {
  if (properties.kind === "directory") {
    return "Folder";
  }

  if (properties.isSymlink) {
    return "Symlink";
  }

  return properties.kind;
}

export function localPathFromUri(uri: string): string {
  return displayPathFromUri(uri);
}

export function parentUri(uri: string): string | null {
  return parentUriFromUri(uri);
}

export function rootUri(currentUri: string): string {
  return rootUriForUri(currentUri);
}

export function breadcrumbSegments(
  uri: string,
): Array<{ label: string; uri: string }> {
  return breadcrumbSegmentsFromUri(uri);
}

export function searchMatchToEntry(
  match: RecursiveSearchResultDto["matches"][number],
): FileEntryDto {
  return {
    uri: match.uri,
    name: match.name,
    kind: match.kind,
    size: match.size,
    modifiedAt: match.modifiedAt,
    isHidden: false,
    isSymlink: match.kind === "symlink",
    providerId: "local",
    canRead: true,
    canList: match.kind === "directory",
    canWrite: true,
    canDelete: true,
    canRename: true,
  };
}

export function providerIdFromUri(uri: string): string {
  return uriScheme(uri) ?? "local";
}
