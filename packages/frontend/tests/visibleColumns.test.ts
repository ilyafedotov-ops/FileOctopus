import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  DEFAULT_VISIBLE_COLUMNS,
  DEFAULT_COLUMN_WIDTHS,
  storedVisibleColumns,
  persistVisibleColumns,
  buildVisibleGridTemplate,
  buildVisibleHeaderGridTemplate,
  isValidVisibleColumns,
  COLUMN_ORDER,
  type VisibleColumns,
  type ColumnWidths,
} from "../src/pane/columnWidths";

beforeEach(() => {
  localStorage.clear();
});

describe("visible columns persistence", () => {
  it("DEFAULT_VISIBLE_COLUMNS includes all 5 columns", () => {
    expect(DEFAULT_VISIBLE_COLUMNS.length).toBe(5);
    expect(DEFAULT_VISIBLE_COLUMNS).toContain("name");
    expect(DEFAULT_VISIBLE_COLUMNS).toContain("extension");
    expect(DEFAULT_VISIBLE_COLUMNS).toContain("size");
    expect(DEFAULT_VISIBLE_COLUMNS).toContain("modified");
    expect(DEFAULT_VISIBLE_COLUMNS).toContain("kind");
  });

  it("COLUMN_ORDER lists all available column ids", () => {
    expect(COLUMN_ORDER).toEqual([
      "name",
      "extension",
      "size",
      "modified",
      "kind",
    ]);
  });

  it("storedVisibleColumns returns defaults when nothing stored", () => {
    const result = storedVisibleColumns();
    expect(result).toEqual(DEFAULT_VISIBLE_COLUMNS);
  });

  it("storedVisibleColumns returns stored columns from localStorage", () => {
    const custom: VisibleColumns = ["name", "size", "modified"];
    localStorage.setItem("fileoctopus.visibleColumns", JSON.stringify(custom));
    const result = storedVisibleColumns();
    expect(result).toEqual(custom);
  });

  it("storedVisibleColumns always includes name even if missing from stored data", () => {
    localStorage.setItem(
      "fileoctopus.visibleColumns",
      JSON.stringify(["size", "modified"]),
    );
    const result = storedVisibleColumns();
    expect(result).toContain("name");
    expect(result.indexOf("name")).toBe(0);
  });

  it("storedVisibleColumns ignores corrupted localStorage data", () => {
    localStorage.setItem("fileoctopus.visibleColumns", "not json");
    const result = storedVisibleColumns();
    expect(result).toEqual(DEFAULT_VISIBLE_COLUMNS);
  });

  it("storedVisibleColumns ignores invalid column ids", () => {
    localStorage.setItem(
      "fileoctopus.visibleColumns",
      JSON.stringify(["name", "size", "bogus"]),
    );
    const result = storedVisibleColumns();
    expect(result).toEqual(DEFAULT_VISIBLE_COLUMNS);
  });

  it("persistVisibleColumns writes to localStorage", () => {
    const custom: VisibleColumns = ["name", "size"];
    persistVisibleColumns(custom);
    const stored = localStorage.getItem("fileoctopus.visibleColumns");
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)).toEqual(custom);
  });

  it("persistVisibleColumns ignores write errors gracefully", () => {
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    expect(() => persistVisibleColumns(DEFAULT_VISIBLE_COLUMNS)).not.toThrow();
    spy.mockRestore();
  });
});

describe("isValidVisibleColumns", () => {
  it("accepts default visible columns", () => {
    expect(isValidVisibleColumns(DEFAULT_VISIBLE_COLUMNS)).toBe(true);
  });

  it("rejects empty array", () => {
    expect(isValidVisibleColumns([])).toBe(false);
  });

  it("rejects array without name", () => {
    expect(isValidVisibleColumns(["size", "modified"])).toBe(false);
  });

  it("rejects array with unknown column id", () => {
    expect(isValidVisibleColumns(["name", "unknown"])).toBe(false);
  });

  it("accepts subset with name", () => {
    expect(isValidVisibleColumns(["name", "size"])).toBe(true);
  });
});

describe("buildVisibleGridTemplate", () => {
  it("includes only visible columns in grid template", () => {
    const widths: ColumnWidths = { ...DEFAULT_COLUMN_WIDTHS };
    const visible: VisibleColumns = ["name", "size"];
    const result = buildVisibleGridTemplate(widths, visible);
    expect(result).toBe("minmax(220px, 1fr) 78px");
  });

  it("returns all columns when all visible", () => {
    const result = buildVisibleGridTemplate(
      DEFAULT_COLUMN_WIDTHS,
      DEFAULT_VISIBLE_COLUMNS,
    );
    expect(result).toBe("minmax(220px, 1fr) 52px 78px 126px 110px");
  });

  it("returns name-only grid when only name visible", () => {
    const result = buildVisibleGridTemplate(DEFAULT_COLUMN_WIDTHS, ["name"]);
    expect(result).toBe("minmax(220px, 1fr)");
  });

  it("respects the visible array order (not COLUMN_ORDER)", () => {
    const visible: VisibleColumns = ["name", "modified", "size"];
    const result = buildVisibleGridTemplate(DEFAULT_COLUMN_WIDTHS, visible);
    // Should follow the visible array order: name, modified, size
    expect(result).toBe("minmax(220px, 1fr) 126px 78px");
  });

  it("follows COLUMN_ORDER when visible array is in default order", () => {
    const result = buildVisibleGridTemplate(
      DEFAULT_COLUMN_WIDTHS,
      DEFAULT_VISIBLE_COLUMNS,
    );
    expect(result).toBe("minmax(220px, 1fr) 52px 78px 126px 110px");
  });
});

describe("buildVisibleHeaderGridTemplate", () => {
  it("includes resize handles between visible columns", () => {
    const visible: VisibleColumns = ["name", "size"];
    const result = buildVisibleHeaderGridTemplate(
      DEFAULT_COLUMN_WIDTHS,
      visible,
    );
    expect(result).toBe("minmax(220px, 1fr) 5px 78px");
  });

  it("no resize handle when only one column visible", () => {
    const result = buildVisibleHeaderGridTemplate(DEFAULT_COLUMN_WIDTHS, [
      "name",
    ]);
    expect(result).toBe("minmax(220px, 1fr)");
  });

  it("includes all columns and handles when all visible", () => {
    const result = buildVisibleHeaderGridTemplate(
      DEFAULT_COLUMN_WIDTHS,
      DEFAULT_VISIBLE_COLUMNS,
    );
    // 5 columns → 4 resize handles
    const handleCount = result.split(" ").filter((p) => p === "5px").length;
    expect(handleCount).toBe(4);
  });
});
