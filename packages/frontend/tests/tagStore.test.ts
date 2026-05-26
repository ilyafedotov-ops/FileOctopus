import { describe, it, expect } from "vitest";
import {
  type FileTag,
  tagColorValues,
  isValidTagColor,
  getTagColorsForEntry,
  addTagToEntry,
  removeTagFromEntry,
  getEntriesWithTag,
} from "../src/utils/tagStore";

describe("isValidTagColor", () => {
  it("returns true for valid colors", () => {
    for (const color of tagColorValues) {
      expect(isValidTagColor(color)).toBe(true);
    }
  });

  it("returns false for invalid colors", () => {
    expect(isValidTagColor("burgundy")).toBe(false);
    expect(isValidTagColor("")).toBe(false);
  });
});

describe("tag CRUD", () => {
  const tagRed: FileTag = {
    uri: "local:///home/user/file.txt",
    color: "red",
    label: "Important",
  };
  const tagBlue: FileTag = {
    uri: "local:///home/user/file.txt",
    color: "blue",
    label: "Work",
  };

  it("addTagToEntry adds a tag", () => {
    const tags: FileTag[] = [];
    const result = addTagToEntry(tags, tagRed);
    expect(result).toHaveLength(1);
    expect(result[0].color).toBe("red");
  });

  it("addTagToEntry prevents duplicate colors for same URI", () => {
    const tags: FileTag[] = [tagRed];
    const result = addTagToEntry(tags, { ...tagRed, label: "Duplicate" });
    expect(result).toHaveLength(1);
  });

  it("addTagToEntry allows different colors for same URI", () => {
    const tags: FileTag[] = [tagRed];
    const result = addTagToEntry(tags, tagBlue);
    expect(result).toHaveLength(2);
  });

  it("removeTagFromEntry removes a tag by color", () => {
    const tags: FileTag[] = [tagRed, tagBlue];
    const result = removeTagFromEntry(tags, tagRed.uri, "red");
    expect(result).toHaveLength(1);
    expect(result[0].color).toBe("blue");
  });

  it("removeTagFromEntry is no-op when tag not found", () => {
    const tags: FileTag[] = [tagRed];
    const result = removeTagFromEntry(tags, tagRed.uri, "green");
    expect(result).toHaveLength(1);
  });

  it("getTagColorsForEntry returns colors for a URI", () => {
    const tags: FileTag[] = [tagRed, tagBlue];
    const result = getTagColorsForEntry(tags, "local:///home/user/file.txt");
    expect(result).toEqual(["red", "blue"]);
  });

  it("getTagColorsForEntry returns empty array for no tags", () => {
    const result = getTagColorsForEntry([], "local:///home/user/file.txt");
    expect(result).toEqual([]);
  });

  it("getEntriesWithTag returns URIs matching a color", () => {
    const tags: FileTag[] = [
      tagRed,
      { uri: "local:///home/user/other.txt", color: "red", label: "Urgent" },
      tagBlue,
    ];
    const result = getEntriesWithTag(tags, "red");
    expect(result).toHaveLength(2);
    expect(result).toContain("local:///home/user/file.txt");
    expect(result).toContain("local:///home/user/other.txt");
  });
});
