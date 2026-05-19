import { describe, expect, it } from "vitest";
import type {
  NetworkConnectionStatusDto,
  NetworkProfileDto,
  StandardLocationDto,
} from "@fileoctopus/ts-api";
import {
  buildDriveTargets,
  isDriveTargetActive,
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
  createdAt: "2026-05-19T00:00:00Z",
  updatedAt: "2026-05-19T00:00:00Z",
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
  it("lists local volumes before network profiles", () => {
    const targets = buildDriveTargets(
      [
        location("root", "Macintosh HD", "local:///", "Devices/Volumes"),
        location("home", "Home", "local:///Users/ilya", "Favorites"),
      ],
      [profile],
      [],
    );

    expect(targets).toHaveLength(2);
    expect(targets[0]).toMatchObject({
      kind: "local",
      id: "root",
      label: "Macintosh HD",
    });
    expect(targets[1]).toMatchObject({
      kind: "network",
      id: profile.id,
      label: "Prod",
    });
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
