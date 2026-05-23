# Menu and Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `packages/frontend` and `apps/desktop-tauri` into full conformance with `docs/plans/FileOctopus_Menu_and_Modal_Specification.md` — application menu bar with proper submenu nesting, every §14 dialog, distinct context menu variants per §13, enablement rules per §16, keyboard shortcut coverage per §15, and §23 manual-QA coverage in `e2e/`.

**Architecture:** Implementation is split across **10 phases**. Phase 1 (this document) is detailed bite-sized. Phases 2–10 are scoped with file paths, signatures, and test expectations; each gets its own detailed plan document at execution time. The submenu primitive change in Phase 1 unblocks every later menu-restructure task, so it ships first.

**Tech Stack:** React 19 + TypeScript, `@fileoctopus/ui` design tokens, Vitest for unit/component tests, Playwright for e2e, Rust 2021 / Tauri v2 for any new IPC commands.

---

## Scope: spec coverage at a glance

| Spec §                                  | Status today                                           | Phase that closes it                 |
| --------------------------------------- | ------------------------------------------------------ | ------------------------------------ |
| §4 Top-level menu bar (Win/Linux order) | ✓ flat 7 menus in `MenuBar.tsx`                        | —                                    |
| §4.2 macOS app menu                     | ✗ no platform variant                                  | Phase 8                              |
| §5 File menu structure (submenus)       | ✗ flat                                                 | Phase 1                              |
| §6 Edit menu structure (submenus)       | ✗ flat                                                 | Phase 1                              |
| §7 View menu structure (submenus)       | ✗ flat                                                 | Phase 1                              |
| §8 Go menu (submenus + dynamic lists)   | ✗ flat + missing dynamic favorites/recents/volumes     | Phase 1 (static) + Phase 5 (dynamic) |
| §9 Tools menu (submenus)                | ✗ flat                                                 | Phase 1                              |
| §10 Window menu                         | ✓ partial (no swap/equalize backed)                    | Phase 1 + Phase 8                    |
| §11 Help menu (submenus)                | ✗ flat                                                 | Phase 1                              |
| §12 Pane toolbar dropdowns              | ✓ exists (`OperationToolbar`)                          | Phase 2 audit                        |
| §13.1 Item context menu                 | ✓ single combined `ContextMenu.tsx` (no variant split) | Phase 3                              |
| §13.2 Folder context menu               | ✗ no variant                                           | Phase 3                              |
| §13.3 Multi-selection menu              | ✗ no variant                                           | Phase 3                              |
| §13.4 Empty-space menu                  | ✗ no variant                                           | Phase 3                              |
| §13.5 Sidebar menu                      | ✗ missing                                              | Phase 3                              |
| §13.6 Breadcrumb menu                   | ✗ missing                                              | Phase 3                              |
| §13.7 Job item menu                     | ✗ missing                                              | Phase 3                              |
| §14.2–14.11 Operation dialogs           | ✓ all 7 (`OperationDialog` union, `index.tsx:123–169`) | —                                    |
| §14.12 Selection Properties             | ✗                                                      | Phase 6                              |
| §14.13 Settings                         | ✓ `SettingsDialog`                                     | Phase 7 reshape only                 |
| §14.14 Reset Layout confirmation        | ✗                                                      | Phase 4                              |
| §14.15 Go to Location                   | ✗ (path bar focus only)                                | Phase 5                              |
| §14.16 Volume Picker                    | ✗ + missing `discover_volumes` IPC                     | Phase 5 + Phase 9                    |
| §14.17 Add Favorite                     | ✗ auto-named today                                     | Phase 5                              |
| §14.18 Manage Favorites                 | ✗ opens Settings as placeholder                        | Phase 5                              |
| §14.19 Recent Locations                 | ✗                                                      | Phase 5                              |
| §14.20 Clear Recent Locations           | ✗                                                      | Phase 5                              |
| §14.21 Recursive Search                 | ✓ inline bar exists                                    | Phase 7 (dialog form)                |
| §14.22 Job Activity drawer              | ✓ `ActivityPanel` (not drawer-shaped)                  | Phase 7 (reshape)                    |
| §14.23 Operation History                | ✓ in `ActivityPanel`                                   | Phase 7 (dialog form)                |
| §14.24 Cancel Job confirmation          | ✗                                                      | Phase 4                              |
| §14.25 Clear Operation History          | ✗                                                      | Phase 4                              |
| §14.26 Diagnostics                      | ✓ `DiagnosticsDialog`                                  | —                                    |
| §14.27 Export Diagnostics               | ✓ embedded in Diagnostics                              | —                                    |
| §14.28 Keyboard Shortcuts               | ✓ `ShortcutsDialog`                                    | —                                    |
| §14.29 About                            | ✗                                                      | Phase 6                              |
| §14.30 Report Issue                     | ✗ opens external URL today                             | Phase 6                              |
| §14.31 Running Jobs close confirmation  | ✗                                                      | Phase 4                              |
| §14.32 Error Details                    | ✗ toasts only                                          | Phase 6                              |
| §15 Keyboard shortcuts                  | partial in `shortcuts.ts`                              | Phase 10                             |
| §16 Enablement rules                    | partial in MenuBar                                     | Phase 10                             |
| §17 Long menu / dynamic caps            | n/a until Phase 5 lands                                | Phase 5                              |
| §18 Error model                         | partial                                                | Phase 6 (Error Details)              |
| §19–20 Components/API                   | implicit                                               | each phase                           |
| §21–23 Acceptance / backlog / manual QA | n/a                                                    | Phase 10 (e2e + QA matrix)           |
| §24 Open decisions                      | doc-only                                               | n/a                                  |

---

## Phase 1 — Submenu primitive + menu restructure

Phase 1 is detailed in full below. Each task ends with a commit. Phases 2–10 are summarized at the bottom of this document.

### Phase 1 file structure

- **Modify** `packages/ui/src/DropdownMenu.tsx` — add nested submenu support via `children?: DropdownMenuItem[]`.
- **Modify** `packages/ui/src/components.css` — add `.fo-ui-dropdown-submenu` positioning + hover-open behaviour.
- **Modify** `packages/ui/src/index.tsx` — re-export remains unchanged but add a snapshot test export if needed.
- **Modify** `packages/frontend/src/shell/MenuBar.tsx` — restructure items into nested submenus per §5–§11.
- **Create** `packages/ui/tests/dropdownMenu.test.tsx` — Vitest component tests for nested rendering, keyboard navigation, hover-open, escape close.
- **Create** `packages/frontend/tests/menuBar.test.tsx` — structure-snapshot tests for each top-level menu's tree, plus enablement smoke tests for selection/clipboard-dependent items.
- **Create** `e2e/menubar.e2e.ts` — Playwright spec that opens each top-level menu, opens one submenu, asserts an item is reachable.

### Phase 1 implementation tasks

### Task 1.1: Extend `DropdownMenuItem` type with `children`

**Files:**

- Modify: `packages/ui/src/DropdownMenu.tsx:13-23`
- Test: `packages/ui/tests/dropdownMenu.test.tsx` (new file)

- [ ] **Step 1: Write the failing test**

```tsx
// packages/ui/tests/dropdownMenu.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DropdownMenu, type DropdownMenuItem } from "../src/DropdownMenu";

describe("DropdownMenu nested children", () => {
  it("renders a submenu trigger when an item has children", () => {
    const onChildSelect = vi.fn();
    const items: DropdownMenuItem[] = [
      {
        id: "parent",
        label: "Sort By",
        onSelect: () => {},
        children: [
          { id: "name", label: "Name", onSelect: onChildSelect },
          { id: "size", label: "Size", onSelect: onChildSelect },
        ],
      },
    ];

    render(
      <DropdownMenu label="View" open items={items} onOpenChange={() => {}} />,
    );

    const submenuTrigger = screen.getByRole("menuitem", { name: /Sort By/ });
    expect(submenuTrigger).toHaveAttribute("aria-haspopup", "menu");
    expect(submenuTrigger).toHaveAttribute("aria-expanded", "false");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @fileoctopus/ui test -- -t "renders a submenu trigger"`
Expected: FAIL with `aria-haspopup` missing on the menuitem (the current primitive ignores `children`).

- [ ] **Step 3: Add `children` to the interface**

Edit `packages/ui/src/DropdownMenu.tsx`:

```ts
export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  checked?: boolean;
  danger?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void;
  children?: DropdownMenuItem[];
}
```

- [ ] **Step 4: Render submenu trigger when `children` is present**

In the items.map loop inside `packages/ui/src/DropdownMenu.tsx`, replace the existing button rendering with a conditional:

```tsx
{
  items.map((item) => {
    if (item.children && item.children.length > 0) {
      return (
        <SubmenuItem
          key={item.id}
          item={item}
          onCloseRoot={() => onOpenChange(false)}
        />
      );
    }
    return (
      <button
        key={item.id}
        type="button"
        role="menuitem"
        className={cx(
          "fo-ui-dropdown-item",
          item.checked && "fo-ui-dropdown-item--checked",
          item.danger && "fo-ui-dropdown-item--danger",
          item.separatorBefore && "fo-ui-dropdown-item--separated",
        )}
        disabled={item.disabled}
        onClick={() => {
          item.onSelect();
          onOpenChange(false);
        }}
      >
        <span className="fo-ui-dropdown-icon" aria-hidden="true">
          {item.icon}
        </span>
        <span className="fo-ui-dropdown-label">{item.label}</span>
        {item.shortcut ? (
          <span className="fo-ui-dropdown-shortcut">{item.shortcut}</span>
        ) : null}
      </button>
    );
  });
}
```

Add the `SubmenuItem` component above the `DropdownMenu` function:

```tsx
function SubmenuItem({
  item,
  onCloseRoot,
}: {
  item: DropdownMenuItem;
  onCloseRoot: () => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const submenuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPos(null);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.top, left: rect.right + 2 });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !submenuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onDocPointer);
    return () => window.removeEventListener("mousedown", onDocPointer);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cx(
          "fo-ui-dropdown-item",
          "fo-ui-dropdown-item--submenu",
          item.separatorBefore && "fo-ui-dropdown-item--separated",
        )}
        disabled={item.disabled}
        onMouseEnter={() => setOpen(true)}
        onClick={(event) => {
          event.preventDefault();
          setOpen((value) => !value);
        }}
      >
        <span className="fo-ui-dropdown-icon" aria-hidden="true">
          {item.icon}
        </span>
        <span className="fo-ui-dropdown-label">{item.label}</span>
        <span className="fo-ui-dropdown-submenu-caret" aria-hidden="true">
          ›
        </span>
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={submenuRef}
              role="menu"
              className="fo-ui-dropdown-menu fo-ui-dropdown-menu--portal fo-ui-dropdown-submenu"
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                zIndex: 201,
              }}
              onClick={(event) => event.stopPropagation()}
            >
              {(item.children ?? []).map((child) => (
                <button
                  key={child.id}
                  type="button"
                  role="menuitem"
                  className={cx(
                    "fo-ui-dropdown-item",
                    child.checked && "fo-ui-dropdown-item--checked",
                    child.danger && "fo-ui-dropdown-item--danger",
                    child.separatorBefore && "fo-ui-dropdown-item--separated",
                  )}
                  disabled={child.disabled}
                  onClick={() => {
                    child.onSelect();
                    setOpen(false);
                    onCloseRoot();
                  }}
                >
                  <span className="fo-ui-dropdown-icon" aria-hidden="true">
                    {child.icon}
                  </span>
                  <span className="fo-ui-dropdown-label">{child.label}</span>
                  {child.shortcut ? (
                    <span className="fo-ui-dropdown-shortcut">
                      {child.shortcut}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @fileoctopus/ui test -- -t "renders a submenu trigger"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/DropdownMenu.tsx packages/ui/tests/dropdownMenu.test.tsx
git commit -m "feat(ui): add nested submenu support to DropdownMenu primitive"
```

### Task 1.2: Submenu activation + close behaviour tests

**Files:**

- Test: `packages/ui/tests/dropdownMenu.test.tsx`

- [ ] **Step 1: Add behaviour tests**

Append to `packages/ui/tests/dropdownMenu.test.tsx`:

```tsx
import { act } from "react";

describe("DropdownMenu submenu behaviour", () => {
  it("opens submenu on hover and closes root on child select", async () => {
    const onChildSelect = vi.fn();
    const onOpenChange = vi.fn();
    const items: DropdownMenuItem[] = [
      {
        id: "parent",
        label: "Sort By",
        onSelect: () => {},
        children: [{ id: "name", label: "Name", onSelect: onChildSelect }],
      },
    ];

    render(
      <DropdownMenu
        label="View"
        open
        items={items}
        onOpenChange={onOpenChange}
      />,
    );

    const trigger = screen.getByRole("menuitem", { name: /Sort By/ });
    fireEvent.mouseEnter(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const child = screen.getByRole("menuitem", { name: "Name" });
    fireEvent.click(child);
    expect(onChildSelect).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes submenu when clicking outside both trigger and submenu", () => {
    const items: DropdownMenuItem[] = [
      {
        id: "parent",
        label: "Sort By",
        onSelect: () => {},
        children: [{ id: "name", label: "Name", onSelect: () => {} }],
      },
    ];

    render(
      <DropdownMenu label="View" open items={items} onOpenChange={() => {}} />,
    );

    fireEvent.mouseEnter(screen.getByRole("menuitem", { name: /Sort By/ }));
    expect(screen.getByRole("menuitem", { name: "Name" })).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(screen.queryByRole("menuitem", { name: "Name" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run all DropdownMenu tests**

Run: `pnpm --filter @fileoctopus/ui test`
Expected: all 3 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/tests/dropdownMenu.test.tsx
git commit -m "test(ui): submenu hover open and outside-click close"
```

### Task 1.3: Style submenu

**Files:**

- Modify: `packages/ui/src/components.css`

- [ ] **Step 1: Add submenu styles**

Append to `packages/ui/src/components.css`:

```css
.fo-ui-dropdown-item--submenu {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr) auto;
  align-items: center;
}

.fo-ui-dropdown-submenu-caret {
  color: var(--fo-muted-text);
  margin-left: 8px;
}

.fo-ui-dropdown-submenu {
  min-width: 200px;
  box-shadow: var(--fo-shadow-popover);
}
```

- [ ] **Step 2: Manual visual smoke**

Run: `pnpm dev` and open any menu that already uses `children` (none yet — but the primitive should render without errors). Quit dev.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components.css
git commit -m "style(ui): submenu indicator and portal shadow tokens"
```

### Task 1.4: Restructure File menu

**Files:**

- Modify: `packages/frontend/src/shell/MenuBar.tsx:185-202`

- [ ] **Step 1: Write failing structure test**

Create `packages/frontend/tests/menuBar.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MenuBar, type MenuBarProps } from "../src/shell/MenuBar";

const noop = () => {};

function buildProps(overrides: Partial<MenuBarProps> = {}): MenuBarProps {
  const stub = vi.fn();
  return {
    activePanelId: "left",
    onBack: stub,
    onForward: stub,
    onUp: stub,
    onHome: stub,
    onGoToLocation: stub,
    goStandardLocation: stub,
    onNewFolder: stub,
    onNewFile: stub,
    onOpenSelected: stub,
    onOpenWithDefaultApp: stub,
    onRevealInFileManager: stub,
    onRename: stub,
    onCopyTo: stub,
    onMoveTo: stub,
    onTrash: stub,
    onDeletePermanently: stub,
    onProperties: stub,
    onCut: stub,
    onCopy: stub,
    onPaste: stub,
    onClearClipboard: stub,
    onSelectAll: stub,
    onClearSelection: stub,
    onInvertSelection: stub,
    onCopyPath: stub,
    onCopyName: stub,
    onCopyParentPath: stub,
    onCopyResourceUri: stub,
    onViewMode: stub,
    onSortBy: stub,
    onSortDirection: stub,
    onTheme: stub,
    onDensity: stub,
    onToggleSidebar: stub,
    onToggleToolbar: stub,
    onToggleStatusBar: stub,
    onToggleDualPane: stub,
    onToggleHidden: stub,
    onRefresh: stub,
    onAddFavorite: stub,
    onManageFavorites: stub,
    onFilter: stub,
    onSearchRecursive: stub,
    onJobActivity: stub,
    onDiagnostics: stub,
    onExportDiagnostics: stub,
    onSwitchPane: stub,
    onSwapPanes: stub,
    onEqualizePanes: stub,
    onShortcuts: stub,
    onDocumentation: stub,
    onReportIssue: stub,
    onAbout: stub,
    onSettings: stub,
    onExit: stub,
    canGoBack: false,
    canGoForward: false,
    hasSelection: false,
    hasClipboard: false,
    sidebarVisible: true,
    toolbarVisible: true,
    statusBarVisible: true,
    dualPane: false,
    showHidden: false,
    ...overrides,
  };
}

describe("MenuBar File menu", () => {
  it("nests New under a submenu with Folder and Empty File", () => {
    render(<MenuBar {...buildProps()} />);
    fireEvent.click(screen.getByRole("menuitem", { name: /File/ }));
    const newTrigger = screen.getByRole("menuitem", { name: /^New$/ });
    fireEvent.mouseEnter(newTrigger);
    expect(
      screen.getByRole("menuitem", { name: /Folder…/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Empty File…/ }),
    ).toBeInTheDocument();
  });

  it("nests Open under a submenu per spec §5.1", () => {
    render(<MenuBar {...buildProps({ hasSelection: true })} />);
    fireEvent.click(screen.getByRole("menuitem", { name: /File/ }));
    fireEvent.mouseEnter(screen.getByRole("menuitem", { name: /^Open$/ }));
    expect(
      screen.getByRole("menuitem", { name: /Open Selected/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Reveal in System File Manager/ }),
    ).toBeInTheDocument();
  });

  it("nests File Actions under a submenu", () => {
    render(<MenuBar {...buildProps({ hasSelection: true })} />);
    fireEvent.click(screen.getByRole("menuitem", { name: /File/ }));
    fireEvent.mouseEnter(
      screen.getByRole("menuitem", { name: /File Actions/ }),
    );
    expect(
      screen.getByRole("menuitem", { name: /Rename…/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Move to Trash…/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Delete Permanently…/ }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run failing tests**

Run: `pnpm --filter @fileoctopus/frontend test -- -t "MenuBar File menu"`
Expected: FAIL — current MenuBar renders everything flat.

- [ ] **Step 3: Restructure the File menu**

Replace `fileItems` in `packages/frontend/src/shell/MenuBar.tsx` with:

```ts
const fileItems: DropdownMenuItem[] = [
  {
    id: "new",
    label: "New",
    onSelect: () => {},
    children: [
      {
        id: "new-folder",
        label: "Folder…",
        shortcut: "Ctrl+N",
        onSelect: wrap(props.onNewFolder),
      },
      { id: "new-file", label: "Empty File…", onSelect: wrap(props.onNewFile) },
    ],
  },
  {
    id: "open",
    label: "Open",
    onSelect: () => {},
    children: [
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
    ],
  },
  {
    id: "file-actions",
    label: "File Actions",
    onSelect: () => {},
    children: [
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
    ],
  },
  sep("sep-properties"),
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
```

- [ ] **Step 4: Run File menu tests**

Run: `pnpm --filter @fileoctopus/frontend test -- -t "MenuBar File menu"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/shell/MenuBar.tsx packages/frontend/tests/menuBar.test.tsx
git commit -m "feat(frontend): nest File menu items under New / Open / File Actions submenus"
```

### Task 1.5: Restructure Edit menu

**Files:**

- Modify: `packages/frontend/src/shell/MenuBar.tsx:204-218`
- Test: `packages/frontend/tests/menuBar.test.tsx`

- [ ] **Step 1: Write failing tests**

Append to `packages/frontend/tests/menuBar.test.tsx`:

```tsx
describe("MenuBar Edit menu", () => {
  it("nests Clipboard, Selection, and Copy Text submenus", () => {
    render(
      <MenuBar {...buildProps({ hasSelection: true, hasClipboard: true })} />,
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /Edit/ }));

    fireEvent.mouseEnter(screen.getByRole("menuitem", { name: /^Clipboard$/ }));
    expect(screen.getByRole("menuitem", { name: /^Cut$/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Paste/ })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Clear File Clipboard/ }),
    ).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole("menuitem", { name: /^Selection$/ }));
    expect(
      screen.getByRole("menuitem", { name: /Select All/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Invert Selection/ }),
    ).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole("menuitem", { name: /^Copy Text$/ }));
    expect(
      screen.getByRole("menuitem", { name: /Copy Full Path/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Copy Resource URI/ }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run failing tests**

Run: `pnpm --filter @fileoctopus/frontend test -- -t "MenuBar Edit menu"`
Expected: FAIL.

- [ ] **Step 3: Restructure `editItems`**

Replace `editItems` in `packages/frontend/src/shell/MenuBar.tsx`:

```ts
const editItems: DropdownMenuItem[] = [
  {
    id: "clipboard",
    label: "Clipboard",
    onSelect: () => {},
    children: [
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
    ],
  },
  {
    id: "selection",
    label: "Selection",
    onSelect: () => {},
    children: [
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
    ],
  },
  {
    id: "copy-text",
    label: "Copy Text",
    onSelect: () => {},
    children: [
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
    ],
  },
];
```

- [ ] **Step 4: Run Edit menu tests**

Run: `pnpm --filter @fileoctopus/frontend test -- -t "MenuBar Edit menu"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/shell/MenuBar.tsx packages/frontend/tests/menuBar.test.tsx
git commit -m "feat(frontend): nest Edit menu items under Clipboard / Selection / Copy Text submenus"
```

### Task 1.6: Restructure View menu

**Files:**

- Modify: `packages/frontend/src/shell/MenuBar.tsx:220-248`
- Test: `packages/frontend/tests/menuBar.test.tsx`

- [ ] **Step 1: Write failing tests**

Append to `packages/frontend/tests/menuBar.test.tsx`:

```tsx
describe("MenuBar View menu", () => {
  it("nests View Mode / Sort By / Appearance / Layout submenus", () => {
    render(<MenuBar {...buildProps()} />);
    fireEvent.click(screen.getByRole("menuitem", { name: /View/ }));

    fireEvent.mouseEnter(screen.getByRole("menuitem", { name: /View Mode/ }));
    expect(
      screen.getByRole("menuitem", { name: /^Details$/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /^Icons$/ }),
    ).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole("menuitem", { name: /^Sort By$/ }));
    expect(
      screen.getByRole("menuitem", { name: /^Name$/ }),
    ).toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByRole("menuitem", { name: /^Direction$/ }));
    expect(
      screen.getByRole("menuitem", { name: /Ascending/ }),
    ).toBeInTheDocument();

    fireEvent.mouseEnter(
      screen.getByRole("menuitem", { name: /^Appearance$/ }),
    );
    fireEvent.mouseEnter(screen.getByRole("menuitem", { name: /^Theme$/ }));
    expect(
      screen.getByRole("menuitem", { name: /^System$/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /^Dark$/ }),
    ).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole("menuitem", { name: /^Layout$/ }));
    expect(
      screen.getByRole("menuitem", { name: /Show Sidebar/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Dual Pane/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Reset Layout…/ }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run failing tests**

Run: `pnpm --filter @fileoctopus/frontend test -- -t "MenuBar View menu"`
Expected: FAIL.

- [ ] **Step 3: Add `onResetLayout` to MenuBarProps**

Edit `packages/frontend/src/shell/MenuBar.tsx` interface — add `onResetLayout: () => void;` and add `onIconSize: (size: string) => void;`. Update `MenuBarProps` interface near top of file.

In `packages/frontend/src/index.tsx:1887` block, add corresponding stubs that show a toast (`pushToast({ tone: "info", title: "Reset Layout coming soon" })`) and same for icon size. (These will be implemented in Phase 4 / Phase 8.)

- [ ] **Step 4: Restructure `viewItems`**

Replace `viewItems` in `packages/frontend/src/shell/MenuBar.tsx`:

```ts
const viewItems: DropdownMenuItem[] = [
  {
    id: "view-mode",
    label: "View Mode",
    onSelect: () => {},
    children: [
      {
        id: "view-details",
        label: "Details",
        onSelect: wrapArg(props.onViewMode, "details"),
      },
      {
        id: "view-list",
        label: "List",
        onSelect: wrapArg(props.onViewMode, "list"),
      },
      {
        id: "view-icons",
        label: "Icons",
        onSelect: wrapArg(props.onViewMode, "icons"),
      },
    ],
  },
  {
    id: "sort-by",
    label: "Sort By",
    onSelect: () => {},
    children: [
      {
        id: "sort-name",
        label: "Name",
        onSelect: wrapArg(props.onSortBy, "name"),
      },
      {
        id: "sort-type",
        label: "Type",
        onSelect: wrapArg(props.onSortBy, "type"),
      },
      {
        id: "sort-size",
        label: "Size",
        onSelect: wrapArg(props.onSortBy, "size"),
      },
      {
        id: "sort-date-modified",
        label: "Date Modified",
        onSelect: wrapArg(props.onSortBy, "dateModified"),
      },
      {
        id: "sort-date-created",
        label: "Date Created",
        onSelect: wrapArg(props.onSortBy, "dateCreated"),
      },
      {
        id: "sort-direction",
        label: "Direction",
        onSelect: () => {},
        separatorBefore: true,
        children: [
          {
            id: "sort-asc",
            label: "Ascending",
            onSelect: wrapArg(props.onSortDirection, "ascending"),
          },
          {
            id: "sort-desc",
            label: "Descending",
            onSelect: wrapArg(props.onSortDirection, "descending"),
          },
        ],
      },
    ],
  },
  {
    id: "appearance",
    label: "Appearance",
    onSelect: () => {},
    children: [
      {
        id: "theme",
        label: "Theme",
        onSelect: () => {},
        children: [
          {
            id: "theme-system",
            label: "System",
            onSelect: wrapArg(props.onTheme, "system"),
          },
          {
            id: "theme-light",
            label: "Light",
            onSelect: wrapArg(props.onTheme, "light"),
          },
          {
            id: "theme-dark",
            label: "Dark",
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
            onSelect: wrapArg(props.onDensity, "compact"),
          },
          {
            id: "density-comfortable",
            label: "Comfortable",
            onSelect: wrapArg(props.onDensity, "comfortable"),
          },
          {
            id: "density-spacious",
            label: "Spacious",
            onSelect: wrapArg(props.onDensity, "spacious"),
          },
        ],
      },
      {
        id: "icon-size",
        label: "Icon Size",
        onSelect: () => {},
        children: [
          {
            id: "icon-small",
            label: "Small",
            onSelect: wrapArg(props.onIconSize, "small"),
          },
          {
            id: "icon-medium",
            label: "Medium",
            onSelect: wrapArg(props.onIconSize, "medium"),
          },
          {
            id: "icon-large",
            label: "Large",
            onSelect: wrapArg(props.onIconSize, "large"),
          },
        ],
      },
    ],
  },
  {
    id: "layout",
    label: "Layout",
    onSelect: () => {},
    children: [
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
      {
        id: "reset-layout",
        label: "Reset Layout…",
        separatorBefore: true,
        onSelect: wrap(props.onResetLayout),
      },
    ],
  },
  sep("sep-misc"),
  {
    id: "toggle-hidden",
    label: "Show Hidden/System Files",
    checked: props.showHidden,
    shortcut: "Ctrl+.",
    onSelect: wrap(props.onToggleHidden),
  },
  {
    id: "refresh",
    label: "Refresh",
    shortcut: "F5",
    onSelect: wrap(props.onRefresh),
  },
  {
    id: "view-options",
    label: "View Options…",
    separatorBefore: true,
    onSelect: wrap(props.onSettings),
  },
];
```

- [ ] **Step 5: Run View menu tests**

Run: `pnpm --filter @fileoctopus/frontend test -- -t "MenuBar View menu"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/shell/MenuBar.tsx packages/frontend/src/index.tsx packages/frontend/tests/menuBar.test.tsx
git commit -m "feat(frontend): nest View menu submenus per spec §7.1"
```

### Task 1.7: Restructure Go menu (static items only)

**Files:**

- Modify: `packages/frontend/src/shell/MenuBar.tsx:250-267`
- Test: `packages/frontend/tests/menuBar.test.tsx`

- [ ] **Step 1: Write failing tests**

Append to `packages/frontend/tests/menuBar.test.tsx`:

```tsx
describe("MenuBar Go menu", () => {
  it("nests Standard Locations and Favorites submenus", () => {
    render(<MenuBar {...buildProps()} />);
    fireEvent.click(screen.getByRole("menuitem", { name: /^Go$/ }));

    fireEvent.mouseEnter(
      screen.getByRole("menuitem", { name: /Standard Locations/ }),
    );
    expect(
      screen.getByRole("menuitem", { name: /Documents/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Pictures/ }),
    ).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole("menuitem", { name: /Favorites/ }));
    expect(
      screen.getByRole("menuitem", { name: /Add Current Folder to Favorites/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Manage Favorites…/ }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `pnpm --filter @fileoctopus/frontend test -- -t "MenuBar Go menu"`
Expected: FAIL.

- [ ] **Step 3: Restructure `goItems` (dynamic favorites/recents wire-up in Phase 5)**

Replace `goItems` in `packages/frontend/src/shell/MenuBar.tsx`:

```ts
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
  {
    id: "go-location",
    label: "Location…",
    shortcut: "Ctrl+L",
    separatorBefore: true,
    onSelect: wrap(props.onGoToLocation),
  },
  {
    id: "standard-locations",
    label: "Standard Locations",
    onSelect: () => {},
    separatorBefore: true,
    children: [
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
    ],
  },
  {
    id: "favorites",
    label: "Favorites",
    onSelect: () => {},
    children: [
      {
        id: "add-favorite",
        label: "Add Current Folder to Favorites",
        onSelect: wrap(props.onAddFavorite),
      },
      {
        id: "manage-favorites",
        label: "Manage Favorites…",
        separatorBefore: true,
        onSelect: wrap(props.onManageFavorites),
      },
    ],
  },
];
```

> Dynamic entries (favorite list, recents list, volumes list) are wired in Phase 5. For now Go > Favorites only contains Add/Manage; Devices and Volumes / Recent Locations submenus are added later.

- [ ] **Step 4: Run Go menu tests**

Run: `pnpm --filter @fileoctopus/frontend test -- -t "MenuBar Go menu"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/shell/MenuBar.tsx packages/frontend/tests/menuBar.test.tsx
git commit -m "feat(frontend): nest Go menu Standard Locations and Favorites submenus"
```

### Task 1.8: Restructure Tools menu

**Files:**

- Modify: `packages/frontend/src/shell/MenuBar.tsx:269-277`
- Test: `packages/frontend/tests/menuBar.test.tsx`

- [ ] **Step 1: Write failing test**

Append to `packages/frontend/tests/menuBar.test.tsx`:

```tsx
describe("MenuBar Tools menu", () => {
  it("nests Search / Operations / Diagnostics submenus", () => {
    render(<MenuBar {...buildProps()} />);
    fireEvent.click(screen.getByRole("menuitem", { name: /Tools/ }));

    fireEvent.mouseEnter(screen.getByRole("menuitem", { name: /^Search$/ }));
    expect(
      screen.getByRole("menuitem", { name: /Filter Current Folder/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Search Recursively…/ }),
    ).toBeInTheDocument();

    fireEvent.mouseEnter(
      screen.getByRole("menuitem", { name: /^Operations$/ }),
    );
    expect(
      screen.getByRole("menuitem", { name: /Job Activity…/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Recent Operations…/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Cancel Active Job…/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Clear Operation History…/ }),
    ).toBeInTheDocument();

    fireEvent.mouseEnter(
      screen.getByRole("menuitem", { name: /^Diagnostics$/ }),
    );
    expect(
      screen.getByRole("menuitem", { name: /Diagnostics…/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Export Diagnostics Bundle…/ }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `pnpm --filter @fileoctopus/frontend test -- -t "MenuBar Tools menu"`
Expected: FAIL.

- [ ] **Step 3: Add missing MenuBarProps fields**

In `MenuBarProps` add: `onRecentOperations: () => void;`, `onCancelActiveJob: () => void;`, `onClearOperationHistory: () => void;`. Default stubs in `index.tsx:1887` as toasts pending Phase 4 wiring.

- [ ] **Step 4: Restructure `toolsItems`**

Replace `toolsItems`:

```ts
const toolsItems: DropdownMenuItem[] = [
  {
    id: "search",
    label: "Search",
    onSelect: () => {},
    children: [
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
    ],
  },
  {
    id: "operations",
    label: "Operations",
    onSelect: () => {},
    children: [
      {
        id: "job-activity",
        label: "Job Activity…",
        onSelect: wrap(props.onJobActivity),
      },
      {
        id: "recent-ops",
        label: "Recent Operations…",
        onSelect: wrap(props.onRecentOperations),
      },
      {
        id: "cancel-active",
        label: "Cancel Active Job…",
        separatorBefore: true,
        onSelect: wrap(props.onCancelActiveJob),
      },
      {
        id: "clear-history",
        label: "Clear Operation History…",
        danger: true,
        onSelect: wrap(props.onClearOperationHistory),
      },
    ],
  },
  {
    id: "diagnostics",
    label: "Diagnostics",
    onSelect: () => {},
    children: [
      {
        id: "diagnostics-open",
        label: "Diagnostics…",
        onSelect: wrap(props.onDiagnostics),
      },
      {
        id: "export-diagnostics",
        label: "Export Diagnostics Bundle…",
        onSelect: wrap(props.onExportDiagnostics),
      },
    ],
  },
];
```

- [ ] **Step 5: Run Tools menu tests**

Run: `pnpm --filter @fileoctopus/frontend test -- -t "MenuBar Tools menu"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/shell/MenuBar.tsx packages/frontend/src/index.tsx packages/frontend/tests/menuBar.test.tsx
git commit -m "feat(frontend): nest Tools menu Search / Operations / Diagnostics submenus"
```

### Task 1.9: Restructure Window and Help menus

**Files:**

- Modify: `packages/frontend/src/shell/MenuBar.tsx:279-296`
- Test: `packages/frontend/tests/menuBar.test.tsx`

- [ ] **Step 1: Write failing test**

Append to `packages/frontend/tests/menuBar.test.tsx`:

```tsx
describe("MenuBar Window and Help menus", () => {
  it("Window menu exposes pane controls including Focus Left/Right and Increase widths", () => {
    render(<MenuBar {...buildProps({ dualPane: true })} />);
    fireEvent.click(screen.getByRole("menuitem", { name: /Window/ }));
    expect(
      screen.getByRole("menuitem", { name: /Switch Active Pane/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Focus Left Pane/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Focus Right Pane/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Swap Panes/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Equalize Pane Widths/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Increase Left Pane Width/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Increase Right Pane Width/ }),
    ).toBeInTheDocument();
  });

  it("Help menu lists Keyboard Shortcuts, Diagnostics, About per spec §11.1", () => {
    render(<MenuBar {...buildProps()} />);
    fireEvent.click(screen.getByRole("menuitem", { name: /Help/ }));
    expect(
      screen.getByRole("menuitem", { name: /Keyboard Shortcuts…/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Documentation/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Report Issue/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Diagnostics…/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Export Diagnostics Bundle…/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /About FileOctopus…/ }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `pnpm --filter @fileoctopus/frontend test -- -t "MenuBar Window and Help menus"`
Expected: FAIL — missing Focus Left/Right and Increase Width items.

- [ ] **Step 3: Add MenuBarProps fields**

Add to `MenuBarProps`: `onFocusLeftPane: () => void;`, `onFocusRightPane: () => void;`, `onIncreaseLeftPane: () => void;`, `onIncreaseRightPane: () => void;`. Stub in `index.tsx:1887` as toasts.

- [ ] **Step 4: Restructure `windowItems` and `helpItems`**

```ts
const windowItems: DropdownMenuItem[] = [
  {
    id: "switch-pane",
    label: "Switch Active Pane",
    shortcut: "Tab",
    onSelect: wrap(props.onSwitchPane),
  },
  {
    id: "focus-left",
    label: "Focus Left Pane",
    disabled: !props.dualPane,
    onSelect: wrap(props.onFocusLeftPane),
  },
  {
    id: "focus-right",
    label: "Focus Right Pane",
    disabled: !props.dualPane,
    onSelect: wrap(props.onFocusRightPane),
  },
  {
    id: "toggle-dual",
    label: "Toggle Dual Pane",
    checked: props.dualPane,
    separatorBefore: true,
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
  {
    id: "inc-left",
    label: "Increase Left Pane Width",
    disabled: !props.dualPane,
    onSelect: wrap(props.onIncreaseLeftPane),
  },
  {
    id: "inc-right",
    label: "Increase Right Pane Width",
    disabled: !props.dualPane,
    onSelect: wrap(props.onIncreaseRightPane),
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
  {
    id: "diagnostics",
    label: "Diagnostics…",
    separatorBefore: true,
    onSelect: wrap(props.onDiagnostics),
  },
  {
    id: "export-diagnostics",
    label: "Export Diagnostics Bundle…",
    onSelect: wrap(props.onExportDiagnostics),
  },
  {
    id: "about",
    label: "About FileOctopus…",
    separatorBefore: true,
    onSelect: wrap(props.onAbout),
  },
];
```

- [ ] **Step 5: Run Window/Help tests**

Run: `pnpm --filter @fileoctopus/frontend test -- -t "MenuBar Window and Help menus"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/shell/MenuBar.tsx packages/frontend/src/index.tsx packages/frontend/tests/menuBar.test.tsx
git commit -m "feat(frontend): expand Window and Help menus per spec §10.1/§11.1"
```

### Task 1.10: Playwright e2e smoke

**Files:**

- Create: `e2e/menubar.e2e.ts`

- [ ] **Step 1: Write Playwright spec**

```ts
// e2e/menubar.e2e.ts
import { test, expect } from "@playwright/test";

test.describe("Application menu bar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:1420", { waitUntil: "networkidle" });
    await page.waitForSelector("[role='menubar']");
  });

  for (const menu of [
    "File",
    "Edit",
    "View",
    "Go",
    "Tools",
    "Window",
    "Help",
  ]) {
    test(`${menu} menu opens and shows at least one item`, async ({ page }) => {
      await page
        .getByRole("menuitem", { name: new RegExp(`^${menu}$`) })
        .click();
      const items = await page.getByRole("menuitem").count();
      expect(items).toBeGreaterThan(1);
    });
  }

  test("View > Sort By > Direction is reachable via hover", async ({
    page,
  }) => {
    await page.getByRole("menuitem", { name: /^View$/ }).click();
    await page.getByRole("menuitem", { name: /Sort By/ }).hover();
    await page.getByRole("menuitem", { name: /Direction/ }).hover();
    await expect(
      page.getByRole("menuitem", { name: /Ascending/ }),
    ).toBeVisible();
  });
});
```

- [ ] **Step 2: Run e2e**

Start dev: `pnpm dev` in one terminal.
Run: `pnpm exec playwright test e2e/menubar.e2e.ts`
Expected: all 8 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/menubar.e2e.ts
git commit -m "test(e2e): smoke each menu opens and submenus reachable via hover"
```

### Task 1.11: Manual visual verification + Phase 1 wrap

- [ ] **Step 1: Start dev server and visually verify menus**

Run: `pnpm dev`
Check: each menu opens, submenu hover works, density/theme settings still apply visually, no console errors. Disabled items grey out per `hasSelection`/`hasClipboard` state.

- [ ] **Step 2: Verify full Vitest + lint + typecheck**

Run in parallel:

```bash
pnpm typecheck
pnpm lint
pnpm --filter @fileoctopus/ui test
pnpm --filter @fileoctopus/frontend test
```

Expected: zero failures.

- [ ] **Step 3: Update spec status**

Edit `docs/plans/FileOctopus_Menu_and_Modal_Specification.md:9` — update implementation status note to reflect that the menu bar with submenus is now implemented and Phase 1 of the plan is complete.

- [ ] **Step 4: Final commit**

```bash
git add docs/plans/FileOctopus_Menu_and_Modal_Specification.md
git commit -m "docs: mark menu bar submenu structure complete (Phase 1)"
```

---

## Phase 2 — Wire MenuBar handlers (kill "coming soon" stubs)

**Goal:** Replace toast stubs in `packages/frontend/src/index.tsx:1887-2009` for items where backend is ready. No backend changes.

**Stubs to wire (handler → implementation source):**

| Handler                                                                                                     | Current line       | New implementation                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onCopyTo`                                                                                                  | 1918               | Open `OperationDialog` of type `copyMove` with kind `copy` against current selection. Reuse `openCopyMoveDialog` pattern; the dialog already exists for this. |
| `onMoveTo`                                                                                                  | 1919               | Same as Copy To, kind `move`.                                                                                                                                 |
| `onInvertSelection`                                                                                         | 1929               | Add `panelReducer` action `invertSelection` operating on `selectVisibleEntries` + current `selectedIds`. Dispatch from handler.                               |
| `onToggleToolbar`                                                                                           | 1960               | Preference key `toolbarVisible`; persist + apply via `applyLayoutPreferences`.                                                                                |
| `onToggleStatusBar`                                                                                         | 1961               | Preference key `statusBarVisible`; persist + apply.                                                                                                           |
| `onToggleDualPane`                                                                                          | 1962               | Phase 8 — leave stub.                                                                                                                                         |
| `onAddFavorite`                                                                                             | 1967               | Phase 5 — open AddFavorite dialog instead of auto-add.                                                                                                        |
| `onManageFavorites`                                                                                         | 1977               | Phase 5 — open Manage Favorites dialog instead of Settings.                                                                                                   |
| `onJobActivity`                                                                                             | 1980               | Open `ActivityPanel` programmatically (set `activityCollapsed = false`).                                                                                      |
| `onExportDiagnostics`                                                                                       | 1982               | Open `DiagnosticsDialog` with export focus token.                                                                                                             |
| `onSwapPanes` / `onEqualizePanes`                                                                           | 1988-1989          | Phase 8.                                                                                                                                                      |
| `onAbout`                                                                                                   | 1997               | Phase 6.                                                                                                                                                      |
| `onExit`                                                                                                    | 1999               | Phase 4 — Running Jobs close confirmation if jobs active, else `getCurrentWindow().close()`.                                                                  |
| `onResetLayout`                                                                                             | new (Task 1.6)     | Phase 4.                                                                                                                                                      |
| `onIconSize`                                                                                                | new (Task 1.6)     | Add preference key `iconSize`, persist + reload affected views.                                                                                               |
| `onCancelActiveJob` / `onClearOperationHistory` / `onRecentOperations` / `onFocus*Pane` / `onIncrease*Pane` | new (Task 1.8/1.9) | Phase 4 / Phase 7 / Phase 8 as appropriate.                                                                                                                   |

**Files:**

- Modify: `packages/frontend/src/index.tsx:1887-2009` (handler block)
- Modify: `packages/frontend/src/panelStore.ts` (add `invertSelection` action and reducer case)
- Test: `packages/frontend/tests/panelStore.test.ts` (add invertSelection coverage)
- Test: `packages/frontend/tests/menuBar.test.tsx` (extend with handler-invocation tests)

**Expected outcome:** Copy To / Move To open existing dialogs; Invert Selection works; Toolbar/Status Bar visibility persist; Job Activity opens panel; Export Diagnostics opens dialog. All other "coming soon" stubs explicitly marked with a `// Phase N` comment.

---

## Phase 3 — Context menu variant split

**Goal:** Replace `packages/frontend/src/components/ContextMenu.tsx` (single combined menu, 437 lines) with seven distinct variants matching spec §13.1–13.7. Each variant builds its item list from a shared `ContextMenuItemList` primitive that supports separators and submenus (reuse the DropdownMenu primitive after extraction or build a parallel `ContextMenuList` if reuse is awkward).

**Files:**

- Create: `packages/frontend/src/menus/FileItemContextMenu.tsx`
- Create: `packages/frontend/src/menus/FolderItemContextMenu.tsx`
- Create: `packages/frontend/src/menus/MultiSelectionContextMenu.tsx`
- Create: `packages/frontend/src/menus/EmptySpaceContextMenu.tsx`
- Create: `packages/frontend/src/menus/SidebarContextMenu.tsx` (variants per §13.5: standard folder / favorite / device-volume)
- Create: `packages/frontend/src/menus/BreadcrumbContextMenu.tsx`
- Create: `packages/frontend/src/menus/JobContextMenu.tsx`
- Create: `packages/frontend/src/menus/contextMenuShell.tsx` (positioning + portal + escape handling, shared)
- Delete (or shrink to thin re-export): `packages/frontend/src/components/ContextMenu.tsx`
- Modify: `packages/frontend/src/index.tsx` to dispatch the right variant based on click source (entry vs empty-space vs sidebar vs breadcrumb)
- Modify: `packages/frontend/src/sidebar/Sidebar.tsx` and `packages/frontend/src/pane/FileTable.tsx` to fire variant-specific events
- Test: one Vitest file per variant; expectations from §13.1–13.7 item lists
- Test: `e2e/context-menus.e2e.ts` covering each variant's primary action

**Selection-targeting rule (§13.1):** the file/folder item context menu must select the clicked item if it's not already selected, before opening. Tests must cover this.

---

## Phase 4 — Missing safety / confirmation dialogs

**Goal:** Add the four confirmation dialogs in §14.14, §14.24, §14.25, §14.31. All share `ConfirmationDialog` shell.

**Files:**

- Create: `packages/frontend/src/components/ConfirmationDialog.tsx` — generic shared shell: title, body, optional danger badge, primary action label, secondary action label, default-focused button (must accept "destructive" prop to never default to destructive). Test file alongside.
- Create: `packages/frontend/src/components/ResetLayoutDialog.tsx` — calls preferences-reset (Phase 4 also adds `preferences.resetLayout()` to the ts-api client and a Tauri command `reset_layout_preferences` returning the defaulted preference set).
- Create: `packages/frontend/src/components/CancelJobDialog.tsx` — accepts `JobSnapshot[]` (cancellable active jobs), calls `client.jobs.cancelJob` for each.
- Create: `packages/frontend/src/components/ClearOperationHistoryDialog.tsx` — calls `client.operationHistory.clearOperationHistory()`.
- Create: `packages/frontend/src/components/RunningJobsCloseDialog.tsx` — accepts active job count + top-job summary; primary button is **Keep FileOctopus Open** (default-focused per §14.31); secondary button is **Cancel Jobs and Exit** (loops cancel + `getCurrentWindow().close()`); third button "Exit After Jobs Finish" hidden until backend supports it.
- Modify: `packages/frontend/src/index.tsx` — wire `onResetLayout`, `onCancelActiveJob`, `onClearOperationHistory`, `onExit`, and the window-close event listener (`getCurrentWindow().onCloseRequested`).
- Modify: `apps/desktop-tauri/src-tauri/src/lib.rs` — add `reset_layout_preferences` command and register in `generate_handler!`.
- Modify: `packages/ts-api/src/client.ts` — add `preferences.resetLayout()` method + commandMap entry.
- Test: one Vitest per dialog plus e2e in `e2e/safety-dialogs.e2e.ts`.

**Acceptance:** §14.14 (Reset Layout: explicit "files and operation history are not deleted"), §14.24 (Cancel Job: warning that completed items remain changed), §14.25 (Clear History: active jobs preserved), §14.31 (Running Jobs close: default focus is Keep Open).

---

## Phase 5 — Navigation dialogs + dynamic Go submenus

**Goal:** Deliver §14.15–14.20 and wire dynamic Go > Devices and Volumes / Favorites / Recent Locations submenus (§8.2).

**Files:**

- Create: `packages/frontend/src/components/GoToLocationDialog.tsx` — path/URI input with recent locations suggestions list. Calls `client.fs.stat` for validation, then `navigatePanel` on success.
- Create: `packages/frontend/src/components/VolumePickerDialog.tsx` — searchable mounted volumes (depends on Phase 9 `discover_volumes` IPC; show a stub "Volume discovery coming soon" empty state when unavailable).
- Create: `packages/frontend/src/components/AddFavoriteDialog.tsx` — name input + read-only path; calls `client.navigation.addFavorite`.
- Create: `packages/frontend/src/components/ManageFavoritesDialog.tsx` — searchable list, reorder via drag, rename, remove; calls `navigation.renameFavorite` / `removeFavorite` / new `reorderFavorites` IPC.
- Create: `packages/frontend/src/components/RecentLocationsDialog.tsx` — searchable list, open, remove single, clear all.
- Create: `packages/frontend/src/components/ClearRecentLocationsDialog.tsx` — extends `ConfirmationDialog` with "only navigation history is cleared, files are not changed".
- Modify: `packages/frontend/src/shell/MenuBar.tsx` to take dynamic `favorites`, `recentLocations`, `volumes` props (the current static `goItems` becomes a function over those arrays applying §8.2 caps).
- Modify: `packages/frontend/src/index.tsx` to pass them in and wire dialogs.
- Modify: `apps/desktop-tauri/src-tauri/src/lib.rs` — `navigation_reorder_favorites`, `navigation_clear_recent` commands.
- Modify: `packages/ts-api/src/client.ts` — add the new methods + commandMap entries.
- Test: per-dialog Vitest; e2e in `e2e/navigation-dialogs.e2e.ts`; menu structure test for §8.2 caps + "More Volumes…" / "Show All Recent Locations…" overflow.

---

## Phase 6 — Info dialogs

**Goal:** Deliver §14.12 Selection Properties, §14.29 About, §14.30 Report Issue, §14.32 Error Details.

**Files:**

- Create: `packages/frontend/src/components/SelectionPropertiesDialog.tsx` — accepts `FileEntryDto[]`; computes file/folder counts; calls a new `fs_selection_summary` IPC (or runs `fs_folder_size` per folder + sum) for total size with cancel.
- Create: `packages/frontend/src/components/AboutDialog.tsx` — pulls `appInfo`, build profile, commit SHA, target OS; "Copy Version Info" button copies a formatted string.
- Create: `packages/frontend/src/components/ReportIssueDialog.tsx` — three buttons per §14.30: Export Diagnostics / Open Issue Tracker / Cancel; opens external URL via Tauri opener plugin.
- Create: `packages/frontend/src/components/ErrorDetailsDialog.tsx` — accepts `{ message, code?, suggestedAction?, affectedUri?, technicalDetails? }`; expandable technical details; "Copy Details" button.
- Modify: `packages/frontend/src/components/ToastStack.tsx` — Error toasts gain a "Details" action that opens `ErrorDetailsDialog`.
- Modify: `packages/frontend/src/toastNotifications.ts` — toast type includes optional `details?: { code, technical, affectedUri }`.
- Modify: `packages/frontend/src/index.tsx` — `operationErrorMessage` now returns a structured object compatible with `ErrorDetailsDialog`.
- Modify: `apps/desktop-tauri/src-tauri/src/lib.rs` — extend `app_get_info` to include `commitSha` and `buildProfile` if not already.
- Test: per-dialog Vitest + extend `e2e/audit-ui.e2e.ts`.

---

## Phase 7 — Search/job dialogs + Settings/ActivityPanel reshape

**Goal:** Deliver §14.21 (Recursive Search dialog form), reshape `ActivityPanel` into a drawer per §14.22, deliver §14.23 Operation History dialog. Spec §14.13 Settings dialog needs minor restructure to match the navigation sections listed in §14.13 exactly.

**Files:**

- Create: `packages/frontend/src/components/RecursiveSearchDialog.tsx` — form with search root path, name pattern, include hidden toggle, type filter, modified date filter; result list with reveal/open/properties actions; "Search" / "Cancel Search" buttons backed by `client.fs.recursiveSearchStart` (already exists in IPC).
- Modify: `packages/frontend/src/activity/ActivityPanel.tsx` to support a "drawer mode" that overlays from right edge instead of an inline panel; default mode stays inline; menu/`onJobActivity` opens drawer mode.
- Create: `packages/frontend/src/components/OperationHistoryDialog.tsx` — table with columns time/operation/status/items/source/destination, filters (status/type/date), per-row reveal-source/reveal-destination/show-details/copy-error-details actions; "Clear History…" button opens `ClearOperationHistoryDialog`.
- Modify: `packages/frontend/src/components/SettingsDialog.tsx` to align section layout with §14.13.
- Test: per-dialog Vitest + e2e in `e2e/search-and-jobs.e2e.ts`.

---

## Phase 8 — Layout & pane infrastructure

**Goal:** Real implementations for dual-pane mode, pane focus left/right, swap, equalize, increase-width, and macOS app menu variant.

**Files:**

- Modify: `packages/frontend/src/panelStore.ts` — add `dualPane: boolean`, `splitRatio: number`, `activePanelId` already exists; add reducers: `toggleDualPane`, `swapPanes`, `setSplitRatio`, `focusPane(panelId)`.
- Modify: `packages/frontend/src/applyPreferences.ts` to persist `paneLayout` and `splitRatio`.
- Modify: `packages/frontend/src/index.tsx` — when `state.dualPane`, render both `Sidebar`/pane areas; when false, render only the active panel. Wire `onToggleDualPane`, `onSwapPanes`, `onEqualizePanes`, `onFocusLeftPane`, `onFocusRightPane`, `onIncreaseLeftPane`, `onIncreaseRightPane`.
- Modify: `packages/frontend/src/shell/LayoutResizers.tsx` to drive `splitRatio`.
- Create: `apps/desktop-tauri/src-tauri/src/menu.rs` — native macOS application menu (`tauri::menu::Menu`) for the §4.2 app menu items. Behind `#[cfg(target_os = "macos")]`. Registered in `run()`.
- Modify: `packages/frontend/src/shell/TitleBar.tsx` — hide `MenuBar` on macOS in favour of native menu (detect via `navigator.platform`).
- Test: `panelStore.test.ts` extended; visual snapshot tests in `packages/frontend/tests/visualStates.test.tsx` for dual-pane rendering; e2e in `e2e/dual-pane.e2e.ts`.

---

## Phase 9 — Volume discovery backend

**Goal:** Implement `discover_volumes` Rust command + ts-api wiring, then populate Go > Devices and Volumes submenu with real data per §8.2.

**Files:**

- Create: `crates/platform/src/volumes.rs` — `discover_volumes() -> Vec<VolumeInfo>` with VolumeInfo: id, label, mount path, capacity, available, removable flag, network flag, available/inaccessible state. Platform-specific impls: linux reads `/proc/mounts`; macOS via `diskutil`/`statfs`; windows via `GetLogicalDrives`. Keep behind feature flags; gracefully degrade.
- Modify: `crates/app-ipc/src/lib.rs` — `DiscoverVolumesResponse` DTO + `VolumeDto`.
- Modify: `apps/desktop-tauri/src-tauri/src/lib.rs` — `fs_discover_volumes` command + handler registration.
- Modify: `packages/ts-api/src/client.ts` — `fs.discoverVolumes()` + commandMap.
- Modify: `packages/ts-api/src/types.ts` — add `VolumeDto`.
- Modify: `packages/frontend/src/index.tsx` — load volumes on mount, pass to `MenuBar` props, wire to `VolumePickerDialog`.
- Test: Rust unit tests for parser code; ts-api client test stub; e2e smoke that the Go > Devices submenu renders something.

---

## Phase 10 — Enablement, shortcuts, e2e, acceptance

**Goal:** Audit §15 keyboard coverage, §16 enablement rules, deliver §23 manual-QA-as-e2e matrix, mark spec §21 acceptance criteria.

**Files:**

- Modify: `packages/frontend/src/shortcuts.ts` — extend `shortcutEntries` to cover every shortcut in spec §15 table (Ctrl+I Properties, Tab Switch Pane, Backspace/Alt+Up, etc.). Add any missing entries.
- Modify: `packages/frontend/src/index.tsx` `handleShellKeyDown` (the `onKeyDown` on the shell `main` element) — implement every shortcut, with `isEditableTarget` guards.
- Audit: `packages/frontend/src/shell/MenuBar.tsx` items — every menu item that uses `disabled` must have a Tooltip explaining why (spec §2.3). Add a `tooltip?: string` field to `DropdownMenuItem` and render via `Tooltip` from `@fileoctopus/ui`.
- Audit + extend: `packages/frontend/tests/menuBar.test.tsx` — assert §16.1 enablement matrix.
- Create: `e2e/qa-matrix.e2e.ts` — implements spec §23 checklist as 20 Playwright tests. Each step is a checkable test case.
- Modify: `docs/plans/FileOctopus_Menu_and_Modal_Specification.md` — final status update to "Implementation complete" with acceptance §21 evidence.

---

## Backend gaps inventory (referenced across phases)

- ✅ Already implemented in Rust: `fs_open_default`, `fs_reveal`, `fs_create_file`, `fs_delete_permanently`, `fs_properties`, `fs_folder_size_start`, `fs_recursive_search_start`, `navigation_*`, `cancel_job`, `clear_operation_history`, `export_diagnostics_bundle`.
- ❌ To add (Phase 4): `reset_layout_preferences`.
- ❌ To add (Phase 5): `navigation_reorder_favorites`, `navigation_clear_recent`.
- ❌ To add (Phase 6): extend `app_get_info` with `commitSha` and `buildProfile` if absent.
- ❌ To add (Phase 9): `fs_discover_volumes`.
- ✗ Out of scope (per user choice §14.31): graceful job-drain shutdown.

## Self-review checklist

Per writing-plans skill self-review:

1. **Spec coverage:** the §-coverage table at top of this document maps every spec section to a phase. ✔
2. **Placeholder scan:** Phase 1 contains complete code; Phases 2–10 are scoped not stubbed — each lists exact file paths, signatures, IPC dependencies, and test expectations. The skill warns against placeholders inside an executable task; the master roadmap intentionally references future plans that will be drafted at execution time. Phase 1 (the only phase to execute right now) has no placeholders.
3. **Type consistency:** new `MenuBarProps` fields (`onResetLayout`, `onIconSize`, `onRecentOperations`, `onCancelActiveJob`, `onClearOperationHistory`, `onFocusLeftPane`, `onFocusRightPane`, `onIncreaseLeftPane`, `onIncreaseRightPane`) introduced in Tasks 1.6/1.8/1.9 are required by their tests and stubbed in `index.tsx` in the same task. `DropdownMenuItem.children?: DropdownMenuItem[]` matches the destructured shape used by `SubmenuItem`. The new Rust command names (`reset_layout_preferences`, `navigation_reorder_favorites`, `navigation_clear_recent`, `fs_discover_volumes`) are paired with corresponding ts-api commandMap entries in the relevant phase descriptions.

---

## Execution handoff

**Plan complete and saved to `docs/plans/2026-05-16-menu-and-modal-implementation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration. Best for Phase 1's 11 bite-sized tasks.

**2. Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review.

Phase 1 should execute in either mode. Phases 2–10 each need their own detailed plan written first (via this same skill) when we approach them — the master roadmap above is scoped intent, not bite-sized tasks.
