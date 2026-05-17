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
});
