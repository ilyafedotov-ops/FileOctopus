import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShellStatusBar } from "../src/shell/ShellStatusBar";
import { createInitialState } from "../src/panelStore";
import type { ShellLayoutContextValue } from "../src/shell/ShellLayoutContext";
import { ShellLayoutProvider } from "../src/shell/ShellLayoutContext";

function renderStatusBar(overrides: Partial<ShellLayoutContextValue> = {}) {
  const handleCreateFolder = vi.fn();
  const handleProperties = vi.fn(async () => undefined);
  const value = {
    state: createInitialState(),
    jobs: {},
    operationError: null,
    appHealth: null,
    diagnosticsOpen: false,
    setPreviewOpen: vi.fn(),
    handleCommandSelect: vi.fn(),
    handleCopyOrMove: vi.fn(),
    handleCreateFolder,
    handleTrash: vi.fn(),
    handleProperties,
    markActivityPinnedOpen: vi.fn(),
    setActivityCollapsed: vi.fn(),
    updatePreference: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as ShellLayoutContextValue;

  render(
    <ShellLayoutProvider value={value}>
      <ShellStatusBar />
    </ShellLayoutProvider>,
  );

  return { handleCreateFolder, handleProperties, value };
}

afterEach(() => {
  cleanup();
});

describe("ShellStatusBar commander bar", () => {
  it("creates a folder when New Folder is clicked", () => {
    const { handleCreateFolder } = renderStatusBar();

    fireEvent.click(screen.getByRole("button", { name: /New Folder - F7/ }));

    expect(handleCreateFolder).toHaveBeenCalledWith("left");
  });

  it("opens properties for view when no previewable file is selected", () => {
    const { handleProperties } = renderStatusBar();

    fireEvent.click(screen.getByRole("button", { name: /View - F3/ }));

    expect(handleProperties).toHaveBeenCalledWith("left", null);
  });

  it("disables copy when nothing is selected", () => {
    renderStatusBar();

    expect(screen.getByRole("button", { name: /Copy - F5/ })).toHaveProperty(
      "disabled",
      true,
    );
  });
});
