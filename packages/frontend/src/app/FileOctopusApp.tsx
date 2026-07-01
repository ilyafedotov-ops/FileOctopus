import { useCallback, useEffect, useMemo, useState } from "react";
import { activeTab, terminalLaunchUri, type SortField } from "../panelStore";
import { applySplitRatio, applyThemePreference } from "../applyPreferences";
import { useWorkspaceLayout } from "../hooks/useWorkspaceLayout";
import { useMenuBarProps } from "../hooks/useMenuBarProps";
import { useEventHandlers } from "../hooks/useEventHandlers";
import { useAppInit } from "../hooks/useAppInit";
import { useCancelActiveJob } from "../hooks/useCancelActiveJob";
import { createKeyboardShortcutsHandler } from "../hooks/useKeyboardShortcuts";
import { useFileOpHandlers } from "../hooks/useFileOpHandlers";
import { useNetworkHandlers } from "../hooks/useNetworkHandlers";
import { useOperationRefreshTargets } from "../hooks/useOperationRefreshTargets";
import { usePaneModePreference } from "../hooks/usePaneModePreference";
import { useCommandDispatch } from "../hooks/useCommandDispatch";
import type { CommandEntry } from "../components/CommandPalette";
import { TerminalCommandDialog } from "../components/dialogs/TerminalCommandDialog";
import { isPreviewable, isTextPreviewable } from "../components/PreviewPanel";
import { ShellLayout } from "../shell/ShellLayout";
import { buildPaletteEntries } from "../commands/paletteEntries";
import type { LocalPathPicker } from "../utils/pathPicker";

import { DebugConsolePanel } from "../dev/DebugConsolePanel";
import { buildFilePanelProps } from "./filePanelProps";
import {
  AppProviders,
  useJobs,
  useModals,
  useNavigationData,
  usePreferences,
  useShell,
  useTerminal,
  useWorkspace,
} from "./providers/AppProviders";

const isProductionBuild = Boolean(
  (import.meta as ImportMeta & { env?: { PROD?: boolean } }).env?.PROD,
);

interface TerminalCommandRequest {
  title: string;
  submitLabel: string;
  onSubmit: (command: string) => void;
}

function FileOctopusAppInner({
  onRequestExit,
  onRequestMinimize,
  onRequestToggleMaximize,
  pickLocalPath,
}: {
  onRequestExit?: () => void;
  onRequestMinimize?: () => void;
  onRequestToggleMaximize?: () => void;
  pickLocalPath?: LocalPathPicker;
}) {
  const { client, state, dispatch, workspaceRef, hasInitializedRef } =
    useShell();
  const [terminalCommandRequest, setTerminalCommandRequest] =
    useState<TerminalCommandRequest | null>(null);
  const { preferences, density, setPreferences, setDensity } = usePreferences();
  const {
    locations,
    favorites,
    recentToday,
    recentWeek,
    starred,
    networkProfiles,
    networkStatuses,
    networkQuickEntries,
    appInfo,
    appHealth,
    autostart,
    setLocations,
    setFavorites,
    setRecentToday,
    setRecentWeek,
    setStarred,
    setNetworkProfiles,
    setNetworkStatuses,
    setNetworkQuickEntries,
    setAppInfo,
    setAppHealth,
    setAutostart,
  } = useNavigationData();
  const {
    toasts,
    notifications,
    notificationCenterOpen,
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
    setToasts,
    setNotifications,
    setNotificationCenterOpen,
    setClipboard,
    setContextMenu,
    setSearch,
    setContentSearch,
    setPathFocusToken,
    setRenameFocusToken,
    setFilterFocusToken,
    setRecursiveSearchFocusToken,
    setDiagnosticsDestination,
    setDiagnosticsMessage,
    setExportingDiagnostics,
  } = useWorkspace();

  const {
    terminal,
    openEmbeddedTerminal,
    openExternalTerminal,
    openProfileTerminalTab,
    runCommandInActiveTerminal,
    setRailSegment,
    spawnAndRunTerminalCommand,
    togglePaneTerminal,
    syncTerminalCwd,
  } = useTerminal();

  const {
    jobs,
    history,
    operationError,
    activityCollapsed,
    jobMetrics,
    setJobs,
    setHistory,
    setJobMetrics,
    setOperationError,
    setActivityCollapsed,
    markActivityPinnedOpen,
  } = useJobs();

  const {
    settingsOpen,
    shortcutsOpen,
    commandPaletteOpen,
    previewOpen,
    viewerOpen,
    viewerEntry,
    editorOpen,
    editorEntry,
    diagnosticsOpen,
    helpOpen,
    aboutOpen,
    goToLocationOpen,
    manageFavoritesOpen,
    recentLocationsOpen,
    clearRecentLocationsOpen,
    closePaneTerminalConfirmOpen,
    setClosePaneTerminalConfirmOpen,
    errorDetailsOpen,
    operationHistoryOpen,
    setAboutOpen,
    setGoToLocationOpen,
    setManageFavoritesOpen,
    setRecentLocationsOpen,
    setClearRecentLocationsOpen,
    setErrorDetailsOpen,
    setOperationHistoryOpen,
    volumePickerOpen,
    connectServerOpen,
    connectServerProfile,
    connectServerInitial,
    removeServerProfile,
    setRemoveServerProfile,
    setVolumePickerOpen,
    setConnectServerOpen,
    setConnectServerProfile,
    setConnectServerInitial,
    toolbarCustomizeOpen,
    setToolbarCustomizeOpen,
    diffOpen,
    diffLeftUri,
    diffRightUri,
    diffLeftName,
    diffRightName,
    setDiffOpen,
    setDiffLeftUri,
    setDiffRightUri,
    setDiffLeftName,
    setDiffRightName,
    dialog,
    setSettingsOpen,
    setShortcutsOpen,
    setCommandPaletteOpen,
    setPreviewOpen,
    setViewerOpen,
    setViewerEntry,
    setEditorOpen,
    setEditorEntry,
    setDiagnosticsOpen,
    setDebugConsoleOpen,
    setHelpOpen,
    setDialog,
    multiRenameOpen,
    setMultiRenameOpen,
    syncDirectoriesOpen,
    setSyncDirectoriesOpen,
    hotlistOpen,
    setHotlistOpen,
    manageHotlistOpen,
    setManageHotlistOpen,
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
    refreshNetworkProfiles,
    refreshNetworkQuickEntries,
    activateEntry,
    openPreviewInOppositePane,
    openEditorInOppositePane,
    openGitReviewInOppositePane,
    refreshVisiblePanels,
    refreshHistory,
    refreshDiagnostics,
    applyFolderSizeCompleted,
    applyRecursiveSearchMatch,
    applyRecursiveSearchCompleted,
    applyContentSearchMatch,
    applyContentSearchCompleted,
    clearHistory,
    exportDiagnostics,
  } = useEventHandlers({
    client,
    state,
    dispatch,
    preferences,
    diagnosticsDestination,
    setToasts,
    setNotifications,
    setPreferences,
    setDensity,
    setActivityCollapsed,
    setOperationError,
    setSearch,
    setContentSearch,
    setAutostart,
    setFavorites,
    setRecentToday,
    setRecentWeek,
    setStarred,
    setLocations,
    setNetworkProfiles,
    setNetworkStatuses,
    setNetworkQuickEntries,
    setDialog,
    setHistory,
    setAppInfo,
    setAppHealth,
    setDiagnosticsMessage,
    setExportingDiagnostics,
    syncTerminalCwd,
    onOpenConnectionWizard: (prefill) => {
      setConnectServerProfile(null);
      setConnectServerInitial(prefill ?? null);
      setConnectServerOpen(true);
    },
  });

  const {
    requestPaneModeChange,
    handleSettingsPreferenceChange,
    confirmClosePaneWithTerminal,
  } = usePaneModePreference({
    preferences,
    terminalSessions: terminal.sessions,
    updatePreference,
    setClosePaneTerminalConfirmOpen,
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
  const {
    registerOperationRefresh,
    takeOperationRefreshTargets,
    refreshOperationTargets,
  } = useOperationRefreshTargets({
    state,
    refreshPanel,
    refreshVisiblePanels,
  });

  const { starredUriSet, rowHeight, previewEntry } = useAppInit({
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
    refreshOperationTargets,
    takeOperationRefreshTargets,
    refreshHistory,
    refreshLocations,
    refreshNetworkProfiles,
    refreshNetworkQuickEntries,
    refreshNavigation,
    refreshDiagnostics,
    setLocations,
    setAppInfo,
    appInfo,
    updatePreference,
    navigatePanel,
    applyFolderSizeCompleted,
    applyRecursiveSearchMatch,
    applyRecursiveSearchCompleted,
    applyContentSearchMatch,
    applyContentSearchCompleted,
    setAutostart,
    setSettingsOpen,
    setShortcutsOpen,
    setDiagnosticsOpen,
    setHelpOpen,
    setJobs,
    setJobMetrics,
    setOperationError,
    setSearch,
    setDialog,
    setPreferences,
    setDensity,
    setActivityCollapsed,
    setNetworkStatuses,
  });

  const commandEntries: CommandEntry[] = useMemo(
    () => buildPaletteEntries(),
    [],
  );

  const {
    reviewCopyMoveDialog,
    selectedEntries,
    openExternal,
    revealEntry,
    calculateSize,
    calculateSelectionSize,
    copySelectionToFileClipboard,
    pasteClipboard,
    copyTextFromSelection,
    handleCreateFolder,
    handleCreateFile,
    handleRename,
    handleCopyOrMove,
    handleTrash,
    handleDelete,
    toggleStarredForEntry,
    handlePermanentDelete,
    handleProperties,
    runRecursiveSearch,
    toggleHidden,
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
    setContentSearch,
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
    registerOperationRefresh,
  });

  const cancelActiveJob = useCancelActiveJob({
    client,
    setJobs,
    setOperationError,
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

  const statusBarVisible = preferences?.statusBarVisible !== false;
  const toolbarVisible = preferences?.toolbarVisible !== false;
  const terminalHomeUri = useMemo(
    () => locations.find((location) => location.id === "home")?.uri,
    [locations],
  );

  const {
    connectProfile,
    disconnectProfile,
    deleteProfile,
    saveProfile,
    forgetFingerprint,
    testConnection,
    testConnectionDraft,
    busyProfileIds,
  } = useNetworkHandlers({
    client,
    refreshNetworkProfiles,
    setOperationError,
  });

  const isTextEditable = useCallback(
    (entry: import("@fileoctopus/ts-api").FileEntryDto | null) =>
      entry !== null &&
      entry.uri.startsWith("local://") &&
      isTextPreviewable(entry),
    [],
  );

  const handleCommandSelect = useCommandDispatch({
    state,
    dispatch,
    preferences,
    navigatePanel,
    goHistory,
    refreshPanel,
    updatePreference,
    requestPaneModeChange,
    setSettingsOpen,
    setToolbarCustomizeOpen,
    setShortcutsOpen,
    setDiagnosticsOpen,
    setDebugConsoleOpen,
    setHelpOpen,
    setAboutOpen,
    setGoToLocationOpen,
    setManageFavoritesOpen,
    setRecentLocationsOpen,
    setClearRecentLocationsOpen,
    setOperationHistoryOpen,
    setVolumePickerOpen,
    setConnectServerOpen,
    setConnectServerProfile,
    setConnectServerInitial,
    setFilterFocusToken,
    setRecursiveSearchFocusToken,
    setPreviewOpen,
    setViewerOpen,
    setViewerEntry,
    setEditorOpen,
    setEditorEntry,
    openPreviewInOppositePane,
    openEditorInOppositePane,
    openGitReviewInOppositePane,
    isPreviewable,
    isTextEditable,
    activityCollapsed,
    setActivityCollapsed,
    markActivityPinnedOpen,
    handleCreateFolder,
    handleCreateFile,
    startInlineRename: triggerInlineRename,
    handleDelete,
    handleTrash,
    handlePermanentDelete,
    handleProperties,
    setOperationError,
    copySelectionToFileClipboard,
    pasteClipboard,
    selectedEntries,
    activateEntry,
    copyTextFromSelection,
    revealEntry,
    openExternal,
    clearClipboard: () => setClipboard(null),
    setCommandPaletteOpen,
    handleCopyOrMove,
    toggleHidden,
    handleCompress,
    handleExtract,
    handleChecksum,
    openEmbeddedTerminal: (panelId) => {
      const uri = terminalLaunchUri(
        activeTab(state.panels[panelId]).uri,
        terminalHomeUri,
      );
      void openEmbeddedTerminal(uri, panelId).catch((error: unknown) => {
        pushToast({
          tone: "error",
          title:
            error instanceof Error ? error.message : "Failed to open terminal",
        });
      });
    },
    togglePaneTerminal: (panelId) => {
      const uri = terminalLaunchUri(
        activeTab(state.panels[panelId]).uri,
        terminalHomeUri,
      );
      void togglePaneTerminal(uri, panelId).catch((error: unknown) => {
        pushToast({
          tone: "error",
          title:
            error instanceof Error ? error.message : "Failed to open terminal",
        });
      });
    },
    openTerminalExternal: (panelId) => {
      const uri = terminalLaunchUri(
        activeTab(state.panels[panelId]).uri,
        terminalHomeUri,
      );
      void openExternalTerminal(uri).catch(() => {
        pushToast({
          tone: "error",
          title: "Failed to open external terminal",
        });
      });
    },
    requestTerminalCommand: (label, onSubmit) => {
      if (!onSubmit) {
        return null;
      }
      setTerminalCommandRequest({
        title: label,
        submitLabel: label.startsWith("Spawn") ? "Spawn and Run" : "Run",
        onSubmit,
      });
      return null;
    },
    runTerminalCommand: (command) => {
      void runCommandInActiveTerminal(command).catch((error: unknown) => {
        pushToast({
          tone: "error",
          title:
            error instanceof Error
              ? error.message
              : "Failed to run terminal command",
        });
      });
    },
    spawnAndRunTerminalCommand: (panelId, command) => {
      const uri = terminalLaunchUri(
        activeTab(state.panels[panelId]).uri,
        terminalHomeUri,
      );
      void spawnAndRunTerminalCommand(uri, command, panelId).catch(
        (error: unknown) => {
          pushToast({
            tone: "error",
            title:
              error instanceof Error
                ? error.message
                : "Failed to spawn terminal command",
          });
        },
      );
    },
    activityPanelVisible: preferences?.activityPanelVisible ?? false,
    terminalRailSegment: terminal.segment,
    setTerminalRailSegment: setRailSegment,
    calculateSize,
    toggleStarredForEntry,
    addFavorite: async (panelId, uri, label) => {
      const target = uri ?? activeTab(state.panels[panelId]).uri;
      const favoriteLabel =
        label ?? target.split("/").filter(Boolean).pop() ?? target;
      try {
        await client.navigation.addFavorite({
          uri: target,
          label: favoriteLabel,
        });
        refreshNavigation();
      } catch {
        /* ignore */
      }
    },
    revealUri: async (uri) => {
      try {
        await client.fs.revealPathInFileManager({ uri });
      } catch {
        /* ignore */
      }
    },
    removeFavorite: async (id) => {
      try {
        await client.navigation.removeFavorite({ id });
        refreshNavigation();
      } catch {
        /* ignore */
      }
    },
    renameFavorite: async (id, label) => {
      try {
        await client.navigation.renameFavorite({ id, label });
        refreshNavigation();
      } catch {
        /* ignore */
      }
    },
    setTheme: applyThemePreference,
    setDensity,
    equalizePanes: () => {
      applySplitRatio(0.5);
      void updatePreference("splitRatio", "0.5");
    },
    toggleStatusBar: () => {
      void updatePreference("statusBarVisible", String(!statusBarVisible));
    },
    toggleToolbar: () => {
      void updatePreference("toolbarVisible", String(!toolbarVisible));
    },
    setMultiRenameOpen,
    setSyncDirectoriesOpen,
    setHotlistOpen,
    setManageHotlistOpen,
    removeRecentEntry: async (uri: string) => {
      try {
        await client.navigation.removeRecent({ uri });
        refreshNavigation();
      } catch {
        /* ignore */
      }
    },
    clearRecentEntries: async () => {
      try {
        await client.navigation.clearRecent();
        refreshNavigation();
      } catch {
        /* ignore */
      }
    },
  });

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let disposed = false;
    const onNativeMenuCommand = client.onNativeMenuCommand?.bind(client);

    if (!onNativeMenuCommand) {
      return undefined;
    }

    onNativeMenuCommand((event) => {
      const context =
        event.sortField || event.preferenceValue
          ? {
              sortField: event.sortField
                ? (event.sortField as SortField)
                : undefined,
              preferenceValue: event.preferenceValue ?? undefined,
            }
          : undefined;
      handleCommandSelect(event.commandId, undefined, context);
    })
      .then((value) => {
        if (disposed) {
          value();
          return;
        }
        unlisten = value;
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [client, handleCommandSelect]);

  const handleShellKeyDown = useMemo(
    () =>
      createKeyboardShortcutsHandler({
        state,
        runCommand: handleCommandSelect,
        commandPaletteOpen,
        setCommandPaletteOpen,
        previewOpen,
        viewerOpen,
        setPreviewOpen,
        setViewerOpen,
        setViewerEntry,
        editorOpen,
        setEditorOpen,
        setEditorEntry,
        openPreviewInOppositePane,
        openEditorInOppositePane,
        isTextEditable,
        dialog,
        setDialog,
        contextMenu,
        setContextMenu,
        helpOpen,
        setHelpOpen,
        setPathFocusToken,
        setRecursiveSearchFocusToken,
        isPreviewable,
        handleCommandSelect,
        handleCopyOrMove,
        handleCreateFolder,
        handleDelete,
        handleProperties,
        setOperationError,
      }),
    [
      state,
      handleCommandSelect,
      commandPaletteOpen,
      setCommandPaletteOpen,
      previewOpen,
      viewerOpen,
      editorOpen,
      setPreviewOpen,
      setViewerOpen,
      setViewerEntry,
      setEditorOpen,
      setEditorEntry,
      openPreviewInOppositePane,
      openEditorInOppositePane,
      isTextEditable,
      dialog,
      setDialog,
      contextMenu,
      setContextMenu,
      helpOpen,
      setHelpOpen,
      setPathFocusToken,
      setRecursiveSearchFocusToken,
      isPreviewable,
      handleCopyOrMove,
      handleCreateFolder,
      handleDelete,
      handleProperties,
      setOperationError,
    ],
  );

  const menuBarProps = useMenuBarProps({
    state,
    dispatch,
    locations,
    clipboard,
    preferences,
    navigatePanel,
    handleRename,
    setDiagnosticsOpen,
    onRequestExit,
    runCommand: handleCommandSelect,
    statusBarVisible,
    toolbarVisible,
    recentLocations: [...recentToday, ...recentWeek],
    starredLocations: starred,
    onCustomizeToolbar: () => handleCommandSelect("app.customizeToolbar"),
  });

  function makeFilePanelProps(pid: "left" | "right") {
    return buildFilePanelProps(pid, {
      state,
      locations,
      networkProfiles,
      networkStatuses,
      networkQuickEntries,
      favorites,
      starred,
      recentEntries: [...recentToday, ...recentWeek],
      clipboard,
      pathFocusToken,
      renameFocusToken,
      filterFocusToken,
      recursiveSearchFocusToken,
      rowHeight,
      search,
      preferences,
      dispatch,
      navigatePanel,
      openProfileTerminalTab,
      handleCommandSelect,
      revealEntry,
      activateEntry,
      runRecursiveSearch,
      setContextMenu,
      setDialog,
      submitInlineRename,
    });
  }

  return (
    <>
      <ShellLayout
        workspaceRef={workspaceRef}
        handleShellKeyDown={handleShellKeyDown}
        makeFilePanelProps={makeFilePanelProps}
        menuBarProps={menuBarProps}
        windowControls={{
          onClose: onRequestExit,
          onMinimize: onRequestMinimize,
          onToggleMaximize: onRequestToggleMaximize,
        }}
        state={state}
        activeTabUri={activeTab(state.panels[state.activePanelId]).uri}
        leftPanelUri={activeTab(state.panels.left).uri}
        rightPanelUri={activeTab(state.panels.right).uri}
        locations={locations}
        favorites={favorites}
        recentToday={recentToday}
        recentWeek={recentWeek}
        starred={starred}
        networkProfiles={networkProfiles}
        networkStatuses={networkStatuses}
        networkQuickEntries={networkQuickEntries}
        preferences={preferences}
        updatePreference={updatePreference}
        pickLocalPath={pickLocalPath}
        settingsPreferenceChange={handleSettingsPreferenceChange}
        closePaneTerminalConfirmOpen={closePaneTerminalConfirmOpen}
        setClosePaneTerminalConfirmOpen={setClosePaneTerminalConfirmOpen}
        onConfirmClosePaneWithTerminal={confirmClosePaneWithTerminal}
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
        onCancelJob={cancelActiveJob}
        settingsOpen={settingsOpen}
        shortcutsOpen={shortcutsOpen}
        commandPaletteOpen={commandPaletteOpen}
        previewOpen={previewOpen}
        viewerOpen={viewerOpen}
        viewerEntry={viewerEntry}
        editorOpen={editorOpen}
        editorEntry={editorEntry}
        diagnosticsOpen={diagnosticsOpen}
        helpOpen={helpOpen}
        aboutOpen={aboutOpen}
        goToLocationOpen={goToLocationOpen}
        manageFavoritesOpen={manageFavoritesOpen}
        recentLocationsOpen={recentLocationsOpen}
        clearRecentLocationsOpen={clearRecentLocationsOpen}
        errorDetailsOpen={errorDetailsOpen}
        operationHistoryOpen={operationHistoryOpen}
        volumePickerOpen={volumePickerOpen}
        connectServerOpen={connectServerOpen}
        connectServerProfile={connectServerProfile}
        connectServerInitial={connectServerInitial}
        removeServerProfile={removeServerProfile}
        busyProfileIds={busyProfileIds}
        toolbarCustomizeOpen={toolbarCustomizeOpen}
        setToolbarCustomizeOpen={setToolbarCustomizeOpen}
        setGoToLocationOpen={setGoToLocationOpen}
        setManageFavoritesOpen={setManageFavoritesOpen}
        setRecentLocationsOpen={setRecentLocationsOpen}
        setClearRecentLocationsOpen={setClearRecentLocationsOpen}
        setErrorDetailsOpen={setErrorDetailsOpen}
        setOperationHistoryOpen={setOperationHistoryOpen}
        setVolumePickerOpen={setVolumePickerOpen}
        setConnectServerOpen={setConnectServerOpen}
        setConnectServerProfile={setConnectServerProfile}
        setConnectServerInitial={setConnectServerInitial}
        setRemoveServerProfile={setRemoveServerProfile}
        connectProfile={connectProfile}
        disconnectProfile={disconnectProfile}
        deleteProfile={deleteProfile}
        saveProfile={saveProfile}
        forgetFingerprint={forgetFingerprint}
        testConnection={testConnection}
        testConnectionDraft={testConnectionDraft}
        refreshNetworkProfiles={refreshNetworkProfiles}
        refreshNetworkQuickEntries={refreshNetworkQuickEntries}
        openProfileTerminalTab={openProfileTerminalTab}
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
        multiRenameOpen={multiRenameOpen}
        setSettingsOpen={setSettingsOpen}
        setShortcutsOpen={setShortcutsOpen}
        setCommandPaletteOpen={setCommandPaletteOpen}
        setPreviewOpen={setPreviewOpen}
        setViewerOpen={setViewerOpen}
        setViewerEntry={setViewerEntry}
        setEditorOpen={setEditorOpen}
        setEditorEntry={setEditorEntry}
        diffOpen={diffOpen}
        diffLeftUri={diffLeftUri}
        diffRightUri={diffRightUri}
        diffLeftName={diffLeftName}
        diffRightName={diffRightName}
        setDiffOpen={setDiffOpen}
        setDiffLeftUri={setDiffLeftUri}
        setDiffRightUri={setDiffRightUri}
        setDiffLeftName={setDiffLeftName}
        setDiffRightName={setDiffRightName}
        setMultiRenameOpen={setMultiRenameOpen}
        syncDirectoriesOpen={syncDirectoriesOpen}
        setSyncDirectoriesOpen={setSyncDirectoriesOpen}
        hotlistOpen={hotlistOpen}
        setHotlistOpen={setHotlistOpen}
        manageHotlistOpen={manageHotlistOpen}
        setManageHotlistOpen={setManageHotlistOpen}
        isTextEditable={isTextEditable}
        refreshActivePane={() => refreshPanel(state.activePanelId)}
        setDiagnosticsOpen={setDiagnosticsOpen}
        setHelpOpen={setHelpOpen}
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
        calculateSelectionSize={calculateSelectionSize}
        revealEntry={revealEntry}
        handleSetAutostart={handleSetAutostart}
        handleCommandSelect={handleCommandSelect}
        toasts={toasts}
        notifications={notifications}
        notificationCenterOpen={notificationCenterOpen}
        setToasts={setToasts}
        setNotifications={setNotifications}
        setNotificationCenterOpen={setNotificationCenterOpen}
        contextMenu={contextMenu}
        setContextMenu={setContextMenu}
        clipboard={clipboard}
        starredUriSet={starredUriSet}
        dispatch={dispatch}
        activateEntry={activateEntry}
        openPreviewInOppositePane={openPreviewInOppositePane}
        openEditorInOppositePane={openEditorInOppositePane}
        handleRename={handleRename}
        triggerInlineRename={triggerInlineRename}
        copySelectionToFileClipboard={copySelectionToFileClipboard}
        pasteClipboard={pasteClipboard}
        handleTrash={handleTrash}
        handleDelete={handleDelete}
        toggleStarredForEntry={toggleStarredForEntry}
        handlePermanentDelete={handlePermanentDelete}
        handleProperties={handleProperties}
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
        refreshNavigation={refreshNavigation}
        setOperationError={setOperationError}
        runRecursiveSearch={runRecursiveSearch}
        applySplitRatioFn={applySplitRatio}
      />
      <TerminalCommandDialog
        open={terminalCommandRequest !== null}
        title={terminalCommandRequest?.title ?? "Run Command in Terminal"}
        submitLabel={terminalCommandRequest?.submitLabel ?? "Run"}
        onClose={() => setTerminalCommandRequest(null)}
        onSubmit={(command) => terminalCommandRequest?.onSubmit(command)}
      />
    </>
  );
}

export interface FileOctopusShellProps {
  onRequestExit?: () => void;
  onRequestMinimize?: () => void;
  onRequestToggleMaximize?: () => void;
  pickLocalPath?: LocalPathPicker;
}

export function FileOctopusApp({
  onRequestExit,
  onRequestMinimize,
  onRequestToggleMaximize,
  pickLocalPath,
}: FileOctopusShellProps = {}) {
  return (
    <AppProviders>
      <FileOctopusAppInner
        onRequestExit={onRequestExit}
        onRequestMinimize={onRequestMinimize}
        onRequestToggleMaximize={onRequestToggleMaximize}
        pickLocalPath={pickLocalPath}
      />
      <DebugConsolePanel />
    </AppProviders>
  );
}

export { FileOctopusApp as FileOctopusShell };
