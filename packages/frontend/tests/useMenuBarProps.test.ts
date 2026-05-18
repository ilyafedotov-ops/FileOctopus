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
    setFilterFocusToken: vi.fn(),
    setRecursiveSearchFocusToken: vi.fn(),
    setDiagnosticsOpen: vi.fn(),
    runCommand: vi.fn(),
    statusBarVisible: true,
    toolbarVisible: true,
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
    props.onCalculateSize();

    expect(runCommand).toHaveBeenCalledWith("op.compress");
    expect(runCommand).toHaveBeenCalledWith("op.extract");
    expect(runCommand).toHaveBeenCalledWith("op.checksum");
    expect(runCommand).toHaveBeenCalledWith("op.openTerminal");
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

  it("bumps recursive search focus token from menu action", () => {
    const setRecursiveSearchFocusToken = vi.fn(
      (updater: (value: number) => number) => updater(2),
    );
    const props = useMenuBarProps(baseParams({ setRecursiveSearchFocusToken }));

    props.onSearchRecursive();

    expect(setRecursiveSearchFocusToken).toHaveBeenCalledOnce();
    expect(setRecursiveSearchFocusToken.mock.results[0]?.value).toBe(3);
  });
});
