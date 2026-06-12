import type { DropdownMenuItem } from "@fileoctopus/ui";
import { menuShortcut } from "./types";
import type { MenuBarProps, MenuHelpers } from "./types";

export function buildViewItems(
  props: MenuBarProps,
  { wrap, wrapArg, sep }: MenuHelpers,
): DropdownMenuItem[] {
  return [
    {
      id: "view-details",
      label: "Details View",
      checked: props.viewMode === "details",
      onSelect: wrapArg(props.onViewMode, "details"),
    },
    {
      id: "view-list",
      label: "List View",
      checked: props.viewMode === "list",
      onSelect: wrapArg(props.onViewMode, "list"),
    },
    {
      id: "view-compact",
      label: "Compact View",
      checked: props.viewMode === "compact",
      onSelect: wrapArg(props.onViewMode, "compact"),
    },
    {
      id: "view-icons",
      label: "Icons View",
      checked: props.viewMode === "icons",
      onSelect: wrapArg(props.onViewMode, "icons"),
    },
    {
      id: "view-columns",
      label: "Columns View",
      checked: props.viewMode === "columns",
      onSelect: wrapArg(props.onViewMode, "columns"),
    },
    sep("sep-sort"),
    {
      id: "sort-by",
      label: "Sort By",
      onSelect: () => {},
      children: [
        {
          id: "sort-name",
          label: "Name",
          checked: props.sortField === "name",
          onSelect: wrapArg(props.onSortBy, "name"),
        },
        {
          id: "sort-type",
          label: "Type",
          checked: props.sortField === "type",
          onSelect: wrapArg(props.onSortBy, "type"),
        },
        {
          id: "sort-size",
          label: "Size",
          checked: props.sortField === "size",
          onSelect: wrapArg(props.onSortBy, "size"),
        },
        {
          id: "sort-date-modified",
          label: "Date Modified",
          checked: props.sortField === "modified",
          onSelect: wrapArg(props.onSortBy, "modified"),
        },
        {
          id: "sort-date-created",
          label: "Date Created",
          checked: props.sortField === "created",
          onSelect: wrapArg(props.onSortBy, "created"),
        },
        {
          id: "sort-extension",
          label: "Extension",
          checked: props.sortField === "extension",
          onSelect: wrapArg(props.onSortBy, "extension"),
        },
        {
          id: "sort-permissions",
          label: "Permissions",
          checked: props.sortField === "permissions",
          onSelect: wrapArg(props.onSortBy, "permissions"),
        },
        {
          id: "sort-owner",
          label: "Owner",
          checked: props.sortField === "owner",
          onSelect: wrapArg(props.onSortBy, "owner"),
        },
        {
          id: "sort-asc",
          label: "Ascending",
          separatorBefore: true,
          checked: props.sortDirection === "asc",
          onSelect: wrapArg(props.onSortDirection, "ascending"),
        },
        {
          id: "sort-desc",
          label: "Descending",
          checked: props.sortDirection === "desc",
          onSelect: wrapArg(props.onSortDirection, "descending"),
        },
      ],
    },
    sep("sep-appearance"),
    {
      id: "theme",
      label: "Theme",
      onSelect: () => {},
      children: [
        {
          id: "theme-system",
          label: "System",
          checked: props.theme === "system",
          onSelect: wrapArg(props.onTheme, "system"),
        },
        {
          id: "theme-light",
          label: "Light",
          checked: props.theme === "light",
          onSelect: wrapArg(props.onTheme, "light"),
        },
        {
          id: "theme-dark",
          label: "Dark",
          checked: props.theme === "dark",
          onSelect: wrapArg(props.onTheme, "dark"),
        },
      ],
    },
    {
      id: "density",
      label: "Density",
      onSelect: () => {},
      children: [
        {
          id: "density-compact",
          label: "Compact",
          checked: props.density === "compact",
          onSelect: wrapArg(props.onDensity, "compact"),
        },
        {
          id: "density-comfortable",
          label: "Comfortable",
          checked: props.density === "comfortable",
          onSelect: wrapArg(props.onDensity, "comfortable"),
        },
        {
          id: "density-spacious",
          label: "Spacious",
          checked: props.density === "spacious",
          onSelect: wrapArg(props.onDensity, "spacious"),
        },
      ],
    },
    sep("sep-layout"),
    {
      id: "toggle-sidebar",
      label: "Show Sidebar",
      checked: props.sidebarVisible,
      onSelect: wrap(props.onToggleSidebar),
    },
    {
      id: "toggle-toolbar",
      label: "Show Toolbar",
      checked: props.toolbarVisible,
      onSelect: wrap(props.onToggleToolbar),
    },
    {
      id: "customize-toolbar",
      label: "Customize Button Bar…",
      disabled: !props.toolbarVisible,
      onSelect: wrap(props.onCustomizeToolbar),
    },
    {
      id: "toggle-statusbar",
      label: "Show Status Bar",
      checked: props.statusBarVisible,
      onSelect: wrap(props.onToggleStatusBar),
    },
    {
      id: "toggle-dualpane",
      label: "Dual Pane",
      checked: props.dualPane,
      onSelect: wrap(props.onToggleDualPane),
    },
    {
      id: "toggle-pane-direction",
      label:
        props.paneDirection === "vertical"
          ? "Split: Vertical"
          : "Split: Horizontal",
      disabled: !props.dualPane,
      onSelect: wrap(props.onTogglePaneDirection),
    },
    sep("sep-hidden"),
    {
      id: "toggle-hidden",
      label: "Show Hidden Files",
      checked: props.showHidden,
      shortcut: menuShortcut("view.toggleHidden"),
      onSelect: wrap(props.onToggleHidden),
    },
    {
      id: "refresh",
      label: "Refresh",
      shortcut: menuShortcut("nav.refresh"),
      separatorBefore: true,
      onSelect: wrap(props.onRefresh),
    },
  ];
}
