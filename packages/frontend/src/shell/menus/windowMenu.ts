import type { DropdownMenuItem } from "@fileoctopus/ui";
import { menuShortcut } from "./types";
import type { MenuBarProps, MenuHelpers } from "./types";

export function buildWindowItems(
  props: MenuBarProps,
  { wrap, sep }: MenuHelpers,
): DropdownMenuItem[] {
  return [
    {
      id: "switch-pane",
      label: "Switch Active Pane",
      shortcut: menuShortcut("layout.switchPane"),
      onSelect: wrap(props.onSwitchPane),
    },
    sep("sep-dual"),
    {
      id: "toggle-dual",
      label: "Toggle Dual Pane",
      checked: props.dualPane,
      onSelect: wrap(props.onToggleDualPane),
    },
    {
      id: "swap-panes",
      label: "Swap Panes",
      shortcut: menuShortcut("layout.swapPanes"),
      onSelect: wrap(props.onSwapPanes),
    },
    {
      id: "equalize-panes",
      label: "Equalize Pane Widths",
      disabled: !props.dualPane,
      onSelect: wrap(props.onEqualizePanes),
    },
    {
      id: "toggle-direction",
      label: "Toggle Split Direction",
      disabled: !props.dualPane,
      onSelect: wrap(props.onTogglePaneDirection),
    },
  ];
}
