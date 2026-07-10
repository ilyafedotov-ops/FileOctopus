import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShell } from "../app/providers/ShellProvider";
import { useTerminal } from "../app/providers/TerminalProvider";
import { useTags } from "../app/TagContext";
import {
  countOperationalSelection,
  countVisibleEntries,
  parentUri,
  selectDisplayedEntries,
  homeUri,
  type PanelId,
  type SortField,
  type PanelTabState,
  type PanelState,
} from "../panelStore";
import { cx } from "@fileoctopus/ui";
import {
  type SearchState,
  FilterInput,
  RecursiveSearchInput,
} from "./PaneFilterBar";
import { FileTable } from "./FileTable";
import { ColumnsView } from "./ColumnsView";
import { RecursiveSearchPanel } from "./PaneFilterBar";
import { ContentSearchInput, ContentSearchPanel } from "./ContentSearchPanel";
import { PaneStateView } from "../components/PaneStateView";
import { PaneHeader } from "./PaneHeader";
import { PaneTerminalSplit } from "./PaneTerminalSplit";
import { TabBar } from "./TabBar";
import {
  readDraggedUri,
  readDropData,
  useFileOctopusDragTarget,
} from "../hooks/useFileOctopusDragTarget";
import { localPathFromUri } from "../utils/paneUtils";
import { fileIconGlyph } from "./fileTableUtils";
import {
  storedColumnWidths,
  persistColumnWidths,
  storedVisibleColumns,
  persistVisibleColumns,
  reorderVisibleColumns,
  type ColumnWidths,
  type ColumnId,
  type VisibleColumns,
} from "./columnWidths";
import type { FileEntryDto, NetworkProfileDto } from "@fileoctopus/ts-api";
import { paneDirectoryCanWrite } from "../navigation/fileMutationState";
import type { PaneLocationTarget } from "../navigation/driveTargets";
import type { ContextMenuState } from "../components/ContextMenu";
import { usePaneGitStatus } from "./usePaneGitStatus";
import { ViewerContent } from "../components/viewer/ViewerDialog";
import {
  detectViewerMode,
  type ViewerMode,
} from "../components/viewer/detectViewerMode";
import { EditorContent } from "../components/editor/EditorDialog";
import { GitReviewTab } from "../components/git/GitReviewTab";

export type CopyMoveKind = "copy" | "move";

export interface FilePanelProps {
  panelId: PanelId;
  title: string;
  tab: PanelTabState;
  active: boolean;
  onActivate: () => void;
  onNavigate: (uri: string) => void;
  onOpenProfileTerminal?: (profile: NetworkProfileDto) => void;
  onAddServer?: () => void;
  locationTargets: PaneLocationTarget[];
  onSelect: (entryId: string | null) => void;
  onSelectionMany?: (entryIds: string[]) => void;
  onEntrySelect: (entryId: string, mode: "single" | "toggle" | "range") => void;
  onMove: (delta: number) => void;
  onSort: (field: SortField) => void;
  onFilter: (filter: string) => void;
  onRecursiveQuery: (query: string) => void;
  onRecursiveSearch: () => void;
  onContentSearchQuery: (query: string) => void;
  onContentSearch: () => void;
  onCancelContentSearch: () => void;
  onEntryActivate: (entry: FileEntryDto | null) => void;
  onCreateFolder: () => void;
  onCreateFile: () => void;
  onPaste: () => void;
  onProperties: (entry: FileEntryDto | null) => void;
  onReveal: (entry: FileEntryDto | null) => void;
  onRefresh: () => void;
  onReplaceContentTabEntry: (tabId: string, entry: FileEntryDto) => void;
  canPaste: boolean;
  pathFocusToken: number;
  renameFocusToken: number;
  filterFocusToken: number;
  recursiveSearchFocusToken: number;
  rowHeight: number;
  search: SearchState | null;
  onContextMenu: (menu: ContextMenuState | null) => void;
  onBreadcrumbContextMenu?: (path: string, event: React.MouseEvent) => void;
  onSubmitInlineRename?: (entryUri: string, newName: string) => void;
  onDropFiles?: (
    sourceUris: string[],
    sourcePanelId: PanelId | null,
    destinationUri: string,
    kind: CopyMoveKind,
  ) => void;
  onEditNetworkCredentials?: () => void;
  panel: PanelState;
  onSwitchTab: (panelId: PanelId, tabId: string) => void;
  onCloseTab: (panelId: PanelId, tabId: string) => void;
  onOpenTab: (panelId: PanelId) => void;
  onOpenTerminal?: () => void;
  onOpenGitReview?: () => void;
  terminalDisabled?: boolean;
  fileTypeColorRules?: string;
}

export function FilePanel({
  panelId,
  title,
  tab,
  active,
  onActivate,
  onNavigate,
  onOpenProfileTerminal,
  onAddServer,
  locationTargets,
  onSelect,
  onSelectionMany,
  onEntrySelect,
  onMove,
  onSort,
  onFilter,
  onRecursiveQuery,
  onRecursiveSearch,
  onContentSearchQuery,
  onContentSearch,
  onCancelContentSearch,
  onEntryActivate,
  onCreateFolder,
  onCreateFile,
  onPaste,
  onReveal,
  onProperties,
  onReplaceContentTabEntry,
  canPaste,
  pathFocusToken,
  renameFocusToken,
  filterFocusToken,
  recursiveSearchFocusToken,
  rowHeight,
  search,
  onContextMenu,
  onBreadcrumbContextMenu,
  onSubmitInlineRename,
  onRefresh,
  onDropFiles,
  onEditNetworkCredentials,
  panel,
  onSwitchTab,
  onCloseTab,
  onOpenTab,
  onOpenTerminal,
  onOpenGitReview,
  terminalDisabled,
  fileTypeColorRules,
}: FilePanelProps) {
  const { client } = useShell();
  const {
    terminal,
    setPaneTerminalSplit,
    setPaneActiveSession,
    openAdditionalPaneTab,
  } = useTerminal();
  const { tagColorsForEntry } = useTags();
  const paneChrome = terminal.pane[panelId];
  const paneHasSessions = terminal.sessions.some(
    (session) => session.paneId === panelId,
  );

  const displayedEntries = selectDisplayedEntries(tab);
  const itemCount = countVisibleEntries(tab);
  const selectedCount = countOperationalSelection(tab);
  const gitStatus = usePaneGitStatus(client, tab.uri);

  const tagMap = useMemo(() => {
    const map: Record<string, import("../utils/tagStore").TagColor[]> = {};
    for (const entry of displayedEntries) {
      const colors = tagColorsForEntry(entry.uri);
      if (colors.length > 0) {
        map[entry.uri] = colors;
      }
    }
    return map;
  }, [displayedEntries, tagColorsForEntry]);

  const selectedEntry =
    displayedEntries.find((entry) => entry.uri === tab.selectedId) ?? null;
  const [inlineRenameUri, setInlineRenameUri] = useState<string | null>(null);
  const lastRenameFocusTokenRef = useRef(renameFocusToken);
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(() =>
    storedColumnWidths(panelId),
  );
  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>(() =>
    storedVisibleColumns(panelId),
  );

  const handleColumnReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      setVisibleColumns((prev) => {
        const next = reorderVisibleColumns(prev, fromIndex, toIndex);
        persistVisibleColumns(next, panelId);
        return next;
      });
    },
    [panelId],
  );

  const handleToggleColumn = useCallback(
    (columnId: ColumnId) => {
      if (columnId === "name") return;
      setVisibleColumns((prev) => {
        const next =
          prev.indexOf(columnId) !== -1
            ? (prev.filter((id) => id !== columnId) as VisibleColumns)
            : ([...prev, columnId] as VisibleColumns);
        persistVisibleColumns(next, panelId);
        return next;
      });
    },
    [panelId],
  );
  const { dragOver, reset, dragTargetProps } = useFileOctopusDragTarget();

  const handleColumnResize = useCallback(
    (columnId: ColumnId, newWidth: number) => {
      setColumnWidths((prev) => {
        const next = { ...prev, [columnId]: Math.max(30, newWidth) };
        persistColumnWidths(next, panelId);
        return next;
      });
    },
    [panelId],
  );

  useEffect(() => {
    if (renameFocusToken === lastRenameFocusTokenRef.current) {
      return;
    }
    lastRenameFocusTokenRef.current = renameFocusToken;
    if (renameFocusToken > 0 && active && tab.selectedIds.length === 1) {
      const uri = tab.selectedIds[0];
      if (uri && tab.entriesById[uri]) {
        setInlineRenameUri(uri);
      }
    }
  }, [renameFocusToken, active, tab.selectedIds, tab.entriesById]);

  if (tab.tabKind === "preview" && tab.previewEntry) {
    return (
      <section
        className={active ? "fo-panel fo-panel-active" : "fo-panel"}
        data-active={active ? "true" : "false"}
        aria-current={active ? "true" : undefined}
        onFocus={onActivate}
      >
        <TabBar
          panelId={panelId}
          panel={panel}
          onSwitchTab={onSwitchTab}
          onCloseTab={onCloseTab}
          onOpenTab={onOpenTab}
          onOpenTerminal={onOpenTerminal}
          terminalDisabled={terminalDisabled}
        />
        <PreviewTabContent
          entry={tab.previewEntry}
          client={client}
          onClose={() => onCloseTab(panelId, panel.activeTabId)}
          onEntryChange={(entry) =>
            onReplaceContentTabEntry(panel.activeTabId, entry)
          }
        />
      </section>
    );
  }

  if (tab.tabKind === "editor" && tab.editorEntry) {
    return (
      <section
        className={active ? "fo-panel fo-panel-active" : "fo-panel"}
        data-active={active ? "true" : "false"}
        aria-current={active ? "true" : undefined}
        onFocus={onActivate}
      >
        <TabBar
          panelId={panelId}
          panel={panel}
          onSwitchTab={onSwitchTab}
          onCloseTab={onCloseTab}
          onOpenTab={onOpenTab}
          onOpenTerminal={onOpenTerminal}
          terminalDisabled={terminalDisabled}
        />
        <div className="fo-pane-content-tab">
          <EditorContent
            entry={tab.editorEntry}
            fs={client.fs}
            onClose={() => onCloseTab(panelId, panel.activeTabId)}
            onEntryChange={(entry) =>
              onReplaceContentTabEntry(panel.activeTabId, entry)
            }
          />
        </div>
      </section>
    );
  }

  if (tab.tabKind === "gitReview" && tab.gitReview) {
    return (
      <section
        className={active ? "fo-panel fo-panel-active" : "fo-panel"}
        data-active={active ? "true" : "false"}
        aria-current={active ? "true" : undefined}
        onFocus={onActivate}
      >
        <TabBar
          panelId={panelId}
          panel={panel}
          onSwitchTab={onSwitchTab}
          onCloseTab={onCloseTab}
          onOpenTab={onOpenTab}
          onOpenTerminal={onOpenTerminal}
          terminalDisabled={terminalDisabled}
        />
        <div className="fo-pane-content-tab">
          <GitReviewTab
            repoRootUri={tab.gitReview.repoRootUri}
            sourceUri={tab.gitReview.sourceUri}
            repoLabel={tab.gitReview.repoLabel}
            refreshToken={tab.gitReview.refreshToken}
            git={client.git}
            fs={client.fs}
            onNavigate={onNavigate}
          />
        </div>
      </section>
    );
  }

  return (
    <section
      className={active ? "fo-panel fo-panel-active" : "fo-panel"}
      data-active={active ? "true" : "false"}
      aria-current={active ? "true" : undefined}
      onFocus={onActivate}
    >
      <TabBar
        panelId={panelId}
        panel={panel}
        onSwitchTab={onSwitchTab}
        onCloseTab={onCloseTab}
        onOpenTab={onOpenTab}
        onOpenTerminal={onOpenTerminal}
        terminalDisabled={terminalDisabled}
      />
      <PaneHeader
        uri={tab.uri}
        pathError={tab.error}
        pathFocusToken={active ? pathFocusToken : 0}
        onNavigate={onNavigate}
        onOpenProfileTerminal={onOpenProfileTerminal}
        onAddServer={onAddServer}
        onActivate={onActivate}
        locationTargets={locationTargets}
        onBreadcrumbContextMenu={onBreadcrumbContextMenu}
        gitBranch={gitStatus.repo?.branch ?? gitStatus.repo?.headShort ?? null}
        gitDirty={gitStatus.repo?.isDirty ?? false}
        onOpenGitReview={onOpenGitReview}
      />
      <div className="fo-panel-filter-row">
        <FilterInput
          panelId={panelId}
          active={active}
          value={tab.filter}
          focusToken={filterFocusToken}
          onChange={onFilter}
        />
        <RecursiveSearchInput
          panelId={panelId}
          active={active}
          value={tab.recursiveQuery}
          focusToken={recursiveSearchFocusToken}
          onChange={onRecursiveQuery}
          onSubmit={onRecursiveSearch}
        />
        <ContentSearchInput
          panelId={panelId}
          active={active}
          value={tab.contentSearchQuery}
          focusToken={0}
          onChange={onContentSearchQuery}
          onSubmit={onContentSearch}
        />
      </div>
      <div
        className={cx("fo-panel-body", dragOver && "fo-panel-body-drag-over")}
        {...dragTargetProps}
        onDrop={(event) => {
          const uri = readDraggedUri(event);
          if (!uri) {
            return;
          }
          event.preventDefault();
          reset();
          if (onDropFiles) {
            const dropData = readDropData(event);
            if (dropData) {
              const kind = dropData.dropEffect === "copy" ? "copy" : "move";
              onDropFiles(
                dropData.uris,
                dropData.sourcePanelId as PanelId | null,
                tab.uri,
                kind,
              );
              return;
            }
          }
          onNavigate(uri);
        }}
      >
        <div
          className="fo-panel-main"
          style={
            paneChrome.open && paneChrome.maximized
              ? { display: "none" }
              : paneChrome.open && !paneChrome.collapsed
                ? { flex: `${1 - paneChrome.splitRatio} 1 0` }
                : undefined
          }
        >
          {dragOver ? (
            <div className="fo-panel-drop-overlay" aria-live="polite">
              <div className="fo-panel-drop-icon" aria-hidden="true" />
              Drop here to move to {title.toLowerCase()} pane
              <span className="fo-panel-drop-path">
                {localPathFromUri(tab.uri)}
              </span>
            </div>
          ) : null}
          <PaneStateView
            loadState={
              tab.loadState === "empty" && parentUri(tab.uri)
                ? "loaded"
                : tab.loadState
            }
            uri={tab.uri}
            message={tab.error}
            errorCode={tab.errorCode}
            canPaste={canPaste}
            allowCreation={paneDirectoryCanWrite(tab)}
            onRetry={() => onNavigate(tab.uri)}
            onRefresh={onRefresh}
            onCreateFolder={onCreateFolder}
            onCreateFile={onCreateFile}
            onPaste={onPaste}
            onEditCredentials={onEditNetworkCredentials}
          />
          {tab.viewMode === "columns" ? (
            <ColumnsView
              client={client}
              rootUri={homeUri()}
              activeUri={tab.uri}
              showHidden={tab.showHidden}
              onNavigate={onNavigate}
              onOpen={onEntryActivate}
              fileIcon={fileIconGlyph}
            />
          ) : (
            <FileTable
              entries={displayedEntries}
              currentUri={tab.uri}
              loadState={tab.loadState}
              rowHeight={rowHeight}
              selectedId={tab.selectedId}
              selectedIds={tab.selectedIds}
              focusedId={tab.focusedId}
              gitStatuses={gitStatus.entries}
              sortField={tab.sort.field}
              sortDirection={tab.sort.direction}
              viewMode={tab.viewMode}
              filterQuery={tab.filter}
              inlineRenameUri={inlineRenameUri}
              panelId={panelId}
              columnWidths={columnWidths}
              visibleColumns={visibleColumns}
              fileTypeColorRules={fileTypeColorRules}
              onToggleColumn={handleToggleColumn}
              onColumnResize={handleColumnResize}
              onColumnReorder={handleColumnReorder}
              onCancelInlineRename={() => setInlineRenameUri(null)}
              onSubmitInlineRename={(entryUri, newName) => {
                const entry = tab.entriesById[entryUri];
                if (entry && onSubmitInlineRename) {
                  onSubmitInlineRename(entryUri, newName);
                }
                setInlineRenameUri(null);
              }}
              onCreateFolder={onCreateFolder}
              onCreateFile={onCreateFile}
              onSelect={onSelect}
              onSelectionMany={onSelectionMany}
              onEntrySelect={onEntrySelect}
              onMove={onMove}
              onSort={onSort}
              onActivate={() => onEntryActivate(selectedEntry)}
              onEntryActivate={onEntryActivate}
              onContextMenu={(event, entry) => {
                event.preventDefault();
                onActivate();
                if (entry && !tab.selectedIds.includes(entry.uri)) {
                  onSelect(entry.uri);
                }
                onContextMenu({
                  panelId,
                  x: event.clientX,
                  y: event.clientY,
                  entry,
                });
              }}
              tagMap={tagMap}
            />
          )}
          <RecursiveSearchPanel
            panelId={panelId}
            search={search}
            onOpen={(entry) => onEntryActivate(entry)}
            onReveal={onReveal}
            onProperties={onProperties}
          />
          <ContentSearchPanel
            panelId={panelId}
            search={tab.contentSearch}
            onOpen={(entry) => onEntryActivate(entry)}
            onReveal={onReveal}
            onCancel={onCancelContentSearch}
          />
          <footer className="fo-pane-status">
            {selectedCount} selected - {itemCount} items
          </footer>
        </div>
        {paneChrome.open && paneHasSessions ? (
          <PaneTerminalSplit
            client={client}
            panelId={panelId}
            sessions={terminal.sessions}
            activeSessionId={paneChrome.sessionId ?? terminal.activeSessionId}
            splitRatio={paneChrome.splitRatio}
            collapsed={paneChrome.collapsed}
            maximized={paneChrome.maximized}
            panelActive={active}
            onResize={(ratio) => setPaneTerminalSplit(panelId, ratio)}
            onSwitch={(sessionId) => setPaneActiveSession(panelId, sessionId)}
            onNewSession={() => {
              void openAdditionalPaneTab(panelId, tab.uri).catch(
                () => undefined,
              );
            }}
          />
        ) : null}
      </div>
    </section>
  );
}

function PreviewTabContent({
  entry,
  client,
  onClose,
  onEntryChange,
}: {
  entry: FileEntryDto;
  client: ReturnType<typeof useShell>["client"];
  onClose: () => void;
  onEntryChange: (entry: FileEntryDto) => void;
}) {
  const initialMode = useMemo(() => detectViewerMode(entry), [entry]);
  const [mode, setMode] = useState<ViewerMode>(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  return (
    <div className="fo-pane-content-tab">
      <ViewerContent
        entry={entry}
        fs={client.fs}
        mode={mode}
        onModeChange={setMode}
        onClose={onClose}
        onEntryChange={onEntryChange}
        headerVariant="pane"
        showOpenExternalAction
      />
    </div>
  );
}
