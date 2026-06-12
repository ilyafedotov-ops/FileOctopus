import type { DropdownMenuItem } from "@fileoctopus/ui";
import type { MenuBarProps, MenuHelpers } from "./types";
import { menuShortcut } from "./types";

export function buildToolsItems(
  props: MenuBarProps,
  { wrap, sep }: MenuHelpers,
): DropdownMenuItem[] {
  return [
    {
      id: "filter",
      label: "Filter Current Folder",
      shortcut: menuShortcut("search.focusFilter"),
      onSelect: wrap(props.onFilter),
    },
    {
      id: "search-recursive",
      label: "Search Recursively…",
      shortcut: menuShortcut("search.recursive"),
      onSelect: wrap(props.onSearchRecursive),
    },
    sep("sep-ops"),
    {
      id: "open-terminal",
      label: "Open Terminal",
      onSelect: wrap(props.onOpenTerminal),
    },
    {
      id: "open-terminal-external",
      label: "Open External Terminal",
      onSelect: wrap(props.onOpenTerminalExternal),
    },
    {
      id: "toggle-terminal",
      label: "Toggle Terminal Panel",
      onSelect: wrap(props.onToggleTerminal),
    },
    {
      id: "checksum",
      label: "Checksum…",
      disabled: !props.hasSelection,
      onSelect: wrap(props.onChecksum),
    },
    {
      id: "calculate-size",
      label: "Calculate Size",
      disabled: !props.hasSelection,
      onSelect: wrap(props.onCalculateSize),
    },
    {
      id: "job-activity",
      label: "Job Activity…",
      onSelect: wrap(props.onJobActivity),
    },
    {
      id: "operation-history",
      label: "Operation History…",
      onSelect: wrap(props.onOperationHistory),
    },
  ];
}
