import { describe, expect, it } from "vitest";
import type {
  FavoriteEntryDto,
  NetworkConnectionStatusDto,
  NetworkProfileDto,
  RecentEntryDto,
  StandardLocationDto,
  StarredEntryDto,
} from "@fileoctopus/ts-api";
import { buildHotlistTargets } from "../src/shell/hotlistTargets";

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

function loc(
  id: string,
  name: string,
  uri: string,
  section: string,
): StandardLocationDto {
  return { id, name, uri, section };
}

const baseInput = {
  activeUri: "local:///Users/test/Documents",
  parentUri: "local:///Users/test" as string | null,
  locations: [] as StandardLocationDto[],
  networkProfiles: [] as NetworkProfileDto[],
  networkStatuses: [] as NetworkConnectionStatusDto[],
  favorites: [] as FavoriteEntryDto[],
  starred: [] as StarredEntryDto[],
  recentToday: [] as RecentEntryDto[],
  recentWeek: [] as RecentEntryDto[],
};

describe("buildHotlistTargets", () => {
  // --- Parent target ---
  it("includes parent target when parentUri is provided", () => {
    const result = buildHotlistTargets({
      ...baseInput,
      parentUri: "local:///Users/test",
    });
    const parent = result.visible.find((t) => t.kind === "parent");
    expect(parent).toBeDefined();
    expect(parent!.label).toBe("..");
    expect(parent!.glyph).toBe("↑");
    expect(parent!.uri).toBe("local:///Users/test");
  });

  it("omits parent target when parentUri is null", () => {
    const result = buildHotlistTargets({
      ...baseInput,
      parentUri: null,
    });
    expect(result.visible.find((t) => t.kind === "parent")).toBeUndefined();
  });

  // --- Home target ---
  it("includes home target from location with id=home", () => {
    const result = buildHotlistTargets({
      ...baseInput,
      locations: [loc("home", "My Home", "local:///Users/test", "Favorites")],
    });
    const home = result.visible.find((t) => t.kind === "home");
    expect(home).toBeDefined();
    expect(home!.label).toBe("My Home");
    expect(home!.glyph).toBe("~");
    expect(home!.uri).toBe("local:///Users/test");
  });

  it("falls back to location named Home in Favorites section", () => {
    const result = buildHotlistTargets({
      ...baseInput,
      locations: [loc("custom", "Home", "local:///Users/test", "Favorites")],
    });
    const home = result.visible.find((t) => t.kind === "home");
    expect(home).toBeDefined();
    expect(home!.label).toBe("Home");
  });

  it("falls back to homeUri() when no matching location", () => {
    const result = buildHotlistTargets({
      ...baseInput,
      locations: [],
    });
    const home = result.visible.find((t) => t.kind === "home");
    expect(home).toBeDefined();
    expect(home!.glyph).toBe("~");
  });

  it("deduplicates home if it matches activeUri", () => {
    const result = buildHotlistTargets({
      ...baseInput,
      activeUri: "local:///Users/test",
      locations: [loc("home", "Home", "local:///Users/test", "Favorites")],
      parentUri: null,
    });
    const home = result.visible.find((t) => t.kind === "home");
    // activeUri is excluded, so home target should be skipped
    expect(home).toBeUndefined();
  });

  // --- Volume targets ---
  it("includes local volume targets from Devices/Volumes section", () => {
    const result = buildHotlistTargets({
      ...baseInput,
      locations: [loc("root", "Macintosh HD", "local:///", "Devices/Volumes")],
    });
    const vol = result.visible.find((t) => t.kind === "volume");
    expect(vol).toBeDefined();
    expect(vol!.label).toBe("Macintosh HD");
    expect(vol!.glyph).toBe("▣");
    expect(vol!.uri).toBe("local:///");
  });

  it("does not include locations from other sections as volumes", () => {
    const result = buildHotlistTargets({
      ...baseInput,
      locations: [
        loc("docs", "Documents", "local:///Users/test/Documents", "Favorites"),
      ],
    });
    expect(result.visible.find((t) => t.kind === "volume")).toBeUndefined();
  });

  // --- Network targets ---
  it("includes network profile targets", () => {
    const result = buildHotlistTargets({
      ...baseInput,
      networkProfiles: [profile],
    });
    const net = result.visible.find((t) => t.kind === "network");
    expect(net).toBeDefined();
    expect(net!.label).toBe("Prod");
    expect(net!.glyph).toBe("⇄");
  });

  it("does not include non-sftp/smb/s3 profiles", () => {
    const ftpProfile = {
      ...profile,
      id: "ftp-id",
      label: "FTP",
      scheme: "ftp" as unknown as FavoriteEntryDto["scheme"],
    };
    const result = buildHotlistTargets({
      ...baseInput,
      networkProfiles: [ftpProfile],
    });
    expect(result.visible.find((t) => t.kind === "network")).toBeUndefined();
  });

  // --- Favorite targets ---
  it("includes favorite targets", () => {
    const fav: FavoriteEntryDto = {
      id: 1,
      label: "Projects",
      uri: "local:///Users/test/Projects",
    };
    const result = buildHotlistTargets({
      ...baseInput,
      favorites: [fav],
    });
    const f = result.visible.find((t) => t.kind === "favorite");
    expect(f).toBeDefined();
    expect(f!.label).toBe("Projects");
    expect(f!.glyph).toBe("★");
  });

  it("uses locationName for favorite without label", () => {
    const fav: FavoriteEntryDto = {
      id: 2,
      label: "",
      uri: "local:///Users/test/Projects",
    };
    const result = buildHotlistTargets({
      ...baseInput,
      favorites: [fav],
    });
    const f = result.visible.find((t) => t.kind === "favorite");
    expect(f).toBeDefined();
    expect(f!.label).toBe("Projects");
  });

  // --- Starred targets ---
  it("includes starred targets", () => {
    const starred: StarredEntryDto[] = [
      {
        label: "Design",
        uri: "local:///Users/test/Design",
        starredAt: "2026-05-27T00:00:00Z",
      },
    ];
    const result = buildHotlistTargets({
      ...baseInput,
      starred,
    });
    const s = result.visible.find((t) => t.kind === "starred");
    expect(s).toBeDefined();
    expect(s!.label).toBe("Design");
    expect(s!.glyph).toBe("☆");
  });

  // --- Recent targets ---
  it("includes recent targets from both today and week", () => {
    const recentToday: RecentEntryDto[] = [
      {
        label: "Downloads",
        uri: "local:///Users/test/Downloads",
        visitedAt: "2026-05-27T00:00:00Z",
      },
    ];
    const recentWeek: RecentEntryDto[] = [
      {
        label: "Archive",
        uri: "local:///Users/test/Archive",
        visitedAt: "2026-05-20T00:00:00Z",
      },
    ];
    const result = buildHotlistTargets({
      ...baseInput,
      recentToday,
      recentWeek,
    });
    const recents = result.visible.filter((t) => t.kind === "recent");
    expect(recents).toHaveLength(2);
    expect(recents[0].glyph).toBe("◷");
    expect(recents[0].label).toBe("Downloads");
    expect(recents[1].label).toBe("Archive");
  });

  it("uses locationName for recent without label", () => {
    const result = buildHotlistTargets({
      ...baseInput,
      recentToday: [
        {
          label: "",
          uri: "local:///Users/test/Backups",
          visitedAt: "2026-05-27T00:00:00Z",
        },
      ],
    });
    const r = result.visible.find((t) => t.kind === "recent");
    expect(r).toBeDefined();
    expect(r!.label).toBe("Backups");
  });

  // --- Deduplication ---
  it("deduplicates by URI (active URI excluded)", () => {
    const uri = "local:///Users/test/Documents";
    const result = buildHotlistTargets({
      ...baseInput,
      activeUri: uri,
      favorites: [{ id: 1, label: "Same", uri }],
      recentToday: [{ label: "Same", uri, visitedAt: "2026-05-27T00:00:00Z" }],
    });
    const matches = result.visible.filter((t) => t.uri === uri);
    expect(matches).toHaveLength(0);
  });

  it("deduplicates favorites and recents with same URI", () => {
    const uri = "local:///Users/test/Projects";
    const result = buildHotlistTargets({
      ...baseInput,
      favorites: [{ id: 1, label: "ProjFav", uri }],
      recentToday: [
        { label: "ProjRecent", uri, visitedAt: "2026-05-27T00:00:00Z" },
      ],
    });
    const matches = result.visible.filter((t) => t.uri === uri);
    // Only the first one (favorite) should appear
    expect(matches).toHaveLength(1);
    expect(matches[0].kind).toBe("favorite");
  });

  it("deduplicates volume and favorite with same URI", () => {
    const uri = "local:///";
    const result = buildHotlistTargets({
      ...baseInput,
      locations: [loc("root", "Root", uri, "Devices/Volumes")],
      favorites: [{ id: 1, label: "RootFav", uri }],
    });
    // Home (structural) and volume both appear with same URI
    const home = result.visible.find((t) => t.kind === "home");
    const vol = result.visible.find((t) => t.kind === "volume");
    expect(home).toBeDefined();
    expect(vol).toBeDefined();
    // Favorite with same URI as volume is deduplicated
    const fav = result.visible.find((t) => t.kind === "favorite");
    expect(fav).toBeUndefined();
  });

  // --- Overflow ---
  it("splits visible and overflow based on maxVisible", () => {
    const favorites: FavoriteEntryDto[] = Array.from(
      { length: 12 },
      (_, i) => ({
        id: i,
        label: `Fav ${i}`,
        uri: `local:///Users/test/fav${i}`,
      }),
    );
    const result = buildHotlistTargets({
      ...baseInput,
      favorites,
      maxVisible: 5,
    });
    // home + 4 favorites = 5 visible, remaining 8 favorites + parent = 9 overflow
    expect(result.visible.length).toBe(5);
    expect(result.overflow.length).toBeGreaterThan(0);
    // all targets = parent + home + 12 favorites = 14 total
    expect(result.visible.length + result.overflow.length).toBe(14);
  });

  it("uses default maxVisible of 10", () => {
    const favorites: FavoriteEntryDto[] = Array.from(
      { length: 15 },
      (_, i) => ({
        id: i,
        label: `Fav ${i}`,
        uri: `local:///Users/test/fav${i}`,
      }),
    );
    const result = buildHotlistTargets({
      ...baseInput,
      favorites,
    });
    // parent + home + 15 favorites = 17 total, visible = 10
    expect(result.visible.length).toBe(10);
    expect(result.overflow.length).toBe(7);
  });

  // --- Edge cases ---
  it("handles empty inputs gracefully", () => {
    const result = buildHotlistTargets({
      ...baseInput,
      parentUri: null,
      locations: [],
      favorites: [],
      recentToday: [],
      recentWeek: [],
    });
    // At least the home target should be there (unless it matches activeUri)
    expect(result.visible.find((t) => t.kind === "home")).toBeDefined();
    expect(result.overflow).toEqual([]);
  });

  it("assigns unique IDs to each target", () => {
    const result = buildHotlistTargets({
      ...baseInput,
      locations: [loc("root", "HD", "local:///", "Devices/Volumes")],
      networkProfiles: [profile],
      favorites: [{ id: 1, label: "Fav", uri: "local:///Users/test/fav" }],
      starred: [
        {
          label: "Star",
          uri: "local:///Users/test/star",
          starredAt: "2026-05-27T00:00:00Z",
        },
      ],
      recentToday: [
        {
          label: "Recent",
          uri: "local:///Users/test/recent",
          visitedAt: "2026-05-27T00:00:00Z",
        },
      ],
    });
    const ids = result.visible.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("target IDs use correct prefixes", () => {
    const result = buildHotlistTargets({
      ...baseInput,
      locations: [loc("root", "HD", "local:///", "Devices/Volumes")],
      networkProfiles: [profile],
      favorites: [{ id: 99, label: "Fav", uri: "local:///Users/test/fav" }],
    });
    const parent = result.visible.find((t) => t.kind === "parent");
    expect(parent!.id).toBe("parent");

    const home = result.visible.find((t) => t.kind === "home");
    expect(home!.id).toBe("home");

    const vol = result.visible.find((t) => t.kind === "volume");
    expect(vol!.id).toBe("volume-root");

    const net = result.visible.find((t) => t.kind === "network");
    expect(net!.id).toBe(`network-${profile.id}`);

    const fav = result.visible.find((t) => t.kind === "favorite");
    expect(fav!.id).toBe("favorite-99");
  });
});
