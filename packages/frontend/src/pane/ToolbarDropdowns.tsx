import { useState } from "react";
import { DropdownMenu, Icons } from "@fileoctopus/ui";
import { formatCommandShortcut } from "../commands/registry";
import type { ViewMode } from "../panelStore";

export interface ToolbarDropdownsProps {
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
  onToggleHidden: () => void;
  onViewMode: (viewMode: ViewMode) => void;
  onRevealInFileManager: () => void;
  onCalculateSize: () => void;
  onCompress: () => void;
  onExtract: () => void;
  onOpenTerminal: () => void;
  onChecksum: () => void;
}

export function ToolbarDropdowns(props: ToolbarDropdownsProps) {
  const {
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
    onToggleHidden,
    onViewMode,
    onRevealInFileManager,
    onCalculateSize,
    onCompress,
    onExtract,
    onOpenTerminal,
    onChecksum,
  } = props;
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);

  return (
    <>
      <span className="fo-toolbar-spacer" aria-hidden="true" />
      <div className="fo-toolbar-group fo-toolbar-group-tools">
        <DropdownMenu
          label="Tools"
          triggerAriaLabel="Tools"
          open={toolsOpen}
          onOpenChange={setToolsOpen}
          items={[
            {
              id: "reveal-in-fm",
              label: "Reveal in File Manager",
              icon: Icons.folder(),
              disabled: selectedCount === 0,
              onSelect: onRevealInFileManager,
            },
            {
              id: "calculate-size",
              label: "Calculate Size",
              icon: Icons.calculator(),
              disabled: selectedCount === 0,
              onSelect: onCalculateSize,
            },
            {
              id: "compress",
              label: "Compress…",
              icon: Icons.archive(),
              separatorBefore: true,
              disabled: selectedCount === 0,
              onSelect: onCompress,
            },
            {
              id: "extract",
              label: "Extract…",
              icon: Icons.archive(),
              disabled: selectedCount === 0,
              onSelect: onExtract,
            },
            {
              id: "open-terminal",
              label: "Open Terminal",
              icon: Icons.terminal(),
              separatorBefore: true,
              onSelect: onOpenTerminal,
            },
            {
              id: "checksum",
              label: "Checksum…",
              icon: Icons.hash(),
              disabled: selectedCount === 0,
              onSelect: onChecksum,
            },
          ]}
        >
          {Icons.terminal()}
          <span className="fo-toolbar-label">Tools</span>
          {Icons.chevronDown()}
        </DropdownMenu>
      </div>
      <span className="fo-toolbar-separator" aria-hidden="true" />
      <div className="fo-toolbar-group fo-toolbar-group-view">
        <DropdownMenu
          label="View"
          triggerAriaLabel="View"
          open={viewOpen}
          onOpenChange={setViewOpen}
          items={[
            {
              id: "view-details",
              label: "Details view",
              icon: Icons.file(),
              checked: viewMode === "details",
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
              id: "view-compact",
              label: "Compact view",
              icon: Icons.file(),
              checked: viewMode === "compact",
              onSelect: () => onViewMode("compact"),
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
            {
              id: "hidden",
              label: showHidden ? "Hide Hidden" : "Show Hidden",
              icon: Icons.file(),
              shortcut: formatCommandShortcut("view.toggleHidden", "mac"),
              checked: showHidden,
              separatorBefore: true,
              onSelect: onToggleHidden,
            },
          ]}
        >
          {Icons.pictures()}
          <span className="fo-toolbar-label">View</span>
          {Icons.chevronDown()}
        </DropdownMenu>
      </div>
      <DropdownMenu
        label="More"
        triggerAriaLabel="More"
        open={overflowOpen}
        onOpenChange={setOverflowOpen}
        align="end"
        items={[
          {
            id: "new-folder",
            label: "New Folder",
            icon: Icons.folderPlus(),
            shortcut: formatCommandShortcut("create.folder", "mac"),
            onSelect: onCreateFolder,
          },
          {
            id: "new-file",
            label: "New File",
            icon: Icons.filePlus(),
            shortcut: formatCommandShortcut("create.folder", "mac"),
            onSelect: onCreateFile,
          },
          {
            id: "copy",
            label: "Copy",
            icon: Icons.copy(),
            shortcut: formatCommandShortcut("op.copy", "mac"),
            disabled: selectedCount === 0,
            onSelect: onCopy,
          },
          {
            id: "rename",
            label: "Rename",
            icon: Icons.pencil(),
            shortcut: formatCommandShortcut("op.rename", "mac"),
            disabled: !canRename,
            onSelect: onRename,
          },
          {
            id: "cut",
            label: "Cut",
            icon: Icons.move(),
            shortcut: formatCommandShortcut("op.cut", "mac"),
            disabled: selectedCount === 0,
            onSelect: onCut,
          },
          {
            id: "paste",
            label: "Paste",
            icon: Icons.copy(),
            shortcut: formatCommandShortcut("op.paste", "mac"),
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
            id: "trash",
            label: "Trash",
            icon: Icons.trash(),
            danger: true,
            separatorBefore: true,
            disabled: selectedCount === 0,
            onSelect: onTrash,
          },
          {
            id: "delete",
            label: "Delete Permanently",
            icon: Icons.trash(),
            danger: true,
            disabled: selectedCount === 0,
            onSelect: onPermanentDelete,
          },
          {
            id: "properties",
            label: "Properties",
            icon: Icons.file(),
            shortcut: formatCommandShortcut("op.properties", "mac"),
            onSelect: onProperties,
          },
          {
            id: "reveal-in-fm",
            label: "Reveal in File Manager",
            icon: Icons.folder(),
            separatorBefore: true,
            disabled: selectedCount === 0,
            onSelect: onRevealInFileManager,
          },
          {
            id: "calculate-size",
            label: "Calculate Size",
            icon: Icons.calculator(),
            disabled: selectedCount === 0,
            onSelect: onCalculateSize,
          },
          {
            id: "compress",
            label: "Compress…",
            icon: Icons.archive(),
            separatorBefore: true,
            disabled: selectedCount === 0,
            onSelect: onCompress,
          },
          {
            id: "extract",
            label: "Extract…",
            icon: Icons.archive(),
            disabled: selectedCount === 0,
            onSelect: onExtract,
          },
          {
            id: "open-terminal",
            label: "Open Terminal",
            icon: Icons.terminal(),
            onSelect: onOpenTerminal,
          },
          {
            id: "checksum",
            label: "Checksum…",
            icon: Icons.hash(),
            disabled: selectedCount === 0,
            onSelect: onChecksum,
          },
          {
            id: "select-all",
            label: "Select All",
            icon: Icons.file(),
            shortcut: formatCommandShortcut("selection.selectAll", "mac"),
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
            id: "view-compact",
            label: "Compact view",
            icon: Icons.file(),
            checked: viewMode === "compact",
            onSelect: () => onViewMode("compact"),
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
        <span className="fo-toolbar-label">More</span>
        {Icons.chevronDown()}
      </DropdownMenu>
    </>
  );
}
