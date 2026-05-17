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
    setOperationHistoryOpen: vi.fn(),
    setFilterFocusToken: vi.fn(),
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
});
