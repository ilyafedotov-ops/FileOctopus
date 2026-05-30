import { describe, it, expect } from "vitest";
import {
  parseHotlistEntries,
  serializeHotlistEntries,
  createHotlistEntry,
} from "../src/utils/hotlist";

describe("createHotlistEntry", () => {
  it("creates entry with generated id, label, uri", () => {
    const entry = createHotlistEntry("Documents", "local:///home/user/docs");
    expect(entry.id).toMatch(/^hotlist-\d+-[a-z0-9]+$/);
    expect(entry.label).toBe("Documents");
    expect(entry.uri).toBe("local:///home/user/docs");
    expect(entry.shortcut).toBeUndefined();
  });

  it("creates entry with optional shortcut", () => {
    const entry = createHotlistEntry("Home", "local:///home/user", 1);
    expect(entry.shortcut).toBe(1);
  });

  it("creates unique ids on successive calls", () => {
    const a = createHotlistEntry("A", "local:///a");
    const b = createHotlistEntry("B", "local:///b");
    expect(a.id).not.toBe(b.id);
  });
});

describe("serializeHotlistEntries / parseHotlistEntries", () => {
  it("round-trips a single entry", () => {
    const entries = [createHotlistEntry("Home", "local:///home/user")];
    const json = serializeHotlistEntries(entries);
    const parsed = parseHotlistEntries(json);
    expect(parsed).toEqual(entries);
  });

  it("round-trips entry with shortcut", () => {
    const entries = [createHotlistEntry("Docs", "local:///docs", 3)];
    const json = serializeHotlistEntries(entries);
    const parsed = parseHotlistEntries(json);
    expect(parsed[0].shortcut).toBe(3);
  });

  it("round-trips multiple entries", () => {
    const entries = [
      createHotlistEntry("Home", "local:///home/user"),
      createHotlistEntry("Downloads", "local:///home/user/downloads"),
      createHotlistEntry("Projects", "local:///home/user/projects"),
    ];
    const json = serializeHotlistEntries(entries);
    const parsed = parseHotlistEntries(json);
    expect(parsed).toEqual(entries);
  });

  it("round-trips empty array", () => {
    const json = serializeHotlistEntries([]);
    expect(parseHotlistEntries(json)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseHotlistEntries("")).toEqual([]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseHotlistEntries("not json")).toEqual([]);
  });

  it("returns empty array for non-array JSON", () => {
    expect(parseHotlistEntries('{"label":"x"}')).toEqual([]);
  });

  it("filters out entries missing required fields", () => {
    const mixed = [
      { id: "1", label: "Good", uri: "local:///a" },
      { id: "2", label: "Missing uri" },
      { id: "3", uri: "local:///b" },
      null,
      "string",
      42,
      { id: 123, label: "Bad id type", uri: "local:///c" },
    ];
    const json = JSON.stringify(mixed);
    const parsed = parseHotlistEntries(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].label).toBe("Good");
  });

  it("filters out entry with non-string label", () => {
    const entries = [{ id: "1", label: 123, uri: "local:///a" }];
    const json = JSON.stringify(entries);
    expect(parseHotlistEntries(json)).toEqual([]);
  });

  it("filters out entry with non-string uri", () => {
    const entries = [{ id: "1", label: "X", uri: 456 }];
    const json = JSON.stringify(entries);
    expect(parseHotlistEntries(json)).toEqual([]);
  });

  it("accepts entry with optional shortcut undefined", () => {
    const entries = [{ id: "1", label: "No shortcut", uri: "local:///a" }];
    const json = JSON.stringify(entries);
    const parsed = parseHotlistEntries(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].shortcut).toBeUndefined();
  });

  it("rejects entry with non-number shortcut", () => {
    const entries = [
      { id: "1", label: "X", uri: "local:///a", shortcut: "bad" },
    ];
    const json = JSON.stringify(entries);
    expect(parseHotlistEntries(json)).toEqual([]);
  });
});
