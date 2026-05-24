import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { FileTable } from "../src/pane/FileTable";
import { FileRow } from "../src/pane/FileRow";
import { DEFAULT_COLUMN_WIDTHS } from "../src/pane/columnWidths";
import type { FileEntryDto } from "@fileoctopus/ts-api";

afterEach(cleanup);

function makeFileTableProps(overrides: Record<string, unknown> = {}) {
  return {
    entries: [] as FileEntryDto[],
    currentUri: "local:///tmp/nested",
    loadState: "loaded" as const,
    rowHeight: 32,
    selectedId: null,
    selectedIds: [] as string[],
    focusedId: null,
    sortField: "name" as const,
    sortDirection: "asc",
    viewMode: "details" as const,
    filterQuery: "",
    columnWidths: DEFAULT_COLUMN_WIDTHS,
    visibleColumns: ["name", "extension", "size", "modified", "kind"] as const,
    onColumnReorder: vi.fn(),
    onColumnResize: vi.fn(),
    onSelect: vi.fn(),
    onEntrySelect: vi.fn(),
    onMove: vi.fn(),
    onSort: vi.fn(),
    onActivate: vi.fn(),
    onEntryActivate: vi.fn(),
    onContextMenu: vi.fn(),
    onCreateFolder: vi.fn(),
    onCreateFile: vi.fn(),
    ...overrides,
  };
}

function makeEntry(overrides: Partial<FileEntryDto> = {}): FileEntryDto {
  return {
    name: "test.txt",
    uri: "local:///tmp/nested/test.txt",
    kind: "file",
    size: 1024,
    extension: "txt",
    modifiedAt: "2024-01-15T10:30:00Z",
    createdAt: "2024-01-10T08:00:00Z",
    canRead: true,
    canWrite: true,
    canDelete: true,
    canRename: true,
    canList: true,
    ...overrides,
  };
}

describe("FileTable column reorder", () => {
  it("renders column headers in visibleColumns order", () => {
    render(
      <FileTable
        {...makeFileTableProps({
          visibleColumns: ["name", "modified", "size"],
        })}
      />,
    );
    const buttons = screen.getAllByRole("columnheader");
    expect(buttons.length).toBe(3);
    expect(buttons[0].textContent).toContain("Name");
    expect(buttons[1].textContent).toContain("modified");
    expect(buttons[2].textContent).toContain("size");
  });

  it("calls onColumnReorder when a column is dragged to another position", () => {
    const onColumnReorder = vi.fn();
    render(
      <FileTable
        {...makeFileTableProps({
          visibleColumns: ["name", "extension", "size", "modified", "kind"],
          onColumnReorder,
        })}
      />,
    );

    const buttons = screen.getAllByRole("columnheader");
    // Drag the second column (extension) to the fourth position (after modified)
    const source = buttons[1]; // extension
    const target = buttons[3]; // modified

    fireEvent.dragStart(source);
    fireEvent.dragOver(target);
    fireEvent.drop(target);

    expect(onColumnReorder).toHaveBeenCalledTimes(1);
    expect(onColumnReorder).toHaveBeenCalledWith(1, 3);
  });

  it("calls onColumnReorder with correct indices for first to last", () => {
    const onColumnReorder = vi.fn();
    render(
      <FileTable
        {...makeFileTableProps({
          visibleColumns: ["name", "size", "modified"],
          onColumnReorder,
        })}
      />,
    );

    const buttons = screen.getAllByRole("columnheader");
    fireEvent.dragStart(buttons[1]); // size
    fireEvent.dragOver(buttons[2]); // modified
    fireEvent.drop(buttons[2]);

    expect(onColumnReorder).toHaveBeenCalledWith(1, 2);
  });
});

describe("FileRow column order", () => {
  it("renders metadata cells in visibleColumns order", () => {
    const entry = makeEntry();
    render(
      <FileRow
        entry={entry}
        top={0}
        rowHeight={32}
        viewMode="details"
        gridColumns="minmax(220px, 1fr) 52px 78px"
        visibleColumns={["name", "modified", "size"]}
        selected={false}
        multiSelected={false}
        focused={false}
        onSelect={vi.fn()}
        onEntrySelect={vi.fn()}
        onEntryActivate={vi.fn()}
        onContextMenu={vi.fn()}
      />,
    );

    const row = screen.getByRole("row");
    const spans = Array.from(row.querySelectorAll("span")).filter(
      (el) =>
        el.className === "" &&
        el.textContent &&
        el.textContent.trim().length > 0,
    );

    // After the name column, the next visible cell should be the modified date
    // We check the text content order
    const texts = spans.map((s) => s.textContent?.trim());
    const sizeIndex = texts.indexOf("1.0 KB");
    const modifiedIndex = texts.indexOf("Jan 15, 2024");

    expect(sizeIndex).toBeGreaterThan(-1);
    expect(modifiedIndex).toBeGreaterThan(-1);
    // modified should come before size because visibleColumns is [name, modified, size]
    expect(modifiedIndex).toBeLessThan(sizeIndex);
  });

  it("skips cells for hidden columns", () => {
    const entry = makeEntry();
    render(
      <FileRow
        entry={entry}
        top={0}
        rowHeight={32}
        viewMode="details"
        gridColumns="minmax(220px, 1fr) 78px"
        visibleColumns={["name", "size"]}
        selected={false}
        multiSelected={false}
        focused={false}
        onSelect={vi.fn()}
        onEntrySelect={vi.fn()}
        onEntryActivate={vi.fn()}
        onContextMenu={vi.fn()}
      />,
    );

    const row = screen.getByRole("row");
    // Only 2 data cells should render after name (size only)
    const dataSpans = Array.from(row.querySelectorAll("span")).filter(
      (el) =>
        el.className === "" &&
        el.textContent &&
        el.textContent.trim().length > 0 &&
        el.parentElement === row,
    );
    // name cell is inside .fo-row-name, so dataSpans should contain just size
    expect(dataSpans.length).toBe(1);
    expect(dataSpans[0].textContent?.trim()).toBe("1.0 KB");
  });
});
