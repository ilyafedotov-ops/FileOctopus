import { useEffect, useState } from "react";
import {
  selectVisibleEntries,
  homeUri,
  type PanelId,
  type SortField,
  type PanelTabState,
} from "../panelStore";
import { cx } from "@fileoctopus/ui";
import { type SearchState, FilterInput } from "./PaneFilterBar";
import { FileTable } from "./FileTable";
import { ColumnsView } from "./ColumnsView";
import { RecursiveSearchPanel } from "./PaneFilterBar";
import { PaneStateView } from "../components/PaneStateView";
import { PaneHeader } from "./PaneHeader";
import {
  readDraggedUri,
  readDropData,
  useFileOctopusDragTarget,
} from "../hooks/useFileOctopusDragTarget";
import { localPathFromUri } from "../utils/paneUtils";
import { fileIconGlyph } from "./fileTableUtils";
import type { FileEntryDto } from "@fileoctopus/ts-api";
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
  rowHeight,
  search,
  onContextMenu,
  onBreadcrumbContextMenu,
  onSubmitInlineRename,
  onRefresh,
  onDropFiles,
}: FilePanelProps) {
  const entries = selectVisibleEntries(tab);

  const selectedEntry =
    entries.find((entry) => entry.uri === tab.selectedId) ?? null;
  const [inlineRenameUri, setInlineRenameUri] = useState<string | null>(null);
  const { dragOver, reset, dragTargetProps } = useFileOctopusDragTarget();

  useEffect(() => {
    if (renameFocusToken > 0 && active && tab.selectedIds.length === 1) {
      setInlineRenameUri(tab.selectedIds[0] ?? null);
    }
  }, [renameFocusToken, active, tab.selectedIds]);

  return (
    <section
      className={active ? "fo-panel fo-panel-active" : "fo-panel"}
      data-active={active ? "true" : "false"}
      aria-current={active ? "true" : undefined}
      onFocus={onActivate}
    >
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
          value={tab.filter}
          focusToken={filterFocusToken}
          onChange={onFilter}
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
          loadState={tab.loadState}
          uri={tab.uri}
          message={tab.error}
          canPaste={canPaste}
          onRetry={() => onNavigate(tab.uri)}
          onRefresh={onRefresh}
          onCreateFolder={onCreateFolder}
          onCreateFile={onCreateFile}
          onPaste={onPaste}
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
            entries={entries}
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
          {tab.selectedIds.length} selected - {entries.length} items
        </footer>
      </div>
    </section>
  );
}
