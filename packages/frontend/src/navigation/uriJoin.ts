import {
  buildRemoteUri,
  isRemoteUri,
  profileIdFromRemoteUri,
  remotePathFromUri,
  uriScheme,
} from "@fileoctopus/ts-api";

export function joinUri(parent: string, name: string): string {
  if (isRemoteUri(parent)) {
    const scheme = uriScheme(parent);
    const profileId = profileIdFromRemoteUri(parent);
    if (!scheme || !profileId) {
      return parent;
    }

    const path = (remotePathFromUri(parent) ?? "/").replace(/\/+$/, "") || "/";
    const joined = path === "/" ? `/${name}` : `${path}/${name}`;
    return buildRemoteUri(scheme, profileId, joined);
  }

  return `${parent.replace(/\/$/, "")}/${name}`;
}
