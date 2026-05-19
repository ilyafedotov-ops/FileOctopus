import { describe, expect, it, vi } from "vitest";
import { dispatchCommand } from "../src/commands/dispatch";
import { createInitialState } from "../src/panelStore";

function baseDeps(overrides: Record<string, unknown> = {}) {
  return {
    state: createInitialState(),
    dispatch: vi.fn(),
    preferences: null,
    navigatePanel: vi.fn(),
    goHistory: vi.fn(),
    refreshPanel: vi.fn(),
    updatePreference: vi.fn(),
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
    setFilterFocusToken: vi.fn(),
    activityCollapsed: true,
    setActivityCollapsed: vi.fn(),
    handleCreateFolder: vi.fn(),
    handleCreateFile: vi.fn(),
    startInlineRename: vi.fn(),
    handleTrash: vi.fn(),
    handlePermanentDelete: vi.fn(),
    handleProperties: vi.fn(),
    setOperationError: vi.fn(),
    copySelectionToFileClipboard: vi.fn(),
    pasteClipboard: vi.fn(),
    selectedEntries: () => [],
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
    activityPanelVisible: false,
    terminalRailSegment: "activity" as const,
    setTerminalRailSegment: vi.fn(),
    calculateSize: vi.fn(),
    toggleStarredForEntry: vi.fn(),
    addFavorite: vi.fn(),
    setTheme: vi.fn(),
    setDensity: vi.fn(),
    equalizePanes: vi.fn(),
    toggleStatusBar: vi.fn(),
    toggleToolbar: vi.fn(),
    revealUri: vi.fn(),
    removeFavorite: vi.fn(),
    renameFavorite: vi.fn(),
    ...overrides,
  };
}

describe("dispatchCommand", () => {
  it("opens go to location dialog", () => {
    const setGoToLocationOpen = vi.fn();
    const handled = dispatchCommand(
      "nav.goToLocation",
      baseDeps({ setGoToLocationOpen }),
    );

    expect(handled).toBe(true);
    expect(setGoToLocationOpen).toHaveBeenCalledWith(true);
  });

  it("opens operation history dialog", () => {
    const setOperationHistoryOpen = vi.fn();
    dispatchCommand(
      "app.operationHistory",
      baseDeps({ setOperationHistoryOpen }),
    );

    expect(setOperationHistoryOpen).toHaveBeenCalledWith(true);
  });

  it("maps legacy settings id", () => {
    const setSettingsOpen = vi.fn();
    dispatchCommand("settings", baseDeps({ setSettingsOpen }));

    expect(setSettingsOpen).toHaveBeenCalledWith(true);
  });

  it("opens toolbar customize dialog for app.customizeToolbar", () => {
    const setToolbarCustomizeOpen = vi.fn();
    dispatchCommand(
      "app.customizeToolbar",
      baseDeps({ setToolbarCustomizeOpen }),
    );

    expect(setToolbarCustomizeOpen).toHaveBeenCalledWith(true);
  });

  it("starts inline rename for op.rename", () => {
    const startInlineRename = vi.fn();
    dispatchCommand("op.rename", baseDeps({ startInlineRename }));

    expect(startInlineRename).toHaveBeenCalledWith("left");
  });

  it("opens command palette for app.commandPalette", () => {
    const setCommandPaletteOpen = vi.fn();
    dispatchCommand("app.commandPalette", baseDeps({ setCommandPaletteOpen }));

    expect(setCommandPaletteOpen).toHaveBeenCalledWith(true);
  });

  it("inverts selection for selection.invert", () => {
    const dispatch = vi.fn();
    dispatchCommand("selection.invert", baseDeps({ dispatch }));

    expect(dispatch).toHaveBeenCalledWith({
      type: "invertSelection",
      panelId: "left",
    });
  });

  it("honors panelId override", () => {
    const startInlineRename = vi.fn();
    dispatchCommand("op.rename", baseDeps({ startInlineRename }), {
      panelId: "right",
    });

    expect(startInlineRename).toHaveBeenCalledWith("right");
  });

  it("runs compress for op.compress", () => {
    const handleCompress = vi.fn();
    dispatchCommand("op.compress", baseDeps({ handleCompress }), {
      panelId: "right",
    });

    expect(handleCompress).toHaveBeenCalledWith("right");
  });

  it("navigates with nav.openUri and targetUri", () => {
    const navigatePanel = vi.fn();
    const handled = dispatchCommand(
      "nav.openUri",
      baseDeps({ navigatePanel }),
      { panelId: "right", targetUri: "local:///tmp" },
    );

    expect(handled).toBe(true);
    expect(navigatePanel).toHaveBeenCalledWith("right", "local:///tmp");
  });

  it("adds favorite with targetUri and label", () => {
    const addFavorite = vi.fn();
    dispatchCommand("nav.addFavorite", baseDeps({ addFavorite }), {
      targetUri: "local:///home",
      preferenceValue: "Home",
    });

    expect(addFavorite).toHaveBeenCalledWith("left", "local:///home", "Home");
  });

  it("sorts with view.sort and sortField", () => {
    const dispatch = vi.fn();
    dispatchCommand("view.sort", baseDeps({ dispatch }), {
      panelId: "left",
      sortField: "size",
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "setSort",
      panelId: "left",
      field: "size",
    });
  });

  it("toggles status bar via view.toggleStatusBar", () => {
    const toggleStatusBar = vi.fn();
    dispatchCommand("view.toggleStatusBar", baseDeps({ toggleStatusBar }));

    expect(toggleStatusBar).toHaveBeenCalled();
  });

  it("opens terminal rail when view.toggleTerminal and panel hidden", () => {
    const setActivityCollapsed = vi.fn();
    const markActivityPinnedOpen = vi.fn();
    const setTerminalRailSegment = vi.fn();
    const updatePreference = vi.fn();
    dispatchCommand(
      "view.toggleTerminal",
      baseDeps({
        activityCollapsed: true,
        activityPanelVisible: false,
        terminalRailSegment: "activity",
        setActivityCollapsed,
        markActivityPinnedOpen,
        setTerminalRailSegment,
        updatePreference,
      }),
    );

    expect(markActivityPinnedOpen).toHaveBeenCalled();
    expect(setActivityCollapsed).toHaveBeenCalledWith(false);
    expect(setTerminalRailSegment).toHaveBeenCalledWith("terminal");
    expect(updatePreference).toHaveBeenCalledWith(
      "activityPanelVisible",
      "true",
    );
  });

  it("collapses activity rail when view.toggleTerminal and terminal visible", () => {
    const setActivityCollapsed = vi.fn();
    const updatePreference = vi.fn();
    dispatchCommand(
      "view.toggleTerminal",
      baseDeps({
        activityCollapsed: false,
        activityPanelVisible: true,
        terminalRailSegment: "terminal",
        setActivityCollapsed,
        updatePreference,
      }),
    );

    expect(setActivityCollapsed).toHaveBeenCalledWith(true);
    expect(updatePreference).toHaveBeenCalledWith(
      "activityPanelVisible",
      "false",
    );
  });

  it("expands activity rail when collapsed", () => {
    const setActivityCollapsed = vi.fn();
    const markActivityPinnedOpen = vi.fn();
    const updatePreference = vi.fn();
    dispatchCommand(
      "view.toggleActivity",
      baseDeps({
        activityCollapsed: true,
        setActivityCollapsed,
        markActivityPinnedOpen,
        updatePreference,
      }),
    );

    expect(markActivityPinnedOpen).toHaveBeenCalled();
    expect(setActivityCollapsed).toHaveBeenCalledWith(false);
    expect(updatePreference).toHaveBeenCalledWith(
      "activityPanelVisible",
      "true",
    );
  });

  it("removes favorite by id", () => {
    const removeFavorite = vi.fn();
    dispatchCommand("nav.removeFavorite", baseDeps({ removeFavorite }), {
      favoriteId: 3,
    });

    expect(removeFavorite).toHaveBeenCalledWith(3);
  });

  it("opens recent locations dialog", () => {
    const setRecentLocationsOpen = vi.fn();
    const handled = dispatchCommand(
      "nav.recentLocations",
      baseDeps({ setRecentLocationsOpen }),
    );

    expect(handled).toBe(true);
    expect(setRecentLocationsOpen).toHaveBeenCalledWith(true);
  });

  it("opens clear recent locations confirmation", () => {
    const setClearRecentLocationsOpen = vi.fn();
    const handled = dispatchCommand(
      "nav.clearRecentLocations",
      baseDeps({ setClearRecentLocationsOpen }),
    );

    expect(handled).toBe(true);
    expect(setClearRecentLocationsOpen).toHaveBeenCalledWith(true);
  });

  it("clears all recent entries", () => {
    const clearRecentEntries = vi.fn();
    const handled = dispatchCommand(
      "nav.clearRecent",
      baseDeps({ clearRecentEntries }),
    );

    expect(handled).toBe(true);
    expect(clearRecentEntries).toHaveBeenCalled();
  });

  it("removes a recent entry by uri", () => {
    const removeRecentEntry = vi.fn();
    const handled = dispatchCommand(
      "nav.removeRecent",
      baseDeps({ removeRecentEntry }),
      { targetUri: "local:///home/user/projects" },
    );

    expect(handled).toBe(true);
    expect(removeRecentEntry).toHaveBeenCalledWith(
      "local:///home/user/projects",
    );
  });

  it("does nothing for nav.removeRecent without targetUri", () => {
    const removeRecentEntry = vi.fn();
    const handled = dispatchCommand(
      "nav.removeRecent",
      baseDeps({ removeRecentEntry }),
    );

    expect(handled).toBe(false);
    expect(removeRecentEntry).not.toHaveBeenCalled();
  });

  it("sets theme via preferences.theme", () => {
    const setTheme = vi.fn();
    const updatePreference = vi.fn();
    dispatchCommand(
      "preferences.theme",
      baseDeps({ setTheme, updatePreference }),
      { preferenceValue: "dark" },
    );

    expect(setTheme).toHaveBeenCalledWith("dark");
    expect(updatePreference).toHaveBeenCalledWith("theme", "dark");
  });

  it("sets density via preferences.density", () => {
    const setDensity = vi.fn();
    const updatePreference = vi.fn();
    dispatchCommand(
      "preferences.density",
      baseDeps({ setDensity, updatePreference }),
      { preferenceValue: "spacious" },
    );

    expect(setDensity).toHaveBeenCalledWith("spacious");
    expect(updatePreference).toHaveBeenCalledWith("density", "spacious");
  });

  it("sets ascending sort when direction differs", () => {
    const state = createInitialState();
    state.panels.left.tabs.main.sort.direction = "desc";
    const dispatch = vi.fn();
    dispatchCommand("view.sortAscending", baseDeps({ state, dispatch }));

    expect(dispatch).toHaveBeenCalledWith({
      type: "setSort",
      panelId: "left",
      field: "name",
    });
  });

  it("sets descending sort when direction differs", () => {
    const state = createInitialState();
    const dispatch = vi.fn();
    dispatchCommand("view.sortDescending", baseDeps({ state, dispatch }));

    expect(dispatch).toHaveBeenCalledWith({
      type: "setSort",
      panelId: "left",
      field: "name",
    });
  });

  it("delegates properties to handleProperties with the active panel", () => {
    const handleProperties = vi.fn();
    const handled = dispatchCommand(
      "op.properties",
      baseDeps({ handleProperties }),
    );

    expect(handled).toBe(true);
    expect(handleProperties).toHaveBeenCalledWith("left", null);
  });

  it("reports unsupported preview for op.view on unknown file types", () => {
    const setOperationError = vi.fn();
    const selected = {
      uri: "local:///tmp/archive.bin",
      name: "archive.bin",
      kind: "file",
      isHidden: false,
      isSymlink: false,
      providerId: "local",
      canRead: true,
      canList: false,
      canWrite: true,
      canDelete: true,
      canRename: true,
    };

    const handled = dispatchCommand(
      "op.view",
      baseDeps({
        setOperationError,
        selectedEntries: () => [selected],
        isPreviewable: () => false,
      }),
    );

    expect(handled).toBe(true);
    expect(setOperationError).toHaveBeenCalledWith(
      "No preview is available for this file type.",
    );
  });
});
