export type SettingsCategory =
  | "general"
  | "display"
  | "colors"
  | "layout"
  | "layout-profiles"
  | "file-list"
  | "operations"
  | "terminal"
  | "keyboard"
  | "advanced"
  | "network"
  | "editor"
  | "viewer";

export interface SettingsTreeItem {
  id: SettingsCategory;
  label: string;
  icon?: string;
  children?: SettingsTreeItem[];
}

export const SETTINGS_TREE: SettingsTreeItem[] = [
  { id: "general", label: "General" },
  { id: "display", label: "Display" },
  { id: "colors", label: "Colors" },
  { id: "layout", label: "Layout" },
  { id: "layout-profiles", label: "Layout Profiles" },
  { id: "file-list", label: "File List" },
  { id: "operations", label: "Operations" },
  { id: "terminal", label: "Terminal" },
  { id: "keyboard", label: "Keyboard" },
  { id: "advanced", label: "Advanced" },
  { id: "network", label: "Network" },
  { id: "editor", label: "Editor" },
  { id: "viewer", label: "Viewer" },
];
