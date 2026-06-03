import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMenuBarProps } from "../src/hooks/useMenuBarProps";
import { createInitialState } from "../src/panelStore";

function makeParams(overrides: Record<string, unknown> = {}) {
  const state = createInitialState();
  return {
    state,
    dispatch: vi.fn(),
    locations: [],
    clipboard: null,
    preferences: null,
    navigatePanel: vi.fn(),
    handleRename: vi.fn(),
    setDiagnosticsOpen: vi.fn(),
    onRequestExit: vi.fn(),
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
  it("returns activePanelId from state", () => {
    const params = makeParams();
    const { result } = renderHook(() => useMenuBarProps(params));
    expect(result.current.activePanelId).toBe("left");
  });

  it("calls runCommand for nav.back on onBack", () => {
    const runCommand = vi.fn();
    const params = makeParams({ runCommand });
    const { result } = renderHook(() => useMenuBarProps(params));
    result.current.onBack();
    expect(runCommand).toHaveBeenCalledWith("nav.back");
  });

  it("calls runCommand for nav.forward on onForward", () => {
    const runCommand = vi.fn();
    const params = makeParams({ runCommand });
    const { result } = renderHook(() => useMenuBarProps(params));
    result.current.onForward();
    expect(runCommand).toHaveBeenCalledWith("nav.forward");
  });

  it("calls runCommand for nav.up on onUp", () => {
    const runCommand = vi.fn();
    const params = makeParams({ runCommand });
    const { result } = renderHook(() => useMenuBarProps(params));
    result.current.onUp();
    expect(runCommand).toHaveBeenCalledWith("nav.up");
  });

  it("calls runCommand for nav.home on onHome", () => {
    const runCommand = vi.fn();
    const params = makeParams({ runCommand });
    const { result } = renderHook(() => useMenuBarProps(params));
    result.current.onHome();
    expect(runCommand).toHaveBeenCalledWith("nav.home");
  });

  it("calls handleRename with active panelId on onRename", () => {
    const handleRename = vi.fn();
    const params = makeParams({ handleRename });
    const { result } = renderHook(() => useMenuBarProps(params));
    result.current.onRename();
    expect(handleRename).toHaveBeenCalledWith("left");
  });

  it("calls runCommand with viewMode command for known view modes", () => {
    const runCommand = vi.fn();
    const params = makeParams({ runCommand });
    const { result } = renderHook(() => useMenuBarProps(params));
    result.current.onViewMode("details");
    expect(runCommand).toHaveBeenCalledWith("view.details");
  });

  it("dispatches setViewMode for unknown view mode", () => {
    const runCommand = vi.fn();
    const dispatch = vi.fn();
    const params = makeParams({ runCommand, dispatch });
    const { result } = renderHook(() => useMenuBarProps(params));
    result.current.onViewMode("custom-mode");
    expect(dispatch).toHaveBeenCalledWith({
      type: "setViewMode",
      panelId: "left",
      viewMode: "custom-mode",
    });
  });

  it("calls runCommand for sort ascending", () => {
    const runCommand = vi.fn();
    const params = makeParams({ runCommand });
    const { result } = renderHook(() => useMenuBarProps(params));
    result.current.onSortDirection("ascending");
    expect(runCommand).toHaveBeenCalledWith("view.sortAscending", "left");
  });

  it("calls runCommand for sort descending", () => {
    const runCommand = vi.fn();
    const params = makeParams({ runCommand });
    const { result } = renderHook(() => useMenuBarProps(params));
    result.current.onSortDirection("descending");
    expect(runCommand).toHaveBeenCalledWith("view.sortDescending", "left");
  });

  it("calls runCommand for theme preference", () => {
    const runCommand = vi.fn();
    const params = makeParams({ runCommand });
    const { result } = renderHook(() => useMenuBarProps(params));
    result.current.onTheme("dark");
    expect(runCommand).toHaveBeenCalledWith("preferences.theme", undefined, {
      preferenceValue: "dark",
    });
  });

  it("calls runCommand for density preference", () => {
    const runCommand = vi.fn();
    const params = makeParams({ runCommand });
    const { result } = renderHook(() => useMenuBarProps(params));
    result.current.onDensity("compact");
    expect(runCommand).toHaveBeenCalledWith("preferences.density", undefined, {
      preferenceValue: "compact",
    });
  });

  it("navigates to standard location when matched", () => {
    const navigatePanel = vi.fn();
    const locations = [{ id: "home", uri: "local:///home/user" }];
    const params = makeParams({ navigatePanel, locations });
    const { result } = renderHook(() => useMenuBarProps(params));
    result.current.goStandardLocation("home");
    expect(navigatePanel).toHaveBeenCalledWith("left", "local:///home/user");
  });

  it("does not navigate when standard location not found", () => {
    const navigatePanel = vi.fn();
    const params = makeParams({ navigatePanel, locations: [] });
    const { result } = renderHook(() => useMenuBarProps(params));
    result.current.goStandardLocation("nonexistent");
    expect(navigatePanel).not.toHaveBeenCalled();
  });

  it("calls onRequestExit on onExit when provided", () => {
    const onRequestExit = vi.fn();
    const params = makeParams({ onRequestExit });
    const { result } = renderHook(() => useMenuBarProps(params));
    result.current.onExit();
    expect(onRequestExit).toHaveBeenCalled();
  });

  it("calls globalThis.close on onExit when no onRequestExit", () => {
    const closeFn = vi.fn();
    const original = globalThis.close;
    globalThis.close = closeFn;
    const params = makeParams({ onRequestExit: undefined });
    const { result } = renderHook(() => useMenuBarProps(params));
    result.current.onExit();
    expect(closeFn).toHaveBeenCalled();
    globalThis.close = original;
  });

  it("calls setDiagnosticsOpen(true) on onExportDiagnostics", () => {
    const setDiagnosticsOpen = vi.fn();
    const params = makeParams({ setDiagnosticsOpen });
    const { result } = renderHook(() => useMenuBarProps(params));
    result.current.onExportDiagnostics();
    expect(setDiagnosticsOpen).toHaveBeenCalledWith(true);
  });

  it("reports canGoBack false when backStack empty", () => {
    const params = makeParams();
    const { result } = renderHook(() => useMenuBarProps(params));
    expect(result.current.canGoBack).toBe(false);
  });

  it("reports hasClipboard false when clipboard is null", () => {
    const params = makeParams({ clipboard: null });
    const { result } = renderHook(() => useMenuBarProps(params));
    expect(result.current.hasClipboard).toBe(false);
  });

  it("reports hasClipboard true when clipboard is set", () => {
    const params = makeParams({ clipboard: { mode: "copy" } });
    const { result } = renderHook(() => useMenuBarProps(params));
    expect(result.current.hasClipboard).toBe(true);
  });

  it("maps starredLocations with label fallback to uri segments", () => {
    const starredLocations = [
      { uri: "local:///home/user/docs", label: null },
      { uri: "local:///home/user/projects", label: "Projects" },
    ];
    const params = makeParams({ starredLocations });
    const { result } = renderHook(() => useMenuBarProps(params));
    expect(result.current.starredLocations).toEqual([
      { uri: "local:///home/user/docs", label: "docs" },
      { uri: "local:///home/user/projects", label: "Projects" },
    ]);
  });

  it("uses preferences for sidebarVisible default", () => {
    const params = makeParams({
      preferences: { sidebarVisible: false },
    });
    const { result } = renderHook(() => useMenuBarProps(params));
    expect(result.current.sidebarVisible).toBe(false);
  });

  it("defaults sidebarVisible to true when preferences null", () => {
    const params = makeParams({ preferences: null });
    const { result } = renderHook(() => useMenuBarProps(params));
    expect(result.current.sidebarVisible).toBe(true);
  });

  it("reports dualPane from preferences paneMode", () => {
    const params = makeParams({
      preferences: { paneMode: "single" },
    });
    const { result } = renderHook(() => useMenuBarProps(params));
    expect(result.current.dualPane).toBe(false);
  });

  it("calls runCommand for app.documentation on onDocumentation", () => {
    const runCommand = vi.fn();
    const params = makeParams({ runCommand });
    const { result } = renderHook(() => useMenuBarProps(params));
    result.current.onDocumentation();
    expect(runCommand).toHaveBeenCalledWith("app.documentation");
  });

  it("passes onCustomizeToolbar through", () => {
    const onCustomizeToolbar = vi.fn();
    const params = makeParams({ onCustomizeToolbar });
    const { result } = renderHook(() => useMenuBarProps(params));
    expect(result.current.onCustomizeToolbar).toBe(onCustomizeToolbar);
  });
});
