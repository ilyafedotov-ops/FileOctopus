import { useRef, useEffect } from "react";
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
import { PathBar } from "./PanePathBar";
import { FilterInput, type SearchState } from "./PaneFilterBar";
import { OperationToolbar } from "./OperationToolbar";
import { FileTable } from "./FileTable";
import { ColumnsView } from "./ColumnsView";
import { RecursiveSearchPanel } from "./PaneFilterBar";
import { PaneStateView } from "../components/PaneStateView";
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
  filterFocusToken: number;
  recursiveSearchFocusToken: number;
  rowHeight: number;
  search: SearchState | null;
  onContextMenu: (menu: ContextMenuState | null) => void;
  onBreadcrumbContextMenu?: (path: string, event: React.MouseEvent) => void;
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
  filterFocusToken,
  recursiveSearchFocusToken,
  rowHeight,
  search,
  onContextMenu,
  onBreadcrumbContextMenu,
}: FilePanelProps) {
  const entries = selectVisibleEntries(tab);

  const selectedEntry =
    entries.find((entry) => entry.uri === tab.selectedId) ?? null;
  const upUri = parentUri(tab.uri);
  const recursiveSearchRef = useRef<HTMLInputElement | null>(null);
  const { dragOver, reset, dragTargetProps } = useFileOctopusDragTarget();

  useEffect(() => {
    if (recursiveSearchFocusToken > 0 && active) {
      recursiveSearchRef.current?.focus();
      recursiveSearchRef.current?.select();
    }
  }, [active, recursiveSearchFocusToken]);

  return (
    <section
      className={active ? "fo-panel fo-panel-active" : "fo-panel"}
      onFocus={onActivate}
    >
      <header className="fo-panel-header">
        <div className="fo-panel-title-row">
          <span className="fo-pane-badge">{title}</span>
          <PathBar
            value={tab.uri}
            error={tab.error}
            focusToken={pathFocusToken}
            onSubmit={onNavigate}
            onBreadcrumbContextMenu={onBreadcrumbContextMenu}
          />
          <span className={active ? "fo-pane-active-label" : "fo-pane-label"}>
            {title.toUpperCase()}
          </span>
        </div>
      </header>
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
          onRename={onRename}
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
          onRetry={() => onNavigate(tab.uri)}
          onRefresh={onRefresh}
          onCreateFolder={onCreateFolder}
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
