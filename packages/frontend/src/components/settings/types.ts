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
  description: string;
  icon?: string;
  children?: SettingsTreeItem[];
}

export const SETTINGS_TREE: SettingsTreeItem[] = [
  {
    id: "general",
    label: "General",
    description: "Startup behavior, autostart, and diagnostics.",
  },
  {
    id: "display",
    label: "Display",
    description: "Theme, density, font size, and icon size.",
  },
  {
    id: "colors",
    label: "Colors",
    description: "Accent color selection for the interface.",
  },
  {
    id: "layout",
    label: "Layout",
    description: "Sidebar, panels, status bar, and toolbar visibility.",
  },
  {
    id: "layout-profiles",
    label: "Layout Profiles",
    description: "Save and switch between workspace layouts.",
  },
  {
    id: "file-list",
    label: "File List",
    description: "Default view mode, hidden files, and column presets.",
  },
  {
    id: "operations",
    label: "Operations",
    description: "Confirmations, trash, and conflict policies.",
  },
  {
    id: "terminal",
    label: "Terminal",
    description: "Shell program, arguments, and pane terminal behavior.",
  },
  {
    id: "keyboard",
    label: "Keyboard",
    description: "View and customize keyboard shortcuts.",
  },
  {
    id: "advanced",
    label: "Advanced",
    description: "Log level, experimental features, cache, and threads.",
  },
  {
    id: "network",
    label: "Network",
    description: "Connection timeout, auto-reconnect, and SSH keys.",
  },
  {
    id: "editor",
    label: "Editor",
    description: "Font, tabs, word wrap, and syntax highlighting.",
  },
  {
    id: "viewer",
    label: "Viewer",
    description: "View mode, image zoom, media autoplay, and file size.",
  },
];
