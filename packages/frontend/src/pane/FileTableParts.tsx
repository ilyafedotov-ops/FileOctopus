import { cx } from "@fileoctopus/ui";
import type { ReactNode } from "react";
import type { SortField, ViewMode } from "../panelStore";
import type { ColumnId, ColumnWidths } from "./columnWidths";

interface ColumnHeaderProps {
  field: SortField;
  active: boolean;
  direction: string;
  children: ReactNode;
  onSort: (field: SortField) => void;
  draggable?: boolean;
  dragOver?: boolean;
  onDragStart?: () => void;
  onDragOver?: () => void;
  onDragEnd?: () => void;
  onDrop?: () => void;
}

export function ColumnHeader({
  field,
  active,
  direction,
  children,
  onSort,
  draggable = false,
  dragOver = false,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
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
      role="columnheader"
      className={cx(
        "fo-column-button",
        active && "fo-column-button-active",
        active && `fo-column-button-${direction}`,
        dragOver && "fo-column-button-drag-over",
      )}
      aria-sort={ariaSort}
      draggable={draggable}
      onClick={() => onSort(field)}
      onDragStart={(e) => {
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        onDragOver?.();
      }}
      onDragEnd={() => onDragEnd?.()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.();
      }}
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

export function FileListSkeleton({
  rowHeight,
  viewMode,
}: FileListSkeletonProps) {
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

export const DEFAULT_WIDTHS: ColumnWidths = {
  name: 220,
  extension: 52,
  size: 78,
  modified: 126,
  kind: 110,
};

export function columnHeaderDef(id: ColumnId): {
  label: string;
  sortField: SortField;
} | null {
  switch (id) {
    case "name":
      return { label: "Name", sortField: "name" };
    case "extension":
      return { label: "ext", sortField: "type" };
    case "size":
      return { label: "size", sortField: "size" };
    case "modified":
      return { label: "modified", sortField: "modified" };
    case "kind":
      return { label: "kind", sortField: "type" };
    default:
      return null;
  }
}

interface ResizeHandleProps {
  columnId: ColumnId;
  onResizeStart: (columnId: ColumnId, clientX: number) => void;
  active: boolean;
}

export function ResizeHandle({
  columnId,
  onResizeStart,
  active,
}: ResizeHandleProps) {
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
