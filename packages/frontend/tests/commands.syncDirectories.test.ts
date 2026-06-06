import { describe, it, expect, vi } from "vitest";
import { COMMAND_REGISTRY } from "../src/commands/registryData";
import {
  dispatchCommand,
  type CommandDispatchDeps,
} from "../src/commands/dispatch";
import type { PanelId } from "../src/panelStore";
import type { UserPreferencesDto } from "@fileoctopus/ts-api";

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
              selectedIds: new Set(),
              expandedIds: new Set(),
              selectedId: null,
              hoveredId: null,
              sort: { field: "name", direction: "asc" },
              viewMode: "details",
              showHidden: false,
              filterText: "",
              hashMap: {},
              searchResults: null,
              loading: false,
              error: null,
              history: { past: [], future: [] },
              scrollPosition: 0,
              columnWidths: {},
              columnsOrder: [],
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
              selectedIds: new Set(),
              expandedIds: new Set(),
              selectedId: null,
              hoveredId: null,
              sort: { field: "name", direction: "asc" },
              viewMode: "details",
              showHidden: false,
              filterText: "",
              hashMap: {},
              searchResults: null,
              loading: false,
              error: null,
              history: { past: [], future: [] },
              scrollPosition: 0,
              columnWidths: {},
              columnsOrder: [],
            },
          ],
          activeTabId: "tab-1",
          terminal: null,
        },
      },
      activePanelId: "left" as PanelId,
    },
    dispatch: vi.fn(),
    preferences: null as unknown as UserPreferencesDto,
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
    setNetworkLocationsOpen: vi.fn(),
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
    clearClipboard: vi.fn(),
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
    ...overrides,
  };
}

describe("tools.syncDirectories command", () => {
  it("is registered in the command registry", () => {
    const found = COMMAND_REGISTRY.find(
      (cmd) => cmd.id === "tools.syncDirectories",
    );
    expect(found).toBeTruthy();
    expect(found!.label).toBe("Synchronize Directories…");
    expect(found!.group).toBe("tools");
  });

  it("dispatch opens the sync directories dialog", () => {
    const deps = createMinimalDeps();
    const result = dispatchCommand("tools.syncDirectories", deps);
    expect(result).toBe(true);
    expect(deps.setSyncDirectoriesOpen).toHaveBeenCalledWith(true);
  });

  it("dispatch returns true regardless of panel state", () => {
    const deps = createMinimalDeps();
    deps.selectedEntries = vi.fn(() => []);
    const result = dispatchCommand("tools.syncDirectories", deps);
    expect(result).toBe(true);
    expect(deps.setSyncDirectoriesOpen).toHaveBeenCalledWith(true);
  });
});
