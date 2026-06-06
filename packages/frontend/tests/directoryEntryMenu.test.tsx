import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FileEntryDto } from "@fileoctopus/ts-api";

// Mock @fileoctopus/ui — provide a real-ish Button so click handlers work
vi.mock("@fileoctopus/ui", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...rest
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    [k: string]: unknown;
  }) => (
    <button disabled={disabled} onClick={onClick} {...rest}>
      {children}
    </button>
  ),
  Icons: {
    archive: () => <span aria-hidden="true" />,
    chevronRight: () => <span aria-hidden="true" />,
    clipboardCopy: () => <span aria-hidden="true" />,
    copy: () => <span aria-hidden="true" />,
    externalLink: () => <span aria-hidden="true" />,
    file: () => <span aria-hidden="true" />,
    folder: () => <span aria-hidden="true" />,
    hash: () => <span aria-hidden="true" />,
    info: () => <span aria-hidden="true" />,
    move: () => <span aria-hidden="true" />,
    pencil: () => <span aria-hidden="true" />,
    plus: () => <span aria-hidden="true" />,
    star: () => <span aria-hidden="true" />,
    terminal: () => <span aria-hidden="true" />,
    trash: () => <span aria-hidden="true" />,
  },
}));

// Mock isRemoteUri
vi.mock("@fileoctopus/ts-api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@fileoctopus/ts-api")>();
  return {
    ...mod,
    isRemoteUri: (uri: string) =>
      uri.startsWith("sftp://") || uri.startsWith("smb://"),
  };
});

// Mock isParentDirectoryEntry — treat entries with name ".." as parent
vi.mock("../../src/utils/parentEntry", () => ({
  isParentDirectoryEntry: (entry: FileEntryDto) => entry.name === "..",
}));

// Mock tagStore — must match the real tagColorValues for tag rendering
vi.mock("../../src/utils/tagStore", () => ({
  tagColorValues: [
    "red",
    "orange",
    "amber",
    "yellow",
    "green",
    "teal",
    "blue",
    "indigo",
    "violet",
    "pink",
  ],
}));

import type { TagColor } from "../../src/utils/tagStore";
import { buildFileEntryMenu } from "../src/menus/context/buildFileEntryMenu";

// ── helpers ──────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<FileEntryDto> = {}): FileEntryDto {
  return {
    uri: "local:///home/user/docs",
    name: "docs",
    kind: "directory",
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

function makeMenuProps(overrides: Record<string, unknown> = {}) {
  return {
    panelId: "left" as const,
    currentTabUri: "local:///home/user",
    entry: makeEntry(),
    canPaste: true,
    isStarred: false,
    entryTagColors: [] as TagColor[],
    run: (action: () => void) => action(),
    onOpen: vi.fn(),
    onOpenInNewTab: vi.fn(),
    onNavigateOtherPane: vi.fn(),
    onOpenWithDefaultApp: vi.fn(),
    onReveal: vi.fn(),
    onAddFavorite: vi.fn(),
    onCut: vi.fn(),
    onCopy: vi.fn(),
    onPaste: vi.fn(),
    onCopyPath: vi.fn(),
    onCopyName: vi.fn(),
    onView: vi.fn(),
    onRename: vi.fn(),
    onCopyTo: vi.fn(),
    onMoveTo: vi.fn(),
    onDelete: vi.fn(),
    onTrash: vi.fn(),
    onPermanentDelete: vi.fn(),
    onToggleStarred: vi.fn(),
    onProperties: vi.fn(),
    onCopyParentPath: vi.fn(),
    onCopyResourceUri: vi.fn(),
    onCompress: vi.fn(),
    onExtract: vi.fn(),
    onOpenTerminal: vi.fn(),
    onOpenTerminalExternal: vi.fn(),
    onChecksum: vi.fn(),
    onRefresh: vi.fn(),
    onSelectAll: vi.fn(),
    onClearSelection: vi.fn(),
    onViewMode: vi.fn(),
    onSort: vi.fn(),
    ...overrides,
  };
}

afterEach(cleanup);

// ── tests ────────────────────────────────────────────────────────────────

describe("buildFileEntryMenu", () => {
  it("renders only Open for parent directory entry", () => {
    const props = makeMenuProps({
      entry: makeEntry({ name: "..", uri: "local:///home" }),
    });
    render(<>{buildFileEntryMenu(props)}</>);
    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain("Open");
  });

  it("renders Open and Open in Other Pane for directories", () => {
    const props = makeMenuProps({
      entry: makeEntry({ kind: "directory", name: "docs" }),
    });
    render(<>{buildFileEntryMenu(props)}</>);
    expect(screen.getByText("Open")).toBeTruthy();
    expect(screen.getByText("Open in New Tab")).toBeTruthy();
    expect(screen.getByText("Open in Other Pane")).toBeTruthy();
    // Should NOT show "Open With Default App"
    expect(screen.queryByText("Open With Default App")).toBeNull();
  });

  it("renders Open and Open With Default App for files", () => {
    const props = makeMenuProps({
      entry: makeEntry({ kind: "file", name: "readme.txt" }),
    });
    render(<>{buildFileEntryMenu(props)}</>);
    expect(screen.getByText("Open")).toBeTruthy();
    expect(screen.getByText("Open With Default App")).toBeTruthy();
    expect(screen.queryByText("Open in New Tab")).toBeNull();
    // Should NOT show "Open in Other Pane"
    expect(screen.queryByText("Open in Other Pane")).toBeNull();
  });

  it("shows Add to Favorites for directories", () => {
    const props = makeMenuProps({
      entry: makeEntry({ kind: "directory" }),
    });
    render(<>{buildFileEntryMenu(props)}</>);
    expect(screen.getByText("Add to Favorites")).toBeTruthy();
  });

  it("hides Add to Favorites for files", () => {
    const props = makeMenuProps({
      entry: makeEntry({ kind: "file" }),
    });
    render(<>{buildFileEntryMenu(props)}</>);
    expect(screen.queryByText("Add to Favorites")).toBeNull();
  });

  it("shows Paste Into Folder for directories, Paste for files", () => {
    const dirProps = makeMenuProps({ entry: makeEntry({ kind: "directory" }) });
    render(<>{buildFileEntryMenu(dirProps)}</>);
    expect(screen.getByText("Paste Into Folder")).toBeTruthy();
    cleanup();

    const fileProps = makeMenuProps({ entry: makeEntry({ kind: "file" }) });
    render(<>{buildFileEntryMenu(fileProps)}</>);
    expect(screen.getByText("Paste")).toBeTruthy();
  });

  it("hides Paste when the clipboard is empty", () => {
    const props = makeMenuProps({
      canPaste: false,
      entry: makeEntry({ kind: "directory" }),
    });
    render(<>{buildFileEntryMenu(props)}</>);
    expect(screen.queryByText("Paste Into Folder")).toBeNull();
  });

  it("disables Cut when entry.canWrite or entry.canDelete is false", () => {
    const props = makeMenuProps({
      entry: makeEntry({ canWrite: false }),
    });
    render(<>{buildFileEntryMenu(props)}</>);
    const cutBtn = screen.getByText("Cut").closest("button")!;
    expect(cutBtn.disabled).toBe(true);
  });

  it("disables Copy when entry.canRead is false", () => {
    const props = makeMenuProps({
      entry: makeEntry({ canRead: false, canList: false }),
    });
    render(<>{buildFileEntryMenu(props)}</>);
    const copyBtn = screen.getByText("Ctrl+C").closest("button")!;
    expect(copyBtn.disabled).toBe(true);
  });

  it("disables Paste when canPaste is false", () => {
    const props = makeMenuProps({
      canPaste: false,
      entry: makeEntry({ kind: "file" }),
    });
    render(<>{buildFileEntryMenu(props)}</>);
    expect(screen.queryByText("Paste")).toBeNull();
  });

  it("disables Rename when entry.canRename is false", () => {
    const props = makeMenuProps({
      entry: makeEntry({ canRename: false }),
    });
    render(<>{buildFileEntryMenu(props)}</>);
    const renameBtn = screen.getByText("Rename…").closest("button")!;
    expect(renameBtn.disabled).toBe(true);
  });

  it("disables Move To when canWrite or canDelete is false", () => {
    const props = makeMenuProps({
      entry: makeEntry({ canDelete: false }),
    });
    render(<>{buildFileEntryMenu(props)}</>);
    const moveBtn = screen.getByText("Move To…").closest("button")!;
    expect(moveBtn.disabled).toBe(true);
  });

  it("disables trash/delete when canDelete is false", () => {
    const props = makeMenuProps({
      entry: makeEntry({ canDelete: false }),
    });
    render(<>{buildFileEntryMenu(props)}</>);
    const deleteBtn = screen.getByText("Delete…").closest("button")!;
    const deletePermBtn = screen
      .getByText("Delete Permanently…")
      .closest("button")!;
    expect(deleteBtn.disabled).toBe(true);
    expect(deletePermBtn.disabled).toBe(true);
  });

  it("shows Delete… as the default delete action", () => {
    const localProps = makeMenuProps({
      currentTabUri: "local:///home/user",
      entry: makeEntry(),
    });
    render(<>{buildFileEntryMenu(localProps)}</>);
    expect(screen.getByText("Delete…")).toBeTruthy();
    expect(screen.queryByText("Move to Trash…")).toBeNull();
    cleanup();

    const remoteProps = makeMenuProps({
      currentTabUri: "sftp://server/home",
      entry: makeEntry(),
    });
    render(<>{buildFileEntryMenu(remoteProps)}</>);
    expect(screen.getByText("Delete…")).toBeTruthy();
  });

  it("shows Move to Trash… only when trash is enabled by preference", () => {
    const props = makeMenuProps({ useTrashByDefault: true });
    render(<>{buildFileEntryMenu(props)}</>);
    expect(screen.getByText("Delete…")).toBeTruthy();
    expect(screen.getByText("Move to Trash…")).toBeTruthy();
  });

  it("shows Add Star when not starred, Remove Star when starred", () => {
    const unstarredProps = makeMenuProps({ isStarred: false });
    render(<>{buildFileEntryMenu(unstarredProps)}</>);
    expect(screen.getByText("Add Star")).toBeTruthy();
    cleanup();

    const starredProps = makeMenuProps({ isStarred: true });
    render(<>{buildFileEntryMenu(starredProps)}</>);
    expect(screen.getByText("Remove Star")).toBeTruthy();
  });

  it("disables Pack and Unpack for remote URIs", () => {
    const props = makeMenuProps({
      currentTabUri: "sftp://server/home",
      entry: makeEntry(),
    });
    render(<>{buildFileEntryMenu(props)}</>);
    const packBtn = screen.getByText("Pack…").closest("button")!;
    expect(packBtn.disabled).toBe(true);
    expect(screen.queryByText("Unpack…")).toBeNull();
  });

  it("does not render pane view or sort controls in the selected entry menu", () => {
    const props = makeMenuProps();
    render(<>{buildFileEntryMenu(props)}</>);
    expect(screen.queryByText("Details View")).toBeNull();
    expect(screen.queryByText("Sort by…")).toBeNull();
  });

  it("moves advanced actions into Copy, Open With, and Tools submenus", () => {
    const props = makeMenuProps();
    render(<>{buildFileEntryMenu(props)}</>);
    expect(screen.getAllByText("Copy").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Open With")).toBeTruthy();
    expect(screen.getByText("Tools")).toBeTruthy();
    expect(screen.getByText("Copy Path")).toBeTruthy();
    expect(screen.getByText("Copy Name")).toBeTruthy();
    expect(screen.getByText("Copy Parent Folder Path")).toBeTruthy();
    expect(screen.getByText("Copy Resource URI")).toBeTruthy();
    expect(screen.getByText("Open Terminal")).toBeTruthy();
    expect(screen.getByText("Open External Terminal")).toBeTruthy();
    expect(screen.getByText("Checksum…")).toBeTruthy();
    expect(screen.queryByText("Refresh")).toBeNull();
    expect(screen.queryByText("Select All")).toBeNull();
    expect(screen.queryByText("Clear Selection")).toBeNull();
    expect(screen.getByText("Properties…")).toBeTruthy();
  });

  it("positions submenu flyouts in viewport coordinates", () => {
    const originalInnerHeight = window.innerHeight;
    const originalInnerWidth = window.innerWidth;
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this.classList.contains("fo-context-menu-submenu")) {
          return {
            bottom: 630,
            height: 30,
            left: 700,
            right: 948,
            top: 600,
            width: 248,
            x: 700,
            y: 600,
            toJSON: () => ({}),
          };
        }

        if (this.classList.contains("fo-context-submenu")) {
          return {
            bottom: 760,
            height: 160,
            left: 0,
            right: 200,
            top: 600,
            width: 200,
            x: 0,
            y: 600,
            toJSON: () => ({}),
          };
        }

        return {
          bottom: 0,
          height: 0,
          left: 0,
          right: 0,
          top: 0,
          width: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        };
      });

    try {
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: 800,
      });
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: 1000,
      });

      const props = makeMenuProps();
      render(<>{buildFileEntryMenu(props)}</>);

      const submenuTrigger = screen
        .getAllByRole("menuitem", { name: /Copy/ })
        .find((item) => item.getAttribute("aria-haspopup") === "menu");
      const submenuWrapper = submenuTrigger?.closest(
        ".fo-context-menu-submenu",
      );
      const submenu = submenuWrapper?.querySelector<HTMLElement>(
        ".fo-context-submenu",
      );

      expect(submenuTrigger).toBeTruthy();
      expect(submenuWrapper).toBeTruthy();

      fireEvent.mouseEnter(submenuWrapper!);

      expect(submenu?.style.left).toBe("501px");
      expect(submenu?.style.top).toBe("596px");
    } finally {
      rectSpy.mockRestore();
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: originalInnerHeight,
      });
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
    }
  });

  it("shows Unpack only for local archive files", () => {
    const archiveProps = makeMenuProps({
      entry: makeEntry({
        kind: "file",
        name: "backup.zip",
        uri: "local:///home/user/backup.zip",
      }),
    });
    render(<>{buildFileEntryMenu(archiveProps)}</>);
    expect(screen.getByText("Unpack…")).toBeTruthy();
    cleanup();

    const normalProps = makeMenuProps({
      entry: makeEntry({ kind: "file", name: "readme.txt" }),
    });
    render(<>{buildFileEntryMenu(normalProps)}</>);
    expect(screen.queryByText("Unpack…")).toBeNull();
  });

  it("renders shortcut hints for common file operations", () => {
    const props = makeMenuProps();
    render(<>{buildFileEntryMenu(props)}</>);
    expect(screen.getByText("Ctrl+X")).toBeTruthy();
    expect(screen.getByText("Ctrl+C")).toBeTruthy();
    expect(screen.getByText("Ctrl+V")).toBeTruthy();
    expect(screen.getByText("F2")).toBeTruthy();
    expect(screen.getByText("F5")).toBeTruthy();
    expect(screen.getByText("F6")).toBeTruthy();
    expect(screen.getByText("Alt+Enter")).toBeTruthy();
  });

  it("invokes action callbacks through run()", () => {
    const onCopyPath = vi.fn();
    const props = makeMenuProps({ onCopyPath });
    render(<>{buildFileEntryMenu(props)}</>);
    fireEvent.click(screen.getByText("Copy Path"));
    expect(onCopyPath).toHaveBeenCalledWith("left");
  });

  it("renders Tags submenu when onAssignTag is provided", () => {
    const props = makeMenuProps({ onAssignTag: vi.fn() });
    render(<>{buildFileEntryMenu(props)}</>);
    expect(screen.getByText("Tags")).toBeTruthy();
    expect(screen.getByText("Red")).toBeTruthy();
    expect(screen.getByText("Green")).toBeTruthy();
  });

  it("does not render Tags submenu when onAssignTag is undefined", () => {
    const props = makeMenuProps();
    render(<>{buildFileEntryMenu(props)}</>);
    expect(screen.queryByText("Tags")).toBeNull();
  });

  it("calls onAssignTag when a tag without existing color is clicked", () => {
    const onAssignTag = vi.fn();
    const onRemoveTag = vi.fn();
    const props = makeMenuProps({
      onAssignTag,
      onRemoveTag,
      entryTagColors: [],
    });
    render(<>{buildFileEntryMenu(props)}</>);
    // "Red" button is in the Tags submenu — find by text content match
    const redBtn = screen.getByRole("menuitem", { name: /Red/ });
    fireEvent.click(redBtn);
    expect(onAssignTag).toHaveBeenCalled();
    expect(onRemoveTag).not.toHaveBeenCalled();
  });

  it("calls onRemoveTag when an existing tag color is clicked", () => {
    const onAssignTag = vi.fn();
    const onRemoveTag = vi.fn();
    const props = makeMenuProps({
      onAssignTag,
      onRemoveTag,
      entryTagColors: ["red" as TagColor],
    });
    render(<>{buildFileEntryMenu(props)}</>);
    // Red has a checkmark (existing tag) — find by accessible name
    const redBtn = screen.getByRole("menuitem", { name: /Red/ });
    fireEvent.click(redBtn);
    expect(onRemoveTag).toHaveBeenCalled();
  });

  it("renders tag color swatches with checkmark for existing tags", () => {
    const props = makeMenuProps({
      onAssignTag: vi.fn(),
      entryTagColors: ["green" as TagColor],
    });
    render(<>{buildFileEntryMenu(props)}</>);
    // Green has a checkmark
    const greenItem = screen.getByRole("menuitem", { name: /Green/ });
    expect(greenItem.textContent).toContain("✓");
    // Red does not
    const redItem = screen.getByRole("menuitem", { name: /^Red/ });
    expect(redItem.textContent).not.toContain("✓");
  });

  it("calls onViewMode with correct mode when view items are clicked", () => {
    const onViewMode = vi.fn();
    const props = makeMenuProps({ onViewMode });
    render(<>{buildFileEntryMenu(props)}</>);
    expect(screen.queryByText("Details View")).toBeNull();
    expect(onViewMode).not.toHaveBeenCalled();
  });

  it("calls onSort with correct field when sort items are clicked", () => {
    const onSort = vi.fn();
    const props = makeMenuProps({ onSort });
    render(<>{buildFileEntryMenu(props)}</>);
    expect(screen.queryByText("Size")).toBeNull();
    expect(onSort).not.toHaveBeenCalled();
  });
});
