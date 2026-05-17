import { useRef, useEffect, useState } from "react";
import {
  selectVisibleEntries,
  parentUri,
  homeUri,
  type PanelId,
  type SortField,
  type ViewMode,
  type PanelTabState,
} from "../panelStore";
import { SegmentedControl, Button, cx } from "@fileoctopus/ui";
import { FilterInput, type SearchState } from "./PaneFilterBar";
import { OperationToolbar } from "./OperationToolbar";
import { FileTable } from "./FileTable";
import { ColumnsView } from "./ColumnsView";
import { RecursiveSearchPanel } from "./PaneFilterBar";
import { PaneStateView } from "../components/PaneStateView";
import { PaneHeader } from "./PaneHeader";
import {
  readDraggedUri,
  useFileOctopusDragTarget,
} from "../hooks/useFileOctopusDragTarget";
import { localPathFromUri } from "../utils/paneUtils";
import { fileIconGlyph } from "./fileTableUtils";
import type { FileEntryDto } from "@fileoctopus/ts-api";
import type { ContextMenuState } from "../components/ContextMenu";

export interface FilePanelProps {
  panelId: PanelId;
  title: string;
  tab: PanelTabState;
  active: boolean;
  onActivate: () => void;
  onNavigate: (uri: string) => void;
  onBack: () => void;
  onForward: () => void;
  onSelect: (entryId: string | null) => void;
  onEntrySelect: (entryId: string, mode: "single" | "toggle" | "range") => void;
  onMove: (delta: number) => void;
  onSort: (field: SortField) => void;
  onFilter: (filter: string) => void;
  onRecursiveQuery: (query: string) => void;
  onRecursiveSearch: () => void;
  onViewMode: (viewMode: ViewMode) => void;
  onEntryActivate: (entry: FileEntryDto | null) => void;
  onCreateFolder: () => void;
  onCreateFile: () => void;
  onRename: () => void;
  onCopy: () => void;
  onCut: () => void;
  onCopyOperation: () => void;
  onMoveOperation: () => void;
  onPaste: () => void;
  onTrash: () => void;
  onPermanentDelete: () => void;
  onCopyPath: () => void;
  onCopyName: () => void;
  onProperties: (entry: FileEntryDto | null) => void;
  onReveal: (entry: FileEntryDto | null) => void;
  onCalculateSize: (entry: FileEntryDto | null) => void;
  onCompress: () => void;
  onExtract: () => void;
  onOpenTerminal: () => void;
  onChecksum: () => void;
  onRefresh: () => void;
  onToggleHidden: () => void;
  onSelectAll: () => void;
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
}

export function FilePanel({
  panelId,
  title,
  tab,
  active,
  onActivate,
  onNavigate,
  onBack,
  onForward,
  onSelect,
  onEntrySelect,
  onMove,
  onSort,
  onFilter,
  onRecursiveQuery,
  onRecursiveSearch,
  onViewMode,
  onEntryActivate,
  onCreateFolder,
  onCreateFile,
  onRename,
  onCopy,
  onCut,
  onCopyOperation,
  onMoveOperation,
  onPaste,
  onTrash,
  onPermanentDelete,
  onCopyPath,
  onCopyName,
  onProperties,
  onReveal,
  onCalculateSize,
  onCompress,
  onExtract,
  onOpenTerminal,
  onChecksum,
  onRefresh,
  onToggleHidden,
  onSelectAll,
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
}: FilePanelProps) {
  const entries = selectVisibleEntries(tab);

  const selectedEntry =
    entries.find((entry) => entry.uri === tab.selectedId) ?? null;
  const upUri = parentUri(tab.uri);
  const recursiveSearchRef = useRef<HTMLInputElement | null>(null);
  const [inlineRenameUri, setInlineRenameUri] = useState<string | null>(null);
  const { dragOver, reset, dragTargetProps } = useFileOctopusDragTarget();
  const visibleCount = entries.length;
  const filteredCount = tab.filter.trim()
    ? selectVisibleEntries(tab).length
    : visibleCount;

  useEffect(() => {
    if (recursiveSearchFocusToken > 0 && active) {
      recursiveSearchRef.current?.focus();
      recursiveSearchRef.current?.select();
    }
  }, [active, recursiveSearchFocusToken]);

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
        title={title}
        active={active}
        uri={tab.uri}
        pathError={tab.error}
        pathFocusToken={pathFocusToken}
        onNavigate={onNavigate}
        onBreadcrumbContextMenu={onBreadcrumbContextMenu}
      />
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
          onNavigate(uri);
        }}
      >
        {dragOver ? (
          <div className="fo-panel-drop-overlay" aria-live="polite">
            Drop here to open in {title.toLowerCase()} pane
            <span className="fo-panel-drop-path">
              {localPathFromUri(tab.uri)}
            </span>
          </div>
        ) : null}
        <OperationToolbar
          selectedCount={tab.selectedIds.length}
          canRename={tab.selectedIds.length === 1}
          canPaste={canPaste}
          showHidden={tab.showHidden}
          viewMode={tab.viewMode}
          canGoBack={tab.backStack.length > 0}
          canGoForward={tab.forwardStack.length > 0}
          canGoUp={Boolean(upUri)}
          onBack={onBack}
          onForward={onForward}
          onUp={() => upUri && onNavigate(upUri)}
          onCreateFolder={onCreateFolder}
          onCreateFile={onCreateFile}
          onRename={() => {
            if (tab.selectedIds.length === 1) {
              setInlineRenameUri(tab.selectedIds[0] ?? null);
              return;
            }
            onRename();
          }}
          onCopy={onCopy}
          onCut={onCut}
          onCopyOperation={onCopyOperation}
          onMove={onMoveOperation}
          onPaste={onPaste}
          onTrash={onTrash}
          onPermanentDelete={onPermanentDelete}
          onCopyPath={onCopyPath}
          onCopyName={onCopyName}
          onProperties={() => onProperties(selectedEntry)}
          onRevealInFileManager={() => onReveal(selectedEntry)}
          onCalculateSize={() => onCalculateSize(selectedEntry)}
          onCompress={onCompress}
          onExtract={onExtract}
          onOpenTerminal={onOpenTerminal}
          onChecksum={onChecksum}
          onRefresh={onRefresh}
          onToggleHidden={onToggleHidden}
          onSelectAll={onSelectAll}
          onViewMode={onViewMode}
        />
        <div className="fo-panel-filter-row">
          <FilterInput
            panelId={panelId}
            value={tab.filter}
            focusToken={filterFocusToken}
            onChange={onFilter}
          />
          {tab.filter.trim() ? (
            <span className="fo-filter-match-count" aria-live="polite">
              {filteredCount} match{filteredCount === 1 ? "" : "es"}
            </span>
          ) : null}
          <SegmentedControl
            aria-label={`${panelId} view mode`}
            value={tab.viewMode}
            options={[
              { value: "details", label: "Details" },
              { value: "list", label: "List" },
              { value: "icons", label: "Icons" },
              { value: "columns", label: "Columns" },
            ]}
            onChange={onViewMode}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleHidden}
          >
            {tab.showHidden ? "Hide Hidden" : "Show Hidden"}
          </Button>
        </div>
        <div className="fo-search-strip">
          <input
            ref={recursiveSearchRef}
            aria-label={`${panelId} recursive search`}
            value={tab.recursiveQuery}
            placeholder="Search in subfolders..."
            onChange={(event) => onRecursiveQuery(event.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRecursiveSearch}
          >
            Search
          </Button>
        </div>
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
