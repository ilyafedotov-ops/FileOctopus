import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MenuBar, type MenuBarProps } from "../src/shell/MenuBar";

function createMenuBarProps(
  overrides: Partial<MenuBarProps> = {},
): MenuBarProps {
  const noop = vi.fn();
  return {
    activePanelId: "left",
    onBack: noop,
    onForward: noop,
    onUp: noop,
    onHome: noop,
    onGoToLocation: noop,
    goStandardLocation: noop,
    onNewFolder: noop,
    onNewFile: noop,
    onOpenSelected: noop,
    onView: noop,
    onOpenWithDefaultApp: noop,
    onRevealInFileManager: noop,
    onRename: noop,
    onCopyTo: noop,
    onMoveTo: noop,
    onTrash: noop,
    onCompress: noop,
    onExtract: noop,
    onDeletePermanently: noop,
    onProperties: noop,
    onCut: noop,
    onCopy: noop,
    onPaste: noop,
    onClearClipboard: noop,
    onSelectAll: noop,
    onClearSelection: noop,
    onInvertSelection: noop,
    onCopyPath: noop,
    onCopyName: noop,
    onCopyParentPath: noop,
    onCopyResourceUri: noop,
    onViewMode: noop,
    onSortBy: noop,
    onSortDirection: noop,
    onTheme: noop,
    onDensity: noop,
    onToggleSidebar: noop,
    onToggleToolbar: noop,
    onToggleStatusBar: noop,
    onToggleDualPane: noop,
    onTogglePaneDirection: noop,
    onToggleHidden: noop,
    onRefresh: noop,
    onAddFavorite: noop,
    onManageFavorites: noop,
    onNetworkLocations: noop,
    onAddServer: noop,
    onShowRecentLocations: noop,
    onClearRecentLocations: noop,
    recentLocations: [],
    starredLocations: [],
    onFilter: noop,
    onSearchRecursive: noop,
    onChecksum: noop,
    onOpenTerminal: noop,
    onOpenTerminalExternal: noop,
    onToggleTerminal: noop,
    onCalculateSize: noop,
    onJobActivity: noop,
    onOperationHistory: noop,
    onDiagnostics: noop,
    onExportDiagnostics: noop,
    onSwitchPane: noop,
    onSwapPanes: noop,
    onEqualizePanes: noop,
    onShortcuts: noop,
    onDocumentation: noop,
    onAbout: noop,
    onSettings: noop,
    onExit: noop,
    canGoBack: false,
    canGoForward: false,
    hasSelection: false,
    hasClipboard: false,
    sidebarVisible: true,
    toolbarVisible: true,
    statusBarVisible: true,
    dualPane: true,
    paneDirection: "horizontal",
    showHidden: false,
    onCustomizeToolbar: noop,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

function openTopMenu(label: string) {
  const triggers = document.querySelectorAll(".fo-menubar-trigger");
  for (const trigger of triggers) {
    if (trigger.textContent?.includes(label)) {
      fireEvent.click(trigger);
      return;
    }
  }
  throw new Error(`Menu trigger not found: ${label}`);
}

describe("MenuBar", () => {
  it("renders added file and tools menu items when opened", () => {
    render(<MenuBar {...createMenuBarProps()} />);

    openTopMenu("File");

    expect(screen.getByRole("menuitem", { name: /Pack/ })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /Unpack/ })).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });

    openTopMenu("Tools");

    expect(
      screen.getByRole("menuitem", { name: /Open Terminal/ }),
    ).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /Checksum/ })).toBeTruthy();
    expect(
      screen.getByRole("menuitem", { name: /Calculate Size/ }),
    ).toBeTruthy();
  });

  it("disables selection-dependent items when nothing is selected", () => {
    render(<MenuBar {...createMenuBarProps({ hasSelection: false })} />);

    openTopMenu("File");

    expect(screen.getByRole("menuitem", { name: /Pack/ })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("menuitem", { name: /Unpack/ })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("includes compact view in the View menu", () => {
    render(<MenuBar {...createMenuBarProps()} />);

    openTopMenu("View");

    expect(screen.getByRole("menuitem", { name: /Compact View/ })).toBeTruthy();
  });

  it("exposes the full sort submenu from the View menu", () => {
    render(<MenuBar {...createMenuBarProps()} />);

    openTopMenu("View");
    fireEvent.mouseEnter(screen.getByRole("menuitem", { name: /Sort By/ }));

    for (const label of [
      "Name",
      "Type",
      "Size",
      "Date Modified",
      "Date Created",
      "Extension",
      "Permissions",
      "Owner",
      "Ascending",
      "Descending",
    ]) {
      expect(screen.getByRole("menuitem", { name: label })).toBeTruthy();
    }
  });

  it("invokes onCompress when Pack is selected", () => {
    const onCompress = vi.fn();
    render(
      <MenuBar {...createMenuBarProps({ hasSelection: true, onCompress })} />,
    );

    openTopMenu("File");
    fireEvent.click(screen.getByRole("menuitem", { name: /Pack/ }));

    expect(onCompress).toHaveBeenCalledOnce();
  });
});
