import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DEFAULT_COLUMN_WIDTHS,
  COLUMN_ORDER,
  buildGridTemplate,
  buildHeaderGridTemplate,
  storedColumnWidths,
  persistColumnWidths,
  type ColumnWidths,
} from "../src/pane/columnWidths";

beforeEach(() => {
  localStorage.clear();
});

describe("columnWidths utilities", () => {
  it("DEFAULT_COLUMN_WIDTHS has all 5 columns", () => {
    const keys = Object.keys(DEFAULT_COLUMN_WIDTHS);
    expect(keys.length).toBe(5);
    expect(keys).toContain("name");
    expect(keys).toContain("extension");
    expect(keys).toContain("size");
    expect(keys).toContain("modified");
    expect(keys).toContain("kind");
  });

  it("DEFAULT_COLUMN_WIDTHS has reasonable pixel values", () => {
    expect(DEFAULT_COLUMN_WIDTHS.name).toBeGreaterThanOrEqual(100);
    expect(DEFAULT_COLUMN_WIDTHS.extension).toBeGreaterThanOrEqual(30);
    expect(DEFAULT_COLUMN_WIDTHS.size).toBeGreaterThanOrEqual(50);
    expect(DEFAULT_COLUMN_WIDTHS.modified).toBeGreaterThanOrEqual(80);
    expect(DEFAULT_COLUMN_WIDTHS.kind).toBeGreaterThanOrEqual(60);
  });

  it("COLUMN_ORDER matches the display order", () => {
    expect(COLUMN_ORDER).toEqual([
      "name",
      "extension",
      "size",
      "modified",
      "kind",
    ]);
  });

  it("buildGridTemplate converts widths to CSS grid-template-columns", () => {
    const widths: ColumnWidths = {
      name: 300,
      extension: 60,
      size: 90,
      modified: 140,
      kind: 120,
    };
    const result = buildGridTemplate(widths);
    expect(result).toBe("minmax(300px, 1fr) 60px 90px 140px 120px");
  });

  it("buildGridTemplate uses name as the flexible column", () => {
    const result = buildGridTemplate(DEFAULT_COLUMN_WIDTHS);
    // Name column should use minmax for flexibility
    expect(result.indexOf("minmax(")).toBe(0);
    // Other columns should be fixed px values
    expect(result.indexOf(" 1fr)") !== -1).toBe(true);
  });

  it("buildHeaderGridTemplate includes resize handle columns between data columns", () => {
    const result = buildHeaderGridTemplate(DEFAULT_COLUMN_WIDTHS);
    // Should have resize handle "5px" columns between data columns
    // Count the 5px entries (resize handles)
    const handleCount = result.split(" ").filter((p) => p === "5px").length;
    expect(handleCount).toBe(4);
    // First part should be minmax for name column
    expect(result.indexOf("minmax(") === 0).toBe(true);
    // Last part should be the kind column
    expect(result.lastIndexOf("110px") > 0).toBe(true);
  });

  it("storedColumnWidths returns defaults when nothing stored", () => {
    const result = storedColumnWidths();
    expect(result).toEqual(DEFAULT_COLUMN_WIDTHS);
  });

  it("storedColumnWidths returns stored widths from localStorage", () => {
    const custom: ColumnWidths = {
      name: 400,
      extension: 70,
      size: 100,
      modified: 160,
      kind: 130,
    };
    localStorage.setItem("fileoctopus.columnWidths", JSON.stringify(custom));
    const result = storedColumnWidths();
    expect(result).toEqual(custom);
  });

  it("storedColumnWidths ignores corrupted localStorage data", () => {
    localStorage.setItem("fileoctopus.columnWidths", "not json");
    const result = storedColumnWidths();
    expect(result).toEqual(DEFAULT_COLUMN_WIDTHS);
  });

  it("storedColumnWidths ignores partial data (missing columns)", () => {
    localStorage.setItem(
      "fileoctopus.columnWidths",
      JSON.stringify({ name: 400 }),
    );
    const result = storedColumnWidths();
    expect(result).toEqual(DEFAULT_COLUMN_WIDTHS);
  });

  it("persistColumnWidths writes to localStorage", () => {
    const widths: ColumnWidths = {
      name: 350,
      extension: 55,
      size: 85,
      modified: 130,
      kind: 110,
    };
    persistColumnWidths(widths);
    const stored = localStorage.getItem("fileoctopus.columnWidths");
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)).toEqual(widths);
  });

  it("persistColumnWidths ignores write errors gracefully", () => {
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    expect(() => persistColumnWidths(DEFAULT_COLUMN_WIDTHS)).not.toThrow();
    spy.mockRestore();
  });

  it("storedColumnWidths clamps values to minimum widths", () => {
    const tooSmall: ColumnWidths = {
      name: 10,
      extension: 5,
      size: 5,
      modified: 5,
      kind: 5,
    };
    localStorage.setItem("fileoctopus.columnWidths", JSON.stringify(tooSmall));
    const result = storedColumnWidths();
    // Name should be clamped to at least 80
    expect(result.name).toBeGreaterThanOrEqual(80);
    // Other columns should be clamped to at least 30
    expect(result.extension).toBeGreaterThanOrEqual(30);
    expect(result.size).toBeGreaterThanOrEqual(30);
    expect(result.modified).toBeGreaterThanOrEqual(30);
    expect(result.kind).toBeGreaterThanOrEqual(30);
  });
});
