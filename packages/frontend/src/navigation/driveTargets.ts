import type {
  FavoriteEntryDto,
  FileEntryDto,
  NetworkConnectionStatusDto,
  NetworkProfileDto,
  RecentEntryDto,
  StandardLocationDto,
  StarredEntryDto,
} from "@fileoctopus/ts-api";
import { profileIdFromRemoteUri, remotePathFromUri } from "@fileoctopus/ts-api";

export type DriveTarget =
  | {
      kind: "local";
      id: string;
      label: string;
      uri: string;
      action: PaneLocationTargetAction;
    }
  | {
      kind: "cloud";
      id: string;
      label: string;
      uri: string;
      entry: FileEntryDto;
      action: PaneLocationTargetAction;
    }
  | {
      kind: "network";
      id: string;
      label: string;
      uri: string;
      profile: NetworkProfileDto;
      status?: NetworkConnectionStatusDto;
      action: PaneLocationTargetAction;
    };

export type PaneLocationTargetKind =
  | "volume"
  | "cloud"
  | "network"
  | "networkRoot"
  | "addServer"
  | "standard"
  | "favorite"
  | "starred"
  | "recent";

export type PaneLocationTargetAction =
  | { type: "navigate"; uri: string }
  | { type: "openTerminal"; profile: NetworkProfileDto }
  | { type: "addServer" };

export interface PaneLocationTarget {
  id: string;
  label: string;
  uri: string;
  section: string;
  kind: PaneLocationTargetKind;
  profile?: NetworkProfileDto;
  status?: NetworkConnectionStatusDto;
  entry?: FileEntryDto;
  action: PaneLocationTargetAction;
}

export interface PaneLocationTargetsInput {
  locations: StandardLocationDto[];
  networkQuickEntries: FileEntryDto[];
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
  networkQuickEntries: FileEntryDto[] = [],
): DriveTarget[] {
  const local = locations
    .filter((location) => location.section === "Devices/Volumes")
    .map(
      (location): DriveTarget => ({
        kind: "local",
        id: location.id,
        label: location.name,
        uri: location.uri,
        action: { type: "navigate", uri: location.uri },
      }),
    );

  const cloud = networkQuickEntries
    .filter(
      (entry) => entry.virtualKind === "cloudDrive" && Boolean(entry.targetUri),
    )
    .map(
      (entry): DriveTarget => ({
        kind: "cloud",
        id: entry.uri,
        label: entry.name,
        uri: entry.targetUri ?? entry.uri,
        entry,
        action: { type: "navigate", uri: entry.targetUri ?? entry.uri },
      }),
    );

  const network = networkProfiles
    .filter(isQuickConnectionProfile)
    .map((profile): DriveTarget => {
      const status = networkStatuses.find(
        (item) => item.profileId === profile.id,
      );
      const browseable = isBrowseableProfile(profile);
      return {
        kind: "network",
        id: profile.id,
        label: profile.label,
        uri: browseable ? profile.defaultUri : `ssh://${profile.id}`,
        profile,
        status,
        action: browseable
          ? { type: "navigate", uri: profile.defaultUri }
          : { type: "openTerminal", profile },
      };
    });

  return [...local, ...cloud, ...network];
}

export function isDriveTargetActive(
  target: DriveTarget,
  activeUri: string,
): boolean {
  if (target.kind === "local") {
    return target.uri === activeUri;
  }
  if (target.kind === "cloud") {
    return target.uri === activeUri || activeUri.startsWith(`${target.uri}/`);
  }
  if (target.action.type === "openTerminal") {
    return false;
  }
  const activeProfileId = profileIdFromRemoteUri(activeUri);
  return activeProfileId === target.profile.id;
}

export function buildPaneLocationTargets({
  locations,
  networkQuickEntries,
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
        action: { type: "navigate", uri: location.uri },
      }),
    );

  buildDriveTargets([], [], [], networkQuickEntries).forEach((target) => {
    addTarget({
      id: `cloud-${target.id}`,
      label: target.label,
      uri: target.uri,
      section: "Cloud Storage",
      kind: "cloud",
      entry: target.kind === "cloud" ? target.entry : undefined,
      action: target.action,
    });
  });

  buildDriveTargets([], networkProfiles, networkStatuses, []).forEach(
    (target) => {
      if (target.kind !== "network") {
        return;
      }
      addTarget({
        id: `network-${target.id}`,
        label: target.label,
        uri: target.uri,
        section: "Connections",
        kind: "network",
        profile: target.profile,
        status: target.status,
        action: target.action,
      });
    },
  );

  addTarget({
    id: "network-add-server",
    label: "Add Connection...",
    uri: "network:///add",
    section: "Connections",
    kind: "addServer",
    action: { type: "addServer" },
  });

  addTarget({
    id: "network-neighborhood",
    label: "Network",
    uri: "network:///",
    section: "Network",
    kind: "networkRoot",
    action: { type: "navigate", uri: "network:///" },
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
        action: { type: "navigate", uri: location.uri },
      }),
    );

  favorites.forEach((favorite) =>
    addTarget({
      id: `favorite-${favorite.id}`,
      label: favorite.label,
      uri: favorite.uri,
      section: "Favorites",
      kind: "favorite",
      action: { type: "navigate", uri: favorite.uri },
    }),
  );

  starred.forEach((entry, index) =>
    addTarget({
      id: `starred-${index}-${entry.uri}`,
      label: entry.label,
      uri: entry.uri,
      section: "Starred",
      kind: "starred",
      action: { type: "navigate", uri: entry.uri },
    }),
  );

  recentEntries.forEach((entry, index) =>
    addTarget({
      id: `recent-${index}-${entry.uri}`,
      label: entry.label,
      uri: entry.uri,
      section: "Recent",
      kind: "recent",
      action: { type: "navigate", uri: entry.uri },
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
    if (target.action.type === "openTerminal") {
      return 0;
    }
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

export function isBrowseableProfile(profile: NetworkProfileDto): boolean {
  return (
    profile.scheme === "sftp" ||
    profile.scheme === "smb" ||
    profile.scheme === "s3" ||
    profile.scheme === "webdav"
  );
}

export function isQuickConnectionProfile(profile: NetworkProfileDto): boolean {
  return isBrowseableProfile(profile) || profile.scheme === "ssh";
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
    return `${target.label} (${target.profile.scheme.toUpperCase()})`;
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
