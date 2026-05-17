import { describe, expect, it, vi } from "vitest";
import { dispatchCommand } from "../src/commands/dispatch";
import { createInitialState } from "../src/panelStore";

describe("dispatchCommand", () => {
  it("opens go to location dialog", () => {
    const setGoToLocationOpen = vi.fn();
    const handled = dispatchCommand("nav.goToLocation", {
      state: createInitialState(),
      dispatch: vi.fn(),
      preferences: null,
      navigatePanel: vi.fn(),
      refreshPanel: vi.fn(),
      updatePreference: vi.fn(),
      setSettingsOpen: vi.fn(),
      setShortcutsOpen: vi.fn(),
      setDiagnosticsOpen: vi.fn(),
      setAboutOpen: vi.fn(),
      setGoToLocationOpen,
      setManageFavoritesOpen: vi.fn(),
      setFilterFocusToken: vi.fn(),
      setActivityCollapsed: vi.fn(),
    });

    expect(handled).toBe(true);
    expect(setGoToLocationOpen).toHaveBeenCalledWith(true);
  });

  it("maps legacy settings id", () => {
    const setSettingsOpen = vi.fn();
    dispatchCommand("settings", {
      state: createInitialState(),
      dispatch: vi.fn(),
      preferences: null,
      navigatePanel: vi.fn(),
      refreshPanel: vi.fn(),
      updatePreference: vi.fn(),
      setSettingsOpen,
      setShortcutsOpen: vi.fn(),
      setDiagnosticsOpen: vi.fn(),
      setAboutOpen: vi.fn(),
      setGoToLocationOpen: vi.fn(),
      setManageFavoritesOpen: vi.fn(),
      setFilterFocusToken: vi.fn(),
      setActivityCollapsed: vi.fn(),
    });

    expect(setSettingsOpen).toHaveBeenCalledWith(true);
  });
});
