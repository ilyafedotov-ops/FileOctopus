import { describe, expect, it } from "vitest";
import type {
  FavoriteEntryDto,
  FileEntryDto,
  NetworkConnectionStatusDto,
  NetworkProfileDto,
  RecentEntryDto,
  StandardLocationDto,
  StarredEntryDto,
} from "@fileoctopus/ts-api";
import {
  buildPaneLocationTargets,
  buildDriveTargets,
  isDriveTargetActive,
  selectActivePaneLocationTarget,
} from "../src/navigation/driveTargets";

const profile: NetworkProfileDto = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  label: "Prod",
  scheme: "sftp",
  host: "prod.example.com",
  port: 22,
  username: "deploy",
  authKind: "password",
  privateKeyPath: null,
  defaultPath: "/",
  defaultUri: "sftp://550e8400-e29b-41d4-a716-446655440000/",
  hostKeyFingerprint: null,
  sortOrder: 0,
  lastConnectedAt: null,
  lastError: null,
  hasStoredSecret: true,
  options: {},
  createdAt: "2026-05-19T00:00:00Z",
  updatedAt: "2026-05-19T00:00:00Z",
};

const cloudEntry: FileEntryDto = {
  uri: "network:///cloud/icloud",
  name: "iCloud Drive",
  kind: "directory",
  isHidden: false,
  isSymlink: false,
  providerId: "network",
  canRead: true,
  canList: true,
  canWrite: true,
  canDelete: false,
  canRename: false,
  targetUri: "local:///Users/ilya/Library/Mobile Documents/com~apple~CloudDocs",
  virtualKind: "cloudDrive",
};

function location(
  id: string,
  name: string,
  uri: string,
  section: string,
): StandardLocationDto {
  return { id, name, uri, section };
}

describe("buildDriveTargets", () => {
  it("lists local volumes, cloud entries, then network profiles", () => {
    const targets = buildDriveTargets(
      [
        location("root", "Macintosh HD", "local:///", "Devices/Volumes"),
        location("home", "Home", "local:///Users/ilya", "Favorites"),
      ],
      [profile],
      [],
      [cloudEntry],
    );

    expect(targets).toHaveLength(3);
    expect(targets[0]).toMatchObject({
      kind: "local",
      id: "root",
      label: "Macintosh HD",
    });
    expect(targets[1]).toMatchObject({
      kind: "cloud",
      label: "iCloud Drive",
      uri: "local:///Users/ilya/Library/Mobile Documents/com~apple~CloudDocs",
      action: {
        type: "navigate",
        uri: "local:///Users/ilya/Library/Mobile Documents/com~apple~CloudDocs",
      },
    });
    expect(targets[2]).toMatchObject({
      kind: "network",
      id: profile.id,
      label: "Prod",
    });
  });
});

describe("buildPaneLocationTargets", () => {
  it("groups all quick places with stable de-duplication", () => {
    const favorites: FavoriteEntryDto[] = [
      {
        id: 7,
        label: "Projects",
        uri: "local:///Users/ilya/Projects",
      },
      {
        id: 8,
        label: "Duplicate Root",
        uri: "local:///",
      },
    ];
    const starred: StarredEntryDto[] = [
      {
        label: "Design",
        uri: "local:///Users/ilya/Design",
        starredAt: "2026-05-27T00:00:00Z",
      },
    ];
    const recent: RecentEntryDto[] = [
      {
        label: "Downloads",
        uri: "local:///Users/ilya/Downloads",
        visitedAt: "2026-05-27T00:00:00Z",
      },
    ];

    const targets = buildPaneLocationTargets({
      locations: [
        location("root", "Macintosh HD", "local:///", "Devices/Volumes"),
        location("home", "Home", "local:///Users/ilya", "Favorites"),
        location(
          "downloads",
          "Downloads",
          "local:///Users/ilya/Downloads",
          "User folders",
        ),
      ],
      networkProfiles: [profile],
      networkQuickEntries: [cloudEntry],
      networkStatuses: [],
      favorites,
      starred,
      recentEntries: recent,
    });

    expect(
      targets.map((target) => `${target.section}:${target.label}`),
    ).toEqual([
      "Devices/Volumes:Macintosh HD",
      "Cloud Storage:iCloud Drive",
      "Connections:Prod",
      "Connections:Add Server...",
      "Network:Network",
      "User folders:Home",
      "User folders:Downloads",
      "Favorites:Projects",
      "Starred:Design",
    ]);
    expect(targets.filter((target) => target.uri === "local:///")).toHaveLength(
      1,
    );
  });
});

describe("selectActivePaneLocationTarget", () => {
  it("selects the most specific matching local target", () => {
    const targets = buildPaneLocationTargets({
      locations: [
        location("root", "Macintosh HD", "local:///", "Devices/Volumes"),
        location("work", "Work", "local:///Volumes/Work", "Devices/Volumes"),
      ],
      networkProfiles: [],
      networkQuickEntries: [],
      networkStatuses: [],
      favorites: [],
      starred: [],
      recentEntries: [],
    });

    expect(
      selectActivePaneLocationTarget(targets, "local:///Volumes/Work/src"),
    ).toMatchObject({
      label: "Work",
      uri: "local:///Volumes/Work",
    });
  });

  it("selects the matching remote profile for nested network paths", () => {
    const targets = buildPaneLocationTargets({
      locations: [],
      networkProfiles: [profile],
      networkQuickEntries: [],
      networkStatuses: [],
      favorites: [],
      starred: [],
      recentEntries: [],
    });

    expect(
      selectActivePaneLocationTarget(
        targets,
        "sftp://550e8400-e29b-41d4-a716-446655440000/var/log",
      ),
    ).toMatchObject({ label: "Prod" });
  });
});

describe("isDriveTargetActive", () => {
  it("matches local targets by exact uri", () => {
    const target = buildDriveTargets(
      [location("root", "Macintosh HD", "local:///", "Devices/Volumes")],
      [],
      [],
    )[0];

    expect(isDriveTargetActive(target, "local:///")).toBe(true);
    expect(isDriveTargetActive(target, "local:///Users")).toBe(false);
  });

  it("matches network targets for any path under the profile", () => {
    const target = buildDriveTargets([], [profile], [])[0];
    const nestedUri = "sftp://550e8400-e29b-41d4-a716-446655440000/var/log";

    expect(isDriveTargetActive(target, profile.defaultUri)).toBe(true);
    expect(isDriveTargetActive(target, nestedUri)).toBe(true);
    expect(
      isDriveTargetActive(
        target,
        "sftp://00000000-0000-0000-0000-000000000000/",
      ),
    ).toBe(false);
  });

  it("attaches connection status to network targets", () => {
    const statuses: NetworkConnectionStatusDto[] = [
      {
        profileId: profile.id,
        status: "connected",
        message: null,
      },
    ];
    const target = buildDriveTargets([], [profile], statuses)[0];

    expect(target.kind).toBe("network");
    if (target.kind === "network") {
      expect(target.status?.status).toBe("connected");
    }
  });
});

import {
  networkProfileBadge,
  networkProfileTitle,
  driveTargetToolbarLabel,
  networkDriveHotlistTitle,
} from "../src/navigation/driveTargets";

describe("networkProfileBadge", () => {
  it("returns warning when hasStoredSecret is false", () => {
    const p = { ...profile, hasStoredSecret: false };
    expect(networkProfileBadge(p, undefined)).toBe("warning");
  });

  it("returns error when status is error", () => {
    const status: NetworkConnectionStatusDto = {
      profileId: profile.id,
      status: "error",
      message: "connection refused",
    };
    expect(networkProfileBadge(profile, status)).toBe("error");
  });

  it("returns null when hasStoredSecret and no error", () => {
    const status: NetworkConnectionStatusDto = {
      profileId: profile.id,
      status: "connected",
      message: null,
    };
    expect(networkProfileBadge(profile, status)).toBeNull();
  });

  it("returns null with no status and hasStoredSecret", () => {
    expect(networkProfileBadge(profile, undefined)).toBeNull();
  });
});

describe("networkProfileTitle", () => {
  it("shows credentials missing when no stored secret", () => {
    const p = { ...profile, hasStoredSecret: false };
    expect(networkProfileTitle(p, undefined)).toBe(
      "Prod (credentials missing)",
    );
  });

  it("shows connected when status is connected", () => {
    const status: NetworkConnectionStatusDto = {
      profileId: profile.id,
      status: "connected",
      message: null,
    };
    expect(networkProfileTitle(profile, status)).toBe("Prod (connected)");
  });

  it("shows error message when status is error", () => {
    const status: NetworkConnectionStatusDto = {
      profileId: profile.id,
      status: "error",
      message: "timeout",
    };
    expect(networkProfileTitle(profile, status)).toBe("Prod (timeout)");
  });

  it("shows just label when no status and has secret", () => {
    expect(networkProfileTitle(profile, undefined)).toBe("Prod");
  });

  it("shows error fallback when status error has no message", () => {
    const status: NetworkConnectionStatusDto = {
      profileId: profile.id,
      status: "error",
      message: null,
    };
    expect(networkProfileTitle(profile, status)).toBe("Prod (error)");
  });
});

describe("driveTargetToolbarLabel", () => {
  it("returns label with SFTP for network target", () => {
    const targets = buildDriveTargets([], [profile], []);
    expect(driveTargetToolbarLabel(targets[0])).toBe("Prod (SFTP)");
  });

  it("returns label for local target", () => {
    const targets = buildDriveTargets(
      [location("root", "Macintosh HD", "local:///", "Devices/Volumes")],
      [],
      [],
    );
    expect(driveTargetToolbarLabel(targets[0])).toBe("Macintosh HD");
  });
});

describe("networkDriveHotlistTitle", () => {
  it("includes path when not root", () => {
    const p = {
      ...profile,
      defaultUri: `sftp://${profile.id}/var/log`,
    };
    expect(networkDriveHotlistTitle(p)).toContain("prod.example.com:22");
  });

  it("omits path when root", () => {
    const p = {
      ...profile,
      defaultUri: `sftp://${profile.id}/`,
    };
    const title = networkDriveHotlistTitle(p);
    expect(title).toBe("prod.example.com:22");
  });
});

describe("buildDriveTargets filtering", () => {
  it("includes browseable profiles and SSH-only terminal profiles", () => {
    const webdavProfile = {
      ...profile,
      id: "webdav-1",
      scheme: "webdav",
      label: "WebDAV",
    };
    const sshProfile = {
      ...profile,
      id: "ssh-1",
      scheme: "ssh",
      label: "SSH Shell",
    };
    const ftpProfile = {
      ...profile,
      id: "ftp-1",
      scheme: "ftp",
      label: "FTP",
    };
    const targets = buildDriveTargets(
      [],
      [profile, webdavProfile, sshProfile, ftpProfile],
      [],
    );

    expect(targets.map((target) => target.label)).toEqual([
      "Prod",
      "WebDAV",
      "SSH Shell",
    ]);
    expect(targets[2]).toMatchObject({
      kind: "network",
      uri: "ssh://ssh-1",
      action: { type: "openTerminal" },
    });
  });

  it("returns empty array with no locations or profiles", () => {
    expect(buildDriveTargets([], [], [])).toEqual([]);
  });

  it("includes only volume locations, not other sections", () => {
    const targets = buildDriveTargets(
      [
        location("root", "Root", "local:///", "Devices/Volumes"),
        location("home", "Home", "local:///home", "Favorites"),
      ],
      [],
      [],
    );
    expect(targets).toHaveLength(1);
    expect(targets[0].kind).toBe("local");
  });
});
