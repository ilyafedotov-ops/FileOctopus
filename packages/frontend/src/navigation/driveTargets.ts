import type {
  NetworkConnectionStatusDto,
  NetworkProfileDto,
  StandardLocationDto,
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
