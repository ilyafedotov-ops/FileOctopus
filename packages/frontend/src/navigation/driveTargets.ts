import type {
  FavoriteEntryDto,
  NetworkConnectionStatusDto,
  NetworkProfileDto,
  RecentEntryDto,
  StandardLocationDto,
  StarredEntryDto,
} from "@fileoctopus/ts-api";
import { profileIdFromRemoteUri, remotePathFromUri } from "@fileoctopus/ts-api";

export type DriveTarget =
  | { kind: "local"; id: string; label: string; uri: string }
  | {
      kind: "network";
      id: string;
      label: string;
      uri: string;
      profile: NetworkProfileDto;
      status?: NetworkConnectionStatusDto;
    };

export type PaneLocationTargetKind =
  | "volume"
  | "network"
  | "networkRoot"
  | "standard"
  | "favorite"
  | "starred"
  | "recent";

export interface PaneLocationTarget {
  id: string;
  label: string;
  uri: string;
  section: string;
  kind: PaneLocationTargetKind;
  profile?: NetworkProfileDto;
  status?: NetworkConnectionStatusDto;
}

export interface PaneLocationTargetsInput {
  locations: StandardLocationDto[];
  networkProfiles: NetworkProfileDto[];
  networkStatuses: NetworkConnectionStatusDto[];
  favorites: FavoriteEntryDto[];
  starred: StarredEntryDto[];
  recentEntries: RecentEntryDto[];
}

export function buildDriveTargets(
  locations: StandardLocationDto[],
  networkProfiles: NetworkProfileDto[],
  networkStatuses: NetworkConnectionStatusDto[],
): DriveTarget[] {
  const local = locations
    .filter((location) => location.section === "Devices/Volumes")
    .map(
      (location): DriveTarget => ({
        kind: "local",
        id: location.id,
        label: location.name,
        uri: location.uri,
      }),
    );

  const network = networkProfiles
    .filter(
      (profile) =>
        profile.scheme === "sftp" ||
        profile.scheme === "smb" ||
        profile.scheme === "s3",
    )
    .map((profile): DriveTarget => {
      const status = networkStatuses.find(
        (item) => item.profileId === profile.id,
      );
      return {
        kind: "network",
        id: profile.id,
        label: profile.label,
        uri: profile.defaultUri,
        profile,
        status,
      };
    });

  return [...local, ...network];
}

export function isDriveTargetActive(
  target: DriveTarget,
  activeUri: string,
): boolean {
  if (target.kind === "local") {
    return target.uri === activeUri;
  }
  const activeProfileId = profileIdFromRemoteUri(activeUri);
  return activeProfileId === target.profile.id;
}

export function buildPaneLocationTargets({
  locations,
  networkProfiles,
  networkStatuses,
  favorites,
  starred,
  recentEntries,
}: PaneLocationTargetsInput): PaneLocationTarget[] {
  const targets: PaneLocationTarget[] = [];
  const seen = new Set<string>();
  const addTarget = (target: PaneLocationTarget) => {
    if (seen.has(target.uri)) {
      return;
    }
    seen.add(target.uri);
    targets.push(target);
  };

  locations
    .filter((location) => location.section === "Devices/Volumes")
    .forEach((location) =>
      addTarget({
        id: `volume-${location.id}`,
        label: location.name,
        uri: location.uri,
        section: "Devices/Volumes",
        kind: "volume",
      }),
    );

  buildDriveTargets([], networkProfiles, networkStatuses).forEach((target) => {
    if (target.kind !== "network") {
      return;
    }
    addTarget({
      id: `network-${target.id}`,
      label: target.label,
      uri: target.uri,
      section: "Network",
      kind: "network",
      profile: target.profile,
      status: target.status,
    });
  });

  addTarget({
    id: "network-neighborhood",
    label: "Network",
    uri: "network:///",
    section: "Network",
    kind: "networkRoot",
  });

  locations
    .filter((location) => location.section !== "Devices/Volumes")
    .forEach((location) =>
      addTarget({
        id: `standard-${location.id}`,
        label: location.name,
        uri: location.uri,
        section: "User folders",
        kind: "standard",
      }),
    );

  favorites.forEach((favorite) =>
    addTarget({
      id: `favorite-${favorite.id}`,
      label: favorite.label,
      uri: favorite.uri,
      section: "Favorites",
      kind: "favorite",
    }),
  );

  starred.forEach((entry, index) =>
    addTarget({
      id: `starred-${index}-${entry.uri}`,
      label: entry.label,
      uri: entry.uri,
      section: "Starred",
      kind: "starred",
    }),
  );

  recentEntries.forEach((entry, index) =>
    addTarget({
      id: `recent-${index}-${entry.uri}`,
      label: entry.label,
      uri: entry.uri,
      section: "Recent",
      kind: "recent",
    }),
  );

  return targets;
}

export function selectActivePaneLocationTarget(
  targets: PaneLocationTarget[],
  activeUri: string,
): PaneLocationTarget | null {
  let best: { target: PaneLocationTarget; score: number } | null = null;

  for (const target of targets) {
    const score = paneLocationTargetScore(target, activeUri);
    if (score > 0 && (!best || score > best.score)) {
      best = { target, score };
    }
  }

  return best?.target ?? null;
}

function paneLocationTargetScore(
  target: PaneLocationTarget,
  activeUri: string,
): number {
  if (target.uri === activeUri) {
    return 10_000 + target.uri.length;
  }

  if (target.kind === "network" && target.profile) {
    const activeProfileId = profileIdFromRemoteUri(activeUri);
    return activeProfileId === target.profile.id ? 5_000 : 0;
  }

  if (target.uri === "local:///") {
    return activeUri.startsWith("local:///") ? target.uri.length : 0;
  }

  const base = trimTrailingSlash(target.uri);
  if (base && activeUri.startsWith(`${base}/`)) {
    return base.length;
  }

  return 0;
}

function trimTrailingSlash(value: string): string {
  if (value === "local:///" || value === "network:///") {
    return value;
  }
  return value.replace(/\/+$/, "");
}

export function networkProfileBadge(
  profile: NetworkProfileDto,
  status: NetworkConnectionStatusDto | undefined,
): "warning" | "error" | null {
  if (!profile.hasStoredSecret) {
    return "warning";
  }
  if (status?.status === "error") {
    return "error";
  }
  return null;
}

export function networkProfileTitle(
  profile: NetworkProfileDto,
  status: NetworkConnectionStatusDto | undefined,
): string {
  if (!profile.hasStoredSecret) {
    return `${profile.label} (credentials missing)`;
  }
  if (status?.status === "connected") {
    return `${profile.label} (connected)`;
  }
  if (status?.status === "error") {
    return `${profile.label} (${status.message ?? "error"})`;
  }
  return profile.label;
}

export function driveTargetToolbarLabel(target: DriveTarget): string {
  if (target.kind === "network") {
    return `${target.label} (SFTP)`;
  }
  return target.label;
}

export function networkDriveHotlistTitle(profile: NetworkProfileDto): string {
  const path = remotePathFromUri(profile.defaultUri);
  if (path && path !== "/") {
    return `${profile.host}:${profile.port}${path}`;
  }
  return `${profile.host}:${profile.port}`;
}
