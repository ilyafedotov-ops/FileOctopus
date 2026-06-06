import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup, screen } from "@testing-library/react";
import {
  ContextMenu,
  type ContextMenuState,
} from "../src/components/ContextMenu";
import { ContextMenuOverlay } from "../src/components/ContextMenuOverlay";
import { createInitialState } from "../src/panelStore";
import type { FileEntryDto } from "@fileoctopus/ts-api";

const mockMenu: ContextMenuState = {
  panelId: "left",
  x: 100,
  y: 100,
  entry: null,
};

const baseProps = {
  currentTabUri: "local:///tmp",
  canPaste: false,
  isStarred: false,
  onClose: vi.fn(),
  onOpen: vi.fn(),
  onOpenInNewTab: vi.fn(),
  onRename: vi.fn(),
  onCopy: vi.fn(),
  onCut: vi.fn(),
  onPaste: vi.fn(),
  onDelete: vi.fn(),
  onTrash: vi.fn(),
  onToggleStarred: vi.fn(),
  onPermanentDelete: vi.fn(),
  onCopyPath: vi.fn(),
  onCopyName: vi.fn(),
  onView: vi.fn(),
  onProperties: vi.fn(),
  onReveal: vi.fn(),
  onCompress: vi.fn(),
  onExtract: vi.fn(),
  onOpenTerminal: vi.fn(),
  onOpenTerminalExternal: vi.fn(),
  onChecksum: vi.fn(),
  onCreateFolder: vi.fn(),
  onCreateFile: vi.fn(),
  onRefresh: vi.fn(),
  onSelectAll: vi.fn(),
  onViewMode: vi.fn(),
  onSort: vi.fn(),
  showHidden: false,
  onToggleHidden: vi.fn(),
  onOpenWithDefaultApp: vi.fn(),
  onCopyTo: vi.fn(),
  onMoveTo: vi.fn(),
  onCopyParentPath: vi.fn(),
  onCopyResourceUri: vi.fn(),
  onClearSelection: vi.fn(),
  onNavigateTo: vi.fn(),
  onNavigateOtherPane: vi.fn(),
  onCopyBreadcrumbPath: vi.fn(),
  onRevealBreadcrumb: vi.fn(),
  onAddFavorite: vi.fn(),
};

afterEach(cleanup);

describe("ContextMenu keyboard navigation", () => {
  it("closes on Escape key", () => {
    const onClose = vi.fn();
    render(<ContextMenu {...baseProps} menu={mockMenu} onClose={onClose} />);

    const menu = document.querySelector('[role="menu"]');
    expect(menu).toBeTruthy();
    fireEvent.keyDown(menu!, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });

  it("focuses first enabled item on ArrowDown", () => {
    render(<ContextMenu {...baseProps} menu={mockMenu} />);

    const menu = document.querySelector('[role="menu"]');
    fireEvent.keyDown(menu!, { key: "ArrowDown" });

    const items = document.querySelectorAll('[role="menuitem"]');
    expect(items.length).toBeGreaterThan(0);
    const enabledItems = Array.from(items).filter(
      (item) => !(item as HTMLButtonElement).disabled,
    );
    expect(enabledItems.length).toBeGreaterThan(0);
    expect(document.activeElement).toBe(enabledItems[0]);
  });

  it("moves focus down on subsequent ArrowDown", () => {
    render(<ContextMenu {...baseProps} menu={mockMenu} />);

    const menu = document.querySelector('[role="menu"]');
    fireEvent.keyDown(menu!, { key: "ArrowDown" });
    fireEvent.keyDown(menu!, { key: "ArrowDown" });

    const items = document.querySelectorAll('[role="menuitem"]');
    // Skip disabled items — the second non-disabled item should be focused
    const enabledItems = Array.from(items).filter(
      (item) => !(item as HTMLButtonElement).disabled,
    );
    if (enabledItems.length > 1) {
      expect(document.activeElement).toBe(enabledItems[1]);
    }
  });

  it("moves focus up on ArrowUp", () => {
    render(<ContextMenu {...baseProps} menu={mockMenu} />);

    const menu = document.querySelector('[role="menu"]');
    // Move down twice, then up once
    fireEvent.keyDown(menu!, { key: "ArrowDown" });
    fireEvent.keyDown(menu!, { key: "ArrowDown" });
    fireEvent.keyDown(menu!, { key: "ArrowUp" });

    const items = document.querySelectorAll('[role="menuitem"]');
    const enabledItems = Array.from(items).filter(
      (item) => !(item as HTMLButtonElement).disabled,
    );
    if (enabledItems.length > 1) {
      expect(document.activeElement).toBe(enabledItems[0]);
    }
  });

  it("wraps focus from last to first on ArrowDown", () => {
    render(<ContextMenu {...baseProps} menu={mockMenu} />);

    const menu = document.querySelector('[role="menu"]');
    const items = document.querySelectorAll('[role="menuitem"]');
    const enabledItems = Array.from(items).filter(
      (item) => !(item as HTMLButtonElement).disabled,
    );

    // Move to last item
    for (let i = 0; i < enabledItems.length + 1; i++) {
      fireEvent.keyDown(menu!, { key: "ArrowDown" });
    }

    // Should wrap back to first
    expect(document.activeElement).toBe(enabledItems[0]);
  });

  it("wraps focus from first to last on ArrowUp", () => {
    render(<ContextMenu {...baseProps} menu={mockMenu} />);

    const menu = document.querySelector('[role="menu"]');
    const items = document.querySelectorAll('[role="menuitem"]');
    const enabledItems = Array.from(items).filter(
      (item) => !(item as HTMLButtonElement).disabled,
    );

    // Press ArrowUp from initial state (no focus) — should go to last item
    fireEvent.keyDown(menu!, { key: "ArrowUp" });

    expect(document.activeElement).toBe(enabledItems[enabledItems.length - 1]);
  });

  it("activates focused item on Enter", () => {
    const onRefresh = vi.fn();
    render(
      <ContextMenu {...baseProps} menu={mockMenu} onRefresh={onRefresh} />,
    );

    const menu = document.querySelector('[role="menu"]');
    // Navigate to first item and press Enter
    fireEvent.keyDown(menu!, { key: "ArrowDown" });
    fireEvent.keyDown(menu!, { key: "Enter" });

    // The first enabled item in pane background menu should trigger its action
    // We can't predict exactly which one, but onClose should have been called
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it("repositions upward instead of making a fitting menu scroll", () => {
    const originalInnerHeight = window.innerHeight;
    const originalInnerWidth = window.innerWidth;
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this.classList.contains("fo-context-menu")) {
          return {
            bottom: 850,
            height: 600,
            left: 100,
            right: 348,
            top: 250,
            width: 248,
            x: 100,
            y: 250,
            toJSON: () => ({}),
          };
        }

        return {
          bottom: 0,
          height: 0,
          left: 0,
          right: 0,
          top: 0,
          width: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        };
      });

    try {
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: 800,
      });
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: 1000,
      });

      render(
        <ContextMenu {...baseProps} menu={{ ...mockMenu, x: 100, y: 250 }} />,
      );

      const menu = document.querySelector<HTMLElement>(".fo-context-menu");
      expect(menu?.style.top).toBe("192px");
      expect(menu?.style.maxHeight).toBe("");
    } finally {
      rectSpy.mockRestore();
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: originalInnerHeight,
      });
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
    }
  });

  it("scrolls only when the menu is taller than the viewport", () => {
    const originalInnerHeight = window.innerHeight;
    const originalInnerWidth = window.innerWidth;
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this.classList.contains("fo-context-menu")) {
          return {
            bottom: 1000,
            height: 900,
            left: 100,
            right: 348,
            top: 100,
            width: 248,
            x: 100,
            y: 100,
            toJSON: () => ({}),
          };
        }

        return {
          bottom: 0,
          height: 0,
          left: 0,
          right: 0,
          top: 0,
          width: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        };
      });

    try {
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: 800,
      });
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: 1000,
      });

      render(
        <ContextMenu {...baseProps} menu={{ ...mockMenu, x: 100, y: 100 }} />,
      );

      const menu = document.querySelector<HTMLElement>(".fo-context-menu");
      expect(menu?.style.top).toBe("8px");
      expect(menu?.style.maxHeight).toBe("784px");
      expect(menu?.style.overflowY).toBe("auto");
    } finally {
      rectSpy.mockRestore();
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: originalInnerHeight,
      });
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalInnerWidth,
      });
    }
  });

  it("opens a folder context target in a new tab through the overlay", () => {
    const state = createInitialState();
    const folder: FileEntryDto = {
      uri: "local:///tmp/docs",
      name: "docs",
      kind: "directory",
      isHidden: false,
      isSymlink: false,
      providerId: "local",
      canRead: true,
      canList: true,
      canWrite: true,
      canDelete: true,
      canRename: true,
    };
    const dispatch = vi.fn();

    render(
      <ContextMenuOverlay
        menu={{ panelId: "left", x: 100, y: 100, entry: folder }}
        state={state}
        clipboard={null}
        preferences={null}
        starredUriSet={new Set()}
        dispatch={dispatch}
        onClose={vi.fn()}
        runPanelCommand={vi.fn()}
        activateEntry={vi.fn()}
        revealEntry={vi.fn()}
        openExternal={vi.fn()}
        navigatePanel={vi.fn()}
        navigateOtherPane={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("menuitem", { name: /Open in New Tab/ }));

    expect(dispatch).toHaveBeenCalledWith({
      type: "openTab",
      panelId: "left",
      uri: "local:///tmp/docs",
    });
  });
});
