export type DocBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] };

export interface DocSection {
  id: string;
  title: string;
  blocks: DocBlock[];
}

export const documentationSections: DocSection[] = [
  {
    id: "overview",
    title: "Overview",
    blocks: [
      {
        kind: "paragraph",
        text: "FileOctopus is a dual-pane desktop file manager. Every panel shows one folder; the active panel is the target for most actions. Use the menu bar, toolbar, context menu, command palette, or keyboard shortcuts to drive the same operations.",
      },
      {
        kind: "list",
        items: [
          "Open the command palette with Ctrl/Cmd+P to search every command.",
          "Open Keyboard Shortcuts (Ctrl/Cmd+/) for the platform-formatted list — it is also included at the end of this guide.",
          "Shortcuts are ignored while typing in inputs, text areas, or the embedded terminal.",
        ],
      },
    ],
  },
  {
    id: "navigation",
    title: "Navigation",
    blocks: [
      {
        kind: "list",
        items: [
          "Navigate via the sidebar, breadcrumbs, the path entry (Ctrl/Cmd+L), or the Back / Forward history buttons (Alt+Left / Alt+Right).",
          "Go up to the parent folder with Backspace or Alt+Up.",
          "Switch the active pane with Tab; swap or equalize panes from the Window menu.",
          "Use Go → Drives to mount points and Go → Network for remote locations.",
        ],
      },
    ],
  },
  {
    id: "selecting-opening",
    title: "Selecting & opening",
    blocks: [
      {
        kind: "list",
        items: [
          "Arrow keys, Page Up/Down, Home, and End move the selection in the file table.",
          "Enter opens the selected folder in-app, or opens a file with the OS default application.",
          "F3 views a file in the built-in viewer; F4 edits text files in the built-in editor.",
          "Space toggles a quick text preview for text-type files.",
          "Ctrl/Cmd+A selects all visible items; Esc clears the selection.",
        ],
      },
    ],
  },
  {
    id: "file-operations",
    title: "File operations",
    blocks: [
      {
        kind: "paragraph",
        text: "Copy, move, rename, pack, and delete run as tracked jobs with progress and cancellation. Long operations appear in the activity panel; cancel them from the job card while running.",
      },
      {
        kind: "list",
        items: [
          "Copy / Cut / Paste with Ctrl/Cmd+C, Ctrl/Cmd+X, Ctrl/Cmd+V (internal clipboard).",
          "Copy To… (F5) and Move To… (F6) copy or move the selection to a chosen folder.",
          "Rename with F2; rename many items at once with Tools → Multi-Rename.",
          "Delete with Delete permanently removes items by default; enable Use Trash for Delete in Settings to move items to Trash instead. Shift+Delete always deletes permanently.",
          "Properties (Ctrl/Cmd+I or Alt+Enter) shows size, paths, and an optional checksum.",
        ],
      },
    ],
  },
  {
    id: "creating",
    title: "Creating items",
    blocks: [
      {
        kind: "list",
        items: [
          "New Folder (F7) and New File create items in the active folder.",
          "Pack the selection into an archive, or Unpack an existing archive in place.",
        ],
      },
    ],
  },
  {
    id: "views-sorting",
    title: "Views & sorting",
    blocks: [
      {
        kind: "list",
        items: [
          "Switch between Details, List, Compact, Icons, and Columns from the View menu or toolbar.",
          "Sort by name, size, type, or modified date, ascending or descending.",
          "Toggle hidden files with Ctrl/Cmd+. or Ctrl/Cmd+H.",
          "Toggle the sidebar, toolbar, status bar, dual pane, and split direction from the View menu.",
        ],
      },
    ],
  },
  {
    id: "search-filter",
    title: "Search & filter",
    blocks: [
      {
        kind: "list",
        items: [
          "Filter the current folder as you type with Ctrl/Cmd+F.",
          "Run a recursive search across subfolders with Ctrl/Cmd+Shift+F.",
          "Content search scans inside files for matching text.",
        ],
      },
    ],
  },
  {
    id: "network",
    title: "Network locations",
    blocks: [
      {
        kind: "list",
        items: [
          "Add a server (SFTP, SMB, S3, and cloud providers) from Go → Add Server.",
          "Connect, disconnect, and browse saved profiles from Go → Network.",
          "Credentials are stored in the OS keychain, never in plain configuration.",
        ],
      },
    ],
  },
  {
    id: "terminal",
    title: "Terminal",
    blocks: [
      {
        kind: "list",
        items: [
          "Open an embedded terminal rooted at the active folder, or launch your external terminal there.",
          "Toggle the terminal panel from the toolbar or the View menu.",
        ],
      },
    ],
  },
  {
    id: "diagnostics",
    title: "Diagnostics & history",
    blocks: [
      {
        kind: "list",
        items: [
          "Tools → Operation History opens the full record of completed operations.",
          "Help → Diagnostics shows version, build profile, target OS, commit SHA, schema version, and data/log paths.",
          "Export Diagnostics Bundle writes a redacted zip useful when reporting a problem.",
        ],
      },
    ],
  },
];
