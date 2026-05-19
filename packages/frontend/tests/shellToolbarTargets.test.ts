import { describe, expect, it } from "vitest";
import type {
  FavoriteEntryDto,
  RecentEntryDto,
  StandardLocationDto,
} from "@fileoctopus/ts-api";
import { buildWorkbenchTargets } from "../src/shell/ShellToolbar";

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

describe("buildWorkbenchTargets", () => {
  it("keeps user folders out of the drivebar unless pinned or recent", () => {
    const result = buildWorkbenchTargets({
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
          "documents",
          "Documents",
          "local:///Users/ilya/Documents",
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
    expect(result.visible.some((target) => target.label === "Desktop")).toBe(
      false,
    );
    expect(result.visible.some((target) => target.label === "Documents")).toBe(
      false,
    );
  });

  it("prioritizes parent, volumes, favorites, then recent with uri dedupe", () => {
    const result = buildWorkbenchTargets({
      activeUri: "local:///Users/ilya/work",
      parentUri: "local:///Users/ilya",
      locations: [
        location("home", "Home", "local:///Users/ilya", "Favorites"),
        location("root", "Macintosh HD", "local:///", "Devices/Volumes"),
        location(
          "backup",
          "Backup",
          "local:///Volumes/Backup",
          "Devices/Volumes",
        ),
      ],
      favorites: [
        favorite(1, "Scripts", "local:///Users/ilya/scripts"),
        favorite(2, "Backup", "local:///Volumes/Backup"),
      ],
      recentToday: [
        recent("Scratch", "local:///tmp/scratch"),
        recent("Scripts", "local:///Users/ilya/scripts"),
      ],
      recentWeek: [recent("Archive", "local:///Users/ilya/archive")],
    });

    expect(
      result.visible.map((target) => `${target.kind}:${target.label}`),
    ).toEqual([
      "parent:..",
      "volume:Macintosh HD",
      "volume:Backup",
      "favorite:Scripts",
      "recent:Scratch",
      "recent:Archive",
    ]);
  });

  it("moves lower priority targets into overflow", () => {
    const result = buildWorkbenchTargets({
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
});
