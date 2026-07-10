import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShellLayoutContextValue } from "../src/shell/ShellLayoutContext";
import { ShellLayoutProvider } from "../src/shell/ShellLayoutContext";
import { ShellToolbar } from "../src/shell/ShellToolbar";
import { createInitialState } from "../src/panelStore";
import type { UserPreferencesDto } from "@fileoctopus/ts-api";

vi.mock("@fileoctopus/ui", () => ({
  Icons: {
    moon: vi.fn(() => "🌙"),
    sun: vi.fn(() => "☀️"),
    monitor: vi.fn(() => "🖥️"),
    info: vi.fn(() => "ⓘ"),
  },
  ToolbarButton: ({
    onClick,
    title,
    children,
    ...props
  }: {
    onClick: () => void;
    title?: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <button
      onClick={onClick}
      title={title}
      data-testid="toolbar-btn"
      {...props}
    >
      {children}
    </button>
  ),
  Button: ({
    onClick,
    children,
    disabled,
  }: {
    onClick?: () => void;
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("../src/components/ToolbarCustomizeDialog", () => ({
  ToolbarCustomizeDialog: ({
    open,
    onClose,
  }: {
    open: boolean;
    onClose: () => void;
    onSave: () => void;
    entries: unknown[];
  }) =>
    open ? (
      <div data-testid="toolbar-customize-dialog">
        Customize
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock("../src/hooks/useToolbarConfig", () => ({
  useToolbarConfig: () => ({
    entries: [],
    saveEntries: vi.fn(),
  }),
}));

vi.mock("../src/pane/OperationToolbar", () => ({
  OperationToolbar: ({
    onBack,
    onForward,
    onRefresh,
    onHome,
    canGoBack,
    canGoForward,
    canGoUp,
  }: {
    onBack?: () => void;
    onForward?: () => void;
    onRefresh?: () => void;
    onHome?: () => void;
    canGoBack?: boolean;
    canGoForward?: boolean;
    canGoUp?: boolean;
  }) => (
    <div data-testid="operation-toolbar">
      <span data-testid="can-go-back">{String(canGoBack)}</span>
      <span data-testid="can-go-forward">{String(canGoForward)}</span>
      <span data-testid="can-go-up">{String(canGoUp)}</span>
      {onBack && <button onClick={onBack}>Back</button>}
      {onForward && <button onClick={onForward}>Forward</button>}
      {onRefresh && <button onClick={onRefresh}>Refresh</button>}
      {onHome && <button onClick={onHome}>Home</button>}
    </div>
  ),
}));

vi.mock("../src/shell/commanderActions", () => ({
  createCommanderActions: () => ({
    canRename: true,
    canEdit: true,
    view: vi.fn(),
  }),
}));

vi.mock("../src/navigation/driveTargets", () => ({
  buildDriveTargets: () => [],
  driveTargetToolbarLabel: () => "Drive",
}));

vi.mock("../src/shell/hotlistTargets", () => ({
  buildHotlistTargets: () => ({ visible: [], overflow: [] }),
}));

vi.mock("../src/pane/toolbarJobsLabel", () => ({
  toolbarJobsDisplay: () => null,
}));

vi.mock("../src/commands/viewModeCommands", () => ({
  viewModeCommandId: (mode: string) => `view.${mode}`,
}));

const defaultPrefs: UserPreferencesDto = {
  theme: "system",
  density: "comfortable",
  defaultViewMode: "details",
  showHiddenFiles: false,
  sidebarWidth: 240,
  splitRatio: 0.5,
  activityPanelVisible: false,
  activityPanelWidth: 288,
  confirmDelete: true,
  confirmPermanentDelete: true,
  useTrashByDefault: true,
  defaultConflictPolicy: "fail",
  accentColor: "blue",
  fontScale: "medium",
  iconScale: "medium",
  confirmOverwrite: true,
  sidebarVisible: true,
  statusBarVisible: true,
  toolbarVisible: true,
  toolbarEntries: "",
  paneMode: "dual",
  jobDrawerBehavior: "manual",
  showAdvancedCopyOptions: false,
  paneTerminalHeightLeft: 0.35,
  paneTerminalHeightRight: 0.35,
  paneTerminalDefaultOpen: false,
  terminalCdOnNavigate: false,
  confirmClosePaneWithTerminal: true,
  terminalShell: "",
  terminalArgs: "",
  tabSessions: "",
  hotlistEntries: "",
  leftDefaultViewMode: "details",
  rightDefaultViewMode: "details",
  leftDefaultSortField: "name",
  rightDefaultSortField: "name",
};

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
    preferences: defaultPrefs,
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
    submitMultiRename: vi.fn(),
    submitCopyMove: vi.fn(),
    submitTrash: vi.fn(),
    submitPermanentDelete: vi.fn(),
    copyTextFromSelection: vi.fn(),
    calculateSelectionSize: vi.fn(),
    revealEntry: vi.fn(),
    handleSetAutostart: vi.fn(),
    handleCommandSelect: vi.fn(),
    toasts: [],
    notifications: [],
    notificationCenterOpen: false,
    setToasts: vi.fn(),
    setNotifications: vi.fn(),
    setNotificationCenterOpen: vi.fn(),
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

function renderToolbar(ctxOverrides: Partial<ShellLayoutContextValue> = {}) {
  const ctx = makeCtx(ctxOverrides);
  return render(
    <ShellLayoutProvider value={ctx}>
      <ShellToolbar />
    </ShellLayoutProvider>,
  );
}

describe("ShellToolbar", () => {
  afterEach(cleanup);

  it("renders the operation toolbar", () => {
    renderToolbar();
    expect(screen.getByTestId("operation-toolbar")).toBeTruthy();
  });

  it("renders the theme button", () => {
    renderToolbar();
    expect(screen.getByLabelText("Theme: System")).toBeTruthy();
  });

  it("shows system theme icon by default", () => {
    renderToolbar();
    expect(screen.getByLabelText("Theme: System").textContent).toContain("🖥️");
  });

  it("shows dark theme icon when theme is dark", () => {
    renderToolbar({
      preferences: { ...defaultPrefs, theme: "dark" },
    });
    expect(screen.getByLabelText("Theme: Dark").textContent).toContain("🌙");
  });

  it("shows light theme icon when theme is light", () => {
    renderToolbar({
      preferences: { ...defaultPrefs, theme: "light" },
    });
    expect(screen.getByLabelText("Theme: Light").textContent).toContain("☀️");
  });

  it("shows monitor icon when theme is system", () => {
    renderToolbar({
      preferences: { ...defaultPrefs, theme: "system" },
    });
    expect(screen.getByLabelText("Theme: System").textContent).toContain("🖥️");
  });

  it("uses system theme when preferences is null", () => {
    renderToolbar({ preferences: null });
    expect(screen.getByLabelText("Theme: System").textContent).toContain("🖥️");
  });

  it("clicking theme button calls handleCommandSelect with preferences.cycleTheme", () => {
    const handleCommandSelect = vi.fn();
    renderToolbar({ handleCommandSelect });
    fireEvent.click(screen.getByLabelText("Theme: System"));
    expect(handleCommandSelect).toHaveBeenCalledWith(
      "preferences.cycleTheme",
      "left",
      undefined,
    );
  });

  it("shows notification count and opens notification center", () => {
    const setNotificationCenterOpen = vi.fn();
    renderToolbar({
      notifications: [
        { id: "n1", tone: "info", title: "One" },
        { id: "n2", tone: "error", title: "Two" },
      ],
      notificationCenterOpen: false,
      setNotificationCenterOpen,
    });

    const button = screen.getByLabelText("Notifications: 2 unread");
    expect(button.textContent).toContain("2");
    fireEvent.click(button);
    expect(setNotificationCenterOpen).toHaveBeenCalledWith(true);
  });

  it("renders the notification center outside the clipping toolbar", () => {
    renderToolbar({
      notifications: [{ id: "n1", tone: "info", title: "One" }],
      notificationCenterOpen: true,
    });

    const center = screen
      .getAllByLabelText("Notifications")
      .find((element) => element.classList.contains("fo-notification-center"));

    expect(center).toBeTruthy();
    expect(center?.closest(".fo-workbench-toolbar")).toBeNull();
  });

  it("shows canGoBack=false when backStack is empty", () => {
    renderToolbar();
    expect(screen.getByTestId("can-go-back").textContent).toBe("false");
  });

  it("shows canGoForward=false when forwardStack is empty", () => {
    renderToolbar();
    expect(screen.getByTestId("can-go-forward").textContent).toBe("false");
  });

  it("passes canGoUp as false when there is no parent URI", () => {
    // Root URI has no parent
    const state = createInitialState();
    state.panels.left.tabs[state.panels.left.activeTabId].uri = "local:///";
    renderToolbar({ state });
    expect(screen.getByTestId("can-go-up").textContent).toBe("false");
  });

  it("renders the toolbar separator", () => {
    const { container } = renderToolbar();
    expect(container.querySelector(".fo-toolbar-separator")).toBeTruthy();
  });

  it("renders the toolbar workbench container", () => {
    const { container } = renderToolbar();
    expect(container.querySelector(".fo-workbench-toolbar")).toBeTruthy();
  });

  it("does not show ToolbarCustomizeDialog when toolbarCustomizeOpen is false", () => {
    renderToolbar({ toolbarCustomizeOpen: false });
    expect(screen.queryByTestId("toolbar-customize-dialog")).toBeNull();
  });

  it("shows ToolbarCustomizeDialog when toolbarCustomizeOpen is true", () => {
    renderToolbar({ toolbarCustomizeOpen: true });
    expect(screen.getByTestId("toolbar-customize-dialog")).toBeTruthy();
  });

  it("clicking Back button invokes handleCommandSelect with nav.back", () => {
    const handleCommandSelect = vi.fn();
    renderToolbar({ handleCommandSelect });
    fireEvent.click(screen.getByText("Back"));
    expect(handleCommandSelect).toHaveBeenCalledWith(
      "nav.back",
      "left",
      undefined,
    );
  });

  it("clicking Forward button invokes handleCommandSelect with nav.forward", () => {
    const handleCommandSelect = vi.fn();
    renderToolbar({ handleCommandSelect });
    fireEvent.click(screen.getByText("Forward"));
    expect(handleCommandSelect).toHaveBeenCalledWith(
      "nav.forward",
      "left",
      undefined,
    );
  });

  it("clicking Refresh calls refreshPanel", () => {
    const refreshPanel = vi.fn();
    renderToolbar({ refreshPanel });
    fireEvent.click(screen.getByText("Refresh"));
    expect(refreshPanel).toHaveBeenCalledWith("left");
  });

  it("clicking Home invokes handleCommandSelect with nav.home", () => {
    const handleCommandSelect = vi.fn();
    renderToolbar({ handleCommandSelect });
    fireEvent.click(screen.getByText("Home"));
    expect(handleCommandSelect).toHaveBeenCalledWith(
      "nav.home",
      "left",
      undefined,
    );
  });
});
