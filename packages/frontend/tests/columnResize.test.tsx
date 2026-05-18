import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { FileTable } from "../src/pane/FileTable";
import { DEFAULT_COLUMN_WIDTHS } from "../src/pane/columnWidths";

afterEach(cleanup);

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    entries: [],
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

describe("FileTable column resize handles", () => {
  it("renders resize handles between column headers in details mode", () => {
    render(<FileTable {...makeProps()} />);
    const handles = screen.getAllByRole("separator");
    // 4 resize handles between 5 columns
    expect(handles.length).toBe(4);
  });

  it("does not render resize handles in list mode", () => {
    render(<FileTable {...makeProps({ viewMode: "list" })} />);
    const handles = screen.queryAllByRole("separator");
    expect(handles.length).toBe(0);
  });

  it("applies grid-template-columns from columnWidths prop", () => {
    render(<FileTable {...makeProps()} />);
    const header = document.querySelector(".fo-table-header");
    expect(header).toBeTruthy();
    const style = header?.getAttribute("style") ?? "";
    expect(style.indexOf("grid-template-columns") !== -1).toBe(true);
    expect(style.indexOf("minmax(") !== -1).toBe(true);
  });

  it("calls onColumnResize when dragging a resize handle", () => {
    const onColumnResize = vi.fn();
    render(<FileTable {...makeProps({ onColumnResize })} />);

    const handles = screen.getAllByRole("separator");
    expect(handles.length).toBeGreaterThan(0);

    // Simulate mousedown on first resize handle
    const handle = handles[0];
    fireEvent.mouseDown(handle, { clientX: 300, button: 0 });

    // Simulate mousemove
    fireEvent.mouseMove(document, { clientX: 350 });

    // Simulate mouseup
    fireEvent.mouseUp(document);

    expect(onColumnResize).toHaveBeenCalled();
    const call = onColumnResize.mock.calls[0];
    expect(call[0]).toBe("name"); // first column resized
    expect(typeof call[1]).toBe("number"); // new width
  });
});
