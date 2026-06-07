import { useState } from "react";
import {
  Badge,
  DropdownMenu,
  Icons,
  ToolbarButton,
  type DropdownMenuItem,
} from "@fileoctopus/ui";
import { useTerminal } from "../app/providers/TerminalProvider";
import { toolbarCommandMeta } from "../commands/toolbarConfig";
import type { ToolbarCommandContext } from "../commands/toolbarCommandState";
import { isToolbarCommandDisabled } from "../commands/toolbarCommandState";
import type { CommandId } from "../commands/types";
import type { HotlistTarget } from "../shell/hotlistTargets";
import type { PaneLocationTargetAction } from "../navigation/driveTargets";
import {
  runToolbarCommand,
  type ToolbarActionHandlers,
} from "./toolbarActions";
import { toolbarCommandIcon } from "./toolbarIcons";
import type { ToolbarJobsDisplay } from "./toolbarJobsLabel";
import {
  isToolbarSectionVisible,
  type ToolbarOverflowTier,
} from "./toolbarOverflowTier";

export interface CommanderToolbarTailProps {
  overflowTier: ToolbarOverflowTier;
  commandContext: ToolbarCommandContext;
  handlers: ToolbarActionHandlers;
  hotlistTargets: HotlistTarget[];
  hotlistOverflow: HotlistTarget[];
  jobsDisplay: ToolbarJobsDisplay;
  onOpenTargetAction: (action: PaneLocationTargetAction) => void;
}

function TailButton({
  commandId,
  commandContext,
  handlers,
  className,
}: {
  commandId: CommandId;
  commandContext: ToolbarCommandContext;
  handlers: ToolbarActionHandlers;
  className?: string;
}) {
  const meta = toolbarCommandMeta(commandId);
  const disabled = isToolbarCommandDisabled(commandId, commandContext);
  const icon = toolbarCommandIcon(commandId);

  return (
    <ToolbarButton
      className={className}
      disabled={disabled}
      title={meta.tooltip}
      aria-label={meta.label}
      onClick={() => runToolbarCommand(commandId, handlers)}
    >
      {icon}
      <span className="fo-toolbar-label">{meta.label}</span>
    </ToolbarButton>
  );
}

export function CommanderToolbarTail({
  overflowTier,
  commandContext,
  handlers,
  hotlistTargets,
  hotlistOverflow,
  jobsDisplay,
  onOpenTargetAction,
}: CommanderToolbarTailProps) {
  const [syncOpen, setSyncOpen] = useState(false);
  const [hotlistOpen, setHotlistOpen] = useState(false);

  const showArchive = isToolbarSectionVisible("archive", overflowTier);
  const showCompare = isToolbarSectionVisible("compare", overflowTier);
  const showSync = isToolbarSectionVisible("sync", overflowTier);
  const showTerminal = isToolbarSectionVisible("terminal", overflowTier);
  const showHotlist = isToolbarSectionVisible("hotlist", overflowTier);
  const showNetwork = isToolbarSectionVisible("network", overflowTier);
  const showSettings = isToolbarSectionVisible("settings", overflowTier);

  const hotlistItems: DropdownMenuItem[] = [
    ...hotlistTargets.map((target) => ({
      id: target.id,
      label: target.label,
      icon: target.glyph,
      onSelect: () => onOpenTargetAction(target.action),
    })),
    ...hotlistOverflow.map((target) => ({
      id: target.id,
      label: target.label,
      icon: target.glyph,
      onSelect: () => onOpenTargetAction(target.action),
    })),
  ];

  const syncItems: DropdownMenuItem[] = [
    {
      id: "sync-directories",
      label: "Synchronize directories…",
      icon: Icons.move(),
      disabled: true,
      onSelect: () => undefined,
    },
    {
      id: "compare-name",
      label: "Compare by name",
      icon: Icons.copy(),
      disabled: true,
      onSelect: () => undefined,
    },
    {
      id: "compare-size",
      label: "Compare by size",
      icon: Icons.copy(),
      disabled: true,
      onSelect: () => undefined,
    },
    {
      id: "compare-modified",
      label: "Compare by modified time",
      icon: Icons.copy(),
      disabled: true,
      onSelect: () => undefined,
    },
    {
      id: "equalize",
      label: "Equalize panes",
      icon: Icons.move(),
      separatorBefore: true,
      onSelect: () => handlers.onCommand("layout.equalizePanes"),
    },
    {
      id: "swap",
      label: "Swap panes",
      icon: Icons.move(),
      onSelect: () => handlers.onCommand("layout.swapPanes"),
    },
  ];

  const showSearchGroup = true;

  return (
    <>
      {showArchive ? (
        <>
          <span className="fo-toolbar-separator" aria-hidden="true" />
          <div
            className="fo-toolbar-group fo-toolbar-group-archive"
            role="group"
            aria-label="Archive"
          >
            <TailButton
              commandId="op.compress"
              commandContext={commandContext}
              handlers={handlers}
            />
            <TailButton
              commandId="op.extract"
              commandContext={commandContext}
              handlers={handlers}
            />
          </div>
        </>
      ) : null}
      {showSearchGroup ? (
        <>
          <span className="fo-toolbar-separator" aria-hidden="true" />
          <div
            className="fo-toolbar-group fo-toolbar-group-search"
            role="group"
            aria-label="Search and sync"
          >
            <TailButton
              commandId="search.recursive"
              commandContext={commandContext}
              handlers={handlers}
            />
            {showCompare ? (
              <ToolbarButton
                disabled
                title="Compare directories (coming soon)"
                aria-label="Compare"
              >
                {Icons.copy()}
                <span className="fo-toolbar-label">Compare</span>
              </ToolbarButton>
            ) : null}
            {showSync ? (
              <DropdownMenu
                label="Sync"
                triggerAriaLabel="Synchronize panes"
                open={syncOpen}
                onOpenChange={setSyncOpen}
                items={syncItems}
              >
                {Icons.move()}
                <span className="fo-toolbar-label">Sync</span>
                {Icons.chevronDown()}
              </DropdownMenu>
            ) : null}
          </div>
        </>
      ) : null}
      <span className="fo-toolbar-separator" aria-hidden="true" />
      <div
        className="fo-toolbar-group fo-toolbar-group-tail"
        role="group"
        aria-label="Tools"
      >
        {showTerminal ? (
          <TerminalTailButton
            commandContext={commandContext}
            handlers={handlers}
          />
        ) : null}
        {showHotlist ? (
          <DropdownMenu
            label="Hotlist"
            triggerAriaLabel="Hotlist"
            open={hotlistOpen}
            onOpenChange={setHotlistOpen}
            items={
              hotlistItems.length > 0
                ? hotlistItems
                : [
                    {
                      id: "empty",
                      label: "No hotlist entries",
                      disabled: true,
                      onSelect: () => undefined,
                    },
                  ]
            }
          >
            {Icons.star()}
            <span className="fo-toolbar-label">Hotlist</span>
            {Icons.chevronDown()}
          </DropdownMenu>
        ) : null}
        {showNetwork ? (
          <ToolbarButton
            title="Network locations"
            aria-label="Network"
            onClick={() => handlers.onCommand("nav.networkLocations")}
          >
            {Icons.volume()}
            <span className="fo-toolbar-label">Network</span>
          </ToolbarButton>
        ) : null}
        <ToolbarButton
          className={
            jobsDisplay.activeCount > 0 ? "fo-toolbar-active-jobs" : undefined
          }
          title={toolbarCommandMeta("view.toggleActivity").tooltip}
          aria-label={
            jobsDisplay.activeCount > 0
              ? jobsDisplay.label
              : jobsDisplay.ariaLabel
          }
          onClick={() => handlers.onCommand("view.toggleActivity")}
        >
          {Icons.activity()}
          <span className="fo-toolbar-label">{jobsDisplay.label}</span>
        </ToolbarButton>
        {showSettings ? (
          <TailButton
            commandId="app.settings"
            commandContext={commandContext}
            handlers={handlers}
          />
        ) : null}
      </div>
    </>
  );
}

function TerminalTailButton({
  commandContext,
  handlers,
}: {
  commandContext: ToolbarCommandContext;
  handlers: ToolbarActionHandlers;
}) {
  const { terminal } = useTerminal();
  const runningCount = terminal.sessions.filter(
    (session) => session.status === "running",
  ).length;

  return (
    <span className="fo-toolbar-button-wrap">
      <TailButton
        commandId="op.openTerminal"
        commandContext={commandContext}
        handlers={handlers}
      />
      {runningCount > 0 ? (
        <Badge
          tone="accent"
          aria-label={`${runningCount} terminal sessions`}
          className="fo-toolbar-button-badge"
        >
          {runningCount}
        </Badge>
      ) : null}
    </span>
  );
}
