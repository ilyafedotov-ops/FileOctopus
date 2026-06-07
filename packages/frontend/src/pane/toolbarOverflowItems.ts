import type { DropdownMenuItem } from "@fileoctopus/ui";
import { Icons } from "@fileoctopus/ui";
import { toolbarCommandMeta } from "../commands/toolbarConfig";
import {
  isToolbarCommandDisabled,
  type ToolbarCommandContext,
} from "../commands/toolbarCommandState";
import type { HotlistTarget } from "../shell/hotlistTargets";
import type { PaneLocationTargetAction } from "../navigation/driveTargets";
import {
  runToolbarCommand,
  type ToolbarActionHandlers,
} from "./toolbarActions";
import {
  isToolbarSectionVisible,
  type ToolbarOverflowTier,
} from "./toolbarOverflowTier";

export interface CollapsedToolbarItemsParams {
  tier: ToolbarOverflowTier;
  commandContext: ToolbarCommandContext;
  handlers: ToolbarActionHandlers;
  hotlistTargets: HotlistTarget[];
  hotlistOverflow: HotlistTarget[];
  onOpenTargetAction: (action: PaneLocationTargetAction) => void;
}

export function buildCollapsedToolbarItems({
  tier,
  commandContext,
  handlers,
  hotlistTargets,
  hotlistOverflow,
  onOpenTargetAction,
}: CollapsedToolbarItemsParams): DropdownMenuItem[] {
  const items: DropdownMenuItem[] = [];

  if (!isToolbarSectionVisible("archive", tier)) {
    items.push(
      {
        id: "collapsed-pack",
        label: toolbarCommandMeta("op.compress").label,
        icon: Icons.archive(),
        disabled: isToolbarCommandDisabled("op.compress", commandContext),
        onSelect: () => runToolbarCommand("op.compress", handlers),
      },
      {
        id: "collapsed-unpack",
        label: toolbarCommandMeta("op.extract").label,
        icon: Icons.archive(),
        disabled: isToolbarCommandDisabled("op.extract", commandContext),
        onSelect: () => runToolbarCommand("op.extract", handlers),
      },
    );
  }

  if (!isToolbarSectionVisible("sync", tier)) {
    items.push(
      {
        id: "collapsed-equalize",
        label: "Equalize panes",
        icon: Icons.move(),
        separatorBefore: items.length > 0,
        onSelect: () => handlers.onCommand("layout.equalizePanes"),
      },
      {
        id: "collapsed-swap",
        label: "Swap panes",
        icon: Icons.move(),
        onSelect: () => handlers.onCommand("layout.swapPanes"),
      },
    );
  }

  if (!isToolbarSectionVisible("terminal", tier)) {
    items.push({
      id: "collapsed-terminal",
      label: toolbarCommandMeta("op.openTerminal").label,
      icon: Icons.terminal(),
      separatorBefore: items.length > 0,
      onSelect: () => runToolbarCommand("op.openTerminal", handlers),
    });
  }

  if (!isToolbarSectionVisible("hotlist", tier)) {
    const hotlistEntries = [...hotlistTargets, ...hotlistOverflow];
    const hotlistStartIndex = items.length;
    if (hotlistEntries.length > 0) {
      items.push(
        ...hotlistEntries.map((target, index) => ({
          id: `collapsed-hotlist-${target.id}`,
          label: target.label,
          icon: target.glyph,
          separatorBefore: hotlistStartIndex > 0 && index === 0,
          onSelect: () => onOpenTargetAction(target.action),
        })),
      );
    } else {
      items.push({
        id: "collapsed-hotlist-empty",
        label: "Hotlist",
        icon: Icons.star(),
        disabled: true,
        separatorBefore: items.length > 0,
        onSelect: () => undefined,
      });
    }
  }

  if (!isToolbarSectionVisible("settings", tier)) {
    items.push({
      id: "collapsed-settings",
      label: toolbarCommandMeta("app.settings").label,
      icon: Icons.settings(),
      separatorBefore: items.length > 0,
      onSelect: () => runToolbarCommand("app.settings", handlers),
    });
  }

  return items;
}
