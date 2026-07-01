import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "../src/shell/AppShell";
import type { ShellLayoutContextValue } from "../src/shell/ShellLayoutContext";
import { ShellLayoutProvider } from "../src/shell/ShellLayoutContext";
import { createInitialState } from "../src/panelStore";
import type { AppInfoResponse } from "@fileoctopus/ts-api";

vi.mock("../src/components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("../src/pane/usePaneGitStatus", () => ({
  usePaneGitStatus: () => ({ repo: null }),
}));

vi.mock("../src/shell/TitleBar", () => ({
  TitleBar: ({
    onSettings,
    nativeMenuActive,
    titlePath,
  }: {
    onSettings: () => void;
    nativeMenuActive?: boolean;
    titlePath: string;
  }) => (
    <div
      data-native-menu-active={String(Boolean(nativeMenuActive))}
      data-testid="title-bar"
    >
      <span data-testid="title-path">{titlePath}</span>
      <button onClick={onSettings} data-testid="settings-btn">
        Settings
      </button>
    </div>
  ),
}));

vi.mock("../src/shell/titleBarStatus", () => ({
  buildTitleBarStatus: () => [],
}));

vi.mock("../src/utils/paneUtils", () => ({
  localPathFromUri: (uri: string) => uri.replace("local://", ""),
}));

function makeCtx(
  overrides: Partial<ShellLayoutContextValue> = {},
): ShellLayoutContextValue {
  const state = createInitialState();
  return {
    workspaceRef: { current: null },
    handleShellKeyDown: vi.fn(),
    makeFilePanelProps: vi.fn(),
    menuBarProps: { items: [] } as unknown as Record<string, unknown>,
    windowControls: undefined,
    state,
    activeTabUri: state.panels.left.tabs[state.panels.left.activeTabId].uri,
    leftPanelUri: state.panels.left.tabs[state.panels.left.activeTabId].uri,
    rightPanelUri: state.panels.right.tabs[state.panels.right.activeTabId].uri,
    locations: [],
    favorites: [],
    recentToday: [],
    recentWeek: [],
    starred: [],
    networkProfiles: [],
    networkStatuses: [],
    preferences: null,
    updatePreference: vi.fn(),
    settingsPreferenceChange: vi.fn(),
    closePaneTerminalConfirmOpen: false,
    setClosePaneTerminalConfirmOpen: vi.fn(),
    onConfirmClosePaneWithTerminal: vi.fn(),
    client: {} as unknown as Record<string, unknown>,
    jobs: {},
    jobMetrics: {},
    history: [],
    operationError: null,
    activityCollapsed: true,
    markActivityPinnedOpen: vi.fn(),
    setActivityCollapsed: vi.fn(),
    refreshHistory: vi.fn(),
    clearHistory: vi.fn(),
    settingsOpen: false,
    shortcutsOpen: false,
    commandPaletteOpen: false,
    previewOpen: false,
    viewerOpen: false,
    viewerEntry: null,
    editorOpen: false,
    editorEntry: null,
    diagnosticsOpen: false,
    aboutOpen: false,
    goToLocationOpen: false,
    manageFavoritesOpen: false,
    recentLocationsOpen: false,
    clearRecentLocationsOpen: false,
    errorDetailsOpen: false,
    operationHistoryOpen: false,
    volumePickerOpen: false,
    connectServerOpen: false,
    connectServerProfile: null,
    connectServerInitial: null,
    removeServerProfile: null,
    toolbarCustomizeOpen: false,
    busyProfileIds: new Set(),
    setToolbarCustomizeOpen: vi.fn(),
    setGoToLocationOpen: vi.fn(),
    setManageFavoritesOpen: vi.fn(),
    setRecentLocationsOpen: vi.fn(),
    setClearRecentLocationsOpen: vi.fn(),
    setErrorDetailsOpen: vi.fn(),
    setOperationHistoryOpen: vi.fn(),
    setVolumePickerOpen: vi.fn(),
    setConnectServerOpen: vi.fn(),
    setConnectServerProfile: vi.fn(),
    setConnectServerInitial: vi.fn(),
    setRemoveServerProfile: vi.fn(),
    connectProfile: vi.fn(),
    disconnectProfile: vi.fn(),
    deleteProfile: vi.fn(),
    forgetFingerprint: vi.fn(),
    saveProfile: vi.fn(),
    refreshNetworkProfiles: vi.fn(),
    openProfileTerminalTab: vi.fn(),
    dialog: null,
    autostart: null,
    commandEntries: [],
    previewEntry: null,
    appInfo: null,
    appHealth: null,
    diagnosticsDestination: "",
    diagnosticsMessage: null,
    exportingDiagnostics: false,
    isProductionBuild: false,
    multiRenameOpen: false,
    syncDirectoriesOpen: false,
    hotlistOpen: false,
    manageHotlistOpen: false,
    setSettingsOpen: vi.fn(),
    setShortcutsOpen: vi.fn(),
    setCommandPaletteOpen: vi.fn(),
    setPreviewOpen: vi.fn(),
    setViewerOpen: vi.fn(),
    setViewerEntry: vi.fn(),
    setEditorOpen: vi.fn(),
    setEditorEntry: vi.fn(),
    diffOpen: false,
    diffLeftUri: "",
    diffRightUri: "",
    diffLeftName: "",
    diffRightName: "",
    setDiffOpen: vi.fn(),
    setMultiRenameOpen: vi.fn(),
    setSyncDirectoriesOpen: vi.fn(),
    setHotlistOpen: vi.fn(),
    setManageHotlistOpen: vi.fn(),
    isTextEditable: vi.fn(() => false),
    refreshActivePane: vi.fn(),
    setDiagnosticsOpen: vi.fn(),
    setAboutOpen: vi.fn(),
    setDialog: vi.fn(),
    setDiagnosticsDestination: vi.fn(),
    refreshDiagnostics: vi.fn(),
    exportDiagnostics: vi.fn(),
    reviewCopyMoveDialog: vi.fn(),
    submitCreateFolder: vi.fn(),
    submitCreateFile: vi.fn(),
    submitRename: vi.fn(),
    submitCopyMove: vi.fn(),
    submitTrash: vi.fn(),
    submitPermanentDelete: vi.fn(),
    copyTextFromSelection: vi.fn(),
    calculateSelectionSize: vi.fn(),
    revealEntry: vi.fn(),
    handleSetAutostart: vi.fn(),
    handleCommandSelect: vi.fn(),
    toasts: [],
    setToasts: vi.fn(),
    contextMenu: null,
    setContextMenu: vi.fn(),
    clipboard: null,
    starredUriSet: new Set(),
    dispatch: vi.fn(),
    activateEntry: vi.fn(),
    handleRename: vi.fn(),
    triggerInlineRename: vi.fn(),
    copySelectionToFileClipboard: vi.fn(),
    pasteClipboard: vi.fn(),
    handleDelete: vi.fn(),
    handleTrash: vi.fn(),
    toggleStarredForEntry: vi.fn(),
    handlePermanentDelete: vi.fn(),
    handleProperties: vi.fn(),
    handleCreateFolder: vi.fn(),
    handleCreateFile: vi.fn(),
    refreshPanel: vi.fn(),
    handleCopyOrMove: vi.fn(),
    openExternal: vi.fn(),
    toggleHidden: vi.fn(),
    navigatePanel: vi.fn(),
    navigateOtherPane: vi.fn(),
    refreshNavigation: vi.fn(),
    setOperationError: vi.fn(),
    runRecursiveSearch: vi.fn(),
    applySplitRatioFn: (r: number) => r,
    ...overrides,
  } as ShellLayoutContextValue;
}

function appInfoForTargetOs(targetOs: string): AppInfoResponse {
  return {
    name: "FileOctopus",
    version: "0.1.1",
    buildProfile: "release",
    commitSha: "abcdef1",
    targetOs,
    dataDir: "/tmp/fileoctopus",
    networkEnabled: true,
  };
}

function renderShell(
  ctxOverrides: Partial<ShellLayoutContextValue> = {},
  children?: {
    toolbar?: React.ReactNode;
    workspace?: React.ReactNode;
    overlays?: React.ReactNode;
    statusBar?: React.ReactNode;
  },
) {
  const ctx = makeCtx(ctxOverrides);
  return render(
    <ShellLayoutProvider value={ctx}>
      <AppShell
        toolbar={
          children?.toolbar ?? <div data-testid="toolbar-slot">Toolbar</div>
        }
        workspace={
          children?.workspace ?? (
            <div data-testid="workspace-slot">Workspace</div>
          )
        }
        overlays={
          children?.overlays ?? <div data-testid="overlays-slot">Overlays</div>
        }
        statusBar={
          children?.statusBar ?? (
            <div data-testid="statusbar-slot">StatusBar</div>
          )
        }
      />
    </ShellLayoutProvider>,
  );
}

describe("AppShell", () => {
  afterEach(cleanup);

  it("renders the fo-shell main element", () => {
    const { container } = renderShell();
    expect(container.querySelector(".fo-shell")).toBeTruthy();
  });

  it("renders the fo-shell-frame container", () => {
    const { container } = renderShell();
    expect(container.querySelector(".fo-shell-frame")).toBeTruthy();
  });

  it("renders the TitleBar", () => {
    renderShell();
    expect(screen.getByTestId("title-bar")).toBeTruthy();
  });

  it.each(["macos", "linux", "windows"])(
    "marks the native menu active on desktop target %s",
    (targetOs) => {
      renderShell({
        appInfo: appInfoForTargetOs(targetOs),
      });

      expect(screen.getByTestId("title-bar").dataset.nativeMenuActive).toBe(
        "true",
      );
    },
  );

  it("keeps the in-window menu path for browser preview", () => {
    renderShell({
      appInfo: appInfoForTargetOs("browser"),
    });

    expect(screen.getByTestId("title-bar").dataset.nativeMenuActive).toBe(
      "false",
    );
  });

  it("renders the toolbar slot", () => {
    renderShell();
    expect(screen.getByTestId("toolbar-slot")).toBeTruthy();
  });

  it("renders the workspace slot", () => {
    renderShell();
    expect(screen.getByTestId("workspace-slot")).toBeTruthy();
  });

  it("renders the overlays slot", () => {
    renderShell();
    expect(screen.getByTestId("overlays-slot")).toBeTruthy();
  });

  it("renders the status bar slot", () => {
    renderShell();
    expect(screen.getByTestId("statusbar-slot")).toBeTruthy();
  });

  it("renders slots inside shell frame (toolbar, workspace, statusbar) and overlays outside", () => {
    const { container } = renderShell();
    const frame = container.querySelector(".fo-shell-frame")!;
    expect(frame.querySelector('[data-testid="toolbar-slot"]')).toBeTruthy();
    expect(frame.querySelector('[data-testid="workspace-slot"]')).toBeTruthy();
    expect(frame.querySelector('[data-testid="statusbar-slot"]')).toBeTruthy();
    // overlays are outside the frame but inside the shell
    expect(frame.querySelector('[data-testid="overlays-slot"]')).toBeNull();
    expect(
      container
        .querySelector(".fo-shell")!
        .querySelector('[data-testid="overlays-slot"]'),
    ).toBeTruthy();
  });

  it("calls setSettingsOpen when settings button clicked", () => {
    const setSettingsOpen = vi.fn();
    renderShell({ setSettingsOpen });
    fireEvent.click(screen.getByTestId("settings-btn"));
    expect(setSettingsOpen).toHaveBeenCalledWith(true);
  });

  it("renders custom toolbar content", () => {
    renderShell(
      {},
      { toolbar: <div data-testid="custom-toolbar">Custom</div> },
    );
    expect(screen.getByTestId("custom-toolbar")).toBeTruthy();
  });

  it("renders custom workspace content", () => {
    renderShell(
      {},
      { workspace: <div data-testid="custom-workspace">Custom</div> },
    );
    expect(screen.getByTestId("custom-workspace")).toBeTruthy();
  });

  it("renders custom overlays content", () => {
    renderShell(
      {},
      { overlays: <div data-testid="custom-overlays">Custom</div> },
    );
    expect(screen.getByTestId("custom-overlays")).toBeTruthy();
  });

  it("renders custom statusBar content", () => {
    renderShell(
      {},
      { statusBar: <div data-testid="custom-statusbar">Custom</div> },
    );
    expect(screen.getByTestId("custom-statusbar")).toBeTruthy();
  });

  it("main element has tabIndex=-1", () => {
    const { container } = renderShell();
    const main = container.querySelector(".fo-shell")!;
    expect(main.getAttribute("tabIndex")).toBe("-1");
  });

  it("main element has onKeyDown handler", () => {
    const handleShellKeyDown = vi.fn();
    const { container } = renderShell({ handleShellKeyDown });
    const main = container.querySelector(".fo-shell")!;
    fireEvent.keyDown(main, { key: "Escape" });
    expect(handleShellKeyDown).toHaveBeenCalled();
  });
});
