import { describe, it, expect } from "vitest";
import {
  parseHotlistEntries,
  serializeHotlistEntries,
  createHotlistEntry,
} from "../src/utils/hotlist";

describe("parseHotlistEntries", () => {
  it("returns empty array for empty string", () => {
    expect(parseHotlistEntries("")).toEqual([]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseHotlistEntries("not json")).toEqual([]);
  });

  it("returns empty array for non-array JSON", () => {
    expect(parseHotlistEntries('{"id":1}')).toEqual([]);
  });

  it("filters out invalid entries", () => {
    const json = JSON.stringify([
      { id: "1", label: "Valid", uri: "local:///home" },
      { id: "2" },
      { label: "No id" },
      "not an object",
      null,
      { id: "3", label: "Also Valid", uri: "local:///tmp", shortcut: 5 },
    ]);
    const result = parseHotlistEntries(json);
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe("Valid");
    expect(result[1].label).toBe("Also Valid");
    expect(result[1].shortcut).toBe(5);
  });

  it("parses valid entries correctly", () => {
    const entries = [
      { id: "a", label: "Home", uri: "local:///home" },
      { id: "b", label: "Tmp", uri: "local:///tmp", shortcut: 3 },
    ];
    const result = parseHotlistEntries(JSON.stringify(entries));
    expect(result).toEqual(entries);
  });

  it("rejects entries with invalid shortcut type", () => {
    const entries = [
      { id: "a", label: "Home", uri: "local:///home", shortcut: "bad" },
    ];
    const result = parseHotlistEntries(JSON.stringify(entries));
    expect(result).toHaveLength(0);
  });
});

describe("serializeHotlistEntries", () => {
  it("serializes to JSON", () => {
    const entries = [{ id: "1", label: "Home", uri: "local:///home" }];
    const result = serializeHotlistEntries(entries);
    expect(JSON.parse(result)).toEqual(entries);
  });

  it("serializes empty array", () => {
    expect(serializeHotlistEntries([])).toBe("[]");
  });
});

describe("createHotlistEntry", () => {
  it("creates entry with id, label, and uri", () => {
    const entry = createHotlistEntry("Home", "local:///home");
    expect(entry.label).toBe("Home");
    expect(entry.uri).toBe("local:///home");
    expect(entry.id).toBeTruthy();
    expect(entry.id.indexOf("hotlist-")).toBe(0);
    expect(entry.shortcut).toBeUndefined();
  });

  it("creates entry with optional shortcut", () => {
    const entry = createHotlistEntry("Tmp", "local:///tmp", 5);
    expect(entry.shortcut).toBe(5);
  });

  it("creates unique ids", () => {
    const a = createHotlistEntry("A", "local:///a");
    const b = createHotlistEntry("B", "local:///b");
    expect(a.id).not.toBe(b.id);
  });
});
