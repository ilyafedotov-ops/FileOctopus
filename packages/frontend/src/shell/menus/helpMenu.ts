import type { DropdownMenuItem } from "@fileoctopus/ui";
import { menuShortcut } from "./types";
import type { MenuBarProps, MenuHelpers } from "./types";

export function buildHelpItems(
  props: MenuBarProps,
  { wrap, sep }: MenuHelpers,
): DropdownMenuItem[] {
  return [
    {
      id: "shortcuts",
      label: "Keyboard Shortcuts…",
      shortcut: menuShortcut("app.shortcuts"),
      onSelect: wrap(props.onShortcuts),
    },
    {
      id: "documentation",
      label: "Documentation…",
      onSelect: wrap(props.onDocumentation),
    },
    sep("sep-diag"),
    {
      id: "diagnostics",
      label: "Diagnostics…",
      onSelect: wrap(props.onDiagnostics),
    },
    {
      id: "export-diagnostics",
      label: "Export Diagnostics Bundle…",
      onSelect: wrap(props.onExportDiagnostics),
    },
    sep("sep-about"),
    { id: "about", label: "About FileOctopus…", onSelect: wrap(props.onAbout) },
  ];
}
