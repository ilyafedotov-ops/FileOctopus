import { useCallback, useEffect, useState } from "react";
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
import { PaneStateView } from "../components/PaneStateView";
import { PaneHeader } from "./PaneHeader";
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
  type ColumnWidths,
  type ColumnId,
  type VisibleColumns,
} from "./columnWidths";
import type { FileEntryDto } from "@fileoctopus/ts-api";
import { paneDirectoryCanWrite } from "../navigation/fileMutationState";
import type { ContextMenuState } from "../components/ContextMenu";

export type CopyMoveKind = "copy" | "move";

export interface FilePanelProps {
  panelId: PanelId;
  title: string;
  tab: PanelTabState;
  active: boolean;
  onActivate: () => void;
  onNavigate: (uri: string) => void;
  onSelect: (entryId: string | null) => void;
  onEntrySelect: (entryId: string, mode: "single" | "toggle" | "range") => void;
  onMove: (delta: number) => void;
  onSort: (field: SortField) => void;
  onFilter: (filter: string) => void;
  onRecursiveQuery: (query: string) => void;
  onRecursiveSearch: () => void;
  onEntryActivate: (entry: FileEntryDto | null) => void;
  onCreateFolder: () => void;
  onCreateFile: () => void;
  onPaste: () => void;
  onProperties: (entry: FileEntryDto | null) => void;
  onReveal: (entry: FileEntryDto | null) => void;
  onRefresh: () => void;
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
}

export function FilePanel({
  panelId,
  title,
  tab,
  active,
  onActivate,
  onNavigate,
  onSelect,
  onEntrySelect,
  onMove,
  onSort,
  onFilter,
  onRecursiveQuery,
  onRecursiveSearch,
  onEntryActivate,
  onCreateFolder,
  onCreateFile,
  onPaste,
  onReveal,
  onProperties,
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
}: FilePanelProps) {
  const displayedEntries = selectDisplayedEntries(tab);
  const itemCount = countVisibleEntries(tab);
  const selectedCount = countOperationalSelection(tab);

  const selectedEntry =
    displayedEntries.find((entry) => entry.uri === tab.selectedId) ?? null;
  const [inlineRenameUri, setInlineRenameUri] = useState<string | null>(null);
  const [columnWidths, setColumnWidths] =
    useState<ColumnWidths>(storedColumnWidths);
  const [visibleColumns, setVisibleColumns] =
    useState<VisibleColumns>(storedVisibleColumns);

  const handleToggleColumn = useCallback((columnId: ColumnId) => {
    if (columnId === "name") return;
    setVisibleColumns((prev) => {
      const next =
        prev.indexOf(columnId) !== -1
          ? (prev.filter((id) => id !== columnId) as VisibleColumns)
          : ([...prev, columnId] as VisibleColumns);
      persistVisibleColumns(next);
      return next;
    });
  }, []);
  const { dragOver, reset, dragTargetProps } = useFileOctopusDragTarget();

  const handleColumnResize = useCallback(
    (columnId: ColumnId, newWidth: number) => {
      setColumnWidths((prev) => {
        const next = { ...prev, [columnId]: Math.max(30, newWidth) };
        persistColumnWidths(next);
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    if (renameFocusToken > 0 && active && tab.selectedIds.length === 1) {
      const uri = tab.selectedIds[0];
      if (uri && tab.entriesById[uri]) {
        setInlineRenameUri(uri);
      }
    }
  }, [renameFocusToken, active, tab.selectedIds, tab.entriesById]);

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
      />
      <PaneHeader
        uri={tab.uri}
        pathError={tab.error}
        pathFocusToken={pathFocusToken}
        onNavigate={onNavigate}
        onBreadcrumbContextMenu={onBreadcrumbContextMenu}
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
        {dragOver ? (
          <div className="fo-panel-drop-overlay" aria-live="polite">
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
            sortField={tab.sort.field}
            sortDirection={tab.sort.direction}
            viewMode={tab.viewMode}
            filterQuery={tab.filter}
            inlineRenameUri={inlineRenameUri}
            panelId={panelId}
            columnWidths={columnWidths}
            visibleColumns={visibleColumns}
            onToggleColumn={handleToggleColumn}
            onColumnResize={handleColumnResize}
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
          />
        )}
        <RecursiveSearchPanel
          panelId={panelId}
          search={search}
          onOpen={(entry) => onEntryActivate(entry)}
          onReveal={onReveal}
          onProperties={onProperties}
        />
        <footer className="fo-pane-status">
          {selectedCount} selected - {itemCount} items
        </footer>
      </div>
    </section>
  );
}
