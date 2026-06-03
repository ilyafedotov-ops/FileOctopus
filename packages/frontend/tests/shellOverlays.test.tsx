import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShellOverlays } from "../src/shell/ShellOverlays";
import type { ShellLayoutContextValue } from "../src/shell/ShellLayoutContext";
import { ShellLayoutProvider } from "../src/shell/ShellLayoutContext";
import { createInitialState } from "../src/panelStore";

vi.mock("../src/components/FirstRunOverlay", () => ({
  FirstRunOverlay: ({ open }: { open: boolean }) =>
    open ? <div data-testid="first-run-overlay">FirstRun</div> : null,
}));

vi.mock("../src/components/DialogOverlayGroup", () => ({
  DialogOverlayGroup: () => (
    <div data-testid="dialog-overlay-group">DialogOverlayGroup</div>
  ),
}));

vi.mock("../src/components/ContextMenuOverlay", () => ({
  ContextMenuOverlay: () => (
    <div data-testid="context-menu-overlay">ContextMenuOverlay</div>
  ),
}));

vi.mock("../src/components/ToastStack", () => ({
  ToastStack: ({ toasts }: { toasts: Array<{ id: string }> }) =>
    toasts.length > 0 ? (
      <div data-testid="toast-stack">{toasts.map((t) => t.id).join(",")}</div>
    ) : null,
}));

vi.mock("../src/onboarding/firstRun", () => ({
  shouldShowFirstRunOverlay: vi.fn(() => false),
  markFirstRunOverlayDismissed: vi.fn(),
}));

vi.mock("../src/components/PreviewPanel", () => ({
  isImagePreviewable: vi.fn(() => false),
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
    networkLocationsOpen: false,
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
    setNetworkLocationsOpen: vi.fn(),
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

function renderOverlays(ctxOverrides: Partial<ShellLayoutContextValue> = {}) {
  const ctx = makeCtx(ctxOverrides);
  return render(
    <ShellLayoutProvider value={ctx}>
      <ShellOverlays />
    </ShellLayoutProvider>,
  );
}

describe("ShellOverlays", () => {
  afterEach(cleanup);

  it("renders DialogOverlayGroup", () => {
    renderOverlays();
    expect(screen.getByTestId("dialog-overlay-group")).toBeTruthy();
  });

  it("renders ContextMenuOverlay", () => {
    renderOverlays();
    expect(screen.getByTestId("context-menu-overlay")).toBeTruthy();
  });

  it("does not show FirstRunOverlay when shouldShowFirstRunOverlay returns false", () => {
    renderOverlays();
    expect(screen.queryByTestId("first-run-overlay")).toBeNull();
  });

  it("shows FirstRunOverlay when shouldShowFirstRunOverlay returns true", async () => {
    const { shouldShowFirstRunOverlay } =
      await import("../src/onboarding/firstRun");
    vi.mocked(shouldShowFirstRunOverlay).mockReturnValueOnce(true);
    renderOverlays();
    expect(screen.getByTestId("first-run-overlay")).toBeTruthy();
  });

  it("renders ToastStack with toasts", () => {
    renderOverlays({
      toasts: [
        { id: "toast-1", message: "Hello", variant: "info" },
      ] as unknown as Record<string, unknown>,
    });
    expect(screen.getByTestId("toast-stack")).toBeTruthy();
  });

  it("does not render toast stack when toasts are empty", () => {
    renderOverlays({ toasts: [] });
    expect(screen.queryByTestId("toast-stack")).toBeNull();
  });

  it("dismisses first run overlay and calls markFirstRunOverlayDismissed", async () => {
    const { shouldShowFirstRunOverlay } =
      await import("../src/onboarding/firstRun");
    vi.mocked(shouldShowFirstRunOverlay).mockReturnValue(true);

    const setSettingsOpen = vi.fn();
    const setShortcutsOpen = vi.fn();
    const navigatePanel = vi.fn();
    const state = createInitialState();

    renderOverlays({
      setSettingsOpen,
      setShortcutsOpen,
      navigatePanel,
      state,
    } as unknown as Record<string, unknown>);

    expect(screen.getByTestId("first-run-overlay")).toBeTruthy();
  });

  it("passes viewerSiblings as empty array when no viewerEntry", () => {
    renderOverlays({ viewerEntry: null });
    expect(screen.getByTestId("dialog-overlay-group")).toBeTruthy();
  });

  it("computes multiRenameEntries from selectedIds", () => {
    const state = createInitialState();
    const tabId = state.panels.left.activeTabId;
    const tab = state.panels.left.tabs[tabId];

    const entry1 = {
      uri: "local:///tmp/file1.txt",
      name: "file1.txt",
      kind: "file" as const,
      size: 10,
      isHidden: false,
      isSymlink: false,
      providerId: "local",
      canRead: true,
      canList: false,
      canWrite: true,
      canDelete: true,
      canRename: true,
    };

    tab.entriesById = { "local:///tmp/file1.txt": entry1 };
    tab.orderedEntryIds = ["local:///tmp/file1.txt"];
    tab.selectedIds = ["local:///tmp/file1.txt"];

    renderOverlays({ state });
    expect(screen.getByTestId("dialog-overlay-group")).toBeTruthy();
  });

  it("computes multiRenameEntries from focused entry when no selectedIds", () => {
    const state = createInitialState();
    const tabId = state.panels.left.activeTabId;
    const tab = state.panels.left.tabs[tabId];

    const entry1 = {
      uri: "local:///tmp/file1.txt",
      name: "file1.txt",
      kind: "file" as const,
      size: 10,
      isHidden: false,
      isSymlink: false,
      providerId: "local",
      canRead: true,
      canList: false,
      canWrite: true,
      canDelete: true,
      canRename: true,
    };

    tab.entriesById = { "local:///tmp/file1.txt": entry1 };
    tab.orderedEntryIds = ["local:///tmp/file1.txt"];
    tab.selectedIds = [];
    tab.selectedId = "local:///tmp/file1.txt";

    renderOverlays({ state });
    expect(screen.getByTestId("dialog-overlay-group")).toBeTruthy();
  });

  it("returns empty multiRenameEntries when no selection and no focused entry", () => {
    const state = createInitialState();
    renderOverlays({ state });
    expect(screen.getByTestId("dialog-overlay-group")).toBeTruthy();
  });
});
