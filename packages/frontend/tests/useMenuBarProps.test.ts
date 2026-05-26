import { describe, expect, it, vi } from "vitest";
import { useMenuBarProps } from "../src/hooks/useMenuBarProps";
import { createInitialState } from "../src/panelStore";

function baseParams(overrides: Record<string, unknown> = {}) {
  return {
    state: createInitialState(),
    dispatch: vi.fn(),
    locations: [],
    clipboard: null,
    preferences: null,
    navigatePanel: vi.fn(),
    handleRename: vi.fn(),
    setDiagnosticsOpen: vi.fn(),
    runCommand: vi.fn(),
    statusBarVisible: true,
    toolbarVisible: true,
    onCustomizeToolbar: vi.fn(),
    recentLocations: [],
    starredLocations: [],
    ...overrides,
  };
}

describe("useMenuBarProps", () => {
  it("routes file operation commands through runCommand", () => {
    const runCommand = vi.fn();
    const props = useMenuBarProps(baseParams({ runCommand }));

    props.onCompress();
    props.onExtract();
    props.onChecksum();
    props.onOpenTerminal();
    props.onOpenTerminalExternal();
    props.onToggleTerminal();
    props.onCalculateSize();

    expect(runCommand).toHaveBeenCalledWith("op.compress");
    expect(runCommand).toHaveBeenCalledWith("op.extract");
    expect(runCommand).toHaveBeenCalledWith("op.checksum");
    expect(runCommand).toHaveBeenCalledWith("op.openTerminal");
    expect(runCommand).toHaveBeenCalledWith("op.openTerminalExternal");
    expect(runCommand).toHaveBeenCalledWith("view.toggleTerminal");
    expect(runCommand).toHaveBeenCalledWith("op.calculateSize");
  });

  it("opens diagnostics modal without exporting immediately", () => {
    const setDiagnosticsOpen = vi.fn();
    const props = useMenuBarProps(baseParams({ setDiagnosticsOpen }));

    props.onExportDiagnostics();

    expect(setDiagnosticsOpen).toHaveBeenCalledWith(true);
  });

  it("uses onRequestExit when provided", () => {
    const onRequestExit = vi.fn();
    const closeSpy = vi.spyOn(globalThis, "close").mockImplementation(() => {});
    const props = useMenuBarProps(baseParams({ onRequestExit }));

    props.onExit();

    expect(onRequestExit).toHaveBeenCalledOnce();
    expect(closeSpy).not.toHaveBeenCalled();
    closeSpy.mockRestore();
  });

  it("falls back to globalThis.close when onRequestExit is missing", () => {
    const closeSpy = vi.spyOn(globalThis, "close").mockImplementation(() => {});
    const props = useMenuBarProps(baseParams());

    props.onExit();

    expect(closeSpy).toHaveBeenCalledOnce();
    closeSpy.mockRestore();
  });

  it("routes view appearance and sort commands through runCommand", () => {
    const runCommand = vi.fn();
    const props = useMenuBarProps(baseParams({ runCommand }));

    props.onSortBy("size");
    props.onSortDirection("descending");
    props.onTheme("dark");
    props.onDensity("compact");
    props.onAddFavorite();

    expect(runCommand).toHaveBeenCalledWith("view.sort", "left", {
      sortField: "size",
    });
    expect(runCommand).toHaveBeenCalledWith("view.sortDescending", "left");
    expect(runCommand).toHaveBeenCalledWith("preferences.theme", undefined, {
      preferenceValue: "dark",
    });
    expect(runCommand).toHaveBeenCalledWith("preferences.density", undefined, {
      preferenceValue: "compact",
    });
    expect(runCommand).toHaveBeenCalledWith("nav.addFavorite", "left");
  });

  it("routes filter and recursive search through runCommand", () => {
    const runCommand = vi.fn();
    const props = useMenuBarProps(baseParams({ runCommand }));

    props.onFilter();
    props.onSearchRecursive();

    expect(runCommand).toHaveBeenCalledWith("filter");
    expect(runCommand).toHaveBeenCalledWith("recursive-search");
  });
});
