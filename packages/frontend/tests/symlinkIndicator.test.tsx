import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { FileEntryDto } from "@fileoctopus/ts-api";
import { FileRow } from "../src/pane/FileRow";

afterEach(cleanup);

const baseEntry: FileEntryDto = {
  name: "link-to-docs",
  uri: "local:///home/user/link-to-docs",
  kind: "symlink",
  size: 0,
  extension: "",
  modifiedAt: "2026-05-18T10:30:00Z",
  createdAt: "2026-01-01T00:00:00Z",
  permissions: null,
  owner: null,
  canRead: true,
  canWrite: true,
  canDelete: true,
  canRename: true,
  canList: true,
  isHidden: false,
  isSymlink: true,
  symlinkTarget: "local:///home/user/Documents",
  providerId: "local",
};

function renderRow(
  overrides: Partial<FileEntryDto> = {},
  props: Partial<import("../src/pane/FileRow").FileRowProps> = {},
) {
  const entry = { ...baseEntry, ...overrides };
  render(
    <FileRow
      entry={entry}
      top={0}
      rowHeight={20}
      viewMode="details"
      selected={false}
      multiSelected={false}
      focused={false}
      onSelect={() => {}}
      onEntrySelect={() => {}}
      onEntryActivate={() => {}}
      onContextMenu={() => {}}
      {...props}
    />,
  );
  return entry;
}

describe("FileRow symlink indicator", () => {
  it("renders symlink badge when entry is a symlink", () => {
    renderRow();
    const badge = screen.getByTitle("Symlink → local:///home/user/Documents");
    expect(badge).toBeTruthy();
  });

  it("renders symlink badge without target when symlinkTarget is null", () => {
    renderRow({ symlinkTarget: null });
    const badge = screen.getByTitle("Symlink");
    expect(badge).toBeTruthy();
  });

  it("does not render symlink badge for regular files", () => {
    renderRow({
      kind: "file",
      isSymlink: false,
      symlinkTarget: null,
      name: "regular.txt",
      extension: "txt",
      size: 100,
    });
    const badges = screen.queryAllByTitle(/Symlink/);
    expect(badges.length).toBe(0);
  });

  it("does not render symlink badge for directories", () => {
    renderRow({
      kind: "directory",
      isSymlink: false,
      symlinkTarget: null,
      name: "folder",
      extension: "",
      size: 0,
    });
    const badges = screen.queryAllByTitle(/Symlink/);
    expect(badges.length).toBe(0);
  });

  it("includes 'symlink' in aria-label for accessibility", () => {
    renderRow();
    const row = screen.getByRole("row");
    const label = row.getAttribute("aria-label") ?? "";
    expect(
      label.indexOf("symlink") !== -1 || label.indexOf("Symlink") !== -1,
    ).toBe(true);
  });

  it("renders 'symlink' in kind column in details view", () => {
    renderRow(
      {},
      { visibleColumns: ["extension", "size", "modified", "kind"] },
    );
    const row = screen.getByRole("row");
    const cells = row.querySelectorAll("span");
    let foundSymlinkKind = false;
    for (const cell of cells) {
      if (cell.textContent === "symlink") {
        foundSymlinkKind = true;
        break;
      }
    }
    expect(foundSymlinkKind).toBe(true);
  });
});
