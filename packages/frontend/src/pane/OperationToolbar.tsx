import { useRef, useState } from "react";
import { Icons, ToolbarButton, DropdownMenu } from "@fileoctopus/ui";
import { useToolbarOverflowTier } from "../hooks/useToolbarOverflowTier";
import { useToolbarKeyboardNavigation } from "../hooks/useToolbarKeyboardNavigation";
import {
  toolbarCommandMeta,
  type ToolbarEntry,
} from "../commands/toolbarConfig";
import type { ToolbarCommandContext } from "../commands/toolbarCommandState";
import type { CommandId } from "../commands/types";
import type { HotlistTarget } from "../shell/hotlistTargets";
import type { PaneLocationTargetAction } from "../navigation/driveTargets";
import { CommanderToolbarButtons } from "./CommanderToolbarButtons";
import { CommanderToolbarTail } from "./CommanderToolbarTail";
import { CommanderToolbarOverflow } from "./CommanderToolbarOverflow";
import { type ToolbarDropdownsProps } from "./ToolbarDropdowns";
import type { ToolbarActionHandlers } from "./toolbarActions";
import type { ToolbarJobsDisplay } from "./toolbarJobsLabel";

export interface OperationToolbarProps extends ToolbarDropdownsProps {
  toolbarEntries: ToolbarEntry[];
  canGoBack: boolean;
  canGoForward: boolean;
  canGoUp: boolean;
  canView: boolean;
  canEdit: boolean;
  hotlistTargets: HotlistTarget[];
  hotlistOverflow: HotlistTarget[];
  driveVolumes: Array<{
    id: string;
    label: string;
    uri: string;
    isNetwork?: boolean;
    action: PaneLocationTargetAction;
  }>;
  jobsDisplay: ToolbarJobsDisplay;
  onBack: () => void;
  onForward: () => void;
  onUp: () => void;
  onRoot: () => void;
  onHome: () => void;
  onDrives: () => void;
  onRefresh: () => void;
  onCommandSearch: () => void;
  onView: () => void;
  onCommand: (commandId: CommandId) => void;
  onCustomizeToolbar: () => void;
  onOpenTargetAction: (action: PaneLocationTargetAction) => void;
}

function rootGlyph(): string {
  const platform = typeof navigator !== "undefined" ? navigator.platform : "";
  return platform.startsWith("Win") ? "\\" : "/";
}

export function OperationToolbar({
  toolbarEntries,
  canGoBack,
  canGoForward,
  canGoUp,
  canView,
  canEdit,
  hotlistTargets,
  hotlistOverflow,
  driveVolumes,
  jobsDisplay,
  onBack,
  onForward,
  onUp,
  onRoot,
  onHome,
  onDrives,
  onRefresh,
  onCommandSearch,
  onView,
  onCommand,
  onCustomizeToolbar,
  onOpenTargetAction,
  selectedCount,
  canRename,
  canPaste,
  ...dropdownProps
}: OperationToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const overflowTier = useToolbarOverflowTier(toolbarRef);
  useToolbarKeyboardNavigation(toolbarRef);
  const [drivesOpen, setDrivesOpen] = useState(false);
  const commandContext: ToolbarCommandContext = {
    selectedCount,
    canRename,
    canPaste,
    canView,
    canEdit,
  };

  const handlers: ToolbarActionHandlers = {
    onBack,
    onForward,
    onUp,
    onRoot,
    onHome,
    onDrives,
    onRefresh,
    onCommandSearch,
    onView,
    onCommand,
    onCustomizeToolbar,
    dropdowns: {
      selectedCount,
      canRename,
      canPaste,
      ...dropdownProps,
    },
  };

  return (
    <div
      ref={toolbarRef}
      className="fo-operation-toolbar"
      role="toolbar"
      aria-label="Commander toolbar"
      data-overflow-tier={overflowTier}
      onContextMenu={(event) => {
        event.preventDefault();
        onCustomizeToolbar();
      }}
    >
      <div
        className="fo-toolbar-group fo-toolbar-group-nav"
        role="group"
        aria-label="Navigation"
      >
        <ToolbarButton
          disabled={!canGoBack}
          onClick={onBack}
          title={toolbarCommandMeta("nav.back").tooltip}
          aria-label="Back"
          className="fo-toolbar-nav-btn"
        >
          {Icons.chevronLeft()}
        </ToolbarButton>
        <ToolbarButton
          disabled={!canGoForward}
          onClick={onForward}
          title={toolbarCommandMeta("nav.forward").tooltip}
          aria-label="Forward"
          className="fo-toolbar-nav-btn"
        >
          {Icons.chevronRight()}
        </ToolbarButton>
        <ToolbarButton
          disabled={!canGoUp}
          onClick={onUp}
          title={toolbarCommandMeta("nav.up").tooltip}
          aria-label="Up"
          className="fo-toolbar-nav-btn"
        >
          {Icons.arrowUp()}
        </ToolbarButton>
        <ToolbarButton
          onClick={onRoot}
          title={toolbarCommandMeta("nav.root").tooltip}
          aria-label="Root"
          className="fo-toolbar-nav-btn"
        >
          <span className="fo-toolbar-glyph" aria-hidden="true">
            {rootGlyph()}
          </span>
        </ToolbarButton>
        <ToolbarButton
          onClick={onHome}
          title={toolbarCommandMeta("nav.home").tooltip}
          aria-label="Home"
          className="fo-toolbar-nav-btn"
        >
          {Icons.home()}
        </ToolbarButton>
        <DropdownMenu
          label="Drives"
          triggerAriaLabel="Drives"
          open={drivesOpen}
          onOpenChange={setDrivesOpen}
          triggerClassName="fo-toolbar-nav-btn"
          items={[
            ...driveVolumes.map((volume) => ({
              id: volume.id,
              label: volume.label,
              icon: volume.isNetwork ? Icons.server() : Icons.volume(),
              onSelect: () => onOpenTargetAction(volume.action),
            })),
            {
              id: "network-neighborhood",
              label: "Network",
              icon: Icons.server(),
              separatorBefore: driveVolumes.length > 0,
              onSelect: () => onCommand("nav.networkLocations"),
            },
            {
              id: "all-drives",
              label: "Browse all drives…",
              icon: Icons.folder(),
              onSelect: onDrives,
            },
          ]}
        >
          {Icons.volume()}
          <span className="fo-toolbar-label fo-toolbar-label-compact">
            Drives
          </span>
          {Icons.chevronDown()}
        </DropdownMenu>
        <ToolbarButton
          onClick={onRefresh}
          title={toolbarCommandMeta("nav.refresh").tooltip}
          aria-label="Refresh"
          className="fo-toolbar-nav-btn"
        >
          {Icons.refresh()}
        </ToolbarButton>
      </div>
      <span className="fo-toolbar-separator" aria-hidden="true" />
      <CommanderToolbarButtons
        entries={toolbarEntries}
        commandContext={commandContext}
        handlers={handlers}
      />
      <CommanderToolbarTail
        overflowTier={overflowTier}
        commandContext={commandContext}
        handlers={handlers}
        hotlistTargets={hotlistTargets}
        hotlistOverflow={hotlistOverflow}
        jobsDisplay={jobsDisplay}
        onOpenTargetAction={onOpenTargetAction}
      />
      <span className="fo-toolbar-spacer" aria-hidden="true" />
      <div
        className="fo-toolbar-group fo-toolbar-group-overflow"
        role="group"
        aria-label="More commands"
      >
        <CommanderToolbarOverflow
          overflowTier={overflowTier}
          commandContext={commandContext}
          handlers={handlers}
          hotlistTargets={hotlistTargets}
          hotlistOverflow={hotlistOverflow}
          onCustomizeToolbar={onCustomizeToolbar}
          onOpenTargetAction={onOpenTargetAction}
        />
      </div>
    </div>
  );
}
