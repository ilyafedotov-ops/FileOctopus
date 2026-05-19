import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { FileEntryDto } from "@fileoctopus/ts-api";
import { SelectionPropertiesDialog } from "../src/components/dialogs/SelectionPropertiesDialog";

afterEach(cleanup);

function makeEntry(overrides: Partial<FileEntryDto> = {}): FileEntryDto {
  return {
    name: "test.txt",
    uri: "local:///home/user/test.txt",
    kind: "file",
    size: 1024,
    extension: ".txt",
    modifiedAt: "2026-01-01T00:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
    isHidden: false,
    isSymlink: false,
    providerId: "local",
    canRead: true,
    canList: true,
    canWrite: true,
    canDelete: true,
    canRename: true,
    ...overrides,
  };
}

const entries: FileEntryDto[] = [
  makeEntry({
    name: "file1.txt",
    uri: "local:///home/user/docs/file1.txt",
    kind: "file",
    size: 100,
    extension: ".txt",
  }),
  makeEntry({
    name: "file2.png",
    uri: "local:///home/user/docs/file2.png",
    kind: "file",
    size: 200,
    extension: ".png",
  }),
  makeEntry({
    name: "subdir",
    uri: "local:///home/user/docs/subdir",
    kind: "directory",
    size: 0,
    extension: null,
  }),
];

describe("SelectionPropertiesDialog", () => {
  it("renders with aggregate counts", () => {
    render(
      <SelectionPropertiesDialog
        open={true}
        entries={entries}
        onClose={() => {}}
        onCopyPaths={() => {}}
      />,
    );

    // Use label context to disambiguate
    const values = screen.getAllByText("3");
    expect(values.length).toBeGreaterThanOrEqual(1);
    const ones = screen.getAllByText("1");
    expect(ones.length).toBeGreaterThanOrEqual(1);
  });

  it("shows total size of files", () => {
    render(
      <SelectionPropertiesDialog
        open={true}
        entries={entries}
        onClose={() => {}}
        onCopyPaths={() => {}}
      />,
    );

    // 100 + 200 = 300 bytes
    expect(screen.getByText("300 B")).toBeTruthy();
  });

  it("shows common parent path", () => {
    render(
      <SelectionPropertiesDialog
        open={true}
        entries={entries}
        onClose={() => {}}
        onCopyPaths={() => {}}
      />,
    );

    expect(screen.getByText("/home/user/docs")).toBeTruthy();
  });

  it("shows type breakdown", () => {
    render(
      <SelectionPropertiesDialog
        open={true}
        entries={entries}
        onClose={() => {}}
        onCopyPaths={() => {}}
      />,
    );

    expect(screen.getByText(".txt")).toBeTruthy();
    expect(screen.getByText(".png")).toBeTruthy();
    expect(screen.getByText("folder")).toBeTruthy();
  });

  it("calls onClose when Close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <SelectionPropertiesDialog
        open={true}
        entries={entries}
        onClose={onClose}
        onCopyPaths={() => {}}
      />,
    );

    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onCopyPaths when Copy Paths button is clicked", () => {
    const onCopyPaths = vi.fn();
    render(
      <SelectionPropertiesDialog
        open={true}
        entries={entries}
        onClose={() => {}}
        onCopyPaths={onCopyPaths}
      />,
    );

    fireEvent.click(screen.getByText("Copy Paths"));
    expect(onCopyPaths).toHaveBeenCalledOnce();
  });

  it("returns null when open is false", () => {
    const { container } = render(
      <SelectionPropertiesDialog
        open={false}
        entries={entries}
        onClose={() => {}}
        onCopyPaths={() => {}}
      />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("handles single-file selection", () => {
    const singleEntry = [entries[0]];
    render(
      <SelectionPropertiesDialog
        open={true}
        entries={singleEntry}
        onClose={() => {}}
        onCopyPaths={() => {}}
      />,
    );

    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1);
  });

  it("handles directory-only selection", () => {
    const dirs = [
      makeEntry({
        name: "folder1",
        uri: "local:///home/user/docs/folder1",
        kind: "directory",
        size: 0,
        extension: null,
      }),
      makeEntry({
        name: "folder2",
        uri: "local:///home/user/docs/folder2",
        kind: "directory",
        size: 0,
        extension: null,
      }),
    ];
    render(
      <SelectionPropertiesDialog
        open={true}
        entries={dirs}
        onClose={() => {}}
        onCopyPaths={() => {}}
      />,
    );

    // Should show 0 files count, 2 folders
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("0")).toBeTruthy(); // 0 files
  });

  it("shows Calculating total size when calculating", () => {
    render(
      <SelectionPropertiesDialog
        open={true}
        entries={entries}
        onClose={() => {}}
        onCopyPaths={() => {}}
        calculatingSize={true}
      />,
    );

    expect(screen.getByText("Calculating…")).toBeTruthy();
  });

  it("shows total size from prop when provided", () => {
    render(
      <SelectionPropertiesDialog
        open={true}
        entries={entries}
        onClose={() => {}}
        onCopyPaths={() => {}}
        totalSize={98765}
      />,
    );

    expect(screen.getByText("96.5 KB")).toBeTruthy();
  });

  it("shows Calculate Size button for directories when not calculating", () => {
    const dirs = [
      makeEntry({
        name: "folder1",
        uri: "local:///home/user/docs/folder1",
        kind: "directory",
        size: 0,
        extension: null,
      }),
    ];
    const onCalculate = vi.fn();
    render(
      <SelectionPropertiesDialog
        open={true}
        entries={dirs}
        onClose={() => {}}
        onCopyPaths={() => {}}
        onCalculateSize={onCalculate}
      />,
    );

    const btn = screen.getByText("Calculate Size");
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onCalculate).toHaveBeenCalledOnce();
  });
});
