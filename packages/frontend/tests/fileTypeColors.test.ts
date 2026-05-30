import { describe, expect, it } from "vitest";
import {
  matchFileTypeColor,
  parseFileTypeColorRules,
  DEFAULT_FILE_TYPE_COLORS,
  type FileTypeColorRule,
} from "../src/utils/fileTypeColors";

describe("matchFileTypeColor", () => {
  it("matches image extensions", () => {
    expect(matchFileTypeColor("photo.jpg", DEFAULT_FILE_TYPE_COLORS)).toBe(
      "#4ec9b0",
    );
    expect(matchFileTypeColor("photo.png", DEFAULT_FILE_TYPE_COLORS)).toBe(
      "#4ec9b0",
    );
    expect(matchFileTypeColor("photo.svg", DEFAULT_FILE_TYPE_COLORS)).toBe(
      "#4ec9b0",
    );
  });

  it("matches video extensions", () => {
    expect(matchFileTypeColor("movie.mp4", DEFAULT_FILE_TYPE_COLORS)).toBe(
      "#b180d7",
    );
    expect(matchFileTypeColor("clip.mkv", DEFAULT_FILE_TYPE_COLORS)).toBe(
      "#b180d7",
    );
  });

  it("matches audio extensions", () => {
    expect(matchFileTypeColor("song.mp3", DEFAULT_FILE_TYPE_COLORS)).toBe(
      "#dcdcaa",
    );
    expect(matchFileTypeColor("track.flac", DEFAULT_FILE_TYPE_COLORS)).toBe(
      "#dcdcaa",
    );
  });

  it("matches archive extensions", () => {
    expect(matchFileTypeColor("archive.zip", DEFAULT_FILE_TYPE_COLORS)).toBe(
      "#ce9178",
    );
    expect(matchFileTypeColor("backup.tar.gz", DEFAULT_FILE_TYPE_COLORS)).toBe(
      "#ce9178",
    );
  });

  it("matches executable extensions", () => {
    expect(matchFileTypeColor("setup.exe", DEFAULT_FILE_TYPE_COLORS)).toBe(
      "#f14c4c",
    );
    expect(matchFileTypeColor("script.sh", DEFAULT_FILE_TYPE_COLORS)).toBe(
      "#f14c4c",
    );
  });

  it("matches code extensions", () => {
    expect(matchFileTypeColor("index.ts", DEFAULT_FILE_TYPE_COLORS)).toBe(
      "#3794ff",
    );
    expect(matchFileTypeColor("main.rs", DEFAULT_FILE_TYPE_COLORS)).toBe(
      "#3794ff",
    );
    expect(matchFileTypeColor("app.py", DEFAULT_FILE_TYPE_COLORS)).toBe(
      "#3794ff",
    );
  });

  it("matches config extensions", () => {
    expect(matchFileTypeColor("package.json", DEFAULT_FILE_TYPE_COLORS)).toBe(
      "#8b95a8",
    );
    expect(matchFileTypeColor("config.yaml", DEFAULT_FILE_TYPE_COLORS)).toBe(
      "#8b95a8",
    );
  });

  it("matches document extensions", () => {
    expect(matchFileTypeColor("readme.md", DEFAULT_FILE_TYPE_COLORS)).toBe(
      "#4ec9b0",
    );
    expect(matchFileTypeColor("report.pdf", DEFAULT_FILE_TYPE_COLORS)).toBe(
      "#4ec9b0",
    );
  });

  it("returns null for unknown extensions", () => {
    expect(matchFileTypeColor("data.xyz", DEFAULT_FILE_TYPE_COLORS)).toBeNull();
  });

  it("returns null for files with no extension", () => {
    expect(matchFileTypeColor("Makefile", DEFAULT_FILE_TYPE_COLORS)).toBeNull();
  });

  it("is case-insensitive for extension matching", () => {
    expect(matchFileTypeColor("photo.JPG", DEFAULT_FILE_TYPE_COLORS)).toBe(
      "#4ec9b0",
    );
    expect(matchFileTypeColor("photo.Png", DEFAULT_FILE_TYPE_COLORS)).toBe(
      "#4ec9b0",
    );
  });

  it("skips disabled rules", () => {
    const rules: FileTypeColorRule[] = [
      {
        id: "test",
        name: "Test",
        pattern: "txt",
        matchType: "extension",
        color: "#ff0000",
        enabled: false,
      },
    ];
    expect(matchFileTypeColor("file.txt", rules)).toBeNull();
  });

  it("matches using name matchType with wildcard prefix", () => {
    const rules: FileTypeColorRule[] = [
      {
        id: "dotfiles",
        name: "Dotfiles",
        pattern: ".*",
        matchType: "name",
        color: "#aaaaaa",
        enabled: true,
      },
    ];
    expect(matchFileTypeColor(".gitignore", rules)).toBe("#aaaaaa");
    expect(matchFileTypeColor("regular.txt", rules)).toBeNull();
  });

  it("matches using name matchType with wildcard suffix", () => {
    const rules: FileTypeColorRule[] = [
      {
        id: "docker",
        name: "Docker",
        pattern: "docker*",
        matchType: "name",
        color: "#2496ed",
        enabled: true,
      },
    ];
    expect(matchFileTypeColor("dockerfile", rules)).toBe("#2496ed");
    expect(matchFileTypeColor("docker-compose.yml", rules)).toBe("#2496ed");
    // "xdocdker" does not start with "docker"
    expect(matchFileTypeColor("xdocker", rules)).toBeNull();
  });

  it("matches using name matchType with exact name (case-insensitive)", () => {
    const rules: FileTypeColorRule[] = [
      {
        id: "makefile",
        name: "Makefile",
        pattern: "makefile",
        matchType: "name",
        color: "#ff00ff",
        enabled: true,
      },
    ];
    expect(matchFileTypeColor("makefile", rules)).toBe("#ff00ff");
    // Name matching uses lowerName, so "Makefile" also matches "makefile"
    expect(matchFileTypeColor("Makefile", rules)).toBe("#ff00ff");
  });

  it("matches using pattern matchType with regex", () => {
    const rules: FileTypeColorRule[] = [
      {
        id: "test-files",
        name: "Test files",
        pattern: "\\.test\\.(ts|tsx|js)$",
        matchType: "pattern",
        color: "#ff6600",
        enabled: true,
      },
    ];
    expect(matchFileTypeColor("app.test.ts", rules)).toBe("#ff6600");
    expect(matchFileTypeColor("app.test.tsx", rules)).toBe("#ff6600");
    expect(matchFileTypeColor("app.ts", rules)).toBeNull();
  });

  it("handles invalid regex in pattern matchType gracefully", () => {
    const rules: FileTypeColorRule[] = [
      {
        id: "bad-regex",
        name: "Bad regex",
        pattern: "[invalid(",
        matchType: "pattern",
        color: "#ff0000",
        enabled: true,
      },
    ];
    expect(matchFileTypeColor("anything", rules)).toBeNull();
  });

  it("returns first matching rule color", () => {
    const rules: FileTypeColorRule[] = [
      {
        id: "first",
        name: "First",
        pattern: "txt",
        matchType: "extension",
        color: "#ff0000",
        enabled: true,
      },
      {
        id: "second",
        name: "Second",
        pattern: "txt",
        matchType: "extension",
        color: "#00ff00",
        enabled: true,
      },
    ];
    expect(matchFileTypeColor("file.txt", rules)).toBe("#ff0000");
  });
});

describe("parseFileTypeColorRules", () => {
  it("returns defaults for empty string", () => {
    expect(parseFileTypeColorRules("")).toEqual(DEFAULT_FILE_TYPE_COLORS);
  });

  it("returns defaults for invalid JSON", () => {
    expect(parseFileTypeColorRules("not json")).toEqual(
      DEFAULT_FILE_TYPE_COLORS,
    );
  });

  it("returns defaults for non-array JSON", () => {
    expect(parseFileTypeColorRules('{"key": "value"}')).toEqual(
      DEFAULT_FILE_TYPE_COLORS,
    );
  });

  it("parses valid rules array", () => {
    const rules: FileTypeColorRule[] = [
      {
        id: "test",
        name: "Test",
        pattern: "txt",
        matchType: "extension",
        color: "#ff0000",
        enabled: true,
      },
    ];
    const result = parseFileTypeColorRules(JSON.stringify(rules));
    expect(result).toEqual(rules);
  });

  it("filters out invalid entries from array", () => {
    const mixed = [
      {
        id: "valid",
        name: "Valid",
        pattern: "txt",
        matchType: "extension",
        color: "#ff0000",
        enabled: true,
      },
      { id: "invalid" },
      "not an object",
      null,
    ];
    const result = parseFileTypeColorRules(JSON.stringify(mixed));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("valid");
  });
});
