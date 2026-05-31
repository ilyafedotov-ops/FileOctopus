import type {
  FavoriteEntryDto,
  FileEntryDto,
  NetworkConnectionStatusDto,
  NetworkProfileDto,
  RecentEntryDto,
  StandardLocationDto,
  StarredEntryDto,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
import { isRemoteUri, profileIdFromRemoteUri } from "@fileoctopus/ts-api";
import type { Dispatch } from "react";
import {
  activeTab,
  type FileOctopusState,
  type PanelAction,
  type PanelId,
} from "../panelStore";
import type { FilePanelProps } from "../pane/FilePanel";
import type { SearchState } from "../pane/PaneFilterBar";
import { buildPaneLocationTargets } from "../navigation/driveTargets";
import type { ContextMenuState } from "../components/ContextMenu";
import type { OperationDialog } from "../dialogs/OperationDialogView";
import type { CommandInvokeArg } from "../commands/invokeContext";

export interface FilePanelPropsBuilderArgs {
  state: FileOctopusState;
  locations: StandardLocationDto[];
  networkProfiles: NetworkProfileDto[];
  networkStatuses: NetworkConnectionStatusDto[];
  favorites: FavoriteEntryDto[];
  starred: StarredEntryDto[];
  recentEntries: RecentEntryDto[];
  clipboard: unknown;
  pathFocusToken: number;
  renameFocusToken: number;
  filterFocusToken: number;
  recursiveSearchFocusToken: number;
  rowHeight: number;
  search: SearchState | null;
  preferences: UserPreferencesDto | null;
  dispatch: Dispatch<PanelAction>;
  navigatePanel: (panelId: PanelId, uri: string) => void;
  handleCommandSelect: (
    commandId: string,
    panelId?: PanelId,
    context?: CommandInvokeArg,
  ) => void;
  revealEntry: (panelId: PanelId, entry: FileEntryDto | null) => void;
  activateEntry: (panelId: PanelId, entry: FileEntryDto | null) => void;
  runRecursiveSearch: (panelId: PanelId) => void;
  setContextMenu: (menu: ContextMenuState | null) => void;
  setDialog: (dialog: OperationDialog | null) => void;
  submitInlineRename: (
    panelId: PanelId,
    entry: FileEntryDto,
    newName: string,
  ) => unknown;
}

export function buildFilePanelProps(
  panelId: PanelId,
  args: FilePanelPropsBuilderArgs,
): FilePanelProps {
  const {
    state,
    locations,
    networkProfiles,
    networkStatuses,
    favorites,
    starred,
    recentEntries,
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
    handleCommandSelect,
    revealEntry,
    activateEntry,
    runRecursiveSearch,
    setContextMenu,
    setDialog,
    submitInlineRename,
  } = args;
  const tab = activeTab(state.panels[panelId]);
  const locationTargets = buildPaneLocationTargets({
    locations,
    networkProfiles,
    networkStatuses,
    favorites,
    starred,
    recentEntries,
  });
  const runPanel = (commandId: string, context?: CommandInvokeArg) =>
    handleCommandSelect(commandId, panelId, context);

  return {
    panelId,
    title: panelId === "left" ? "Left" : "Right",
    tab,
    active: state.activePanelId === panelId,
    onActivate: () => dispatch({ type: "setActivePanel", panelId }),
    onNavigate: (uri) => navigatePanel(panelId, uri),
    locationTargets,
    onSelect: (entryId) => dispatch({ type: "setSelection", panelId, entryId }),
    onEntrySelect: (entryId, mode) =>
      dispatch({ type: "selectEntry", panelId, entryId, mode }),
    onCreateFolder: () => runPanel("create.folder"),
    onCreateFile: () => runPanel("create.file"),
    onPaste: () => runPanel("op.paste"),
    onProperties: (entry) =>
      handleCommandSelect("op.properties", panelId, entry),
    onReveal: (entry) => revealEntry(panelId, entry),
    onRefresh: () => runPanel("nav.refresh"),
    onMove: (delta) => dispatch({ type: "moveSelection", panelId, delta }),
    onSort: (field) => runPanel("view.sort", { sortField: field }),
    onFilter: (filter) => dispatch({ type: "setFilter", panelId, filter }),
    onRecursiveQuery: (query) =>
      dispatch({ type: "setRecursiveQuery", panelId, query }),
    onRecursiveSearch: () => runRecursiveSearch(panelId),
    canPaste: Boolean(clipboard),
    onEntryActivate: (entry) => activateEntry(panelId, entry),
    pathFocusToken,
    renameFocusToken,
    filterFocusToken,
    recursiveSearchFocusToken,
    rowHeight,
    search: search?.panelId === panelId ? search : null,
    onContextMenu: setContextMenu,
    onBreadcrumbContextMenu: (path, event) => {
      event.preventDefault();
      setContextMenu({
        panelId,
        x: event.clientX,
        y: event.clientY,
        entry: null,
        breadcrumbPath: path,
      });
    },
    onSubmitInlineRename: (entryUri, newName) => {
      const entry = tab.entriesById[entryUri];
      if (entry) {
        void submitInlineRename(panelId, entry, newName);
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
          const profile = networkProfiles.find((item) => item.id === profileId);
          if (profile) {
            handleCommandSelect("nav.connectServer", panelId, {
              networkProfile: profile,
            });
          }
        }
      : undefined,
    panel: state.panels[panelId],
    onSwitchTab: (nextPanelId, tabId) =>
      dispatch({ type: "switchTab", panelId: nextPanelId, tabId }),
    onCloseTab: (nextPanelId, tabId) =>
      dispatch({ type: "closeTab", panelId: nextPanelId, tabId }),
    onOpenTab: (nextPanelId) =>
      dispatch({
        type: "openTab",
        panelId: nextPanelId,
        uri: activeTab(state.panels[nextPanelId]).uri,
      }),
    onOpenTerminal: () => {
      dispatch({ type: "setActivePanel", panelId });
      handleCommandSelect("op.openTerminal", panelId);
    },
    terminalDisabled: false,
    fileTypeColorRules: preferences?.fileTypeColorRules,
  };
}
