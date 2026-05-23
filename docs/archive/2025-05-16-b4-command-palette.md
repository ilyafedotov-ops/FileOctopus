# Command Palette Implementation Plan

> **For implementer:** Use TDD throughout. Write failing test first. Watch it fail. Then implement.

**Goal:** Add a Command Palette (Ctrl+P) to FileOctopus — a searchable overlay listing all commands with fuzzy matching.

**Architecture:** CommandPalette is a standalone React component (like ShortcutsDialog) rendered as a modal overlay. It uses the existing `shortcutEntries` array as its command index. Fuzzy search is implemented as a pure function (no library dependency). The component is wired into `index.tsx` with a `commandPaletteOpen` state and Ctrl+P shortcut.

**Tech Stack:** React 18, @testing-library/react, vitest, @fileoctopus/ui (SearchInput, Icons)

**Test Infrastructure:**

- Runner: `npx vitest run tests --environment jsdom`
- Pattern: `@testing-library/react` + `vi.fn()` mocks
- Existing tests: 10 files, 54 tests — all green
- CSS: `apps/desktop-tauri/src/App.css`

---

### Task 1: Fuzzy search utility — `matchCommand`

**Files:**

- Create: `packages/frontend/src/utils/matchCommand.ts`
- Test: `packages/frontend/tests/matchCommand.test.ts`

**Step 1: Write the failing test**

```ts
// packages/frontend/tests/matchCommand.test.ts
import { describe, expect, it } from "vitest";
import { matchCommand } from "../src/utils/matchCommand";

describe("matchCommand", () => {
  it("matches exact label substring", () => {
    expect(matchCommand("copy", "Copy selection")).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(matchCommand("REFRESH", "Refresh pane")).toBe(true);
  });

  it("matches fuzzy characters in order", () => {
    // "cp" matches "Copy" (c...p...)
    expect(matchCommand("cp", "Copy selection")).toBe(true);
  });

  it("rejects non-matching query", () => {
    expect(matchCommand("xyz", "Copy selection")).toBe(false);
  });

  it("rejects out-of-order fuzzy match", () => {
    // "pc" should NOT match "Copy" (p comes after y in "Copy")
    expect(matchCommand("pc", "Copy selection")).toBe(false);
  });

  it("matches empty query (always true)", () => {
    expect(matchCommand("", "Copy selection")).toBe(true);
  });

  it("matches against shortcut keys too", () => {
    // "ctrl+c" matches the shortcut key
    expect(matchCommand("ctrl+c", "Copy selection")).toBe(true);
  });

  it("matches against category", () => {
    expect(matchCommand("view", "Toggle hidden files")).toBe(true);
  });
});
```

**Step 2: Run test — confirm it fails**
Command: `cd packages/frontend && npx vitest run tests/matchCommand.test.ts`
Expected: FAIL — `Cannot find module '../src/utils/matchCommand'`

**Step 3: Write minimal implementation**

```ts
// packages/frontend/src/utils/matchCommand.ts
export interface CommandItem {
  label: string;
  shortcutKey?: string;
  category?: string;
}

export function matchCommand(query: string, item: CommandItem): boolean {
  if (!query) return true;

  const q = query.toLowerCase();

  const haystack = [item.label, item.shortcutKey ?? "", item.category ?? ""]
    .join(" ")
    .toLowerCase();

  // Substring match first
  if (haystack.includes(q)) return true;

  // Fuzzy match: each query char must appear in order
  let hayIdx = 0;
  for (const ch of q) {
    const found = haystack.indexOf(ch, hayIdx);
    if (found === -1) return false;
    hayIdx = found + 1;
  }

  return true;
}
```

**Step 4: Run test — confirm it passes**
Command: `cd packages/frontend && npx vitest run tests/matchCommand.test.ts`
Expected: PASS

**Step 5: Commit**
`git add packages/frontend/src/utils/matchCommand.ts packages/frontend/tests/matchCommand.test.ts && git commit -m "feat: add matchCommand fuzzy search utility (TDD)"`

---

### Task 2: CommandPalette component — rendering

**Files:**

- Create: `packages/frontend/src/components/CommandPalette.tsx`
- Test: `packages/frontend/tests/commandPalette.test.tsx`

**Step 1: Write the failing test**

```tsx
// packages/frontend/tests/commandPalette.test.tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "../src/components/CommandPalette";

const commands = [
  {
    id: "copy",
    label: "Copy selection",
    shortcutKey: "Ctrl+C",
    category: "File operations",
  },
  {
    id: "refresh",
    label: "Refresh pane",
    shortcutKey: "Ctrl+R",
    category: "View",
  },
  {
    id: "toggle-hidden",
    label: "Toggle hidden files",
    shortcutKey: "Ctrl+H",
    category: "View",
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CommandPalette", () => {
  it("renders nothing when closed", () => {
    render(
      <CommandPalette
        open={false}
        commands={commands}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders search input and command list when open", () => {
    render(
      <CommandPalette
        open
        commands={commands}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByPlaceholderText("Type a command...")).toBeTruthy();
    expect(screen.getByText("Copy selection")).toBeTruthy();
    expect(screen.getByText("Refresh pane")).toBeTruthy();
  });

  it("filters commands by search query", () => {
    render(
      <CommandPalette
        open
        commands={commands}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    const input = screen.getByPlaceholderText("Type a command...");
    fireEvent.change(input, { target: { value: "ref" } });
    expect(screen.queryByText("Copy selection")).toBeNull();
    expect(screen.getByText("Refresh pane")).toBeTruthy();
  });

  it("calls onSelect with command id when command is clicked", () => {
    const onSelect = vi.fn();
    render(
      <CommandPalette
        open
        commands={commands}
        onSelect={onSelect}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("Copy selection"));
    expect(onSelect).toHaveBeenCalledWith("copy");
  });

  it("calls onClose on Escape key", () => {
    const onClose = vi.fn();
    render(
      <CommandPalette
        open
        commands={commands}
        onSelect={() => {}}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("shows 'No matching commands' for empty results", () => {
    render(
      <CommandPalette
        open
        commands={commands}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    const input = screen.getByPlaceholderText("Type a command...");
    fireEvent.change(input, { target: { value: "zzzzz" } });
    expect(screen.getByText("No matching commands")).toBeTruthy();
  });
});
```

**Step 2: Run test — confirm it fails**
Command: `cd packages/frontend && npx vitest run tests/commandPalette.test.tsx`
Expected: FAIL — `Cannot find module '../src/components/CommandPalette'`

**Step 3: Write minimal implementation**

```tsx
// packages/frontend/src/components/CommandPalette.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SearchInput } from "@fileoctopus/ui";
import { useDialogEscape } from "../hooks/useDialogEscape";
import { matchCommand, type CommandItem } from "../utils/matchCommand";
import { cx } from "@fileoctopus/ui";

export interface CommandEntry extends CommandItem {
  id: string;
}

interface CommandPaletteProps {
  open: boolean;
  commands: CommandEntry[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function CommandPalette({
  open,
  commands,
  onSelect,
  onClose,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useDialogEscape(open, onClose);

  useEffect(() => {
    if (open) {
      setQuery("");
      // Focus input after render
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(
    () =>
      query
        ? commands.filter((cmd) =>
            matchCommand(query, {
              label: cmd.label,
              shortcutKey: cmd.shortcutKey,
              category: cmd.category,
            }),
          )
        : commands,
    [query, commands],
  );

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
      onClose();
    },
    [onSelect, onClose],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" && filtered.length > 0) {
        handleSelect(filtered[0].id);
      }
    },
    [filtered, handleSelect],
  );

  if (!open) return null;

  return (
    <div className="fo-dialog-backdrop" role="presentation" onClick={onClose}>
      <dialog
        open
        className="fo-dialog fo-command-palette"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="fo-command-palette-input">
          <SearchInput
            ref={inputRef}
            placeholder="Type a command..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search commands"
          />
        </div>
        <ul className="fo-command-palette-list" role="listbox">
          {filtered.length === 0 ? (
            <li className="fo-command-palette-empty">No matching commands</li>
          ) : (
            filtered.map((cmd) => (
              <li
                key={cmd.id}
                role="option"
                className={cx(
                  "fo-command-palette-item",
                  cmd.id === filtered[0]?.id &&
                    "fo-command-palette-item-active",
                )}
                onClick={() => handleSelect(cmd.id)}
              >
                <span className="fo-command-palette-label">{cmd.label}</span>
                {cmd.shortcutKey && (
                  <kbd className="fo-command-palette-shortcut">
                    {cmd.shortcutKey}
                  </kbd>
                )}
              </li>
            ))
          )}
        </ul>
      </dialog>
    </div>
  );
}
```

**Step 4: Run test — confirm it passes**
Command: `cd packages/frontend && npx vitest run tests/commandPalette.test.tsx`
Expected: PASS

**Step 5: Commit**
`git add packages/frontend/src/components/CommandPalette.tsx packages/frontend/tests/commandPalette.test.tsx && git commit -m "feat: add CommandPalette component with search/filter (TDD)"`

---

### Task 3: CSS styles for Command Palette

**Files:**

- Modify: `apps/desktop-tauri/src/App.css`

**Step 1: Write the failing test**

Add to `packages/frontend/tests/commandPalette.test.tsx`:

```ts
it("applies fo-command-palette CSS class", () => {
  render(<CommandPalette open commands={commands} onSelect={() => {}} onClose={() => {}} />);
  const dialog = screen.getByRole("dialog");
  expect(dialog.className).toContain("fo-command-palette");
});
```

**Step 2: Run test — confirm it passes** (CSS class already on element — should pass immediately, confirming structure)

**Step 3: Add CSS styles**

Add to `apps/desktop-tauri/src/App.css`:

```css
/* Command Palette */
.fo-command-palette {
  max-width: 520px;
  width: 90vw;
  padding: 0;
  border-radius: 8px;
  top: 15vh;
}

.fo-command-palette-input {
  padding: 12px;
  border-bottom: 1px solid var(--fo-border-color, #333);
}

.fo-command-palette-input input {
  width: 100%;
  font-size: 14px;
  padding: 8px;
}

.fo-command-palette-list {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  max-height: 320px;
  overflow-y: auto;
}

.fo-command-palette-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  gap: 12px;
}

.fo-command-palette-item:hover,
.fo-command-palette-item-active {
  background: var(--fo-selection-bg, rgba(255, 255, 255, 0.08));
}

.fo-command-palette-label {
  font-size: 13px;
}

.fo-command-palette-shortcut {
  font-size: 11px;
  opacity: 0.5;
  font-family: var(--fo-mono, monospace);
}

.fo-command-palette-empty {
  padding: 16px;
  text-align: center;
  opacity: 0.5;
  font-size: 13px;
}
```

**Step 4: Run full test suite**
Command: `cd packages/frontend && npx vitest run tests --environment jsdom`
Expected: all pass

**Step 5: Commit**
`git add apps/desktop-tauri/src/App.css && git commit -m "feat: add Command Palette CSS styles"`

---

### Task 4: Wire CommandPalette into app shell — state + Ctrl+P shortcut

**Files:**

- Modify: `packages/frontend/src/index.tsx`
- Modify: `packages/frontend/src/shortcuts.ts`
- Test: `packages/frontend/tests/appShell.test.tsx`

**Step 1: Write the failing test**

Add to `packages/frontend/tests/appShell.test.tsx` (or create new section):

```ts
it("opens command palette on Ctrl+P", async () => {
  // Render the full shell (existing helper)
  // ...
  fireEvent.keyDown(container, { key: "p", ctrlKey: true });
  await waitFor(() => {
    expect(
      screen.getByRole("dialog", { name: "Command palette" }),
    ).toBeTruthy();
  });
});
```

**Step 2: Run test — confirm it fails**
Command: `cd packages/frontend && npx vitest run tests/appShell.test.tsx`
Expected: FAIL — dialog not found

**Step 3: Wire into index.tsx**

1. Add `commandPaletteOpen` state:

```tsx
const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
```

2. Add Ctrl+P handler in `handleShellKeyDown`:

```tsx
if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
  event.preventDefault();
  setCommandPaletteOpen(true);
  return;
}
```

3. Build command entries from `shortcutEntries`:

```tsx
import { shortcutEntries } from "./shortcuts";
import { CommandPalette, type CommandEntry } from "./components/CommandPalette";

const commandEntries: CommandEntry[] = shortcutEntries.map((e) => ({
  id: e.id,
  label: e.label,
  shortcutKey: e.windowsLinux,
  category: e.category,
}));
```

4. Render `<CommandPalette>` alongside other dialogs:

```tsx
<CommandPalette
  open={commandPaletteOpen}
  commands={commandEntries}
  onSelect={handleCommandSelect}
  onClose={() => setCommandPaletteOpen(false)}
/>
```

5. Implement `handleCommandSelect` to map command IDs to actions (e.g., "copy" → onCopy, "refresh" → refreshPanel, "preferences" → setSettingsOpen, etc.)

6. Add shortcut entry for Command Palette in `shortcuts.ts`:

```ts
{
  id: "command-palette",
  label: "Command palette",
  mac: "⌘P",
  windowsLinux: "Ctrl+P",
  category: "Navigation",
},
```

**Step 4: Run test — confirm it passes**
Command: `cd packages/frontend && npx vitest run tests/appShell.test.tsx`
Expected: PASS

**Step 5: Run full suite**
Command: `cd packages/frontend && npx vitest run tests --environment jsdom`
Expected: all pass

**Step 6: Commit**
`git add -A && git commit -m "feat: wire CommandPalette into app shell with Ctrl+P shortcut"`

---

### Task 5: Arrow key navigation + Enter selection in Command Palette

**Files:**

- Modify: `packages/frontend/src/components/CommandPalette.tsx`
- Modify: `packages/frontend/tests/commandPalette.test.tsx`

**Step 1: Write the failing tests**

```ts
it("navigates with arrow keys", () => {
  render(<CommandPalette open commands={commands} onSelect={() => {}} onClose={() => {}} />);
  const dialog = screen.getByRole("dialog");

  // Initially first item is active
  const items = screen.getAllByRole("option");
  expect(items[0].className).toContain("fo-command-palette-item-active");

  // Arrow down moves to second
  fireEvent.keyDown(dialog, { key: "ArrowDown" });
  expect(items[1].className).toContain("fo-command-palette-item-active");

  // Arrow up wraps to last
  fireEvent.keyDown(dialog, { key: "ArrowUp" });
  expect(items[0].className).toContain("fo-command-palette-item-active");
});

it("selects active item on Enter", () => {
  const onSelect = vi.fn();
  render(<CommandPalette open commands={commands} onSelect={onSelect} onClose={() => {}} />);
  const dialog = screen.getByRole("dialog");

  // Arrow down then Enter
  fireEvent.keyDown(dialog, { key: "ArrowDown" });
  fireEvent.keyDown(dialog, { key: "Enter" });
  expect(onSelect).toHaveBeenCalledWith("refresh");
});
```

**Step 2: Run test — confirm it fails**
Command: `cd packages/frontend && npx vitest run tests/commandPalette.test.tsx`
Expected: FAIL — ArrowDown not handled

**Step 3: Implement arrow navigation**

Add `activeIndex` state and arrow key handling to CommandPalette:

```tsx
const [activeIndex, setActiveIndex] = useState(0);

// Reset activeIndex when filtered changes
useEffect(() => setActiveIndex(0), [filtered]);

// In handleKeyDown:
if (event.key === "ArrowDown") {
  event.preventDefault();
  setActiveIndex((i) => (i + 1) % filtered.length);
} else if (event.key === "ArrowUp") {
  event.preventDefault();
  setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
} else if (event.key === "Enter" && filtered.length > 0) {
  handleSelect(filtered[activeIndex].id);
}
```

Update `fo-command-palette-item-active` class to use `activeIndex`:

```tsx
className={cx("fo-command-palette-item", idx === activeIndex && "fo-command-palette-item-active")}
```

**Step 4: Run test — confirm it passes**
Command: `cd packages/frontend && npx vitest run tests/commandPalette.test.tsx`
Expected: PASS

**Step 5: Run full suite**
Command: `cd packages/frontend && npx vitest run tests --environment jsdom`
Expected: all pass

**Step 6: Commit**
`git add -A && git commit -m "feat: add arrow key navigation to Command Palette"`

---

## Summary

| Task | Description                  | Files                   | Tests                   |
| ---- | ---------------------------- | ----------------------- | ----------------------- |
| 1    | Fuzzy search utility         | matchCommand.ts         | matchCommand.test.ts    |
| 2    | CommandPalette component     | CommandPalette.tsx      | commandPalette.test.tsx |
| 3    | CSS styles                   | App.css                 | (structural test)       |
| 4    | Wire into app shell + Ctrl+P | index.tsx, shortcuts.ts | appShell.test.tsx       |
| 5    | Arrow key navigation         | CommandPalette.tsx      | commandPalette.test.tsx |

**Execution options:**

1. **Subagent-Driven** — I dispatch a fresh sub-agent per task, review between tasks
2. **Manual** — You run the tasks yourself
