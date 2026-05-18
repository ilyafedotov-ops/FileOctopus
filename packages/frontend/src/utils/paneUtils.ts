import type {
  FileEntryDto,
  PathPropertiesDto,
  RecursiveSearchResultDto,
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
  return uri.replace(/^local:\/\//, "");
}

export function parentUri(uri: string): string | null {
  const path = uri.replace(/^local:\/\//, "");
  const normalized =
    path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path;
  const index = normalized.lastIndexOf("/");

  if (index <= 0) {
    return null;
  }

  return `local://${normalized.slice(0, index)}`;
}

export function breadcrumbSegments(
  uri: string,
): Array<{ label: string; uri: string }> {
  const path = localPathFromUri(uri).replace(/\/+$/, "");
  const segments = path.split("/").filter(Boolean);
  const result: Array<{ label: string; uri: string }> = [];
  let current = "";

  const isAbsolute = path.startsWith("/");

  for (const segment of segments) {
    current = isAbsolute || current ? `${current}/${segment}` : segment;
    result.push({
      label: segment,
      uri: `local://${isAbsolute ? current : `${current}/`}`,
    });
  }

  return result.length > 0 ? result : [{ label: uri, uri }];
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
