import type { FileEntryDto } from "@fileoctopus/ts-api";
import { cx } from "@fileoctopus/ui";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { isPaneLoading, type PaneLoadState } from "../paneTypes";
import type { SortField, ViewMode } from "../panelStore";
import { FileRow } from "./FileRow";
import {
  buildGridTemplate,
  buildHeaderGridTemplate,
  type ColumnWidths,
  type ColumnId,
} from "./columnWidths";

const overscan = 8;

export interface FileTableProps {
  entries: FileEntryDto[];
  loadState: PaneLoadState;
  rowHeight: number;
  selectedId: string | null;
  selectedIds: string[];
  focusedId: string | null;
  sortField: SortField;
  sortDirection: string;
  viewMode: ViewMode;
  filterQuery?: string;
  inlineRenameUri?: string | null;
  panelId?: string;
  columnWidths?: ColumnWidths;
  onSubmitInlineRename?: (entryUri: string, newName: string) => void;
  onCancelInlineRename?: () => void;
  onCreateFolder?: () => void;
  onCreateFile?: () => void;
  onColumnResize?: (columnId: ColumnId, newWidth: number) => void;
  onSelect: (entryId: string | null) => void;
  onEntrySelect: (entryId: string, mode: "single" | "toggle" | "range") => void;
  onMove: (delta: number) => void;
  onSort: (field: SortField) => void;
  onActivate: () => void;
  onEntryActivate: (entry: FileEntryDto | null) => void;
  onContextMenu: (
    event: MouseEvent<HTMLElement>,
    entry: FileEntryDto | null,
  ) => void;
}

export function FileTable({
  entries,
  loadState,
  rowHeight,
  selectedId,
  selectedIds,
  focusedId,
  sortField,
  sortDirection,
  viewMode,
  filterQuery = "",
  inlineRenameUri,
  panelId,
  columnWidths,
  onSubmitInlineRename,
  onCancelInlineRename,
  onCreateFolder,
  onCreateFile,
  onColumnResize,
  onSelect,
  onEntrySelect,
  onMove,
  onSort,
  onActivate,
  onEntryActivate,
  onContextMenu,
}: FileTableProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const [resizingColumn, setResizingColumn] = useState<ColumnId | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const viewportHeight = viewportRef.current?.clientHeight ?? 420;
  const virtualize = viewMode !== "icons";
  const startIndex = virtualize
    ? Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
    : 0;
  const visibleCount = virtualize
    ? Math.ceil(viewportHeight / rowHeight) + overscan * 2
    : entries.length;
  const visibleEntries = virtualize
    ? entries.slice(startIndex, startIndex + visibleCount)
    : entries;
  const totalHeight = virtualize ? entries.length * rowHeight : undefined;
  const loading = isPaneLoading(loadState);
  const widths = columnWidths ?? DEFAULT_WIDTHS;
  const rowGridColumns = buildGridTemplate(widths);
  const headerGridColumns = buildHeaderGridTemplate(widths);

  const handleResizeStart = useCallback(
    (columnId: ColumnId, clientX: number) => {
      setResizingColumn(columnId);
      setResizeStartX(clientX);
      setResizeStartWidth(widths[columnId]);
    },
    [widths],
  );

  useEffect(() => {
    if (!resizingColumn) return;
    const col = resizingColumn;

    function handleMouseMove(e: globalThis.MouseEvent) {
      const delta = e.clientX - resizeStartX;
      const newWidth = Math.max(30, resizeStartWidth + delta);
      onColumnResize?.(col, newWidth);
    }

    function handleMouseUp() {
      setResizingColumn(null);
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizingColumn, resizeStartX, resizeStartWidth, onColumnResize]);

  useEffect(() => {
    if (!virtualize || !focusedId || !viewportRef.current) {
      return;
    }

    const index = entries.findIndex((entry) => entry.uri === focusedId);

    if (index < 0) {
      return;
    }

    const top = index * rowHeight;
    const bottom = top + rowHeight;
    const viewTop = viewportRef.current.scrollTop;
    const viewBottom = viewTop + viewportRef.current.clientHeight;

    if (top < viewTop) {
      viewportRef.current.scrollTop = top;
    } else if (bottom > viewBottom) {
      viewportRef.current.scrollTop = bottom - viewportRef.current.clientHeight;
    }
  }, [entries, focusedId, rowHeight, virtualize]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "ArrowUp":
        event.preventDefault();
        onMove(-1);
        break;
      case "ArrowDown":
        event.preventDefault();
        onMove(1);
        break;
      case "PageUp":
        event.preventDefault();
        onMove(-Math.max(1, Math.floor(viewportHeight / rowHeight)));
        break;
      case "PageDown":
        event.preventDefault();
        onMove(Math.max(1, Math.floor(viewportHeight / rowHeight)));
        break;
      case "Home":
        event.preventDefault();
        onMove(-entries.length);
        break;
      case "End":
        event.preventDefault();
        onMove(entries.length);
        break;
      case "Enter":
        event.preventDefault();
        onActivate();
        break;
      default:
        break;
    }
  }

  return (
    <div
      className={cx(
        "fo-table-shell",
        `fo-view-${viewMode}`,
        loading && entries.length > 0 && "fo-table-shell-busy",
      )}
      onContextMenu={(event) => onContextMenu(event, null)}
    >
      {viewMode === "details" ? (
        <div
          className="fo-table-header"
          role="row"
          style={{ gridTemplateColumns: headerGridColumns }}
        >
          <ColumnHeader
            field="name"
            active={sortField === "name"}
            direction={sortDirection}
            onSort={onSort}
          >
            Name
          </ColumnHeader>
          <ResizeHandle
            columnId="name"
            onResizeStart={handleResizeStart}
            active={resizingColumn === "name"}
          />
          <ColumnHeader
            field="type"
            active={sortField === "type"}
            direction={sortDirection}
            onSort={onSort}
          >
            ext
          </ColumnHeader>
          <ResizeHandle
            columnId="extension"
            onResizeStart={handleResizeStart}
            active={resizingColumn === "extension"}
          />
          <ColumnHeader
            field="size"
            active={sortField === "size"}
            direction={sortDirection}
            onSort={onSort}
          >
            size
          </ColumnHeader>
          <ResizeHandle
            columnId="size"
            onResizeStart={handleResizeStart}
            active={resizingColumn === "size"}
          />
          <ColumnHeader
            field="modified"
            active={sortField === "modified"}
            direction={sortDirection}
            onSort={onSort}
          >
            modified
          </ColumnHeader>
          <ResizeHandle
            columnId="modified"
            onResizeStart={handleResizeStart}
            active={resizingColumn === "modified"}
          />
          <ColumnHeader
            field="type"
            active={sortField === "type"}
            direction={sortDirection}
            onSort={onSort}
          >
            kind
          </ColumnHeader>
        </div>
      ) : null}
      <div
        ref={viewportRef}
        className="fo-table-viewport"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        {loading && entries.length === 0 ? (
          <FileListSkeleton rowHeight={rowHeight} viewMode={viewMode} />
        ) : entries.length === 0 ? (
          <div className="fo-empty-directory">
            <span className="fo-empty-directory-icon" aria-hidden="true">
              {filterQuery.trim() ? "🔍" : "📁"}
            </span>
            <span className="fo-empty-directory-text">
              {filterQuery.trim()
                ? `No matches for "${filterQuery.trim()}"`
                : "This folder is empty"}
            </span>
            {!filterQuery.trim() && (
              <div className="fo-empty-directory-actions">
                {onCreateFolder && (
                  <button
                    type="button"
                    className="fo-empty-action fo-empty-action--folder"
                    onClick={onCreateFolder}
                  >
                    New Folder
                  </button>
                )}
                {onCreateFile && (
                  <button
                    type="button"
                    className="fo-empty-action fo-empty-action--file"
                    onClick={onCreateFile}
                  >
                    New File
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div
            className="fo-table-spacer"
            style={
              totalHeight === undefined ? undefined : { height: totalHeight }
            }
          >
            {visibleEntries.map((entry, offset) => (
              <FileRow
                key={entry.uri}
                entry={entry}
                top={(startIndex + offset) * rowHeight}
                rowHeight={rowHeight}
                viewMode={viewMode}
                gridColumns={
                  viewMode === "details" ? rowGridColumns : undefined
                }
                renaming={entry.uri === inlineRenameUri}
                onSubmitRename={(newName) =>
                  onSubmitInlineRename?.(entry.uri, newName)
                }
                onCancelRename={onCancelInlineRename}
                selected={entry.uri === selectedId}
                multiSelected={selectedIds.indexOf(entry.uri) !== -1}
                focused={entry.uri === focusedId}
                panelId={panelId}
                selectedUris={selectedIds}
                onSelect={onSelect}
                onEntrySelect={onEntrySelect}
                onEntryActivate={onEntryActivate}
                onContextMenu={onContextMenu}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ColumnHeaderProps {
  field: SortField;
  active: boolean;
  direction: string;
  children: ReactNode;
  onSort: (field: SortField) => void;
}

function ColumnHeader({
  field,
  active,
  direction,
  children,
  onSort,
}: ColumnHeaderProps) {
  const ariaSort: "none" | "ascending" | "descending" =
    active && direction === "asc"
      ? "ascending"
      : active && direction === "desc"
        ? "descending"
        : "none";

  return (
    <button
      type="button"
      className={cx(
        "fo-column-button",
        active && "fo-column-button-active",
        active && `fo-column-button-${direction}`,
      )}
      aria-sort={ariaSort}
      onClick={() => onSort(field)}
    >
      <span className="fo-column-label">{children}</span>
      {active ? (
        <span className="fo-column-sort" aria-hidden="true">
          {direction === "asc" ? "^" : "v"}
        </span>
      ) : null}
    </button>
  );
}

interface FileListSkeletonProps {
  rowHeight: number;
  viewMode: ViewMode;
}

function FileListSkeleton({ rowHeight, viewMode }: FileListSkeletonProps) {
  const rows = viewMode === "icons" ? 8 : 12;

  if (viewMode === "icons") {
    return (
      <div className="fo-file-skeleton fo-file-skeleton-icons" aria-busy="true">
        {Array.from({ length: rows }, (_, index) => (
          <div className="fo-file-skeleton-card" key={index} />
        ))}
      </div>
    );
  }

  return (
    <div
      className="fo-file-skeleton"
      aria-busy="true"
      aria-label="Loading folder"
    >
      <p className="fo-pane-state-loading-label">Loading folder…</p>
      {Array.from({ length: rows }, (_, index) => (
        <div
          className="fo-file-skeleton-row"
          key={index}
          style={{ height: rowHeight }}
        />
      ))}
    </div>
  );
}

const DEFAULT_WIDTHS: ColumnWidths = {
  name: 220,
  extension: 52,
  size: 78,
  modified: 126,
  kind: 110,
};

interface ResizeHandleProps {
  columnId: ColumnId;
  onResizeStart: (columnId: ColumnId, clientX: number) => void;
  active: boolean;
}

function ResizeHandle({ columnId, onResizeStart, active }: ResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${columnId} column`}
      className={cx(
        "fo-column-resize-handle",
        active && "fo-column-resize-handle-active",
      )}
      onMouseDown={(e) => {
        if (e.button === 0) {
          e.preventDefault();
          onResizeStart(columnId, e.clientX);
        }
      }}
    />
  );
}
