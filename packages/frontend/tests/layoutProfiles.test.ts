import { describe, expect, it, vi } from "vitest";
import {
  captureCurrentProfile,
  applyLayoutProfile,
  exportProfile,
  importProfile,
  parseLayoutProfiles,
  serializeLayoutProfiles,
  type LayoutProfile,
} from "../src/utils/layoutProfiles";
import type { UserPreferencesDto } from "@fileoctopus/ts-api";

function makePreferences(
  overrides: Partial<UserPreferencesDto> = {},
): UserPreferencesDto {
  return {
    sidebarWidth: 280,
    sidebarVisible: true,
    splitRatio: 0.5,
    paneMode: "dual",
    paneDirection: "horizontal",
    statusBarVisible: true,
    toolbarVisible: true,
    toolbarEntries: "copy|move|delete|rename",
    activityPanelVisible: false,
    activityPanelWidth: 300,
    fontScale: "1",
    iconScale: "1",
    density: "comfortable",
    accentColor: "blue",
    theme: "light",
    ...overrides,
  } as UserPreferencesDto;
}

function makeProfile(overrides: Partial<LayoutProfile> = {}): LayoutProfile {
  return {
    id: "profile-test-123",
    name: "Test Profile",
    createdAt: "2026-01-01T00:00:00Z",
    sidebarWidth: 280,
    sidebarVisible: true,
    splitRatio: 0.5,
    paneMode: "dual",
    paneDirection: "horizontal",
    statusBarVisible: true,
    toolbarVisible: true,
    toolbarEntries: "copy|move|delete|rename",
    activityPanelVisible: false,
    activityPanelWidth: 300,
    fontScale: "1",
    iconScale: "1",
    density: "comfortable",
    accentColor: "blue",
    theme: "light",
    ...overrides,
  };
}

describe("captureCurrentProfile", () => {
  it("creates profile from preferences", () => {
    const prefs = makePreferences();
    const profile = captureCurrentProfile(prefs, "My Layout");
    expect(profile.name).toBe("My Layout");
    expect(profile.sidebarWidth).toBe(280);
    expect(profile.sidebarVisible).toBe(true);
    expect(profile.splitRatio).toBe(0.5);
    expect(profile.paneMode).toBe("dual");
    expect(profile.density).toBe("comfortable");
    expect(profile.theme).toBe("light");
  });

  it("generates unique id with timestamp", () => {
    const prefs = makePreferences();
    const p1 = captureCurrentProfile(prefs, "A");
    const p2 = captureCurrentProfile(prefs, "B");
    expect(p1.id).not.toBe(p2.id);
    expect(p1.id.indexOf("profile-")).toBe(0);
  });

  it("sets createdAt to current ISO timestamp", () => {
    const before = new Date().toISOString();
    const profile = captureCurrentProfile(makePreferences(), "Test");
    const after = new Date().toISOString();
    expect(profile.createdAt >= before).toBe(true);
    expect(profile.createdAt <= after).toBe(true);
  });

  it("preserves all preference fields", () => {
    const prefs = makePreferences({
      sidebarWidth: 320,
      paneMode: "single",
      density: "compact",
      accentColor: "red",
      theme: "dark",
    });
    const profile = captureCurrentProfile(prefs, "Custom");
    expect(profile.sidebarWidth).toBe(320);
    expect(profile.paneMode).toBe("single");
    expect(profile.density).toBe("compact");
    expect(profile.accentColor).toBe("red");
    expect(profile.theme).toBe("dark");
  });
});

describe("applyLayoutProfile", () => {
  it("calls updatePreference for all profile fields", () => {
    const updatePreference = vi.fn();
    const profile = makeProfile({
      sidebarWidth: 200,
      sidebarVisible: false,
      paneMode: "single",
    });
    applyLayoutProfile(profile, updatePreference);
    expect(updatePreference).toHaveBeenCalledWith("sidebarWidth", "200");
    expect(updatePreference).toHaveBeenCalledWith("sidebarVisible", "false");
    expect(updatePreference).toHaveBeenCalledWith("paneMode", "single");
  });

  it("converts numeric fields to strings", () => {
    const updatePreference = vi.fn();
    const profile = makeProfile({ splitRatio: 0.7 });
    applyLayoutProfile(profile, updatePreference);
    expect(updatePreference).toHaveBeenCalledWith("splitRatio", "0.7");
  });

  it("converts boolean fields to strings", () => {
    const updatePreference = vi.fn();
    const profile = makeProfile({ statusBarVisible: false });
    applyLayoutProfile(profile, updatePreference);
    expect(updatePreference).toHaveBeenCalledWith("statusBarVisible", "false");
  });

  it("applies exactly 15 preferences", () => {
    const updatePreference = vi.fn();
    applyLayoutProfile(makeProfile(), updatePreference);
    expect(updatePreference).toHaveBeenCalledTimes(15);
  });
});

describe("exportProfile", () => {
  it("serializes profile to formatted JSON", () => {
    const profile = makeProfile();
    const json = exportProfile(profile);
    const parsed = JSON.parse(json);
    expect(parsed.name).toBe("Test Profile");
    expect(parsed.sidebarWidth).toBe(280);
    expect(json.indexOf("\n")).toBeGreaterThan(0);
  });
});

describe("importProfile", () => {
  it("imports valid profile JSON", () => {
    const profile = makeProfile();
    const json = JSON.stringify(profile);
    const imported = importProfile(json);
    expect(imported).not.toBeNull();
    expect(imported!.name).toBe("Test Profile");
    expect(imported!.sidebarWidth).toBe(280);
  });

  it("assigns new id and createdAt on import", () => {
    const profile = makeProfile({ id: "old-id", createdAt: "2020-01-01" });
    const json = JSON.stringify(profile);
    const imported = importProfile(json);
    expect(imported!.id).not.toBe("old-id");
    expect(imported!.id.indexOf("profile-")).toBe(0);
    expect(imported!.createdAt).not.toBe("2020-01-01");
  });

  it("returns null for invalid JSON", () => {
    expect(importProfile("not json")).toBeNull();
  });

  it("returns null for valid JSON missing required fields", () => {
    expect(importProfile(JSON.stringify({ name: "incomplete" }))).toBeNull();
  });

  it("returns null for wrong field types", () => {
    const obj = makeProfile();
    (obj as unknown as Record<string, unknown>).sidebarWidth = "not-a-number";
    expect(importProfile(JSON.stringify(obj))).toBeNull();
  });

  it("returns null for null input", () => {
    expect(importProfile("null")).toBeNull();
  });

  it("returns null for array input", () => {
    expect(importProfile("[]")).toBeNull();
  });

  it("preserves extra fields from imported object", () => {
    const obj = { ...makeProfile(), customField: "extra" };
    const imported = importProfile(JSON.stringify(obj));
    expect(imported).not.toBeNull();
    expect((imported as { customField?: string })?.customField).toBe("extra");
  });
});

describe("parseLayoutProfiles", () => {
  it("parses valid profiles array", () => {
    const profiles = [makeProfile({ name: "A" }), makeProfile({ name: "B" })];
    const result = parseLayoutProfiles(JSON.stringify(profiles));
    expect(result.length).toBe(2);
    expect(result[0].name).toBe("A");
    expect(result[1].name).toBe("B");
  });

  it("returns empty array for empty string", () => {
    expect(parseLayoutProfiles("")).toEqual([]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseLayoutProfiles("not json")).toEqual([]);
  });

  it("returns empty array for non-array JSON", () => {
    expect(parseLayoutProfiles("{}")).toEqual([]);
  });

  it("filters out invalid entries", () => {
    const profiles = [
      makeProfile(),
      { name: "invalid" },
      makeProfile({ name: "C" }),
    ];
    const result = parseLayoutProfiles(JSON.stringify(profiles));
    expect(result.length).toBe(2);
    expect(result[0].name).toBe("Test Profile");
    expect(result[1].name).toBe("C");
  });

  it("handles mixed valid and null entries", () => {
    const profiles = [null, makeProfile(), undefined];
    const result = parseLayoutProfiles(JSON.stringify(profiles));
    expect(result.length).toBe(1);
  });
});

describe("serializeLayoutProfiles", () => {
  it("serializes array to JSON string", () => {
    const profiles = [makeProfile()];
    const json = serializeLayoutProfiles(profiles);
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(1);
    expect(parsed[0].name).toBe("Test Profile");
  });

  it("handles empty array", () => {
    const json = serializeLayoutProfiles([]);
    expect(json).toBe("[]");
  });
});

describe("round-trip: serialize → parse", () => {
  it("preserves profile data through serialize/parse cycle", () => {
    const original = [makeProfile({ name: "Round Trip", sidebarWidth: 400 })];
    const json = serializeLayoutProfiles(original);
    const restored = parseLayoutProfiles(json);
    expect(restored.length).toBe(1);
    expect(restored[0].name).toBe("Round Trip");
    expect(restored[0].sidebarWidth).toBe(400);
  });
});
