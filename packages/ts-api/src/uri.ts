export const REMOTE_URI_SCHEMES = ["sftp", "smb", "s3", "webdav"] as const;

export type RemoteUriScheme = (typeof REMOTE_URI_SCHEMES)[number];

const NETWORK_URI_LABELS: Record<string, string> = {
  cloud: "Cloud Storage",
  lan: "Local Network",
  saved: "Saved Connections",
  add: "Add Connection",
};

export interface UriBreadcrumbSegment {
  label: string;
  uri: string;
}

export function uriScheme(uri: string): string | null {
  const separator = uri.indexOf("://");
  if (separator <= 0) {
    return null;
  }
  return uri.slice(0, separator);
}

export function isRemoteUri(uri: string): boolean {
  const scheme = uriScheme(uri);
  return (
    scheme != null && REMOTE_URI_SCHEMES.includes(scheme as RemoteUriScheme)
  );
}

export function isNetworkUri(uri: string): boolean {
  return uriScheme(uri) === "network" && uri.startsWith("network:///");
}

export function isSupportedNavigationUri(uri: string): boolean {
  return uri.startsWith("local://") || isRemoteUri(uri) || isNetworkUri(uri);
}

export function profileIdFromRemoteUri(uri: string): string | null {
  if (!isRemoteUri(uri)) {
    return null;
  }
  const body = uri.split("://")[1];
  if (!body) {
    return null;
  }
  return body.split("/")[0] || null;
}

export function remotePathFromUri(uri: string): string | null {
  if (!isRemoteUri(uri)) {
    return null;
  }
  const profileId = profileIdFromRemoteUri(uri);
  if (!profileId) {
    return null;
  }
  const body = uri.slice(uri.indexOf("://") + 3);
  const path = body.slice(profileId.length);
  if (path.length === 0) {
    return "/";
  }
  return path.startsWith("/") ? path : `/${path}`;
}

export function buildRemoteUri(
  scheme: string,
  profileId: string,
  path: string,
): string {
  const normalized =
    path === "" || path === "/" ? "/" : path.replace(/\/+$/, "");
  if (normalized === "/") {
    return `${scheme}://${profileId}/`;
  }
  return `${scheme}://${profileId}${normalized.startsWith("/") ? normalized : `/${normalized}`}`;
}

export function displayPathFromUri(uri: string): string {
  if (isNetworkUri(uri)) {
    const parts = networkPathParts(uri);
    if (parts.length === 0) {
      return "Network";
    }
    return ["Network", ...parts.map(networkPartLabel)].join(" / ");
  }

  if (isRemoteUri(uri)) {
    return remotePathFromUri(uri) ?? uri;
  }
  return uri.replace(/^local:\/\//, "");
}

export function parentUriFromUri(uri: string): string | null {
  if (isNetworkUri(uri)) {
    const parts = networkPathParts(uri);
    if (parts.length === 0) {
      return null;
    }
    if (parts.length === 1) {
      return "network:///";
    }
    return networkUriFromParts(parts.slice(0, -1));
  }

  if (isRemoteUri(uri)) {
    const scheme = uriScheme(uri);
    const profileId = profileIdFromRemoteUri(uri);
    if (!scheme || !profileId) {
      return null;
    }

    const path = (remotePathFromUri(uri) ?? "/").replace(/\/+$/, "") || "/";
    if (path === "/") {
      return null;
    }

    const lastSlash = path.lastIndexOf("/");
    if (lastSlash === 0) {
      return buildRemoteUri(scheme, profileId, "/");
    }

    return buildRemoteUri(scheme, profileId, path.slice(0, lastSlash));
  }

  const path = uri.replace(/^local:\/\//, "");
  const uncPath = localUncPath(path);
  if (uncPath) {
    if (uncPath.segments.length === 0) {
      return null;
    }
    if (uncPath.segments.length === 1) {
      return uncPath.rootUri;
    }
    return `${uncPath.rootUri}${uncPath.segments.slice(0, -1).join("/")}`;
  }
  if (path.startsWith("//")) {
    return null;
  }

  const normalized =
    path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path;
  const index = normalized.lastIndexOf("/");

  if (index < 0 || normalized === "/") {
    return null;
  }
  if (index === 0) {
    return "local:///";
  }

  const parentPath = normalized.slice(0, index);
  const driveRootMatch = parentPath.match(/^\/?([A-Za-z]:)$/);
  if (driveRootMatch) {
    return `local://${driveRootMatch[1]}/`;
  }

  return `local://${parentPath}`;
}

export function rootUriForUri(uri: string): string {
  if (isNetworkUri(uri)) {
    return "network:///";
  }

  if (isRemoteUri(uri)) {
    const scheme = uriScheme(uri);
    const profileId = profileIdFromRemoteUri(uri);
    if (!scheme || !profileId) {
      return uri;
    }
    return buildRemoteUri(scheme, profileId, "/");
  }

  const path = displayPathFromUri(uri);
  const uncPath = localUncPath(path);
  if (uncPath) {
    return uncPath.rootUri;
  }

  const driveMatch =
    path.match(/^\/([A-Za-z]:)[\\/]/) ?? path.match(/^([A-Za-z]:)[\\/]/);
  if (driveMatch) {
    return `local://${driveMatch[1]}/`;
  }
  return "local:///";
}

export function breadcrumbSegmentsFromUri(uri: string): UriBreadcrumbSegment[] {
  if (isNetworkUri(uri)) {
    const parts = networkPathParts(uri);
    const segments: UriBreadcrumbSegment[] = [
      { label: "Network", uri: "network:///" },
    ];
    let current: string[] = [];
    for (const part of parts) {
      current = [...current, part];
      segments.push({
        label: networkPartLabel(part),
        uri: networkUriFromParts(current),
      });
    }
    return segments;
  }

  if (isRemoteUri(uri)) {
    const scheme = uriScheme(uri);
    const profileId = profileIdFromRemoteUri(uri);
    if (!scheme || !profileId) {
      return [{ label: uri, uri }];
    }

    const path = (remotePathFromUri(uri) ?? "/").replace(/\/+$/, "");
    const segments = path.split("/").filter(Boolean);
    if (segments.length === 0) {
      return [{ label: "/", uri }];
    }

    let current = "";
    return segments.map((segment) => {
      current = `${current}/${segment}`;
      return {
        label: segment,
        uri: buildRemoteUri(scheme, profileId, current),
      };
    });
  }

  const path = displayPathFromUri(uri).replace(/\/+$/, "");
  const uncPath = localUncPath(path);
  if (uncPath) {
    const result: UriBreadcrumbSegment[] = [
      {
        label: `//${uncPath.server}/${uncPath.share}`,
        uri: uncPath.rootUri,
      },
    ];
    let current = uncPath.rootUri.slice(0, -1);

    for (const segment of uncPath.segments) {
      current = `${current}/${segment}`;
      result.push({ label: segment, uri: current });
    }

    return result;
  }

  const drivePathMatch = path.match(/^\/?([A-Za-z]:)(?:\/(.*))?$/);
  if (drivePathMatch) {
    const drive = drivePathMatch[1];
    const segments = (drivePathMatch[2] ?? "").split("/").filter(Boolean);
    const result: UriBreadcrumbSegment[] = [
      { label: drive, uri: `local://${drive}/` },
    ];
    let current = drive;

    for (const segment of segments) {
      current = `${current}/${segment}`;
      result.push({ label: segment, uri: `local://${current}` });
    }

    return result;
  }

  const parts = path.split("/").filter(Boolean);
  const result: UriBreadcrumbSegment[] = [];
  let current = "";
  const isAbsolute = path.startsWith("/");

  for (const segment of parts) {
    current = isAbsolute || current ? `${current}/${segment}` : segment;
    result.push({
      label: segment,
      uri: `local://${isAbsolute ? current : `${current}/`}`,
    });
  }

  return result.length > 0 ? result : [{ label: uri, uri }];
}

function networkPathParts(uri: string): string[] {
  return uri
    .replace(/^network:\/\//, "")
    .split("/")
    .filter(Boolean);
}

function localUncPath(path: string): {
  server: string;
  share: string;
  segments: string[];
  rootUri: string;
} | null {
  const normalized = path.replace(/\/+$/, "");
  const match = normalized.match(/^\/\/([^/]+)\/([^/]+)(?:\/(.*))?$/);
  if (!match) {
    return null;
  }

  const server = match[1];
  const share = match[2];
  return {
    server,
    share,
    segments: (match[3] ?? "").split("/").filter(Boolean),
    rootUri: `local:////${server}/${share}/`,
  };
}

function networkUriFromParts(parts: string[]): string {
  return parts.length === 0 ? "network:///" : `network:///${parts.join("/")}`;
}

function networkPartLabel(part: string): string {
  return (
    NETWORK_URI_LABELS[part] ??
    part
      .split(/[-_]/)
      .filter(Boolean)
      .map((value) => value.charAt(0).toUpperCase() + value.slice(1))
      .join(" ")
  );
}
