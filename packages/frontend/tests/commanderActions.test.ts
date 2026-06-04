import { describe, expect, it, vi } from "vitest";
import { createInitialState, activeTab } from "../src/panelStore";
import {
  createCommanderActions,
  COMMANDER_FUNCTION_ITEMS,
  commanderItemDisabled,
} from "../src/shell/commanderActions";

function baseDeps(overrides: Record<string, unknown> = {}) {
  const state = createInitialState();
  const panelId = state.activePanelId;
  const tab = activeTab(state.panels[panelId]);

  return {
    panelId,
    tab,
    setViewerOpen: vi.fn(),
    setViewerEntry: vi.fn(),
    setEditorOpen: vi.fn(),
    setEditorEntry: vi.fn(),
    isTextEditable: () => false,
    handleCommandSelect: vi.fn(),
    handleCopyOrMove: vi.fn(),
    handleCreateFolder: vi.fn(),
    handleTrash: vi.fn(),
    handleDelete: vi.fn(),
    handleProperties: vi.fn(async () => undefined),
    setOperationError: vi.fn(),
    ...overrides,
  };
}

describe("createCommanderActions", () => {
  it("opens properties for view when nothing previewable is selected", () => {
    const handleProperties = vi.fn(async () => undefined);
    const commander = createCommanderActions(baseDeps({ handleProperties }));

    commander.view();

    expect(handleProperties).toHaveBeenCalledWith("left", null);
  });

  it("opens viewer for selected files on view", () => {
    const setViewerOpen = vi.fn();
    const setViewerEntry = vi.fn();
    const tab = {
      ...activeTab(createInitialState().panels.left),
      selectedId: "local:///tmp/readme.txt",
      selectedIds: ["local:///tmp/readme.txt"],
      entriesById: {
        "local:///tmp/readme.txt": {
          uri: "local:///tmp/readme.txt",
          name: "readme.txt",
          kind: "file",
          size: 12,
          isHidden: false,
          isSymlink: false,
          providerId: "local",
          canRead: true,
          canList: false,
          canWrite: true,
          canDelete: true,
          canRename: true,
        },
      },
      orderedEntryIds: ["local:///tmp/readme.txt"],
    };

    const commander = createCommanderActions(
      baseDeps({
        tab,
        setViewerOpen,
        setViewerEntry,
      }),
    );

    commander.view();

    expect(setViewerEntry).toHaveBeenCalled();
    expect(setViewerOpen).toHaveBeenCalledWith(true);
  });

  it("opens viewer for binary files on view", () => {
    const setViewerOpen = vi.fn();
    const setViewerEntry = vi.fn();
    const setOperationError = vi.fn();
    const tab = {
      ...activeTab(createInitialState().panels.left),
      selectedId: "local:///tmp/archive.bin",
      selectedIds: ["local:///tmp/archive.bin"],
      entriesById: {
        "local:///tmp/archive.bin": {
          uri: "local:///tmp/archive.bin",
          name: "archive.bin",
          kind: "file",
          size: 12,
          isHidden: false,
          isSymlink: false,
          providerId: "local",
          canRead: true,
          canList: false,
          canWrite: true,
          canDelete: true,
          canRename: true,
        },
      },
      orderedEntryIds: ["local:///tmp/archive.bin"],
    };

    const commander = createCommanderActions(
      baseDeps({ tab, setViewerOpen, setViewerEntry, setOperationError }),
    );

    commander.view();

    expect(setOperationError).toHaveBeenCalledWith(null);
    expect(setViewerOpen).toHaveBeenCalledWith(true);
  });

  it("exposes the full F1-F10 Norton function-key layout", () => {
    const keys = COMMANDER_FUNCTION_ITEMS.map((item) => item.key);
    expect(keys).toEqual([
      "F1",
      "F2",
      "F3",
      "F4",
      "F5",
      "F6",
      "F7",
      "F8",
      "F9",
      "F10",
    ]);
  });

  it("dispatches help and menu for F1 and F10, always enabled", () => {
    const handleCommandSelect = vi.fn();
    const commander = createCommanderActions(baseDeps({ handleCommandSelect }));

    commander.help();
    expect(handleCommandSelect).toHaveBeenCalledWith("app.shortcuts", "left");

    commander.menu();
    expect(handleCommandSelect).toHaveBeenCalledWith(
      "app.commandPalette",
      "left",
    );

    expect(commanderItemDisabled("help", commander)).toBe(false);
    expect(commanderItemDisabled("menu", commander)).toBe(false);
  });

  it("creates a folder from F7 action", () => {
    const handleCreateFolder = vi.fn();
    const commander = createCommanderActions(baseDeps({ handleCreateFolder }));

    commander.newFolder();

    expect(handleCreateFolder).toHaveBeenCalledWith("left");
  });

  it("allows copy on remote panes when entries are readable", () => {
    const handleCopyOrMove = vi.fn();
    const tab = {
      ...activeTab(createInitialState().panels.left),
      uri: "sftp://550e8400-e29b-41d4-a716-446655440000/home",
      selectedId: "sftp://550e8400-e29b-41d4-a716-446655440000/home/readme.txt",
      selectedIds: [
        "sftp://550e8400-e29b-41d4-a716-446655440000/home/readme.txt",
      ],
      entriesById: {
        "sftp://550e8400-e29b-41d4-a716-446655440000/home/readme.txt": {
          uri: "sftp://550e8400-e29b-41d4-a716-446655440000/home/readme.txt",
          name: "readme.txt",
          kind: "file",
          size: 12,
          isHidden: false,
          isSymlink: false,
          providerId: "sftp",
          canRead: true,
          canList: false,
          canWrite: true,
          canDelete: true,
          canRename: true,
        },
      },
      orderedEntryIds: [
        "sftp://550e8400-e29b-41d4-a716-446655440000/home/readme.txt",
      ],
    };

    const commander = createCommanderActions(
      baseDeps({ tab, handleCopyOrMove }),
    );

    expect(commander.canCopy).toBe(true);
    commander.copy();
    expect(handleCopyOrMove).toHaveBeenCalledWith("left", "copy");
  });

  it("disables mutating actions when remote entries are read-only", () => {
    const handleCreateFolder = vi.fn();
    const handleCopyOrMove = vi.fn();
    const handleTrash = vi.fn();
    const tab = {
      ...activeTab(createInitialState().panels.left),
      uri: "sftp://550e8400-e29b-41d4-a716-446655440000/home",
      selectedId: "sftp://550e8400-e29b-41d4-a716-446655440000/home/readme.txt",
      selectedIds: [
        "sftp://550e8400-e29b-41d4-a716-446655440000/home/readme.txt",
      ],
      entriesById: {
        "sftp://550e8400-e29b-41d4-a716-446655440000/home/readme.txt": {
          uri: "sftp://550e8400-e29b-41d4-a716-446655440000/home/readme.txt",
          name: "readme.txt",
          kind: "file",
          size: 12,
          isHidden: false,
          isSymlink: false,
          providerId: "sftp",
          canRead: true,
          canList: false,
          canWrite: false,
          canDelete: false,
          canRename: false,
        },
      },
      orderedEntryIds: [
        "sftp://550e8400-e29b-41d4-a716-446655440000/home/readme.txt",
      ],
    };

    const commander = createCommanderActions(
      baseDeps({
        tab,
        handleCreateFolder,
        handleCopyOrMove,
        handleTrash,
      }),
    );

    expect(commander.canNewFolder).toBe(false);
    expect(commander.canCopy).toBe(true);
    expect(commander.canMove).toBe(false);
    expect(commander.canDelete).toBe(false);
    expect(commander.canRename).toBe(false);
    expect(commander.canEdit).toBe(false);

    commander.newFolder();
    commander.move();
    commander.delete();

    expect(handleCreateFolder).not.toHaveBeenCalled();
    expect(handleTrash).not.toHaveBeenCalled();

    commander.copy();
    expect(handleCopyOrMove).toHaveBeenCalledWith("left", "copy");
  });

  it("routes the F8 delete action through handleDelete", () => {
    const tab = {
      ...activeTab(createInitialState().panels.left),
      selectedId: "local:///tmp/a.txt",
      selectedIds: ["local:///tmp/a.txt"],
      entriesById: {
        "local:///tmp/a.txt": {
          uri: "local:///tmp/a.txt",
          name: "a.txt",
          kind: "file",
          size: 1,
          isHidden: false,
          isSymlink: false,
          providerId: "local",
          canRead: true,
          canList: false,
          canWrite: true,
          canDelete: true,
          canRename: true,
        },
      },
      orderedEntryIds: ["local:///tmp/a.txt"],
    };
    const handleDelete = vi.fn();
    const handleTrash = vi.fn();
    const commander = createCommanderActions(
      baseDeps({ tab, handleDelete, handleTrash }),
    );

    expect(commander.canDelete).toBe(true);
    commander.delete();

    expect(handleDelete).toHaveBeenCalledWith("left");
    expect(handleTrash).not.toHaveBeenCalled();
  });

  it("starts copy and move dialogs when selection exists", () => {
    const tab = {
      ...activeTab(createInitialState().panels.left),
      selectedId: "local:///tmp/a.txt",
      selectedIds: ["local:///tmp/a.txt"],
      entriesById: {
        "local:///tmp/a.txt": {
          uri: "local:///tmp/a.txt",
          name: "a.txt",
          kind: "file",
          size: 1,
          isHidden: false,
          isSymlink: false,
          providerId: "local",
          canRead: true,
          canList: false,
          canWrite: true,
          canDelete: true,
          canRename: true,
        },
      },
      orderedEntryIds: ["local:///tmp/a.txt"],
    };
    const handleCopyOrMove = vi.fn();
    const commander = createCommanderActions(
      baseDeps({ tab, handleCopyOrMove }),
    );

    commander.copy();
    commander.move();

    expect(handleCopyOrMove).toHaveBeenCalledWith("left", "copy");
    expect(handleCopyOrMove).toHaveBeenCalledWith("left", "move");
  });

  it("allows copy on selected directories that can be listed", () => {
    const handleCopyOrMove = vi.fn();
    const tab = {
      ...activeTab(createInitialState().panels.left),
      selectedId: "sftp://550e8400-e29b-41d4-a716-446655440000/home/docs",
      selectedIds: ["sftp://550e8400-e29b-41d4-a716-446655440000/home/docs"],
      entriesById: {
        "sftp://550e8400-e29b-41d4-a716-446655440000/home/docs": {
          uri: "sftp://550e8400-e29b-41d4-a716-446655440000/home/docs",
          name: "docs",
          kind: "directory",
          isHidden: false,
          isSymlink: false,
          providerId: "sftp",
          canRead: false,
          canList: true,
          canWrite: true,
          canDelete: true,
          canRename: true,
        },
      },
      orderedEntryIds: [
        "sftp://550e8400-e29b-41d4-a716-446655440000/home/docs",
      ],
    };
    const commander = createCommanderActions(
      baseDeps({ tab, handleCopyOrMove }),
    );

    expect(commander.canCopy).toBe(true);
    commander.copy();
    expect(handleCopyOrMove).toHaveBeenCalledWith("left", "copy");
  });
});
