import { Icons, type DropdownMenuItem } from "@fileoctopus/ui";
import type { MenuBarProps, MenuHelpers } from "./types";
import { menuShortcut, platformShortcut } from "./types";

export function buildFileItems(
  props: MenuBarProps,
  { wrap, sep }: MenuHelpers,
): DropdownMenuItem[] {
  return [
    {
      id: "new-folder",
      label: "New Folder…",
      shortcut: menuShortcut("create.folder"),
      onSelect: wrap(props.onNewFolder),
    },
    { id: "new-file", label: "Empty File…", onSelect: wrap(props.onNewFile) },
    sep("sep-open"),
    {
      id: "open-selected",
      label: "Open Selected",
      shortcut: menuShortcut("op.open"),
      disabled: !props.hasSelection,
      onSelect: wrap(props.onOpenSelected),
    },
    {
      id: "view-selected",
      label: "View",
      shortcut: menuShortcut("op.view"),
      onSelect: wrap(props.onView),
    },
    {
      id: "edit-selected",
      label: "Edit",
      shortcut: menuShortcut("op.edit"),
      disabled: !props.hasSelection,
      onSelect: wrap(props.onEdit),
    },
    {
      id: "open-default",
      label: "Open With Default App",
      shortcut: menuShortcut("op.openDefault"),
      disabled: !props.hasSelection,
      onSelect: wrap(props.onOpenWithDefaultApp),
    },
    {
      id: "reveal-fm",
      label: "Reveal in System File Manager",
      disabled: !props.hasSelection,
      onSelect: wrap(props.onRevealInFileManager),
    },
    sep("sep-actions"),
    {
      id: "rename",
      label: "Rename…",
      shortcut: menuShortcut("op.rename"),
      disabled: !props.hasSelection,
      onSelect: wrap(props.onRename),
    },
    {
      id: "copy-to",
      label: "Copy To…",
      shortcut: menuShortcut("op.copyTo"),
      disabled: !props.hasSelection,
      onSelect: wrap(props.onCopyTo),
    },
    {
      id: "move-to",
      label: "Move To…",
      shortcut: menuShortcut("op.moveTo"),
      disabled: !props.hasSelection,
      onSelect: wrap(props.onMoveTo),
    },
    {
      id: "delete-default",
      label: "Delete…",
      shortcut: menuShortcut("op.delete"),
      disabled: !props.hasSelection,
      danger: true,
      onSelect: wrap(props.onDelete),
    },
    {
      id: "compress",
      label: "Pack…",
      disabled: !props.hasSelection,
      onSelect: wrap(props.onCompress),
    },
    {
      id: "extract",
      label: "Unpack…",
      disabled: !props.hasSelection,
      onSelect: wrap(props.onExtract),
    },
    {
      id: "delete",
      label: "Delete Permanently…",
      shortcut: menuShortcut("op.deletePermanent"),
      disabled: !props.hasSelection,
      danger: true,
      onSelect: wrap(props.onDeletePermanently),
    },
    {
      id: "properties",
      label: "Properties…",
      icon: Icons.info(),
      shortcut: menuShortcut("op.properties"),
      disabled: !props.hasSelection,
      onSelect: wrap(props.onProperties),
    },
    sep("sep-settings"),
    {
      id: "settings",
      label: "Settings…",
      icon: Icons.settings(),
      shortcut: menuShortcut("app.settings"),
      onSelect: wrap(props.onSettings),
    },
    {
      id: "exit",
      label: "Exit",
      icon: Icons.logOut(),
      shortcut: platformShortcut("⌘Q", "Ctrl+Q"),
      onSelect: wrap(props.onExit),
    },
  ];
}
