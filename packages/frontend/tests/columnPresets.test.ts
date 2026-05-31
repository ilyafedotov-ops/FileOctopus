import { describe, it, expect } from "vitest";
import {
  parseColumnPresets,
  serializeColumnPresets,
  captureColumnPreset,
  DEFAULT_COLUMN_PRESETS,
} from "../src/utils/columnPresets";
import type { ColumnWidths } from "../src/pane/columnWidths";

const FULL_WIDTHS: ColumnWidths = {
  name: 200,
  extension: 60,
  size: 80,
  modified: 140,
  kind: 110,
};

describe("DEFAULT_COLUMN_PRESETS", () => {
  it("has at least one preset", () => {
    expect(DEFAULT_COLUMN_PRESETS.length).toBeGreaterThan(0);
  });

  it("each preset has required fields", () => {
    for (const preset of DEFAULT_COLUMN_PRESETS) {
      expect(typeof preset.id).toBe("string");
      expect(typeof preset.name).toBe("string");
      expect(Array.isArray(preset.visibleColumns)).toBe(true);
      expect(typeof preset.columnWidths).toBe("object");
    }
  });
});

describe("captureColumnPreset", () => {
  it("creates a preset with a generated id", () => {
    const preset = captureColumnPreset("Test", ["name", "size"], FULL_WIDTHS);
    expect(preset.name).toBe("Test");
    expect(preset.id.indexOf("preset-")).toBe(0);
    expect(preset.visibleColumns).toEqual(["name", "size"]);
  });

  it("copies arrays and objects (not shared references)", () => {
    const preset = captureColumnPreset("X", ["name"], FULL_WIDTHS);
    preset.visibleColumns.push("size");
    expect(FULL_WIDTHS.name).toBe(200);
  });
});

describe("parseColumnPresets", () => {
  it("returns defaults for empty string", () => {
    const result = parseColumnPresets("");
    expect(result).toEqual(DEFAULT_COLUMN_PRESETS);
  });

  it("returns defaults for non-array JSON", () => {
    expect(parseColumnPresets("{}")).toEqual(DEFAULT_COLUMN_PRESETS);
    expect(parseColumnPresets('"hello"')).toEqual(DEFAULT_COLUMN_PRESETS);
  });

  it("returns defaults for invalid JSON", () => {
    expect(parseColumnPresets("not json")).toEqual(DEFAULT_COLUMN_PRESETS);
  });

  it("filters invalid entries", () => {
    const valid = {
      id: "a",
      name: "A",
      visibleColumns: ["name"],
      columnWidths: FULL_WIDTHS,
    };
    const invalid = { bad: true };
    const json = JSON.stringify([valid, invalid]);
    const result = parseColumnPresets(json);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("a");
  });

  it("parses valid presets", () => {
    const presets = [
      {
        id: "p1",
        name: "One",
        visibleColumns: ["name"],
        columnWidths: FULL_WIDTHS,
      },
      {
        id: "p2",
        name: "Two",
        visibleColumns: ["name", "size"],
        columnWidths: FULL_WIDTHS,
      },
    ];
    const result = parseColumnPresets(JSON.stringify(presets));
    expect(result.length).toBe(2);
    expect(result[0].name).toBe("One");
    expect(result[1].name).toBe("Two");
  });
});

describe("serializeColumnPresets", () => {
  it("round-trips through parse", () => {
    const presets = DEFAULT_COLUMN_PRESETS;
    const json = serializeColumnPresets(presets);
    const parsed = parseColumnPresets(json);
    expect(parsed.length).toBe(presets.length);
    for (let i = 0; i < parsed.length; i++) {
      expect(parsed[i].id).toBe(presets[i].id);
    }
  });
});
