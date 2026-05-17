import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { FileTable } from "../src/pane/FileTable";

afterEach(cleanup);

function renderEmptyTable(overrides: { filterQuery?: string } = {}) {
  const props = {
    entries: [],
    loadState: "ready" as const,
    rowHeight: 32,
    selectedId: null,
    selectedIds: [],
    focusedId: null,
    sortField: "name" as const,
    sortDirection: "asc",
    viewMode: "details" as const,
    filterQuery: overrides.filterQuery ?? "",
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
  return render(<FileTable {...props} />);
}

describe("Empty directory state (spec §12.3)", () => {
  it("shows empty folder message with icon when no filter", () => {
    renderEmptyTable();
    expect(screen.getByText("This folder is empty")).toBeTruthy();
  });

  it("shows search icon and no-matches message when filtering", () => {
    renderEmptyTable({ filterQuery: "test" });
    expect(screen.getByText('No matches for "test"')).toBeTruthy();
  });

  it("shows New Folder action button in empty state", () => {
    renderEmptyTable();
    const btn = screen.getByRole("button", { name: /new folder/i });
    expect(btn).toBeTruthy();
  });

  it("shows New File action button in empty state", () => {
    renderEmptyTable();
    const btn = screen.getByRole("button", { name: /new file/i });
    expect(btn).toBeTruthy();
  });

  it("does not show action buttons when filtering (no matches state)", () => {
    renderEmptyTable({ filterQuery: "test" });
    expect(screen.queryByRole("button", { name: /new folder/i })).toBeNull();
  });

  it("calls onCreateFolder when New Folder button clicked", () => {
    const onCreateFolder = vi.fn();
    renderEmptyTable({ onCreateFolder });
    screen.getByRole("button", { name: /new folder/i }).click();
    expect(onCreateFolder).toHaveBeenCalledTimes(1);
  });

  it("calls onCreateFile when New File button clicked", () => {
    const onCreateFile = vi.fn();
    renderEmptyTable({ onCreateFile });
    screen.getByRole("button", { name: /new file/i }).click();
    expect(onCreateFile).toHaveBeenCalledTimes(1);
  });
});
