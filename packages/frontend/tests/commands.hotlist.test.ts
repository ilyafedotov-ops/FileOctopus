import { describe, it, expect, vi } from "vitest";
import { COMMAND_REGISTRY } from "../src/commands/registryData";
import {
  dispatchCommand,
  type CommandDispatchDeps,
} from "../src/commands/dispatch";

function createMinimalDeps(
  overrides: Partial<CommandDispatchDeps> = {},
): CommandDispatchDeps {
  return {
    state: {
      panels: {
        left: {
          tabs: [
            {
              id: "tab-1",
              uri: "local:///home/user",
              entriesById: {},
              orderedEntryIds: [],
              selectedIds: [],
              selectedId: null,
              focusedId: null,
              anchorId: null,
              sort: {
                field: "name" as const,
                direction: "asc" as const,
                directoriesFirst: true,
              },
              viewMode: "details" as const,
              showHidden: false,
              filter: "",
              recursiveQuery: "",
              errorCode: null,
              backStack: [],
            },
          ],
          activeTabId: "tab-1",
          terminal: null,
        },
        right: {
          tabs: [
            {
              id: "tab-1",
              uri: "local:///home/user/documents",
              entriesById: {},
              orderedEntryIds: [],
              selectedIds: [],
              selectedId: null,
              focusedId: null,
              anchorId: null,
              sort: {
                field: "name" as const,
                direction: "asc" as const,
                directoriesFirst: true,
              },
              viewMode: "details" as const,
              showHidden: false,
              filter: "",
              recursiveQuery: "",
              errorCode: null,
              backStack: [],
            },
          ],
          activeTabId: "tab-1",
          terminal: null,
        },
      },
      activePanelId: "left" as const,
    },
    dispatch: vi.fn(),
    preferences: null,
    navigatePanel: vi.fn(),
    goHistory: vi.fn(),
    refreshPanel: vi.fn(),
    updatePreference: vi.fn(),
    requestPaneModeChange: vi.fn(),
    setSettingsOpen: vi.fn(),
    setToolbarCustomizeOpen: vi.fn(),
    setShortcutsOpen: vi.fn(),
    setDiagnosticsOpen: vi.fn(),
    setAboutOpen: vi.fn(),
    setGoToLocationOpen: vi.fn(),
    setManageFavoritesOpen: vi.fn(),
    setRecentLocationsOpen: vi.fn(),
    setClearRecentLocationsOpen: vi.fn(),
    removeRecentEntry: vi.fn(),
    clearRecentEntries: vi.fn(),
    setOperationHistoryOpen: vi.fn(),
    setVolumePickerOpen: vi.fn(),
    setConnectServerOpen: vi.fn(),
    setConnectServerProfile: vi.fn(),
    setFilterFocusToken: vi.fn(),
    setRecursiveSearchFocusToken: vi.fn(),
    setPreviewOpen: vi.fn(),
    setViewerOpen: vi.fn(),
    setViewerEntry: vi.fn(),
    setEditorOpen: vi.fn(),
    setEditorEntry: vi.fn(),
    isTextEditable: vi.fn(),
    isPreviewable: vi.fn(),
    activityCollapsed: false,
    activityPanelVisible: false,
    setActivityCollapsed: vi.fn(),
    terminalRailSegment: { running: 0, finished: 0 },
    setTerminalRailSegment: vi.fn(),
    handleCreateFolder: vi.fn(),
    handleCreateFile: vi.fn(),
    startInlineRename: vi.fn(),
    handleDelete: vi.fn(),
    handleTrash: vi.fn(),
    handlePermanentDelete: vi.fn(),
    handleProperties: vi.fn(),
    setOperationError: vi.fn(),
    copySelectionToFileClipboard: vi.fn(),
    pasteClipboard: vi.fn(),
    selectedEntries: vi.fn(() => []),
    activateEntry: vi.fn(),
    copyTextFromSelection: vi.fn(),
    revealEntry: vi.fn(),
    openExternal: vi.fn(),
    clearClipboard: () => {},
    setCommandPaletteOpen: vi.fn(),
    handleCopyOrMove: vi.fn(),
    toggleHidden: vi.fn(),
    handleCompress: vi.fn(),
    handleExtract: vi.fn(),
    handleChecksum: vi.fn(),
    openEmbeddedTerminal: vi.fn(),
    openTerminalExternal: vi.fn(),
    togglePaneTerminal: vi.fn(),
    calculateSize: vi.fn(),
    toggleStarredForEntry: vi.fn(),
    addFavorite: vi.fn(),
    revealUri: vi.fn(),
    removeFavorite: vi.fn(),
    renameFavorite: vi.fn(),
    setTheme: vi.fn(),
    setDensity: vi.fn(),
    equalizePanes: vi.fn(),
    toggleStatusBar: vi.fn(),
    toggleToolbar: vi.fn(),
    setMultiRenameOpen: vi.fn(),
    setSyncDirectoriesOpen: vi.fn(),
    setHotlistOpen: vi.fn(),
    setManageHotlistOpen: vi.fn(),
    ...overrides,
  } as unknown as CommandDispatchDeps;
}

describe("hotlist commands", () => {
  it("registers tools.openHotlist command", () => {
    const found = COMMAND_REGISTRY.find(
      (cmd) => cmd.id === "tools.openHotlist",
    );
    expect(found).toBeTruthy();
    expect(found!.label).toBe("Open Hotlist…");
    expect(found!.group).toBe("tools");
  });

  it("registers tools.manageHotlist command", () => {
    const found = COMMAND_REGISTRY.find(
      (cmd) => cmd.id === "tools.manageHotlist",
    );
    expect(found).toBeTruthy();
    expect(found!.label).toBe("Manage Hotlist…");
    expect(found!.group).toBe("tools");
  });

  it("dispatches tools.openHotlist to setHotlistOpen(true)", () => {
    const deps = createMinimalDeps();
    const result = dispatchCommand("tools.openHotlist", deps);
    expect(result).toBe(true);
    expect(deps.setHotlistOpen).toHaveBeenCalledWith(true);
  });

  it("dispatches tools.manageHotlist to setManageHotlistOpen(true)", () => {
    const deps = createMinimalDeps();
    const result = dispatchCommand("tools.manageHotlist", deps);
    expect(result).toBe(true);
    expect(deps.setManageHotlistOpen).toHaveBeenCalledWith(true);
  });
});
