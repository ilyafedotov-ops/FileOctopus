import type { FileEntryDto, GitFileStatusDto } from "@fileoctopus/ts-api";
import { cx, fileEntryIcon } from "@fileoctopus/ui";
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
} from "react";
import { formatDate, formatSize } from "./fileTableUtils";
import type { ViewMode } from "../panelStore";
import type { TagColor } from "../utils/tagStore";

const URI_MIME = "application/x-fileoctopus-uri";

export interface FileRowProps {
  entry: FileEntryDto;
  isParentEntry?: boolean;
  top: number;
  rowHeight: number;
  viewMode: ViewMode;
  gridColumns?: string;
  visibleColumns?: readonly import("./columnWidths").ColumnId[];
  selected: boolean;
  multiSelected: boolean;
  focused: boolean;
  renaming?: boolean;
  panelId?: string;
  selectedUris?: string[];
  gitStatus?: GitFileStatusDto;
  fileTypeColor?: string | null;
  onSubmitRename?: (newName: string) => void;
  onCancelRename?: () => void;
  onSelect: (entryId: string | null) => void;
  onEntrySelect: (entryId: string, mode: "single" | "toggle" | "range") => void;
  onEntryActivate: (entry: FileEntryDto) => void;
  onContextMenu: (
    event: MouseEvent<HTMLElement>,
    entry: FileEntryDto | null,
  ) => void;
  tagColors?: TagColor[];
}

export function FileRow({
  entry,
  isParentEntry = false,
  top,
  rowHeight,
  viewMode,
  gridColumns,
  visibleColumns,
  selected,
  multiSelected,
  focused,
  renaming = false,
  panelId,
  selectedUris,
  gitStatus,
  fileTypeColor,
  onSubmitRename,
  onCancelRename,
  onSelect,
  onEntrySelect,
  onEntryActivate,
  onContextMenu,
  tagColors,
}: FileRowProps) {
  const [draftName, setDraftName] = useState(entry.name);
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (renaming) {
      setDraftName(entry.name);
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renaming, entry.name]);

  const typeLabel = entry.isSymlink
    ? "Symlink"
    : entry.virtualKind === "cloudDrive"
      ? "Cloud"
      : entry.virtualKind === "savedConnection"
        ? "Saved"
        : entry.virtualKind === "discoveredService"
          ? (entry.protocol ?? "Network").toUpperCase()
          : entry.virtualKind === "addConnection"
            ? "Action"
            : entry.kind === "directory"
              ? "Folder"
              : entry.extension
                ? entry.extension.toUpperCase()
                : "File";
  const extensionLabel =
    entry.kind === "directory" ? "" : (entry.extension ?? "").toLowerCase();
  const showMetadata =
    viewMode === "details" || viewMode === "list" || viewMode === "compact";

  const ariaLabel = [
    entry.name,
    entry.isSymlink ? "symlink" : typeLabel,
    entry.kind === "directory" ? "" : formatSize(entry.size),
    entry.modifiedAt ? formatDate(entry.modifiedAt) : "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      role="row"
      aria-label={ariaLabel}
      aria-selected={selected || multiSelected}
      className={cx(
        "fo-row",
        isParentEntry ? "fo-row-parent" : "",
        selected || multiSelected ? "fo-row-selected" : "",
        focused ? "fo-row-focused" : "",
      )}
      style={{
        transform: viewMode === "icons" ? undefined : `translateY(${top}px)`,
        height: viewMode === "icons" ? undefined : rowHeight,
        ...(gridColumns ? { gridTemplateColumns: gridColumns } : {}),
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
      draggable={!isParentEntry}
      onDragStart={
        isParentEntry
          ? undefined
          : (event: DragEvent<HTMLDivElement>) => {
              event.dataTransfer.setData(URI_MIME, entry.uri);
              event.dataTransfer.setData(
                "application/x-fileoctopus-name",
                entry.name,
              );
              if (panelId) {
                event.dataTransfer.setData(
                  "application/x-fileoctopus-panel-id",
                  panelId,
                );
              }
              if (selectedUris && selectedUris.length > 1) {
                event.dataTransfer.setData(
                  "application/x-fileoctopus-selected-uris",
                  JSON.stringify(selectedUris),
                );
              }
              event.dataTransfer.effectAllowed = "move";
            }
      }
      onContextMenu={(event) => {
        event.stopPropagation();
        onContextMenu(event, entry);
      }}
    >
      <span className="fo-row-name">
        <span className="fo-row-icon" aria-hidden="true">
          {fileEntryIcon(entry)}
        </span>
        {renaming && !isParentEntry ? (
          <input
            ref={renameInputRef}
            className="fo-row-rename-input"
            value={draftName}
            aria-label={`Rename ${entry.name}`}
            onChange={(event) => setDraftName(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") {
                onSubmitRename?.(draftName);
              }
              if (event.key === "Escape") {
                onCancelRename?.();
              }
            }}
            onBlur={() => onSubmitRename?.(draftName)}
          />
        ) : (
          <span
            className="fo-row-text"
            title={entry.name}
            style={fileTypeColor ? { color: fileTypeColor } : undefined}
          >
            {entry.name}
          </span>
        )}
        {gitStatus && gitStatus !== "clean" ? (
          <span
            className={`fo-row-git-badge fo-row-git-badge-${gitStatus}`}
            aria-label={`Git status: ${gitStatus}`}
            title={`Git status: ${gitStatus}`}
          >
            {gitStatusLabel(gitStatus)}
          </span>
        ) : null}
        {tagColors && tagColors.length > 0
          ? tagColors.map((color) => (
              <span
                key={color}
                className={`fo-row-tag-badge fo-row-tag-${color}`}
                aria-label={`Tag: ${color}`}
                title={`Tag: ${color}`}
              />
            ))
          : null}
        {entry.isSymlink ? (
          <span
            className="fo-row-symlink-badge"
            aria-label="Symlink"
            title={`Symlink${entry.symlinkTarget ? ` → ${entry.symlinkTarget}` : ""}`}
          >
            ↗
          </span>
        ) : null}
        {entry.status ? (
          <span
            className={`fo-row-network-badge fo-row-network-badge-${entry.status}`}
            aria-label={`Network status: ${entry.status}`}
            title={entry.description ?? entry.status}
          >
            {networkStatusLabel(entry.status)}
          </span>
        ) : null}
      </span>
      {showMetadata ? (
        viewMode === "details" ? (
          <>
            {(visibleColumns ?? ["extension", "size", "modified", "kind"]).map(
              (colId) => {
                switch (colId) {
                  case "extension":
                    return <span key="extension">{extensionLabel}</span>;
                  case "size":
                    return (
                      <span key="size">
                        {entry.kind === "directory"
                          ? isParentEntry
                            ? "—"
                            : "DIR"
                          : formatSize(entry.size)}
                      </span>
                    );
                  case "modified":
                    return (
                      <span
                        key="modified"
                        title={entry.modifiedAt ?? undefined}
                      >
                        {formatDate(entry.modifiedAt)}
                      </span>
                    );
                  case "kind":
                    return (
                      <span key="kind">
                        {isParentEntry
                          ? "parent"
                          : entry.isSymlink
                            ? "symlink"
                            : entry.kind === "directory"
                              ? "folder"
                              : typeLabel}
                      </span>
                    );
                  default:
                    return null;
                }
              },
            )}
          </>
        ) : (
          <>
            <span>
              {entry.kind === "directory" ? "—" : formatSize(entry.size)}
            </span>
            <span>{typeLabel}</span>
            <span title={entry.modifiedAt ?? undefined}>
              {formatDate(entry.modifiedAt)}
            </span>
          </>
        )
      ) : null}
    </div>
  );
}

function networkStatusLabel(status: string): string {
  switch (status) {
    case "available":
      return "OK";
    case "saved":
      return "SAVED";
    case "credentialsRequired":
      return "AUTH";
    case "unavailable":
      return "OFF";
    default:
      return status.toUpperCase();
  }
}

function gitStatusLabel(status: GitFileStatusDto): string {
  switch (status) {
    case "modified":
      return "M";
    case "added":
      return "A";
    case "deleted":
      return "D";
    case "renamed":
      return "R";
    case "untracked":
      return "?";
    case "ignored":
      return "I";
    case "conflicted":
      return "U";
    case "unknown":
      return "!";
    case "clean":
      return "";
  }
}
