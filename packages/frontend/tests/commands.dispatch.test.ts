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
    openTerminal: vi.fn(),
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

  it("delegates properties to handleProperties with the active panel", () => {
    const handleProperties = vi.fn();
    const handled = dispatchCommand(
      "op.properties",
      baseDeps({ handleProperties }),
    );

    expect(handled).toBe(true);
    expect(handleProperties).toHaveBeenCalledWith("left", null);
  });
});
