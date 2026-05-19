export const REMOTE_URI_SCHEMES = ["sftp", "smb", "webdav"] as const;

export type RemoteUriScheme = (typeof REMOTE_URI_SCHEMES)[number];

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

export function isSupportedNavigationUri(uri: string): boolean {
  return uri.startsWith("local://") || isRemoteUri(uri);
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
  if (isRemoteUri(uri)) {
    return remotePathFromUri(uri) ?? uri;
  }
  return uri.replace(/^local:\/\//, "");
}

export function parentUriFromUri(uri: string): string | null {
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
  const normalized =
    path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path;
  const index = normalized.lastIndexOf("/");

  if (index <= 0) {
    return null;
  }

  return `local://${normalized.slice(0, index)}`;
}

export function rootUriForUri(uri: string): string {
  if (isRemoteUri(uri)) {
    const scheme = uriScheme(uri);
    const profileId = profileIdFromRemoteUri(uri);
    if (!scheme || !profileId) {
      return uri;
    }
    return buildRemoteUri(scheme, profileId, "/");
  }

  const path = displayPathFromUri(uri);
  const driveMatch =
    path.match(/^\/([A-Za-z]:)[\\/]/) ?? path.match(/^([A-Za-z]:)[\\/]/);
  if (driveMatch) {
    return `local:///${driveMatch[1]}/`;
  }
  return "local:///";
}

export function breadcrumbSegmentsFromUri(uri: string): UriBreadcrumbSegment[] {
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
