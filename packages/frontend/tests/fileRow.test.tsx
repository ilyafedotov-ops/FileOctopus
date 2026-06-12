import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileRow } from "../src/pane/FileRow";
import type { FileEntryDto, GitFileStatusDto } from "@fileoctopus/ts-api";

vi.mock("@fileoctopus/ui", () => ({
  cx: (...args: unknown[]) => args.filter(Boolean).join(" "),
  fileEntryIcon: (entry: { name: string; kind: string }) =>
    entry.kind === "directory" ? "📁" : "📄",
}));

function makeEntry(overrides: Partial<FileEntryDto> = {}): FileEntryDto {
  return {
    uri: "local:///home/user/file.txt",
    name: "file.txt",
    extension: "txt",
    kind: "file",
    size: 1024,
    modifiedAt: "2026-01-15T10:30:00Z",
    isHidden: false,
    isSymlink: false,
    providerId: "local",
    canRead: true,
    canList: false,
    canWrite: true,
    canDelete: true,
    canRename: true,
    ...overrides,
  };
}

const baseProps = {
  top: 0,
  rowHeight: 28,
  viewMode: "details" as const,
  selected: false,
  multiSelected: false,
  focused: false,
  onSelect: vi.fn(),
  onEntrySelect: vi.fn(),
  onEntryActivate: vi.fn(),
  onContextMenu: vi.fn(),
};

afterEach(cleanup);

describe("FileRow", () => {
  it("renders file name and aria-label", () => {
    render(<FileRow {...baseProps} entry={makeEntry()} />);
    const row = screen.getByRole("row");
    expect(row).toBeTruthy();
    expect(row.getAttribute("aria-label")).toContain("file.txt");
  });

  it("renders directory as DIR in size column for details mode", () => {
    const entry = makeEntry({
      kind: "directory",
      name: "docs",
      extension: undefined,
    });
    render(<FileRow {...baseProps} entry={entry} />);
    expect(screen.getByText("DIR")).toBeTruthy();
  });

  it("renders parent entry as — in size column", () => {
    const entry = makeEntry({
      kind: "directory",
      name: "..",
      uri: "local:///home/user",
    });
    render(<FileRow {...baseProps} entry={entry} isParentEntry />);
    const cells = screen.getAllByText("—");
    expect(cells.length).toBeGreaterThanOrEqual(1);
  });

  it("shows file size formatted for files", () => {
    render(<FileRow {...baseProps} entry={makeEntry({ size: 2048 })} />);
    expect(screen.getByText("2.0 KB")).toBeTruthy();
  });

  it("shows extension label lowercase for files", () => {
    render(<FileRow {...baseProps} entry={makeEntry()} />);
    expect(screen.getByText("txt")).toBeTruthy();
  });

  it("applies selected class when selected", () => {
    render(<FileRow {...baseProps} entry={makeEntry()} selected />);
    const row = screen.getByRole("row");
    expect(row.className).toContain("fo-row-selected");
  });

  it("applies selected class when multiSelected", () => {
    render(<FileRow {...baseProps} entry={makeEntry()} multiSelected />);
    const row = screen.getByRole("row");
    expect(row.className).toContain("fo-row-selected");
  });

  it("applies focused class when focused", () => {
    render(<FileRow {...baseProps} entry={makeEntry()} focused />);
    const row = screen.getByRole("row");
    expect(row.className).toContain("fo-row-focused");
  });

  it("applies parent class when isParentEntry", () => {
    const entry = makeEntry({
      kind: "directory",
      name: "..",
      uri: "local:///home/user",
    });
    render(<FileRow {...baseProps} entry={entry} isParentEntry />);
    const row = screen.getByRole("row");
    expect(row.className).toContain("fo-row-parent");
  });

  it("calls onSelect on click with entry URI for single mode", () => {
    const onSelect = vi.fn();
    const onEntrySelect = vi.fn();
    render(
      <FileRow
        {...baseProps}
        entry={makeEntry()}
        onSelect={onSelect}
        onEntrySelect={onEntrySelect}
      />,
    );
    fireEvent.click(screen.getByRole("row"));
    expect(onSelect).toHaveBeenCalledWith("local:///home/user/file.txt");
  });

  it("calls onEntrySelect with toggle mode on ctrl+click", () => {
    const onEntrySelect = vi.fn();
    render(
      <FileRow
        {...baseProps}
        entry={makeEntry()}
        onEntrySelect={onEntrySelect}
      />,
    );
    fireEvent.click(screen.getByRole("row"), { ctrlKey: true });
    expect(onEntrySelect).toHaveBeenCalledWith(
      "local:///home/user/file.txt",
      "toggle",
    );
  });

  it("calls onEntrySelect with range mode on shift+click", () => {
    const onEntrySelect = vi.fn();
    render(
      <FileRow
        {...baseProps}
        entry={makeEntry()}
        onEntrySelect={onEntrySelect}
      />,
    );
    fireEvent.click(screen.getByRole("row"), { shiftKey: true });
    expect(onEntrySelect).toHaveBeenCalledWith(
      "local:///home/user/file.txt",
      "range",
    );
  });

  it("calls onEntryActivate on double-click", () => {
    const onEntryActivate = vi.fn();
    render(
      <FileRow
        {...baseProps}
        entry={makeEntry()}
        onEntryActivate={onEntryActivate}
      />,
    );
    fireEvent.doubleClick(screen.getByRole("row"));
    expect(onEntryActivate).toHaveBeenCalledTimes(1);
    expect(onEntryActivate.mock.calls[0][0].uri).toBe(
      "local:///home/user/file.txt",
    );
  });

  it("calls onContextMenu on right-click", () => {
    const onContextMenu = vi.fn();
    render(
      <FileRow
        {...baseProps}
        entry={makeEntry()}
        onContextMenu={onContextMenu}
      />,
    );
    fireEvent.contextMenu(screen.getByRole("row"));
    expect(onContextMenu).toHaveBeenCalledTimes(1);
  });

  it("is not draggable when isParentEntry", () => {
    const entry = makeEntry({
      kind: "directory",
      name: "..",
      uri: "local:///home",
    });
    const { container } = render(
      <FileRow {...baseProps} entry={entry} isParentEntry />,
    );
    const row = container.querySelector('[role="row"]');
    expect(row?.getAttribute("draggable")).toBe("false");
  });

  it("is draggable when not isParentEntry", () => {
    const { container } = render(
      <FileRow {...baseProps} entry={makeEntry()} />,
    );
    const row = container.querySelector('[role="row"]');
    expect(row?.getAttribute("draggable")).toBe("true");
  });

  it("sets drag data on drag start", () => {
    const { container } = render(
      <FileRow
        {...baseProps}
        entry={makeEntry()}
        panelId="left"
        selectedUris={["local:///home/user/file.txt"]}
      />,
    );
    const row = container.querySelector('[role="row"]')!;
    const dt = {
      setData: vi.fn(),
      effectAllowed: "",
    };
    fireEvent.dragStart(row, { dataTransfer: dt });
    expect(dt.setData).toHaveBeenCalledWith(
      "application/x-fileoctopus-uri",
      "local:///home/user/file.txt",
    );
    expect(dt.setData).toHaveBeenCalledWith(
      "application/x-fileoctopus-name",
      "file.txt",
    );
    expect(dt.setData).toHaveBeenCalledWith(
      "application/x-fileoctopus-panel-id",
      "left",
    );
  });

  it("sets selectedUris on drag when multiple selected", () => {
    const uris = [
      "local:///home/user/file.txt",
      "local:///home/user/other.txt",
    ];
    const { container } = render(
      <FileRow
        {...baseProps}
        entry={makeEntry()}
        panelId="left"
        selectedUris={uris}
      />,
    );
    const row = container.querySelector('[role="row"]')!;
    const dt = {
      setData: vi.fn(),
      effectAllowed: "",
    };
    fireEvent.dragStart(row, { dataTransfer: dt });
    expect(dt.setData).toHaveBeenCalledWith(
      "application/x-fileoctopus-selected-uris",
      JSON.stringify(uris),
    );
  });

  it("does not set selectedUris on drag when only one selected", () => {
    const { container } = render(
      <FileRow
        {...baseProps}
        entry={makeEntry()}
        panelId="left"
        selectedUris={["local:///home/user/file.txt"]}
      />,
    );
    const row = container.querySelector('[role="row"]')!;
    const dt = {
      setData: vi.fn(),
      effectAllowed: "",
    };
    fireEvent.dragStart(row, { dataTransfer: dt });
    const selectedUrisCall = dt.setData.mock.calls.find(
      (c: unknown[]) => c[0] === "application/x-fileoctopus-selected-uris",
    );
    expect(selectedUrisCall).toBeUndefined();
  });

  it("renders git status badge when status is not clean", () => {
    const entry = makeEntry();
    render(
      <FileRow
        {...baseProps}
        entry={entry}
        gitStatus={"modified" as GitFileStatusDto}
      />,
    );
    expect(screen.getByTitle("Git status: modified")).toBeTruthy();
    expect(screen.getByTitle("Git status: modified").textContent).toBe("M");
  });

  it("does not render git status badge when clean", () => {
    const entry = makeEntry();
    const { container } = render(
      <FileRow
        {...baseProps}
        entry={entry}
        gitStatus={"clean" as GitFileStatusDto}
      />,
    );
    expect(container.querySelector(".fo-row-git-badge")).toBeNull();
  });

  it("renders git status labels correctly", () => {
    const cases: Array<[GitFileStatusDto, string]> = [
      ["added", "A"],
      ["deleted", "D"],
      ["renamed", "R"],
      ["untracked", "?"],
      ["ignored", "I"],
      ["conflicted", "U"],
      ["unknown", "!"],
    ];
    for (const [status, label] of cases) {
      cleanup();
      const entry = makeEntry();
      render(<FileRow {...baseProps} entry={entry} gitStatus={status} />);
      expect(screen.getByTitle(`Git status: ${status}`).textContent).toBe(
        label,
      );
    }
  });

  it("renders tag badges", () => {
    const entry = makeEntry();
    render(
      <FileRow {...baseProps} entry={entry} tagColors={["red", "blue"]} />,
    );
    expect(screen.getByTitle("Tag: red")).toBeTruthy();
    expect(screen.getByTitle("Tag: blue")).toBeTruthy();
  });

  it("renders symlink badge", () => {
    const entry = makeEntry({
      isSymlink: true,
      symlinkTarget: "/home/user/real.txt",
    });
    render(<FileRow {...baseProps} entry={entry} />);
    const badge = screen.getByTitle("Symlink → /home/user/real.txt");
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe("↗");
  });

  it("renders symlink badge without target", () => {
    const entry = makeEntry({ isSymlink: true, symlinkTarget: undefined });
    render(<FileRow {...baseProps} entry={entry} />);
    expect(screen.getByTitle("Symlink")).toBeTruthy();
  });

  it("renders cloud-only badge for placeholder entries", () => {
    const entry = makeEntry({ isPlaceholder: true });
    render(<FileRow {...baseProps} entry={entry} />);
    expect(screen.getByLabelText("Cloud-only file")).toBeTruthy();
  });

  it("does not render cloud-only badge for regular entries", () => {
    const entry = makeEntry();
    render(<FileRow {...baseProps} entry={entry} />);
    expect(screen.queryByLabelText("Cloud-only file")).toBeNull();
  });

  it("renders network status badge", () => {
    const entry = makeEntry({ status: "available" });
    render(<FileRow {...baseProps} entry={entry} />);
    expect(screen.getByTitle("available")).toBeTruthy();
    expect(screen.getByText("OK")).toBeTruthy();
  });

  it("renders network status labels correctly", () => {
    const cases: Array<[string, string]> = [
      ["saved", "SAVED"],
      ["credentialsRequired", "AUTH"],
      ["unavailable", "OFF"],
    ];
    for (const [status, label] of cases) {
      cleanup();
      const entry = makeEntry({ status, description: `desc ${status}` });
      render(<FileRow {...baseProps} entry={entry} />);
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("renders network status with description fallback", () => {
    const entry = makeEntry({ status: "custom", description: null });
    render(<FileRow {...baseProps} entry={entry} />);
    expect(screen.getByTitle("custom")).toBeTruthy();
    expect(screen.getByText("CUSTOM")).toBeTruthy();
  });

  it("renders renaming input when renaming is true", () => {
    const entry = makeEntry();
    render(
      <FileRow
        {...baseProps}
        entry={entry}
        renaming
        onSubmitRename={vi.fn()}
      />,
    );
    const input = screen.getByLabelText("Rename file.txt");
    expect(input).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe("file.txt");
  });

  it("calls onSubmitRename on Enter in rename input", () => {
    const onSubmitRename = vi.fn();
    const entry = makeEntry();
    render(
      <FileRow
        {...baseProps}
        entry={entry}
        renaming
        onSubmitRename={onSubmitRename}
      />,
    );
    const input = screen.getByLabelText("Rename file.txt");
    fireEvent.change(input, { target: { value: "renamed.txt" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmitRename).toHaveBeenCalledWith("renamed.txt");
  });

  it("calls onCancelRename on Escape in rename input", () => {
    const onCancelRename = vi.fn();
    const entry = makeEntry();
    render(
      <FileRow
        {...baseProps}
        entry={entry}
        renaming
        onCancelRename={onCancelRename}
      />,
    );
    const input = screen.getByLabelText("Rename file.txt");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onCancelRename).toHaveBeenCalledTimes(1);
  });

  it("calls onSubmitRename on blur of rename input", () => {
    const onSubmitRename = vi.fn();
    const entry = makeEntry();
    render(
      <FileRow
        {...baseProps}
        entry={entry}
        renaming
        onSubmitRename={onSubmitRename}
      />,
    );
    const input = screen.getByLabelText("Rename file.txt");
    fireEvent.blur(input);
    expect(onSubmitRename).toHaveBeenCalledWith("file.txt");
  });

  it("stops propagation on rename input click", () => {
    const onSelect = vi.fn();
    const entry = makeEntry();
    render(
      <FileRow
        {...baseProps}
        entry={entry}
        renaming
        onSelect={onSelect}
        onSubmitRename={vi.fn()}
      />,
    );
    const input = screen.getByLabelText("Rename file.txt");
    fireEvent.click(input);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("renders fileTypeColor style on name span", () => {
    const entry = makeEntry();
    render(<FileRow {...baseProps} entry={entry} fileTypeColor="#ff0000" />);
    const nameSpan = screen.getByTitle("file.txt");
    expect(nameSpan.style.color).toBe("rgb(255, 0, 0)");
  });

  it("renders kind column correctly for files", () => {
    render(<FileRow {...baseProps} entry={makeEntry()} />);
    expect(screen.getByText("TXT")).toBeTruthy();
  });

  it("renders kind column correctly for directories", () => {
    const entry = makeEntry({
      kind: "directory",
      name: "docs",
      extension: undefined,
    });
    render(<FileRow {...baseProps} entry={entry} />);
    expect(screen.getByText("folder")).toBeTruthy();
  });

  it("renders kind column correctly for parent entry", () => {
    const entry = makeEntry({
      kind: "directory",
      name: "..",
      uri: "local:///home",
    });
    render(<FileRow {...baseProps} entry={entry} isParentEntry />);
    expect(screen.getByText("parent")).toBeTruthy();
  });

  it("renders kind column correctly for symlinks", () => {
    const entry = makeEntry({ isSymlink: true });
    render(<FileRow {...baseProps} entry={entry} />);
    expect(screen.getByText("symlink")).toBeTruthy();
  });

  it("renders list mode with simplified metadata", () => {
    render(<FileRow {...baseProps} entry={makeEntry()} viewMode="list" />);
    expect(screen.getByText("1.0 KB")).toBeTruthy();
    expect(screen.getByText("TXT")).toBeTruthy();
  });

  it("renders list mode showing — for directory size", () => {
    const entry = makeEntry({
      kind: "directory",
      name: "docs",
      extension: undefined,
    });
    render(<FileRow {...baseProps} entry={entry} viewMode="list" />);
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("does not show metadata columns in icons mode", () => {
    const { container } = render(
      <FileRow {...baseProps} entry={makeEntry()} viewMode="icons" />,
    );
    const row = container.querySelector('[role="row"]')!;
    expect(row.style.transform).toBe("");
    expect(row.style.height).toBe("");
  });

  it("applies translateY in details mode", () => {
    const { container } = render(
      <FileRow {...baseProps} entry={makeEntry()} top={56} />,
    );
    const row = container.querySelector('[role="row"]')!;
    expect(row.style.transform).toBe("translateY(56px)");
  });

  it("applies gridTemplateColumns when gridColumns is set", () => {
    const { container } = render(
      <FileRow
        {...baseProps}
        entry={makeEntry()}
        gridColumns="200px 50px 80px 120px 100px"
      />,
    );
    const row = container.querySelector('[role="row"]')!;
    expect(row.style.gridTemplateColumns).toBe("200px 50px 80px 120px 100px");
  });

  it("renders visible columns subset correctly", () => {
    render(
      <FileRow
        {...baseProps}
        entry={makeEntry()}
        visibleColumns={["extension", "kind"]}
      />,
    );
    expect(screen.getByText("txt")).toBeTruthy();
    expect(screen.getByText("TXT")).toBeTruthy();
  });

  it("renders typeLabel for cloudDrive virtualKind", () => {
    const entry = makeEntry({
      virtualKind: "cloudDrive",
      kind: "directory",
      name: "GDrive",
    });
    render(<FileRow {...baseProps} entry={entry} viewMode="list" />);
    expect(screen.getByText("Cloud")).toBeTruthy();
  });

  it("renders typeLabel for savedConnection virtualKind", () => {
    const entry = makeEntry({
      virtualKind: "savedConnection",
      kind: "directory",
      name: "My Server",
    });
    render(<FileRow {...baseProps} entry={entry} viewMode="list" />);
    expect(screen.getByText("Saved")).toBeTruthy();
  });

  it("renders typeLabel for discoveredService virtualKind with protocol", () => {
    const entry = makeEntry({
      virtualKind: "discoveredService",
      kind: "directory",
      name: "Server",
      protocol: "smb",
    });
    render(<FileRow {...baseProps} entry={entry} viewMode="list" />);
    expect(screen.getByText("SMB")).toBeTruthy();
  });

  it("renders typeLabel for discoveredService without protocol as Network", () => {
    const entry = makeEntry({
      virtualKind: "discoveredService",
      kind: "directory",
      name: "Server",
      protocol: null,
    });
    render(<FileRow {...baseProps} entry={entry} viewMode="list" />);
    expect(screen.getByText("NETWORK")).toBeTruthy();
  });

  it("renders typeLabel for addConnection virtualKind", () => {
    const entry = makeEntry({
      virtualKind: "addConnection",
      kind: "directory",
      name: "Add",
    });
    render(<FileRow {...baseProps} entry={entry} viewMode="list" />);
    expect(screen.getByText("Action")).toBeTruthy();
  });

  it("renders file with no extension as File type", () => {
    const entry = makeEntry({ extension: null, name: "Makefile" });
    render(<FileRow {...baseProps} entry={entry} viewMode="list" />);
    expect(screen.getByText("File")).toBeTruthy();
  });

  it("renders symlink as Symlink type", () => {
    cleanup();
    const entry = makeEntry({ isSymlink: true });
    render(<FileRow {...baseProps} entry={entry} viewMode="list" />);
    const typeLabels = screen.getAllByText("Symlink");
    expect(typeLabels.length).toBeGreaterThanOrEqual(1);
  });

  it("renders aria-label with symlink indicator", () => {
    const entry = makeEntry({ isSymlink: true });
    render(<FileRow {...baseProps} entry={entry} />);
    const row = screen.getByRole("row");
    expect(row.getAttribute("aria-label")).toContain("symlink");
  });
});
