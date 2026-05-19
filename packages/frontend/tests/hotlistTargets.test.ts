import { describe, expect, it } from "vitest";
import type {
  FavoriteEntryDto,
  NetworkProfileDto,
  RecentEntryDto,
  StandardLocationDto,
} from "@fileoctopus/ts-api";
import { buildHotlistTargets } from "../src/shell/hotlistTargets";

function location(
  id: string,
  name: string,
  uri: string,
  section: string,
): StandardLocationDto {
  return { id, name, uri, section };
}

function favorite(id: number, label: string, uri: string): FavoriteEntryDto {
  return { id, label, uri };
}

function recent(label: string, uri: string): RecentEntryDto {
  return { label, uri, visitedAt: "2026-05-19T10:00:00.000Z" };
}

const networkProfile: NetworkProfileDto = {
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

describe("buildHotlistTargets", () => {
  it("keeps user folders out of the hotlist unless pinned or recent", () => {
    const result = buildHotlistTargets({
      activeUri: "local:///Users/ilya/conductor",
      parentUri: "local:///Users/ilya",
      locations: [
        location("home", "Home", "local:///Users/ilya", "Favorites"),
        location(
          "desktop",
          "Desktop",
          "local:///Users/ilya/Desktop",
          "User folders",
        ),
        location(
          "macintosh-hd",
          "Macintosh HD",
          "local:///",
          "Devices/Volumes",
        ),
      ],
      favorites: [favorite(1, "Project", "local:///Users/ilya/conductor")],
      recentToday: [recent("Downloads", "local:///Users/ilya/Downloads")],
      recentWeek: [],
    });

    expect(result.visible.map((target) => target.label)).toEqual([
      "..",
      "Macintosh HD",
      "Downloads",
    ]);
  });

  it("moves lower priority targets into overflow", () => {
    const result = buildHotlistTargets({
      activeUri: "local:///Users/ilya/work",
      parentUri: "local:///Users/ilya",
      locations: [
        location("home", "Home", "local:///Users/ilya/home", "Favorites"),
        location("root", "Macintosh HD", "local:///", "Devices/Volumes"),
      ],
      favorites: [favorite(1, "One", "local:///one")],
      recentToday: [recent("Two", "local:///two")],
      recentWeek: [],
      maxVisible: 3,
    });

    expect(result.visible.map((target) => target.label)).toEqual([
      "..",
      "Home",
      "Macintosh HD",
    ]);
    expect(result.overflow.map((target) => target.label)).toEqual([
      "One",
      "Two",
    ]);
  });

  it("includes network profiles after local volumes", () => {
    const result = buildHotlistTargets({
      activeUri: "local:///Users/ilya/work",
      parentUri: "local:///Users/ilya",
      locations: [
        location("root", "Macintosh HD", "local:///", "Devices/Volumes"),
      ],
      networkProfiles: [networkProfile],
      networkStatuses: [],
      favorites: [],
      recentToday: [],
      recentWeek: [],
    });

    expect(result.visible.map((target) => target.label)).toEqual([
      "..",
      "Macintosh HD",
      "Prod",
    ]);
    expect(
      result.visible.find((target) => target.kind === "network")?.glyph,
    ).toBe("⇄");
  });
});
