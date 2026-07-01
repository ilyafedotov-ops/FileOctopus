import { useMemo, useState } from "react";
import { DropdownMenu, Icons } from "@fileoctopus/ui";
import {
  currentShortcutPlatform,
  formatCommandShortcut,
} from "../commands/registry";
import type { ToolbarCommandContext } from "../commands/toolbarCommandState";
import type { HotlistTarget } from "../shell/hotlistTargets";
import type { PaneLocationTargetAction } from "../navigation/driveTargets";
import {
  runToolbarCommand,
  type ToolbarActionHandlers,
} from "./toolbarActions";
import { buildCollapsedToolbarItems } from "./toolbarOverflowItems";
import type { ToolbarOverflowTier } from "./toolbarOverflowTier";

export interface CommanderToolbarOverflowProps {
  overflowTier: ToolbarOverflowTier;
  commandContext: ToolbarCommandContext;
  handlers: ToolbarActionHandlers;
  hotlistTargets: HotlistTarget[];
  hotlistOverflow: HotlistTarget[];
  onCustomizeToolbar: () => void;
  onOpenTargetAction: (action: PaneLocationTargetAction) => void;
}

export function CommanderToolbarOverflow({
  overflowTier,
  commandContext,
  handlers,
  hotlistTargets,
  hotlistOverflow,
  onCustomizeToolbar,
  onOpenTargetAction,
}: CommanderToolbarOverflowProps) {
  const [open, setOpen] = useState(false);
  const shortcutPlatform = currentShortcutPlatform();
  const { dropdowns } = handlers;
  const {
    selectedCount,
    canPaste,
    showHidden,
    viewMode,
    onCreateFile,
    onCopy,
    onCut,
    onPaste,
    onCopyPath,
    onSelectAll,
    onToggleHidden,
    onViewMode,
    onRevealInFileManager,
    onCalculateSize,
    onChecksum,
  } = dropdowns;

  const collapsedItems = useMemo(
    () =>
      buildCollapsedToolbarItems({
        tier: overflowTier,
        commandContext,
        handlers,
        hotlistTargets,
        hotlistOverflow,
        onOpenTargetAction,
      }),
    [
      overflowTier,
      commandContext,
      handlers,
      hotlistTargets,
      hotlistOverflow,
      onOpenTargetAction,
    ],
  );

  return (
    <DropdownMenu
      label="More"
      triggerAriaLabel="More toolbar commands"
      open={open}
      onOpenChange={setOpen}
      align="end"
      items={[
        ...collapsedItems,
        {
          id: "command-palette",
          label: "Command Palette",
          icon: Icons.search(),
          shortcut: formatCommandShortcut(
            "app.commandPalette",
            shortcutPlatform,
          ),
          separatorBefore: collapsedItems.length > 0,
          onSelect: handlers.onCommandSearch,
        },
        {
          id: "filter",
          label: "Filter",
          icon: Icons.search(),
          onSelect: () => runToolbarCommand("search.focusFilter", handlers),
        },
        {
          id: "paste",
          label: "Paste",
          icon: Icons.copy(),
          shortcut: formatCommandShortcut("op.paste", shortcutPlatform),
          disabled: !canPaste,
          separatorBefore: true,
          onSelect: onPaste,
        },
        {
          id: "copy-clipboard",
          label: "Copy",
          icon: Icons.copy(),
          shortcut: formatCommandShortcut("op.copy", shortcutPlatform),
          disabled: selectedCount === 0,
          onSelect: onCopy,
        },
        {
          id: "cut",
          label: "Cut",
          icon: Icons.move(),
          shortcut: formatCommandShortcut("op.cut", shortcutPlatform),
          disabled: selectedCount === 0,
          onSelect: onCut,
        },
        {
          id: "new-file",
          label: "New File",
          icon: Icons.filePlus(),
          separatorBefore: true,
          onSelect: onCreateFile,
        },
        {
          id: "copy-path",
          label: "Copy Path",
          icon: Icons.file(),
          disabled: selectedCount === 0,
          onSelect: onCopyPath,
        },
        {
          id: "reveal",
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
          id: "checksum",
          label: "Checksum",
          icon: Icons.hash(),
          disabled: selectedCount === 0,
          onSelect: onChecksum,
        },
        {
          id: "select-all",
          label: "Select All",
          icon: Icons.file(),
          shortcut: formatCommandShortcut(
            "selection.selectAll",
            shortcutPlatform,
          ),
          separatorBefore: true,
          onSelect: onSelectAll,
        },
        {
          id: "hidden",
          label: showHidden ? "Hide Hidden" : "Show Hidden",
          icon: Icons.file(),
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
          id: "customize-toolbar",
          label: "Customize Button Bar…",
          icon: Icons.settings(),
          separatorBefore: true,
          onSelect: onCustomizeToolbar,
        },
        {
          id: "view-icons",
          label: "Icons view",
          icon: Icons.pictures(),
          checked: viewMode === "icons",
          onSelect: () => onViewMode("icons"),
        },
      ]}
    >
      {Icons.more()}
      <span className="fo-toolbar-label">More</span>
      {Icons.chevronDown()}
    </DropdownMenu>
  );
}
