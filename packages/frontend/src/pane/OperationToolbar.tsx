import { useState } from "react";
import { DropdownMenu, Icons, ToolbarButton } from "@fileoctopus/ui";

import type { ViewMode } from "../panelStore";

export interface OperationToolbarProps {
  selectedCount: number;
  canRename: boolean;
  canPaste: boolean;
  showHidden: boolean;
  viewMode: ViewMode;
  onCreateFolder: () => void;
  onCreateFile: () => void;
  onRename: () => void;
  onCopy: () => void;
  onCut: () => void;
  onCopyOperation: () => void;
  onMove: () => void;
  onPaste: () => void;
  onTrash: () => void;
  onPermanentDelete: () => void;
  onCopyPath: () => void;
  onCopyName: () => void;
  onProperties: () => void;
  onSelectAll: () => void;
  onRefresh: () => void;
  onToggleHidden: () => void;
  onViewMode: (viewMode: ViewMode) => void;
}

export function OperationToolbar({
  selectedCount,
  canRename,
  canPaste,
  showHidden,
  viewMode,
  onCreateFolder,
  onCreateFile,
  onRename,
  onCopy,
  onCut,
  onCopyOperation,
  onMove,
  onPaste,
  onTrash,
  onPermanentDelete,
  onCopyPath,
  onCopyName,
  onProperties,
  onSelectAll,
  onRefresh,
  onToggleHidden,
  onViewMode,
}: OperationToolbarProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);

  return (
    <div className="fo-operation-toolbar" aria-label="File operations">
      <div className="fo-toolbar-actions">
        <ToolbarButton
          primary
          className="fo-toolbar-priority-high"
          onClick={onCreateFolder}
        >
          {Icons.folderPlus()}
          <span>New Folder</span>
        </ToolbarButton>
        <ToolbarButton
          className="fo-toolbar-priority-high"
          onClick={onCreateFile}
        >
          {Icons.filePlus()}
          <span>New File</span>
        </ToolbarButton>
        <ToolbarButton
          className="fo-toolbar-priority-high"
          disabled={!canRename}
          onClick={onRename}
        >
          {Icons.pencil()}
          <span>Rename</span>
        </ToolbarButton>
        <ToolbarButton
          className="fo-toolbar-priority-medium"
          disabled={selectedCount === 0}
          onClick={onCopy}
        >
          {Icons.copy()}
          <span>Copy</span>
        </ToolbarButton>
        <ToolbarButton
          className="fo-toolbar-priority-medium"
          disabled={selectedCount === 0}
          onClick={onMove}
        >
          {Icons.move()}
          <span>Move</span>
        </ToolbarButton>
        {canPaste ? (
          <ToolbarButton
            className="fo-toolbar-priority-medium"
            onClick={onPaste}
          >
            {Icons.copy()}
            <span>Paste</span>
          </ToolbarButton>
        ) : null}
        <ToolbarButton
          className="fo-toolbar-priority-low"
          disabled={selectedCount === 0}
          onClick={onTrash}
        >
          {Icons.trash()}
          <span>Trash</span>
        </ToolbarButton>
        <ToolbarButton className="fo-toolbar-priority-low" onClick={onRefresh}>
          {Icons.refresh()}
          <span>Refresh</span>
        </ToolbarButton>
      </div>
      <span className="fo-toolbar-spacer" aria-hidden="true" />
      <DropdownMenu
        label="More"
        open={overflowOpen}
        onOpenChange={setOverflowOpen}
        align="end"
        items={[
          {
            id: "new-file",
            label: "New File",
            icon: Icons.filePlus(),
            shortcut: "Cmd+N",
            onSelect: onCreateFile,
          },
          {
            id: "rename",
            label: "Rename",
            icon: Icons.pencil(),
            shortcut: "F2",
            disabled: !canRename,
            onSelect: onRename,
          },
          {
            id: "cut",
            label: "Cut",
            icon: Icons.move(),
            shortcut: "Cmd+X",
            disabled: selectedCount === 0,
            onSelect: onCut,
          },
          {
            id: "paste",
            label: "Paste",
            icon: Icons.copy(),
            shortcut: "Cmd+V",
            disabled: !canPaste,
            onSelect: onPaste,
          },
          {
            id: "copy-to",
            label: "Copy To…",
            icon: Icons.copy(),
            separatorBefore: true,
            disabled: selectedCount === 0,
            onSelect: onCopyOperation,
          },
          {
            id: "move-to",
            label: "Move To…",
            icon: Icons.move(),
            disabled: selectedCount === 0,
            onSelect: onMove,
          },
          {
            id: "copy-path",
            label: "Copy Path",
            icon: Icons.file(),
            separatorBefore: true,
            disabled: selectedCount === 0,
            onSelect: onCopyPath,
          },
          {
            id: "copy-name",
            label: "Copy Name",
            icon: Icons.file(),
            disabled: selectedCount === 0,
            onSelect: onCopyName,
          },
          {
            id: "delete",
            label: "Delete Permanently",
            icon: Icons.trash(),
            danger: true,
            separatorBefore: true,
            disabled: selectedCount === 0,
            onSelect: onPermanentDelete,
          },
          {
            id: "properties",
            label: "Properties",
            icon: Icons.file(),
            shortcut: "Cmd+I",
            onSelect: onProperties,
          },
          {
            id: "select-all",
            label: "Select All",
            icon: Icons.file(),
            shortcut: "Cmd+A",
            separatorBefore: true,
            onSelect: onSelectAll,
          },
          {
            id: "hidden",
            label: showHidden ? "Hide Hidden" : "Show Hidden",
            icon: Icons.file(),
            shortcut: "Cmd+.",
            checked: showHidden,
            onSelect: onToggleHidden,
          },
          {
            id: "view-details",
            label: "Details view",
            icon: Icons.file(),
            checked: viewMode === "details",
            separatorBefore: true,
            onSelect: () => onViewMode("details"),
          },
          {
            id: "view-list",
            label: "List view",
            icon: Icons.file(),
            checked: viewMode === "list",
            onSelect: () => onViewMode("list"),
          },
          {
            id: "view-icons",
            label: "Icons view",
            icon: Icons.pictures(),
            checked: viewMode === "icons",
            onSelect: () => onViewMode("icons"),
          },
          {
            id: "view-columns",
            label: "Columns view",
            icon: Icons.folder(),
            checked: viewMode === "columns",
            onSelect: () => onViewMode("columns"),
          },
        ]}
      >
        {Icons.more()}
        <span>More</span>
      </DropdownMenu>
      <span className="fo-toolbar-meta">{selectedCount} selected</span>
    </div>
  );
}
