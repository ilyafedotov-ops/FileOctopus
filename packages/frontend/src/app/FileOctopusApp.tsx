import { useCallback, useMemo } from "react";
import { activeTab } from "../panelStore";
import { applySplitRatio } from "../applyPreferences";
import { useWorkspaceLayout } from "../hooks/useWorkspaceLayout";
import { useMenuBarProps } from "../hooks/useMenuBarProps";
import { useEventHandlers } from "../hooks/useEventHandlers";
import { useAppInit } from "../hooks/useAppInit";
import { createKeyboardShortcutsHandler } from "../hooks/useKeyboardShortcuts";
import { useFileOpHandlers } from "../hooks/useFileOpHandlers";
import { useCommandDispatch } from "../hooks/useCommandDispatch";
import type { CommandEntry } from "../components/CommandPalette";
import { isTextPreviewable } from "../components/PreviewPanel";
import type { FilePanelProps } from "../pane/FilePanel";
import { ShellLayout } from "../shell/ShellLayout";
import { shortcutEntries } from "../shortcuts";
import {
  AppProviders,
  useJobs,
  useModals,
  useShell,
} from "./providers/AppProviders";

const isProductionBuild = Boolean(
  (import.meta as ImportMeta & { env?: { PROD?: boolean } }).env?.PROD,
);

function FileOctopusAppInner() {
  const {
    client,
    state,
    dispatch,
    preferences,
    density,
    locations,
    favorites,
    recentToday,
    recentWeek,
    starred,
    appInfo,
    appHealth,
    autostart,
    toasts,
    clipboard,
    contextMenu,
    search,
    pathFocusToken,
    renameFocusToken,
    filterFocusToken,
    recursiveSearchFocusToken,
    diagnosticsDestination,
    diagnosticsMessage,
    exportingDiagnostics,
    workspaceRef,
    hasInitializedRef,
    setPreferences,
    setDensity,
    setLocations,
    setFavorites,
    setRecentToday,
    setRecentWeek,
    setStarred,
    setAppInfo,
    setAppHealth,
    setAutostart,
    setToasts,
    setClipboard,
    setContextMenu,
    setSearch,
    setPathFocusToken,
    setRenameFocusToken,
    setFilterFocusToken,
    setRecursiveSearchFocusToken,
    setDiagnosticsDestination,
    setDiagnosticsMessage,
    setExportingDiagnostics,
  } = useShell();

  const {
    jobs,
    history,
    operationError,
    activityCollapsed,
    setJobs,
    setHistory,
    setOperationError,
    setActivityCollapsed,
    markActivityPinnedOpen,
  } = useJobs();

  const {
    settingsOpen,
    shortcutsOpen,
    commandPaletteOpen,
    previewOpen,
    diagnosticsOpen,
    helpOpen,
    aboutOpen,
    goToLocationOpen,
    manageFavoritesOpen,
    errorDetailsOpen,
    operationHistoryOpen,
    setAboutOpen,
    setGoToLocationOpen,
    setManageFavoritesOpen,
    setErrorDetailsOpen,
    setOperationHistoryOpen,
    dialog,
    setSettingsOpen,
    setShortcutsOpen,
    setCommandPaletteOpen,
    setPreviewOpen,
    setDiagnosticsOpen,
    setHelpOpen,
    setDialog,
  } = useModals();

  const {
    pushToast,
    updatePreference,
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
    diagnosticsDestination,
    setToasts,
    setPreferences,
    setDensity,
    setActivityCollapsed,
    setOperationError,
    setSearch,
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

  useWorkspaceLayout({
    workspaceRef,
    sidebarWidth: preferences?.sidebarWidth ?? 240,
    activityCollapsed,
    activityPanelVisible: preferences?.activityPanelVisible ?? false,
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
    preferences,
    starred,
    pushToast,
    refreshPanel,
    refreshVisiblePanels,
    refreshHistory,
    refreshLocations,
    refreshNavigation,
    refreshDiagnostics,
    updatePreference,
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
    handleCompress,
    handleExtract,
    submitCreateFolder,
    submitCreateFile,
    submitRename,
    submitInlineRename,
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

  const triggerInlineRename = useCallback(
    (panelId: "left" | "right") => {
      const tab = activeTab(state.panels[panelId]);
      if (tab.selectedIds.length === 1) {
        setRenameFocusToken((value) => value + 1);
        return;
      }
      handleRename(panelId);
    },
    [state.panels, handleRename, setRenameFocusToken],
  );

  const handleCommandSelect = useCommandDispatch({
    state,
    dispatch,
    preferences,
    navigatePanel,
    goHistory,
    refreshPanel,
    updatePreference,
    setSettingsOpen,
    setShortcutsOpen,
    setDiagnosticsOpen,
    setAboutOpen,
    setGoToLocationOpen,
    setManageFavoritesOpen,
    setOperationHistoryOpen,
    setFilterFocusToken,
    setActivityCollapsed,
    markActivityPinnedOpen,
    handleCreateFolder,
    handleCreateFile,
    startInlineRename: triggerInlineRename,
    handleTrash,
    handlePermanentDelete,
    handleProperties,
    copySelectionToFileClipboard,
    pasteClipboard,
    selectedEntries,
    activateEntry,
    setCommandPaletteOpen,
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
        startInlineRename: triggerInlineRename,
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
      triggerInlineRename,
      handleTrash,
      handlePermanentDelete,
      copySelectionToFileClipboard,
      pasteClipboard,
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
    exportDiagnostics,
    activateEntry,
    selectedEntries,
    openExternal,
    revealEntry,
    handleCreateFolder,
    handleCreateFile,
    handleRename,
    handleTrash,
    handlePermanentDelete,
    handleCopyOrMove,
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
    setAboutOpen,
    setGoToLocationOpen,
    setManageFavoritesOpen,
    setOperationHistoryOpen,
    setActivityCollapsed,
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
      onRename: () => triggerInlineRename(pid),
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
      onCompress: () => void handleCompress(pid),
      onExtract: () => void handleExtract(pid),
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
      renameFocusToken,
      filterFocusToken,
      recursiveSearchFocusToken,
      rowHeight,
      search: search?.panelId === pid ? search : null,
      onContextMenu: setContextMenu,
      onEntryActivate: (entry) => activateEntry(pid, entry),
      onBreadcrumbContextMenu: (path, event) => {
        event.preventDefault();
        setContextMenu({
          panelId: pid,
          x: event.clientX,
          y: event.clientY,
          entry: null,
          breadcrumbPath: path,
        });
      },
      onSubmitInlineRename: (entryUri, newName) => {
        const entry = tab.entriesById[entryUri];
        if (entry) {
          void submitInlineRename(pid, entry, newName);
        }
      },
    };
  }

  return (
    <ShellLayout
      workspaceRef={workspaceRef}
      handleShellKeyDown={handleShellKeyDown}
      makeFilePanelProps={makeFilePanelProps}
      menuBarProps={menuBarProps}
      state={state}
      activeTabUri={activeTab(state.panels[state.activePanelId]).uri}
      locations={locations}
      favorites={favorites}
      recentToday={recentToday}
      recentWeek={recentWeek}
      starred={starred}
      preferences={preferences}
      updatePreference={updatePreference}
      client={client}
      jobs={jobs}
      jobMetrics={jobMetrics}
      history={history}
      operationError={operationError}
      activityCollapsed={activityCollapsed}
      markActivityPinnedOpen={markActivityPinnedOpen}
      setActivityCollapsed={setActivityCollapsed}
      refreshHistory={refreshHistory}
      clearHistory={clearHistory}
      settingsOpen={settingsOpen}
      shortcutsOpen={shortcutsOpen}
      commandPaletteOpen={commandPaletteOpen}
      previewOpen={previewOpen}
      diagnosticsOpen={diagnosticsOpen}
      aboutOpen={aboutOpen}
      goToLocationOpen={goToLocationOpen}
      manageFavoritesOpen={manageFavoritesOpen}
      errorDetailsOpen={errorDetailsOpen}
      operationHistoryOpen={operationHistoryOpen}
      setGoToLocationOpen={setGoToLocationOpen}
      setManageFavoritesOpen={setManageFavoritesOpen}
      setErrorDetailsOpen={setErrorDetailsOpen}
      setOperationHistoryOpen={setOperationHistoryOpen}
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
      setSettingsOpen={setSettingsOpen}
      setShortcutsOpen={setShortcutsOpen}
      setCommandPaletteOpen={setCommandPaletteOpen}
      setPreviewOpen={setPreviewOpen}
      setDiagnosticsOpen={setDiagnosticsOpen}
      setAboutOpen={setAboutOpen}
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
      handleSetAutostart={handleSetAutostart}
      handleCommandSelect={handleCommandSelect}
      toasts={toasts}
      setToasts={setToasts}
      contextMenu={contextMenu}
      setContextMenu={setContextMenu}
      clipboard={clipboard}
      starredUriSet={starredUriSet}
      dispatch={dispatch}
      activateEntry={activateEntry}
      handleRename={handleRename}
      triggerInlineRename={triggerInlineRename}
      copySelectionToFileClipboard={copySelectionToFileClipboard}
      pasteClipboard={pasteClipboard}
      handleTrash={handleTrash}
      toggleStarredForEntry={toggleStarredForEntry}
      handlePermanentDelete={handlePermanentDelete}
      handleProperties={handleProperties}
      openTerminal={openTerminal}
      handleChecksum={handleChecksum}
      handleCompress={handleCompress}
      handleExtract={handleExtract}
      handleCreateFolder={handleCreateFolder}
      handleCreateFile={handleCreateFile}
      refreshPanel={refreshPanel}
      handleCopyOrMove={handleCopyOrMove}
      openExternal={openExternal}
      toggleHidden={toggleHidden}
      navigatePanel={navigatePanel}
      navigateOtherPane={(uri) => {
        const otherPanel: "left" | "right" =
          state.activePanelId === "left" ? "right" : "left";
        navigatePanel(otherPanel, uri);
      }}
      addFavorite={async (uri) => {
        try {
          const label = uri.split("/").pop() || uri;
          await client.navigation.addFavorite({ uri, label });
        } catch {
          /* ignore */
        }
      }}
      refreshNavigation={refreshNavigation}
      setOperationError={setOperationError}
      applySplitRatioFn={applySplitRatio}
    />
  );
}

export function FileOctopusApp() {
  return (
    <AppProviders>
      <FileOctopusAppInner />
    </AppProviders>
  );
}

export { FileOctopusApp as FileOctopusShell };
