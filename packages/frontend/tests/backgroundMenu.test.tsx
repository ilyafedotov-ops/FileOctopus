import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock @fileoctopus/ui — provide a real-ish Button
vi.mock("@fileoctopus/ui", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...rest
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    [k: string]: unknown;
  }) => (
    <button disabled={disabled} onClick={onClick} {...rest}>
      {children}
    </button>
  ),
}));

import { buildPaneBackgroundMenu } from "../src/menus/context/buildPaneBackgroundMenu";

// ── helpers ──────────────────────────────────────────────────────────────

function makeMenuProps(overrides: Record<string, unknown> = {}) {
  return {
    panelId: "left" as const,
    canPaste: true,
    showHidden: false,
    run: (action: () => void) => action(),
    onPaste: vi.fn(),
    onCreateFolder: vi.fn(),
    onCreateFile: vi.fn(),
    onRefresh: vi.fn(),
    onToggleHidden: vi.fn(),
    onViewMode: vi.fn(),
    onProperties: vi.fn(),
    ...overrides,
  };
}

afterEach(cleanup);

// ── tests ────────────────────────────────────────────────────────────────

describe("buildPaneBackgroundMenu", () => {
  it("renders all expected menu items", () => {
    const props = makeMenuProps();
    render(<>{buildPaneBackgroundMenu(props)}</>);
    expect(screen.getByText("Paste")).toBeTruthy();
    expect(screen.getByText("New Folder")).toBeTruthy();
    expect(screen.getByText("New File")).toBeTruthy();
    expect(screen.getByText("Refresh")).toBeTruthy();
    expect(screen.getByText("Show Hidden Files")).toBeTruthy();
    expect(screen.getByText("Details View")).toBeTruthy();
    expect(screen.getByText("Current Folder Properties")).toBeTruthy();
  });

  it("shows 'Hide Hidden Files' when showHidden is true", () => {
    const props = makeMenuProps({ showHidden: true });
    render(<>{buildPaneBackgroundMenu(props)}</>);
    expect(screen.getByText("Hide Hidden Files")).toBeTruthy();
    expect(screen.queryByText("Show Hidden Files")).toBeNull();
  });

  it("shows 'Show Hidden Files' when showHidden is false", () => {
    const props = makeMenuProps({ showHidden: false });
    render(<>{buildPaneBackgroundMenu(props)}</>);
    expect(screen.getByText("Show Hidden Files")).toBeTruthy();
    expect(screen.queryByText("Hide Hidden Files")).toBeNull();
  });

  it("disables Paste when canPaste is false", () => {
    const props = makeMenuProps({ canPaste: false });
    render(<>{buildPaneBackgroundMenu(props)}</>);
    const pasteBtn = screen.getByText("Paste").closest("button")!;
    expect(pasteBtn.disabled).toBe(true);
  });

  it("enables Paste when canPaste is true", () => {
    const props = makeMenuProps({ canPaste: true });
    render(<>{buildPaneBackgroundMenu(props)}</>);
    const pasteBtn = screen.getByText("Paste").closest("button")!;
    expect(pasteBtn.disabled).toBe(false);
  });

  it("calls onPaste when Paste is clicked", () => {
    const onPaste = vi.fn();
    const props = makeMenuProps({ onPaste });
    render(<>{buildPaneBackgroundMenu(props)}</>);
    fireEvent.click(screen.getByText("Paste"));
    expect(onPaste).toHaveBeenCalledWith("left");
  });

  it("calls onCreateFolder when New Folder is clicked", () => {
    const onCreateFolder = vi.fn();
    const props = makeMenuProps({ onCreateFolder });
    render(<>{buildPaneBackgroundMenu(props)}</>);
    fireEvent.click(screen.getByText("New Folder"));
    expect(onCreateFolder).toHaveBeenCalledWith("left");
  });

  it("calls onCreateFile when New File is clicked", () => {
    const onCreateFile = vi.fn();
    const props = makeMenuProps({ onCreateFile });
    render(<>{buildPaneBackgroundMenu(props)}</>);
    fireEvent.click(screen.getByText("New File"));
    expect(onCreateFile).toHaveBeenCalledWith("left");
  });

  it("calls onRefresh when Refresh is clicked", () => {
    const onRefresh = vi.fn();
    const props = makeMenuProps({ onRefresh });
    render(<>{buildPaneBackgroundMenu(props)}</>);
    fireEvent.click(screen.getByText("Refresh"));
    expect(onRefresh).toHaveBeenCalledWith("left");
  });

  it("calls onToggleHidden when toggle hidden is clicked", () => {
    const onToggleHidden = vi.fn();
    const props = makeMenuProps({ onToggleHidden });
    render(<>{buildPaneBackgroundMenu(props)}</>);
    fireEvent.click(screen.getByText("Show Hidden Files"));
    expect(onToggleHidden).toHaveBeenCalledWith("left");
  });

  it("calls onViewMode when Details View is clicked", () => {
    const onViewMode = vi.fn();
    const props = makeMenuProps({ onViewMode });
    render(<>{buildPaneBackgroundMenu(props)}</>);
    fireEvent.click(screen.getByText("Details View"));
    expect(onViewMode).toHaveBeenCalledWith("left", "details");
  });

  it("calls onProperties with null entry when properties clicked", () => {
    const onProperties = vi.fn();
    const props = makeMenuProps({ onProperties });
    render(<>{buildPaneBackgroundMenu(props)}</>);
    fireEvent.click(screen.getByText("Current Folder Properties"));
    expect(onProperties).toHaveBeenCalledWith("left", null);
  });

  it("renders separator elements", () => {
    const props = makeMenuProps();
    const { container } = render(<>{buildPaneBackgroundMenu(props)}</>);
    const separators = container.querySelectorAll('[role="separator"]');
    // There should be at least 2 separators
    expect(separators.length).toBeGreaterThanOrEqual(2);
  });

  it("uses run wrapper to invoke actions", () => {
    const run = vi.fn((action: () => void) => action());
    const onRefresh = vi.fn();
    const props = makeMenuProps({ run, onRefresh });
    render(<>{buildPaneBackgroundMenu(props)}</>);
    fireEvent.click(screen.getByText("Refresh"));
    expect(run).toHaveBeenCalled();
    expect(onRefresh).toHaveBeenCalledWith("left");
  });
});
