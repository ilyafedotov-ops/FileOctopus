import { useMemo, useReducer, useRef, useState } from "react";
import {
  createFileOctopusClient,
  normalizeIpcError,
} from "@fileoctopus/ts-api";
import type {
  AppDataHealthResponse,
  AppInfoResponse,
  AutostartStatusDto,
  StandardLocationDto,
  FavoriteEntryDto,
  RecentEntryDto,
  StarredEntryDto,
  JobSnapshot,
  OperationHistoryRecordDto,
} from "@fileoctopus/ts-api";
import { activeTab, createInitialState, panelReducer } from "./panelStore";
import { applySplitRatio, type DensityPreference } from "./applyPreferences";
import { ActivityPanel } from "./activity/ActivityPanel";
import type { SearchState } from "./pane/PaneFilterBar";
import { useWorkspaceLayout } from "./hooks/useWorkspaceLayout";
import { useMenuBarProps } from "./hooks/useMenuBarProps";
import { useEventHandlers } from "./hooks/useEventHandlers";
import { useAppInit } from "./hooks/useAppInit";
import { createKeyboardShortcutsHandler } from "./hooks/useKeyboardShortcuts";
import {
  useFileOpHandlers,
  type FileClipboardState,
} from "./hooks/useFileOpHandlers";
import { SidebarResizer, SplitResizer } from "./shell/LayoutResizers";
import { TitleBar } from "./shell/TitleBar";
import { Sidebar } from "./sidebar/Sidebar";
import { type ContextMenuState } from "./components/ContextMenu";
import { ContextMenuOverlay } from "./components/ContextMenuOverlay";
import type { CommandEntry } from "./components/CommandPalette";
import { isTextPreviewable } from "./components/PreviewPanel";
import { ToastStack, type ToastMessage } from "./components/ToastStack";
import { DialogOverlayGroup } from "./components/DialogOverlayGroup";

import { FilePanel, type FilePanelProps } from "./pane/FilePanel";
import { type OperationDialog } from "./dialogs/OperationDialogView";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { StatusBarSection } from "./components/StatusBarSection";
import { shortcutEntries } from "./shortcuts";
import type { UserPreferencesDto } from "@fileoctopus/ts-api";

const isProductionBuild = Boolean(
  (import.meta as ImportMeta & { env?: { PROD?: boolean } }).env?.PROD,
);

export function FileOctopusShell() {
  const client = useMemo(() => createFileOctopusClient(), []);
  const hasInitializedRef = useRef(false);
  const [state, dispatch] = useReducer(panelReducer, undefined, () =>
    createInitialState(),
  );
  const [jobs, setJobs] = useState<Record<string, JobSnapshot>>({});
  const [history, setHistory] = useState<OperationHistoryRecordDto[]>([]);
  const [appInfo, setAppInfo] = useState<AppInfoResponse | null>(null);
  const [appHealth, setAppHealth] = useState<AppDataHealthResponse | null>(
    null,
  );
  const [diagnosticsDestination, setDiagnosticsDestination] = useState(
    "/tmp/fileoctopus-diagnostics.zip",
  );
  const [diagnosticsMessage, setDiagnosticsMessage] = useState<string | null>(
    null,
  );
  const [exportingDiagnostics, setExportingDiagnostics] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<OperationDialog | null>(null);
  const [locations, setLocations] = useState<StandardLocationDto[]>([]);
  const [clipboard, setClipboard] = useState<FileClipboardState | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [search, setSearch] = useState<SearchState | null>(null);
  const [pathFocusToken, setPathFocusToken] = useState(0);
  const [filterFocusToken, setFilterFocusToken] = useState(0);
  const [recursiveSearchFocusToken, setRecursiveSearchFocusToken] = useState(0);
  const [preferences, setPreferences] = useState<UserPreferencesDto | null>(
    null,
  );
  const [density, setDensity] = useState<DensityPreference>("comfortable");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [autostart, setAutostart] = useState<AutostartStatusDto | null>(null);

  // ── useEffects moved to useAppInit hook ───────────────────────────
  const [favorites, setFavorites] = useState<FavoriteEntryDto[]>([]);
  const [recentToday, setRecentToday] = useState<RecentEntryDto[]>([]);
  const [recentWeek, setRecentWeek] = useState<RecentEntryDto[]>([]);
  const [starred, setStarred] = useState<StarredEntryDto[]>([]);
  const [activityCollapsed, setActivityCollapsed] = useState(false);

  const {
    pushToast,
    updatePreference,
    handleCommandSelect,
    handleSetAutostart,
    navigatePanel,
    refreshNavigation,
    goHistory,
    refreshPanel,
    refreshLocations,
    activateEntry,
    refreshVisiblePanels,
    refreshHistory,
    refreshDiagnostics,
    applyFolderSizeCompleted,
    applyRecursiveSearchMatch,
    applyRecursiveSearchCompleted,
    clearHistory,
    exportDiagnostics,
  } = useEventHandlers({
    client,
    state,
    dispatch,
    preferences,
    diagnosticsDestination,
    setToasts,
    setPreferences,
    setDensity,
    setActivityCollapsed,
    setOperationError,
    setSearch,
    setCommandPaletteOpen,
    setSettingsOpen,
    setShortcutsOpen,
    setDiagnosticsOpen,
    setFilterFocusToken,
    setAutostart,
    setFavorites,
    setRecentToday,
    setRecentWeek,
    setStarred,
    setLocations,
    setDialog,
    setHistory,
    setAppInfo,
    setAppHealth,
    setDiagnosticsMessage,
    setExportingDiagnostics,
  });

  const workspaceRef = useRef<HTMLElement | null>(null);
  const { markActivityPinnedOpen } = useWorkspaceLayout({
    workspaceRef,
    sidebarWidth: preferences?.sidebarWidth ?? 240,
    activityCollapsed,
    activityPanelVisible: preferences?.activityPanelVisible ?? true,
    onCollapseActivity: () => {
      setActivityCollapsed(true);
      void updatePreference("activityPanelVisible", "false");
    },
  });
  const left = activeTab(state.panels.left);
  const right = activeTab(state.panels.right);

  const { starredUriSet, rowHeight, previewEntry, jobMetrics } = useAppInit({
    client,
    state,
    dispatch,
    hasInitializedRef,
    settingsOpen,
    left,
    right,
    density,
    starred,
    pushToast,
    refreshPanel,
    refreshVisiblePanels,
    refreshHistory,
    refreshLocations,
    refreshNavigation,
    refreshDiagnostics,
    navigatePanel,
    applyFolderSizeCompleted,
    applyRecursiveSearchMatch,
    applyRecursiveSearchCompleted,
    setAutostart,
    setSettingsOpen,
    setShortcutsOpen,
    setDiagnosticsOpen,
    setHelpOpen,
    setJobs,
    setOperationError,
    setSearch,
    setDialog,
    setPreferences,
    setDensity,
    setActivityCollapsed,
  });

  // ── Command Palette entries ──────────────────────────────────────
  const commandEntries: CommandEntry[] = useMemo(
    () => [
      ...shortcutEntries.map((s) => ({
        id: s.id,
        label: s.label,
        shortcutKey: s.windowsLinux,
        category: s.category,
      })),
      {
        id: "settings",
        label: "Open Settings",
        shortcutKey: "Ctrl+,",
        category: "App",
      },
      {
        id: "shortcuts",
        label: "Show Keyboard Shortcuts",
        shortcutKey: "Ctrl+/",
        category: "App",
      },
      { id: "diagnostics", label: "Open Diagnostics", category: "App" },
      { id: "toggle-sidebar", label: "Toggle Sidebar", category: "View" },
    ],
    [],
  );

  const {
    reviewCopyMoveDialog,
    selectedEntries,
    openExternal,
    revealEntry,
    calculateSize,
    copySelectionToFileClipboard,
    pasteClipboard,
    copyTextFromSelection,
    handleCreateFolder,
    handleCreateFile,
    handleRename,
    handleCopyOrMove,
    handleTrash,
    toggleStarredForEntry,
    handlePermanentDelete,
    handleProperties,
    runRecursiveSearch,
    toggleHidden,
    openTerminal,
    handleChecksum,
    submitCreateFolder,
    submitCreateFile,
    submitRename,
    submitCopyMove,
    submitTrash,
    submitPermanentDelete,
  } = useFileOpHandlers({
    client,
    state,
    dispatch,
    setSearch,
    setDialog,
    setClipboard,
    clipboard,
    setJobs,
    setOperationError,
    pushToast,
    preferences,
    refreshPanel,
    refreshVisiblePanels,
    refreshNavigation,
    navigatePanel,
  });

  const handleShellKeyDown = useMemo(
    () =>
      createKeyboardShortcutsHandler({
        state,
        dispatch,
        commandPaletteOpen,
        setCommandPaletteOpen,
        previewOpen,
        setPreviewOpen,
        dialog,
        setDialog,
        contextMenu,
        setContextMenu,
        helpOpen,
        setHelpOpen,
        setSettingsOpen,
        setShortcutsOpen,
        setPathFocusToken,
        setFilterFocusToken,
        setRecursiveSearchFocusToken,
        activateEntry,
        navigatePanel,
        goHistory,
        refreshPanel,
        toggleHidden,
        handleProperties,
        handleCreateFolder,
        handleRename,
        handleTrash,
        handlePermanentDelete,
        copySelectionToFileClipboard,
        pasteClipboard,
        isTextPreviewable,
      }),
    [
      state,
      dispatch,
      commandPaletteOpen,
      setCommandPaletteOpen,
      previewOpen,
      setPreviewOpen,
      dialog,
      setDialog,
      contextMenu,
      setContextMenu,
      helpOpen,
      setHelpOpen,
      setSettingsOpen,
      setShortcutsOpen,
      setPathFocusToken,
      setFilterFocusToken,
      setRecursiveSearchFocusToken,
      activateEntry,
      navigatePanel,
      goHistory,
      refreshPanel,
      toggleHidden,
      handleProperties,
      handleCreateFolder,
      handleRename,
      handleTrash,
      handlePermanentDelete,
      copySelectionToFileClipboard,
      pasteClipboard,
      isTextPreviewable,
    ],
  );

  const menuBarProps = useMenuBarProps({
    state,
    dispatch,
    client,
    locations,
    clipboard,
    setClipboard,
    preferences,
    setDensity,
    goHistory,
    navigatePanel,
    refreshPanel,
    refreshNavigation,
    activateEntry,
    selectedEntries,
    openExternal,
    revealEntry,
    handleCreateFolder,
    handleCreateFile,
    handleRename,
    handleTrash,
    handlePermanentDelete,
    handleProperties,
    copySelectionToFileClipboard,
    pasteClipboard,
    copyTextFromSelection,
    toggleHidden,
    updatePreference,
    pushToast,
    setPathFocusToken,
    setFilterFocusToken,
    setRecursiveSearchFocusToken,
    setSettingsOpen,
    setShortcutsOpen,
    setDiagnosticsOpen,
  });

  function makeFilePanelProps(pid: "left" | "right"): FilePanelProps {
    const tab = activeTab(state.panels[pid]);
    return {
      panelId: pid,
      title: pid === "left" ? "Left" : "Right",
      tab,
      active: state.activePanelId === pid,
      onActivate: () => dispatch({ type: "setActivePanel", panelId: pid }),
      onNavigate: (uri) => navigatePanel(pid, uri),
      onBack: () => void goHistory(pid, "back"),
      onForward: () => void goHistory(pid, "forward"),
      onSelect: (entryId) =>
        dispatch({ type: "setSelection", panelId: pid, entryId }),
      onEntrySelect: (entryId, mode) =>
        dispatch({ type: "selectEntry", panelId: pid, entryId, mode }),
      onCreateFolder: () => handleCreateFolder(pid),
      onCreateFile: () => handleCreateFile(pid),
      onRename: () => handleRename(pid),
      onCopy: () => copySelectionToFileClipboard(pid, "copy"),
      onCut: () => copySelectionToFileClipboard(pid, "move"),
      onCopyOperation: () => handleCopyOrMove(pid, "copy"),
      onMoveOperation: () => handleCopyOrMove(pid, "move"),
      onPaste: () => void pasteClipboard(pid),
      onTrash: () => handleTrash(pid),
      onPermanentDelete: () => handlePermanentDelete(pid),
      onCopyPath: () => void copyTextFromSelection(pid, "path"),
      onCopyName: () => void copyTextFromSelection(pid, "name"),
      onProperties: (entry) => void handleProperties(pid, entry),
      onReveal: (entry) => void revealEntry(pid, entry),
      onCalculateSize: (entry) => void calculateSize(pid, entry),
      onCompress: () =>
        pushToast({ tone: "info", title: "Compress coming soon" }),
      onExtract: () =>
        pushToast({ tone: "info", title: "Extract coming soon" }),
      onOpenTerminal: () => openTerminal(tab.uri),
      onChecksum: () => void handleChecksum(pid),
      onRefresh: () => refreshPanel(pid),
      onToggleHidden: () => toggleHidden(pid),
      onSelectAll: () => dispatch({ type: "selectAll", panelId: pid }),
      onMove: (delta) =>
        dispatch({ type: "moveSelection", panelId: pid, delta }),
      onSort: (field) => dispatch({ type: "setSort", panelId: pid, field }),
      onFilter: (filter) =>
        dispatch({ type: "setFilter", panelId: pid, filter }),
      onRecursiveQuery: (query) =>
        dispatch({ type: "setRecursiveQuery", panelId: pid, query }),
      onRecursiveSearch: () => void runRecursiveSearch(pid),
      onViewMode: (viewMode) =>
        dispatch({ type: "setViewMode", panelId: pid, viewMode }),
      canPaste: Boolean(clipboard),
      pathFocusToken,
      filterFocusToken,
      recursiveSearchFocusToken,
      rowHeight,
      search: search?.panelId === pid ? search : null,
      onContextMenu: setContextMenu,
      onEntryActivate: (entry) => activateEntry(pid, entry),
    };
  }

  return (
    <ErrorBoundary>
      <main className="fo-shell" tabIndex={-1} onKeyDown={handleShellKeyDown}>
        <div className="fo-shell-frame">
          <TitleBar
            onSettings={() => setSettingsOpen(true)}
            menuBarProps={menuBarProps}
          />
          <section
            ref={workspaceRef}
            className="fo-workspace"
            aria-label="File workspace"
          >
            {preferences?.sidebarVisible !== false ? (
              <>
                <Sidebar
                  locations={locations}
                  favorites={favorites}
                  recentToday={recentToday}
                  recentWeek={recentWeek}
                  starred={starred}
                  activeUri={activeTab(state.panels[state.activePanelId]).uri}
                  onNavigate={(uri) => navigatePanel(state.activePanelId, uri)}
                  onAddFavorite={(uri, label) => {
                    void client.navigation
                      .addFavorite({ uri, label })
                      .then(() => refreshNavigation())
                      .catch((error) =>
                        setOperationError(normalizeIpcError(error).message),
                      );
                  }}
                  onRemoveFavorite={(id) => {
                    void client.navigation
                      .removeFavorite({ id })
                      .then(() => refreshNavigation())
                      .catch((error) =>
                        setOperationError(normalizeIpcError(error).message),
                      );
                  }}
                  onRenameFavorite={(id, label) => {
                    void client.navigation
                      .renameFavorite({ id, label })
                      .then(() => refreshNavigation())
                      .catch((error) =>
                        setOperationError(normalizeIpcError(error).message),
                      );
                  }}
                  onRevealFavorite={(uri) => {
                    void client.fs
                      .revealPathInFileManager({ uri })
                      .catch((error: unknown) =>
                        setOperationError(normalizeIpcError(error).message),
                      );
                  }}
                />
                <SidebarResizer
                  onSidebarResize={(width) => {
                    document.documentElement.style.setProperty(
                      "--fo-sidebar-width",
                      `${width}px`,
                    );
                    void updatePreference("sidebarWidth", String(width));
                  }}
                />
              </>
            ) : null}
            <div className="fo-dual-pane" aria-label="File panels">
              <FilePanel {...makeFilePanelProps("left")} />
              <SplitResizer
                onSplitResize={(ratio) => {
                  const nextRatio = applySplitRatio(ratio);
                  void updatePreference("splitRatio", String(nextRatio));
                }}
              />
              <FilePanel {...makeFilePanelProps("right")} />
            </div>
            <ActivityPanel
              jobs={Object.values(jobs)}
              history={history}
              error={operationError}
              collapsed={activityCollapsed}
              jobMetrics={jobMetrics}
              onToggleCollapsed={() => {
                const next = !activityCollapsed;
                if (!next) {
                  markActivityPinnedOpen();
                }
                setActivityCollapsed(next);
                void updatePreference("activityPanelVisible", String(!next));
              }}
              onCancel={(jobId) => void client.jobs.cancelJob({ jobId })}
              onRefreshHistory={() => void refreshHistory()}
              onClearHistory={() => void clearHistory()}
            />
          </section>
          <ToastStack
            toasts={toasts}
            onDismiss={(id) =>
              setToasts((current) => current.filter((toast) => toast.id !== id))
            }
          />
          <DialogOverlayGroup
            preferences={preferences}
            settingsOpen={settingsOpen}
            shortcutsOpen={shortcutsOpen}
            commandPaletteOpen={commandPaletteOpen}
            previewOpen={previewOpen}
            diagnosticsOpen={diagnosticsOpen}
            dialog={dialog}
            autostart={autostart}
            commandEntries={commandEntries}
            previewEntry={previewEntry}
            appInfo={appInfo}
            appHealth={appHealth}
            diagnosticsDestination={diagnosticsDestination}
            diagnosticsMessage={diagnosticsMessage}
            exportingDiagnostics={exportingDiagnostics}
            isProductionBuild={isProductionBuild}
            fs={client.fs}
            updatePreference={updatePreference}
            handleSetAutostart={handleSetAutostart}
            handleCommandSelect={handleCommandSelect}
            setSettingsOpen={setSettingsOpen}
            setShortcutsOpen={setShortcutsOpen}
            setCommandPaletteOpen={setCommandPaletteOpen}
            setDiagnosticsOpen={setDiagnosticsOpen}
            setPreviewOpen={setPreviewOpen}
            setDialog={setDialog}
            setDiagnosticsDestination={setDiagnosticsDestination}
            refreshDiagnostics={refreshDiagnostics}
            exportDiagnostics={exportDiagnostics}
            reviewCopyMoveDialog={reviewCopyMoveDialog}
            submitCreateFolder={submitCreateFolder}
            submitCreateFile={submitCreateFile}
            submitRename={submitRename}
            submitCopyMove={submitCopyMove}
            submitTrash={submitTrash}
            submitPermanentDelete={submitPermanentDelete}
            copyTextFromSelection={copyTextFromSelection}
            revealEntry={revealEntry}
          />
          <ContextMenuOverlay
            menu={contextMenu}
            state={state}
            clipboard={clipboard}
            starredUriSet={starredUriSet}
            dispatch={dispatch}
            onClose={() => setContextMenu(null)}
            activateEntry={activateEntry}
            handleRename={handleRename}
            copySelectionToFileClipboard={copySelectionToFileClipboard}
            pasteClipboard={pasteClipboard}
            handleTrash={handleTrash}
            toggleStarredForEntry={toggleStarredForEntry}
            handlePermanentDelete={handlePermanentDelete}
            copyTextFromSelection={copyTextFromSelection}
            handleProperties={handleProperties}
            revealEntry={revealEntry}
            pushToast={pushToast}
            openTerminal={openTerminal}
            handleChecksum={handleChecksum}
            handleCreateFolder={handleCreateFolder}
            handleCreateFile={handleCreateFile}
            refreshPanel={refreshPanel}
            handleCopyOrMove={handleCopyOrMove}
            openExternal={openExternal}
            toggleHidden={toggleHidden}
          />
          <StatusBarSection
            state={state}
            jobs={jobs}
            operationError={operationError}
            appHealth={appHealth}
            diagnosticsOpen={diagnosticsOpen}
          />
        </div>
      </main>
    </ErrorBoundary>
  );
}
