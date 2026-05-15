import type { FileEntryDto } from "@fileoctopus/ts-api";
import { cx, fileEntryIcon } from "@fileoctopus/ui";
import type { DragEvent, MouseEvent } from "react";
import { formatDate, formatSize } from "./fileTableUtils";
import type { ViewMode } from "../panelStore";

const URI_MIME = "application/x-fileoctopus-uri";

export interface FileRowProps {
  entry: FileEntryDto;
  top: number;
  rowHeight: number;
  viewMode: ViewMode;
  selected: boolean;
  multiSelected: boolean;
  focused: boolean;
  onSelect: (entryId: string | null) => void;
  onEntrySelect: (entryId: string, mode: "single" | "toggle" | "range") => void;
  onEntryActivate: (entry: FileEntryDto) => void;
  onContextMenu: (
    event: MouseEvent<HTMLElement>,
    entry: FileEntryDto | null,
  ) => void;
}

export function FileRow({
  entry,
  top,
  rowHeight,
  viewMode,
  selected,
  multiSelected,
  focused,
  onSelect,
  onEntrySelect,
  onEntryActivate,
  onContextMenu,
}: FileRowProps) {
  const typeLabel =
    entry.kind === "directory"
      ? "Folder"
      : entry.extension
        ? entry.extension.toUpperCase()
        : "File";

  return (
    <div
      role="row"
      aria-selected={selected || multiSelected}
      className={cx(
        "fo-row",
        selected || multiSelected ? "fo-row-selected" : "",
        focused ? "fo-row-focused" : "",
      )}
      style={{
        transform: viewMode === "icons" ? undefined : `translateY(${top}px)`,
        height: viewMode === "icons" ? undefined : rowHeight,
      }}
      onClick={(event) => {
        const mode = event.shiftKey
          ? "range"
          : event.metaKey || event.ctrlKey
            ? "toggle"
            : "single";

        if (mode === "single") {
          onSelect(entry.uri);
        } else {
          onEntrySelect(entry.uri, mode);
        }
      }}
      onDoubleClick={() => onEntryActivate(entry)}
      draggable
      onDragStart={(event: DragEvent<HTMLDivElement>) => {
        event.dataTransfer.setData(URI_MIME, entry.uri);
        event.dataTransfer.setData(
          "application/x-fileoctopus-name",
          entry.name,
        );
        event.dataTransfer.effectAllowed = "move";
      }}
      onContextMenu={(event) => {
        event.stopPropagation();
        onContextMenu(event, entry);
      }}
    >
      <span className="fo-row-name">
        <span className="fo-row-icon" aria-hidden="true">
          {fileEntryIcon(entry)}
        </span>
        <span className="fo-row-text" title={entry.name}>
          {entry.name}
        </span>
      </span>
      {viewMode === "details" || viewMode === "list" ? (
        <>
          <span>
            {entry.kind === "directory" ? "—" : formatSize(entry.size)}
          </span>
          <span title={entry.modifiedAt ?? undefined}>
            {formatDate(entry.modifiedAt)}
          </span>
          <span>{typeLabel}</span>
        </>
      ) : null}
    </div>
  );
}
