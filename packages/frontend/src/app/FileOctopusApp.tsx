import { useCallback, useEffect, useMemo, useRef } from "react";
import { activeTab, type SortField } from "../panelStore";
import { applySplitRatio, applyThemePreference } from "../applyPreferences";
import { useWorkspaceLayout } from "../hooks/useWorkspaceLayout";
import { useMenuBarProps } from "../hooks/useMenuBarProps";
import { useEventHandlers } from "../hooks/useEventHandlers";
import { useAppInit } from "../hooks/useAppInit";
import { createKeyboardShortcutsHandler } from "../hooks/useKeyboardShortcuts";
import { useFileOpHandlers } from "../hooks/useFileOpHandlers";
import { useNetworkHandlers } from "../hooks/useNetworkHandlers";
import { useCommandDispatch } from "../hooks/useCommandDispatch";
import type { CommandEntry } from "../components/CommandPalette";
import { isPreviewable, isTextPreviewable } from "../components/PreviewPanel";
import type { FilePanelProps } from "../pane/FilePanel";
import { ShellLayout } from "../shell/ShellLayout";
import { buildPaletteEntries } from "../commands/paletteEntries";
import { buildPaneLocationTargets } from "../navigation/driveTargets";
import type { FileEntryDto } from "@fileoctopus/ts-api";
import { isRemoteUri, profileIdFromRemoteUri } from "@fileoctopus/ts-api";

import { hasRunningPaneSessions } from "../terminal/terminalSlice";
import { DebugConsolePanel } from "../dev/DebugConsolePanel";
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

function FileOctopusAppInner({
  onRequestExit,
  onRequestMinimize,
  onRequestToggleMaximize,
}: {
  onRequestExit?: () => void;
  onRequestMinimize?: () => void;
  onRequestToggleMaximize?: () => void;
}) {
  const { client, state, dispatch, workspaceRef, hasInitializedRef } =
    useShell();
  const { preferences, density, setPreferences, setDensity } = usePreferences();
  const {
    locations,
    favorites,
    recentToday,
    recentWeek,
    starred,
    networkProfiles,
    networkStatuses,
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
    setAppInfo,
    setAppHealth,
    setAutostart,
  } = useNavigationData();
  const {
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
  } = useWorkspace();

  const {
    terminal,
    openEmbeddedTerminal,
    openExternalTerminal,
    openProfileTerminalTab,
    setRailSegment,
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
    networkLocationsOpen,
    connectServerOpen,
    connectServerProfile,
    connectServerInitial,
    removeServerProfile,
    setRemoveServerProfile,
    setVolumePickerOpen,
    setNetworkLocationsOpen,
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
    refreshNetworkProfiles,
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
    setNetworkProfiles,
    setNetworkStatuses,
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

  const pendingPaneModeRef = useRef<"single" | "dual" | null>(null);

  const requestPaneModeChange = useCallback(
    (next: "single" | "dual") => {
      if (
        next === "single" &&
        preferences?.confirmClosePaneWithTerminal !== false &&
        hasRunningPaneSessions(terminal.sessions, "right")
      ) {
        pendingPaneModeRef.current = next;
        setClosePaneTerminalConfirmOpen(true);
        return;
      }
      void updatePreference("paneMode", next);
    },
    [
      preferences?.confirmClosePaneWithTerminal,
      setClosePaneTerminalConfirmOpen,
      terminal.sessions,
      updatePreference,
    ],
  );

  const handleSettingsPreferenceChange = useCallback(
    (key: string, value: string) => {
      if (key === "paneMode") {
        requestPaneModeChange(value as "single" | "dual");
        return;
      }
      void updatePreference(key, value);
    },
    [requestPaneModeChange, updatePreference],
  );

  const confirmClosePaneWithTerminal = useCallback(() => {
    const next = pendingPaneModeRef.current;
    pendingPaneModeRef.current = null;
    if (next) {
      void updatePreference("paneMode", next);
    }
  }, [updatePreference]);

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
    refreshVisiblePanels,
    refreshHistory,
    refreshLocations,
    refreshNetworkProfiles,
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

  const statusBarVisible = preferences?.statusBarVisible !== false;
  const toolbarVisible = preferences?.toolbarVisible !== false;

  const {
    connectProfile,
    disconnectProfile,
    deleteProfile,
    saveProfile,
    forgetFingerprint,
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
    setAboutOpen,
    setGoToLocationOpen,
    setManageFavoritesOpen,
    setRecentLocationsOpen,
    setClearRecentLocationsOpen,
    setOperationHistoryOpen,
    setVolumePickerOpen,
    setNetworkLocationsOpen,
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
    isPreviewable,
    isTextEditable,
    activityCollapsed,
    setActivityCollapsed,
    markActivityPinnedOpen,
    handleCreateFolder,
    handleCreateFile,
    startInlineRename: triggerInlineRename,
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
      const uri = activeTab(state.panels[panelId]).uri;
      void openEmbeddedTerminal(uri, panelId).catch((error: unknown) => {
        pushToast({
          tone: "error",
          title:
            error instanceof Error ? error.message : "Failed to open terminal",
        });
      });
    },
    togglePaneTerminal: (panelId) => {
      const uri = activeTab(state.panels[panelId]).uri;
      void togglePaneTerminal(uri, panelId).catch((error: unknown) => {
        pushToast({
          tone: "error",
          title:
            error instanceof Error ? error.message : "Failed to open terminal",
        });
      });
    },
    openTerminalExternal: (panelId) => {
      const uri = activeTab(state.panels[panelId]).uri;
      void openExternalTerminal(uri).catch(() => {
        pushToast({
          tone: "error",
          title: "Failed to open external terminal",
        });
      });
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
        handleTrash,
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
      handleTrash,
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

  function makeFilePanelProps(pid: "left" | "right"): FilePanelProps {
    const tab = activeTab(state.panels[pid]);
    const locationTargets = buildPaneLocationTargets({
      locations,
      networkProfiles,
      networkStatuses,
      favorites,
      starred,
      recentEntries: [...recentToday, ...recentWeek],
    });
    const runPanel = (
      commandId: string,
      context?: import("../commands/invokeContext").CommandInvokeArg,
    ) => handleCommandSelect(commandId, pid, context);

    return {
      panelId: pid,
      title: pid === "left" ? "Left" : "Right",
      tab,
      active: state.activePanelId === pid,
      onActivate: () => dispatch({ type: "setActivePanel", panelId: pid }),
      onNavigate: (uri) => navigatePanel(pid, uri),
      locationTargets,
      onSelect: (entryId) =>
        dispatch({ type: "setSelection", panelId: pid, entryId }),
      onEntrySelect: (entryId, mode) =>
        dispatch({ type: "selectEntry", panelId: pid, entryId, mode }),
      onCreateFolder: () => runPanel("create.folder"),
      onCreateFile: () => runPanel("create.file"),
      onPaste: () => runPanel("op.paste"),
      onProperties: (entry) => handleCommandSelect("op.properties", pid, entry),
      onReveal: (entry) => void revealEntry(pid, entry),
      onRefresh: () => runPanel("nav.refresh"),
      onMove: (delta) =>
        dispatch({ type: "moveSelection", panelId: pid, delta }),
      onSort: (field) => runPanel("view.sort", { sortField: field }),
      onFilter: (filter) =>
        dispatch({ type: "setFilter", panelId: pid, filter }),
      onRecursiveQuery: (query) =>
        dispatch({ type: "setRecursiveQuery", panelId: pid, query }),
      onRecursiveSearch: () => void runRecursiveSearch(pid),
      canPaste: Boolean(clipboard),
      onEntryActivate: (entry) => activateEntry(pid, entry),
      pathFocusToken,
      renameFocusToken,
      filterFocusToken,
      recursiveSearchFocusToken,
      rowHeight,
      search: search?.panelId === pid ? search : null,
      onContextMenu: setContextMenu,
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
      onDropFiles: (sourceUris, sourcePanelId, destinationUri, kind) => {
        if (!sourcePanelId) return;
        const sourceTab = activeTab(state.panels[sourcePanelId]);
        const entries = sourceUris
          .map((uri) => sourceTab.entriesById[uri])
          .filter(Boolean) as FileEntryDto[];
        if (entries.length === 0) return;
        const advancedOptions = preferences?.showAdvancedCopyOptions === true;
        setDialog({
          type: "copyMove",
          panelId: sourcePanelId,
          kind,
          entries,
          destination: destinationUri,
          conflictPolicy: "fail",
          advancedOptions,
          planningEnabled: false,
          plan: null,
          planning: false,
          step: "review",
          error: null,
        });
      },
      onEditNetworkCredentials: isRemoteUri(tab.uri)
        ? () => {
            const profileId = profileIdFromRemoteUri(tab.uri);
            const profile = networkProfiles.find(
              (item) => item.id === profileId,
            );
            if (profile) {
              handleCommandSelect("nav.connectServer", pid, {
                networkProfile: profile,
              });
            }
          }
        : undefined,
      panel: state.panels[pid],
      onSwitchTab: (panelId, tabId) =>
        dispatch({ type: "switchTab", panelId, tabId }),
      onCloseTab: (panelId, tabId) =>
        dispatch({ type: "closeTab", panelId, tabId }),
      onOpenTab: (panelId) =>
        dispatch({
          type: "openTab",
          panelId,
          uri: activeTab(state.panels[panelId]).uri,
        }),
      onOpenTerminal: () => {
        dispatch({ type: "setActivePanel", panelId: pid });
        handleCommandSelect("op.openTerminal", pid);
      },
      terminalDisabled: false,
      fileTypeColorRules: preferences?.fileTypeColorRules,
    };
  }

  return (
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
      locations={locations}
      favorites={favorites}
      recentToday={recentToday}
      recentWeek={recentWeek}
      starred={starred}
      networkProfiles={networkProfiles}
      networkStatuses={networkStatuses}
      preferences={preferences}
      updatePreference={updatePreference}
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
      settingsOpen={settingsOpen}
      shortcutsOpen={shortcutsOpen}
      commandPaletteOpen={commandPaletteOpen}
      previewOpen={previewOpen}
      viewerOpen={viewerOpen}
      viewerEntry={viewerEntry}
      editorOpen={editorOpen}
      editorEntry={editorEntry}
      diagnosticsOpen={diagnosticsOpen}
      aboutOpen={aboutOpen}
      goToLocationOpen={goToLocationOpen}
      manageFavoritesOpen={manageFavoritesOpen}
      recentLocationsOpen={recentLocationsOpen}
      clearRecentLocationsOpen={clearRecentLocationsOpen}
      errorDetailsOpen={errorDetailsOpen}
      operationHistoryOpen={operationHistoryOpen}
      volumePickerOpen={volumePickerOpen}
      networkLocationsOpen={networkLocationsOpen}
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
      setNetworkLocationsOpen={setNetworkLocationsOpen}
      setConnectServerOpen={setConnectServerOpen}
      setConnectServerProfile={setConnectServerProfile}
      setConnectServerInitial={setConnectServerInitial}
      setRemoveServerProfile={setRemoveServerProfile}
      connectProfile={connectProfile}
      disconnectProfile={disconnectProfile}
      deleteProfile={deleteProfile}
      saveProfile={saveProfile}
      forgetFingerprint={forgetFingerprint}
      refreshNetworkProfiles={refreshNetworkProfiles}
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
      isTextEditable={isTextEditable}
      refreshActivePane={() => refreshPanel(state.activePanelId)}
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
      calculateSelectionSize={calculateSelectionSize}
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
  );
}

export interface FileOctopusShellProps {
  onRequestExit?: () => void;
  onRequestMinimize?: () => void;
  onRequestToggleMaximize?: () => void;
}

export function FileOctopusApp({
  onRequestExit,
  onRequestMinimize,
  onRequestToggleMaximize,
}: FileOctopusShellProps = {}) {
  return (
    <AppProviders>
      <FileOctopusAppInner
        onRequestExit={onRequestExit}
        onRequestMinimize={onRequestMinimize}
        onRequestToggleMaximize={onRequestToggleMaximize}
      />
      <DebugConsolePanel />
    </AppProviders>
  );
}

export { FileOctopusApp as FileOctopusShell };
