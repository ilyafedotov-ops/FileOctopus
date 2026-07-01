import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToolbarDropdowns } from "../src/pane/ToolbarDropdowns";

vi.mock("@fileoctopus/ui", () => ({
  DropdownMenu: ({
    label,
    items,
    children,
  }: {
    label: string;
    items: Array<{ id: string; label: string; onSelect?: () => void }>;
    children?: React.ReactNode;
  }) => (
    <div data-testid={`dropdown-${label.toLowerCase()}`}>
      <span>{label}</span>
      <ul>
        {items.map((item) => (
          <li key={item.id} data-testid={`item-${item.id}`}>
            {item.label}
          </li>
        ))}
      </ul>
      {children}
    </div>
  ),
  Icons: {
    terminal: () => <span>terminal-icon</span>,
    chevronDown: () => <span>chevron-icon</span>,
    folder: () => <span>folder-icon</span>,
    calculator: () => <span>calc-icon</span>,
    archive: () => <span>archive-icon</span>,
    hash: () => <span>hash-icon</span>,
    file: () => <span>file-icon</span>,
    pictures: () => <span>pictures-icon</span>,
    folderPlus: () => <span>folder-plus-icon</span>,
    filePlus: () => <span>file-plus-icon</span>,
    copy: () => <span>copy-icon</span>,
    pencil: () => <span>pencil-icon</span>,
    move: () => <span>move-icon</span>,
    trash: () => <span>trash-icon</span>,
    more: () => <span>more-icon</span>,
  },
}));

vi.mock("../src/commands/registry", () => ({
  currentShortcutPlatform: () => "mac",
  formatCommandShortcut: () => "Cmd+S",
}));

const noop = vi.fn();

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    selectedCount: 1,
    canRename: true,
    canPaste: true,
    showHidden: false,
    viewMode: "details" as const,
    onCreateFolder: noop,
    onCreateFile: noop,
    onRename: noop,
    onCopy: noop,
    onCut: noop,
    onCopyOperation: noop,
    onMove: noop,
    onPaste: noop,
    onDelete: noop,
    onTrash: noop,
    onPermanentDelete: noop,
    onCopyPath: noop,
    onCopyName: noop,
    onProperties: noop,
    onSelectAll: noop,
    onToggleHidden: noop,
    onViewMode: noop,
    onRevealInFileManager: noop,
    onCalculateSize: noop,
    onCompress: noop,
    onExtract: noop,
    onOpenTerminal: noop,
    onOpenTerminalExternal: noop,
    onChecksum: noop,
    ...overrides,
  };
}

afterEach(cleanup);

describe("ToolbarDropdowns", () => {
  it("renders all three dropdown menus", () => {
    render(<ToolbarDropdowns {...makeProps()} />);
    expect(screen.getByTestId("dropdown-tools")).toBeTruthy();
    expect(screen.getByTestId("dropdown-view")).toBeTruthy();
    expect(screen.getByTestId("dropdown-more")).toBeTruthy();
  });

  it("renders Tools dropdown items", () => {
    render(<ToolbarDropdowns {...makeProps()} />);
    const tools = screen.getByTestId("dropdown-tools");
    expect(
      tools.querySelector('[data-testid="item-reveal-in-fm"]'),
    ).toBeTruthy();
    expect(
      tools.querySelector('[data-testid="item-calculate-size"]'),
    ).toBeTruthy();
    expect(tools.querySelector('[data-testid="item-compress"]')).toBeTruthy();
    expect(tools.querySelector('[data-testid="item-extract"]')).toBeTruthy();
    expect(
      tools.querySelector('[data-testid="item-open-terminal"]'),
    ).toBeTruthy();
    expect(
      tools.querySelector('[data-testid="item-open-terminal-external"]'),
    ).toBeTruthy();
    expect(tools.querySelector('[data-testid="item-checksum"]')).toBeTruthy();
  });

  it("renders View dropdown items", () => {
    render(<ToolbarDropdowns {...makeProps()} />);
    const view = screen.getByTestId("dropdown-view");
    expect(
      view.querySelector('[data-testid="item-view-details"]'),
    ).toBeTruthy();
    expect(view.querySelector('[data-testid="item-view-list"]')).toBeTruthy();
    expect(
      view.querySelector('[data-testid="item-view-compact"]'),
    ).toBeTruthy();
    expect(view.querySelector('[data-testid="item-view-icons"]')).toBeTruthy();
    expect(
      view.querySelector('[data-testid="item-view-columns"]'),
    ).toBeTruthy();
    expect(view.querySelector('[data-testid="item-hidden"]')).toBeTruthy();
  });

  it("renders More dropdown items", () => {
    render(<ToolbarDropdowns {...makeProps()} />);
    expect(screen.getByTestId("item-new-folder")).toBeTruthy();
    expect(screen.getByTestId("item-new-file")).toBeTruthy();
    expect(screen.getByTestId("item-rename")).toBeTruthy();
    expect(screen.getByTestId("item-paste")).toBeTruthy();
    expect(screen.getByTestId("item-delete")).toBeTruthy();
    expect(screen.getByTestId("item-delete-permanent")).toBeTruthy();
    expect(screen.getByTestId("item-properties")).toBeTruthy();
    expect(screen.getByTestId("item-select-all")).toBeTruthy();
  });

  it("shows Show Hidden when showHidden is false", () => {
    render(<ToolbarDropdowns {...makeProps({ showHidden: false })} />);
    const hiddenItems = screen.getAllByText("Show Hidden");
    expect(hiddenItems.length).toBeGreaterThanOrEqual(1);
  });

  it("shows Hide Hidden when showHidden is true", () => {
    render(<ToolbarDropdowns {...makeProps({ showHidden: true })} />);
    const hiddenItems = screen.getAllByText("Hide Hidden");
    expect(hiddenItems.length).toBeGreaterThanOrEqual(1);
  });
});
