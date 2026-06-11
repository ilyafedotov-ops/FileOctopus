import { Icons, type DropdownMenuItem } from "@fileoctopus/ui";
import type { MenuBarProps, MenuHelpers } from "./types";

export function buildGoItems(
  props: MenuBarProps,
  { wrap, wrapArg, sep }: MenuHelpers,
): DropdownMenuItem[] {
  return [
    {
      id: "back",
      label: "Back",
      shortcut: "Alt+←",
      disabled: !props.canGoBack,
      onSelect: wrap(props.onBack),
    },
    {
      id: "forward",
      label: "Forward",
      shortcut: "Alt+→",
      disabled: !props.canGoForward,
      onSelect: wrap(props.onForward),
    },
    {
      id: "up",
      label: "Up to Parent",
      shortcut: "Backspace",
      onSelect: wrap(props.onUp),
    },
    {
      id: "home",
      label: "Home",
      shortcut: "Alt+Home",
      onSelect: wrap(props.onHome),
    },
    sep("sep-location"),
    {
      id: "go-location",
      label: "Location…",
      shortcut: "Ctrl+L",
      onSelect: wrap(props.onGoToLocation),
    },
    {
      id: "go-volumes",
      label: "Volumes…",
      onSelect: wrap(props.onVolumePicker),
    },
    {
      id: "go-network",
      label: "Network Locations",
      icon: Icons.server(),
      onSelect: wrap(props.onNetworkLocations),
    },
    {
      id: "go-add-server",
      label: "Add Connection…",
      onSelect: wrap(props.onAddServer),
    },
    sep("sep-stdloc"),
    {
      id: "loc-desktop",
      label: "Desktop",
      onSelect: wrapArg(props.goStandardLocation, "desktop"),
    },
    {
      id: "loc-documents",
      label: "Documents",
      onSelect: wrapArg(props.goStandardLocation, "documents"),
    },
    {
      id: "loc-downloads",
      label: "Downloads",
      onSelect: wrapArg(props.goStandardLocation, "downloads"),
    },
    {
      id: "loc-pictures",
      label: "Pictures",
      onSelect: wrapArg(props.goStandardLocation, "pictures"),
    },
    {
      id: "loc-music",
      label: "Music",
      onSelect: wrapArg(props.goStandardLocation, "music"),
    },
    {
      id: "loc-videos",
      label: "Videos",
      onSelect: wrapArg(props.goStandardLocation, "videos"),
    },
    sep("sep-favorites"),
    {
      id: "add-favorite",
      label: "Add Current Folder",
      onSelect: wrap(props.onAddFavorite),
    },
    {
      id: "manage-favorites",
      label: "Manage Favorites…",
      onSelect: wrap(props.onManageFavorites),
    },
    ...(props.starredLocations.length > 0
      ? [
          sep("sep-starred"),
          ...props.starredLocations.slice(0, 10).map(
            (loc): DropdownMenuItem => ({
              id: "starred-" + loc.uri,
              label: loc.label,
              icon: Icons.star(),
              onSelect: wrapArg(props.goStandardLocation, loc.uri),
            }),
          ),
        ]
      : []),
    sep("sep-recent"),
    ...props.recentLocations.slice(0, 10).map(
      (loc): DropdownMenuItem => ({
        id: "recent-" + loc.uri,
        label: loc.label,
        onSelect: wrapArg(props.goStandardLocation, loc.uri),
      }),
    ),
    ...(props.recentLocations.length > 10
      ? [
          {
            id: "show-all-recent",
            label: "Show All Recent Locations…",
            onSelect: wrap(props.onShowRecentLocations),
          },
        ]
      : []),
    {
      id: "clear-recent",
      label: "Clear Recent Locations…",
      disabled: props.recentLocations.length === 0,
      onSelect: wrap(props.onClearRecentLocations),
    },
  ];
}
