import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TOOLBAR_ENTRIES } from "../src/commands/toolbarConfig";
import { OperationToolbar } from "../src/pane/OperationToolbar";

function createProps(
  overrides: Partial<ComponentProps<typeof OperationToolbar>> = {},
) {
  const noop = vi.fn();
  return {
    selectedCount: 0,
    canRename: false,
    canPaste: false,
    canView: true,
    canEdit: false,
    hotlistTargets: [],
    hotlistOverflow: [],
    driveVolumes: [],
    jobsDisplay: { label: "Jobs", ariaLabel: "Jobs", activeCount: 0 },
    showHidden: false,
    viewMode: "details" as const,
    canGoBack: false,
    canGoForward: false,
    canGoUp: false,
    onBack: noop,
    onForward: noop,
    onUp: noop,
    onRoot: noop,
    onHome: noop,
    onDrives: noop,
    onRefresh: noop,
    onCommandSearch: noop,
    onView: noop,
    onOpenHotlistTarget: noop,
    onCreateFolder: noop,
    onCreateFile: noop,
    onRename: noop,
    onCopy: noop,
    onCut: noop,
    onCopyOperation: noop,
    onMove: noop,
    onPaste: noop,
    onTrash: noop,
    onPermanentDelete: noop,
    onCopyPath: noop,
    onCopyName: noop,
    onProperties: noop,
    onRevealInFileManager: noop,
    onCalculateSize: noop,
    onCompress: noop,
    onExtract: noop,
    onOpenTerminal: noop,
    onOpenTerminalExternal: noop,
    onChecksum: noop,
    onToggleHidden: noop,
    onSelectAll: noop,
    onViewMode: noop,
    toolbarEntries: DEFAULT_TOOLBAR_ENTRIES,
    onCommand: noop,
    onCustomizeToolbar: noop,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("OperationToolbar", () => {
  it("renders commander labels without function-key prefixes", () => {
    render(<OperationToolbar {...createProps()} />);

    expect(screen.getByRole("button", { name: "View" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Trash" })).toBeTruthy();
    expect(screen.queryByText("F3")).toBeNull();
    expect(screen.queryByText("F8")).toBeNull();
  });

  it("opens customize dialog from toolbar context menu", () => {
    const onCustomizeToolbar = vi.fn();
    render(<OperationToolbar {...createProps({ onCustomizeToolbar })} />);

    fireEvent.contextMenu(screen.getByLabelText("Commander toolbar"));

    expect(onCustomizeToolbar).toHaveBeenCalledOnce();
  });

  it("does not render a permanent command palette input", () => {
    render(<OperationToolbar {...createProps()} />);

    expect(screen.queryByLabelText("Open command palette")).toBeNull();
  });

  it("moves focus across toolbar buttons with arrow keys", () => {
    render(
      <OperationToolbar
        {...createProps({ canGoBack: true, canGoForward: true })}
      />,
    );

    const back = screen.getByRole("button", { name: "Back" });
    const forward = screen.getByRole("button", { name: "Forward" });

    back.focus();
    fireEvent.keyDown(back, { key: "ArrowRight" });
    expect(document.activeElement).toBe(forward);

    fireEvent.keyDown(forward, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(back);
  });

  it("jumps between toolbar groups with ctrl+arrow keys", () => {
    render(
      <OperationToolbar
        {...createProps({ canGoBack: true, canGoForward: true })}
      />,
    );

    const back = screen.getByRole("button", { name: "Back" });
    const view = screen.getByRole("button", { name: "View" });

    back.focus();
    fireEvent.keyDown(back, { key: "ArrowRight", ctrlKey: true });
    expect(document.activeElement).toBe(view);

    fireEvent.keyDown(view, { key: "ArrowLeft", ctrlKey: true });
    expect(document.activeElement).toBe(back);
  });
});
