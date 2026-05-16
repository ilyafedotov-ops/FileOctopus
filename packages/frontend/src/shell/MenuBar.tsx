import { useState, useCallback, useEffect, useRef } from "react";
import { DropdownMenu, type DropdownMenuItem } from "@fileoctopus/ui";

export interface MenuBarProps {
  activePanelId: "left" | "right";
  onBack: () => void;
  onForward: () => void;
  onUp: () => void;
  onHome: () => void;
  onGoToLocation: () => void;
  goStandardLocation: (loc: string) => void;
  onNewFolder: () => void;
  onNewFile: () => void;
  onOpenSelected: () => void;
  onOpenWithDefaultApp: () => void;
  onRevealInFileManager: () => void;
  onRename: () => void;
  onCopyTo: () => void;
  onMoveTo: () => void;
  onTrash: () => void;
  onDeletePermanently: () => void;
  onProperties: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onClearClipboard: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onInvertSelection: () => void;
  onCopyPath: () => void;
  onCopyName: () => void;
  onCopyParentPath: () => void;
  onCopyResourceUri: () => void;
  onViewMode: (mode: string) => void;
  onSortBy: (field: string) => void;
  onSortDirection: (dir: string) => void;
  onTheme: (theme: string) => void;
  onDensity: (density: string) => void;
  onToggleSidebar: () => void;
  onToggleToolbar: () => void;
  onToggleStatusBar: () => void;
  onToggleDualPane: () => void;
  onToggleHidden: () => void;
  onRefresh: () => void;
  onAddFavorite: () => void;
  onManageFavorites: () => void;
  onFilter: () => void;
  onSearchRecursive: () => void;
  onJobActivity: () => void;
  onDiagnostics: () => void;
  onExportDiagnostics: () => void;
  onSwitchPane: () => void;
  onSwapPanes: () => void;
  onEqualizePanes: () => void;
  onShortcuts: () => void;
  onDocumentation: () => void;
  onReportIssue: () => void;
  onAbout: () => void;
  onSettings: () => void;
  onExit: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  hasSelection: boolean;
  hasClipboard: boolean;
  sidebarVisible: boolean;
  toolbarVisible: boolean;
  statusBarVisible: boolean;
  dualPane: boolean;
  showHidden: boolean;
}

type MenuId = "file" | "edit" | "view" | "go" | "tools" | "window" | "help";

const MENU_ORDER: MenuId[] = [
  "file",
  "edit",
  "view",
  "go",
  "tools",
  "window",
  "help",
];

const MENU_MNEMONICS: Record<MenuId, string> = {
  file: "F",
  edit: "E",
  view: "V",
  go: "G",
  tools: "T",
  window: "W",
  help: "H",
};

export function MenuBar(props: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const menubarRef = useRef<HTMLDivElement>(null);

  const closeAll = useCallback(() => setOpenMenu(null), []);

  const handleHover = useCallback(
    (id: MenuId) => {
      if (openMenu !== null && openMenu !== id) {
        setOpenMenu(id);
      }
    },
    [openMenu],
  );

  useEffect(() => {
    if (openMenu === null) return;

    const onPointerDown = (event: MouseEvent) => {
      if (
        menubarRef.current &&
        !menubarRef.current.contains(event.target as Node)
      ) {
        closeAll();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAll();
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const idx = MENU_ORDER.indexOf(openMenu);
        const next =
          event.key === "ArrowRight"
            ? MENU_ORDER[(idx + 1) % MENU_ORDER.length]
            : MENU_ORDER[(idx - 1 + MENU_ORDER.length) % MENU_ORDER.length];
        setOpenMenu(next);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu, closeAll]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      const key = event.key.toUpperCase();
      for (const id of MENU_ORDER) {
        if (MENU_MNEMONICS[id] === key) {
          event.preventDefault();
          setOpenMenu(id);
          return;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const wrap = (fn: () => void) => () => {
    closeAll();
    fn();
  };

  const wrapArg = (fn: (arg: string) => void, arg: string) => () => {
    closeAll();
    fn(arg);
  };

  const sep = (id: string): DropdownMenuItem => ({
    id,
    label: "",
    separatorBefore: true,
    onSelect: () => {},
  });

  const fileItems: DropdownMenuItem[] = [
    {
      id: "new-folder",
      label: "New Folder…",
      shortcut: "Ctrl+N",
      onSelect: wrap(props.onNewFolder),
    },
    { id: "new-file", label: "Empty File…", onSelect: wrap(props.onNewFile) },
    sep("sep-open"),
    {
      id: "open-selected",
      label: "Open Selected",
      shortcut: "Enter",
      disabled: !props.hasSelection,
      onSelect: wrap(props.onOpenSelected),
    },
    {
      id: "open-default",
      label: "Open With Default App",
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
      shortcut: "F2",
      disabled: !props.hasSelection,
      onSelect: wrap(props.onRename),
    },
    {
      id: "copy-to",
      label: "Copy To…",
      disabled: !props.hasSelection,
      onSelect: wrap(props.onCopyTo),
    },
    {
      id: "move-to",
      label: "Move To…",
      disabled: !props.hasSelection,
      onSelect: wrap(props.onMoveTo),
    },
    {
      id: "trash",
      label: "Move to Trash…",
      shortcut: "Delete",
      disabled: !props.hasSelection,
      onSelect: wrap(props.onTrash),
    },
    {
      id: "delete",
      label: "Delete Permanently…",
      shortcut: "Shift+Delete",
      disabled: !props.hasSelection,
      danger: true,
      onSelect: wrap(props.onDeletePermanently),
    },
    {
      id: "properties",
      label: "Properties…",
      shortcut: "Ctrl+I",
      disabled: !props.hasSelection,
      onSelect: wrap(props.onProperties),
    },
    sep("sep-settings"),
    {
      id: "settings",
      label: "Settings…",
      shortcut: "Ctrl+,",
      onSelect: wrap(props.onSettings),
    },
    {
      id: "exit",
      label: "Exit",
      shortcut: "Ctrl+Q",
      onSelect: wrap(props.onExit),
    },
  ];

  const editItems: DropdownMenuItem[] = [
    {
      id: "cut",
      label: "Cut",
      shortcut: "Ctrl+X",
      disabled: !props.hasSelection,
      onSelect: wrap(props.onCut),
    },
    {
      id: "copy",
      label: "Copy",
      shortcut: "Ctrl+C",
      disabled: !props.hasSelection,
      onSelect: wrap(props.onCopy),
    },
    {
      id: "paste",
      label: "Paste",
      shortcut: "Ctrl+V",
      disabled: !props.hasClipboard,
      onSelect: wrap(props.onPaste),
    },
    {
      id: "clear-clipboard",
      label: "Clear File Clipboard",
      disabled: !props.hasClipboard,
      onSelect: wrap(props.onClearClipboard),
    },
    sep("sep-selection"),
    {
      id: "select-all",
      label: "Select All",
      shortcut: "Ctrl+A",
      onSelect: wrap(props.onSelectAll),
    },
    {
      id: "clear-selection",
      label: "Clear Selection",
      disabled: !props.hasSelection,
      onSelect: wrap(props.onClearSelection),
    },
    {
      id: "invert-selection",
      label: "Invert Selection",
      onSelect: wrap(props.onInvertSelection),
    },
    sep("sep-copy-text"),
    {
      id: "copy-path",
      label: "Copy Full Path",
      disabled: !props.hasSelection,
      onSelect: wrap(props.onCopyPath),
    },
    {
      id: "copy-name",
      label: "Copy File Name",
      disabled: !props.hasSelection,
      onSelect: wrap(props.onCopyName),
    },
    {
      id: "copy-parent-path",
      label: "Copy Parent Folder Path",
      disabled: !props.hasSelection,
      onSelect: wrap(props.onCopyParentPath),
    },
    {
      id: "copy-uri",
      label: "Copy Resource URI",
      disabled: !props.hasSelection,
      onSelect: wrap(props.onCopyResourceUri),
    },
  ];

  const viewItems: DropdownMenuItem[] = [
    {
      id: "view-details",
      label: "Details View",
      onSelect: wrapArg(props.onViewMode, "details"),
    },
    {
      id: "view-list",
      label: "List View",
      onSelect: wrapArg(props.onViewMode, "list"),
    },
    {
      id: "view-icons",
      label: "Icons View",
      onSelect: wrapArg(props.onViewMode, "icons"),
    },
    sep("sep-sort"),
    {
      id: "sort-name",
      label: "Sort by Name",
      onSelect: wrapArg(props.onSortBy, "name"),
    },
    {
      id: "sort-type",
      label: "Sort by Type",
      onSelect: wrapArg(props.onSortBy, "type"),
    },
    {
      id: "sort-size",
      label: "Sort by Size",
      onSelect: wrapArg(props.onSortBy, "size"),
    },
    {
      id: "sort-date-modified",
      label: "Sort by Date Modified",
      onSelect: wrapArg(props.onSortBy, "dateModified"),
    },
    {
      id: "sort-date-created",
      label: "Sort by Date Created",
      onSelect: wrapArg(props.onSortBy, "dateCreated"),
    },
    {
      id: "sort-asc",
      label: "Ascending",
      separatorBefore: true,
      onSelect: wrapArg(props.onSortDirection, "ascending"),
    },
    {
      id: "sort-desc",
      label: "Descending",
      onSelect: wrapArg(props.onSortDirection, "descending"),
    },
    sep("sep-appearance"),
    {
      id: "theme-system",
      label: "Theme: System",
      onSelect: wrapArg(props.onTheme, "system"),
    },
    {
      id: "theme-light",
      label: "Theme: Light",
      onSelect: wrapArg(props.onTheme, "light"),
    },
    {
      id: "theme-dark",
      label: "Theme: Dark",
      onSelect: wrapArg(props.onTheme, "dark"),
    },
    sep("sep-density"),
    {
      id: "density-compact",
      label: "Density: Compact",
      onSelect: wrapArg(props.onDensity, "compact"),
    },
    {
      id: "density-comfortable",
      label: "Density: Comfortable",
      onSelect: wrapArg(props.onDensity, "comfortable"),
    },
    {
      id: "density-spacious",
      label: "Density: Spacious",
      onSelect: wrapArg(props.onDensity, "spacious"),
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
    sep("sep-hidden"),
    {
      id: "toggle-hidden",
      label: "Show Hidden Files",
      checked: props.showHidden,
      shortcut: "Ctrl+.",
      onSelect: wrap(props.onToggleHidden),
    },
    {
      id: "refresh",
      label: "Refresh",
      shortcut: "F5",
      separatorBefore: true,
      onSelect: wrap(props.onRefresh),
    },
  ];

  const goItems: DropdownMenuItem[] = [
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
  ];

  const toolsItems: DropdownMenuItem[] = [
    {
      id: "filter",
      label: "Filter Current Folder",
      shortcut: "Ctrl+F",
      onSelect: wrap(props.onFilter),
    },
    {
      id: "search-recursive",
      label: "Search Recursively…",
      shortcut: "Ctrl+Shift+F",
      onSelect: wrap(props.onSearchRecursive),
    },
    sep("sep-ops"),
    {
      id: "job-activity",
      label: "Job Activity…",
      onSelect: wrap(props.onJobActivity),
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
  ];

  const windowItems: DropdownMenuItem[] = [
    {
      id: "switch-pane",
      label: "Switch Active Pane",
      shortcut: "Tab",
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
      disabled: !props.dualPane,
      onSelect: wrap(props.onSwapPanes),
    },
    {
      id: "equalize-panes",
      label: "Equalize Pane Widths",
      disabled: !props.dualPane,
      onSelect: wrap(props.onEqualizePanes),
    },
  ];

  const helpItems: DropdownMenuItem[] = [
    {
      id: "shortcuts",
      label: "Keyboard Shortcuts…",
      shortcut: "Ctrl+/",
      onSelect: wrap(props.onShortcuts),
    },
    {
      id: "documentation",
      label: "Documentation",
      onSelect: wrap(props.onDocumentation),
    },
    {
      id: "report-issue",
      label: "Report Issue",
      onSelect: wrap(props.onReportIssue),
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

  const menus: { id: MenuId; label: string; items: DropdownMenuItem[] }[] = [
    { id: "file", label: "File", items: fileItems },
    { id: "edit", label: "Edit", items: editItems },
    { id: "view", label: "View", items: viewItems },
    { id: "go", label: "Go", items: goItems },
    { id: "tools", label: "Tools", items: toolsItems },
    { id: "window", label: "Window", items: windowItems },
    { id: "help", label: "Help", items: helpItems },
  ];

  return (
    <div ref={menubarRef} className="fo-menubar" role="menubar">
      {menus.map((menu) => (
        <DropdownMenu
          key={menu.id}
          label={menu.label}
          open={openMenu === menu.id}
          items={menu.items}
          onOpenChange={(open) => {
            if (open) {
              setOpenMenu(menu.id);
            } else {
              closeAll();
            }
          }}
          align="start"
          triggerClassName="fo-menubar-trigger"
        >
          <span
            className="fo-menubar-trigger-inner"
            role="menuitem"
            onMouseEnter={() => handleHover(menu.id)}
          >
            {underlineMnemonic(menu.label, MENU_MNEMONICS[menu.id])}
          </span>
        </DropdownMenu>
      ))}
    </div>
  );
}

function underlineMnemonic(label: string, mnemonic: string): React.ReactNode {
  const idx = label.toUpperCase().indexOf(mnemonic);
  if (idx === -1) return label;
  return (
    <>
      {label.slice(0, idx)}
      <u>{label[idx]}</u>
      {label.slice(idx + 1)}
    </>
  );
}
