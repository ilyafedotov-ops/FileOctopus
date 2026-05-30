import type { ReactNode } from "react";

export { cx } from "./cx";
export {
  Button,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from "./Button";
export {
  IconButton,
  type IconButtonProps,
  type IconButtonSize,
} from "./IconButton";
export { ToolbarButton, type ToolbarButtonProps } from "./ToolbarButton";
export { Input, type InputProps } from "./Input";
export { SearchInput, type SearchInputProps } from "./SearchInput";
export { Badge, type BadgeProps, type BadgeTone } from "./Badge";
export { Panel, type PanelProps } from "./Panel";
export { Divider, type DividerProps } from "./Divider";
export { Tooltip, type TooltipProps } from "./Tooltip";
export {
  DropdownMenu,
  type DropdownMenuItem,
  type DropdownMenuProps,
} from "./DropdownMenu";
export { MenuSurface, type MenuSurfaceProps } from "./MenuSurface";
export {
  BreadcrumbPath,
  type BreadcrumbPathProps,
  type BreadcrumbSegment,
} from "./BreadcrumbPath";
export { Icons, fileEntryIcon, iconSize, renderIcon } from "./icons";
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentedOption,
} from "./SegmentedControl";

export interface ShellPanelProps {
  title: string;
  active?: boolean;
  children?: ReactNode;
}

export function ShellPanel({
  title,
  active = false,
  children,
}: ShellPanelProps) {
  return (
    <section className={active ? "fo-panel fo-panel-active" : "fo-panel"}>
      <header className="fo-panel-header">
        <span>{title}</span>
        <span>{active ? "Active" : "Ready"}</span>
      </header>
      <div className="fo-panel-body">{children}</div>
    </section>
  );
}
