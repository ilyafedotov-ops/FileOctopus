# Terminal Pane Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the embedded terminal feel like a first-class feature of the active file pane: visible by default, bound to the pane's current folder, and (in Phase 2) rendered as a bottom split inside the pane rather than only inside the activity rail.

**Architecture:** Two phases. **Phase 1** is a discoverability polish (~half day): pin the toolbar button to the always-visible tier, badge it with running-session count, add a one-click affordance from `PaneHeader`. **Phase 2** is a structural refactor (~3 days): extend `TerminalSession` with a `paneId` field, add per-pane terminal state, render `TerminalView` as a VS Code-style bottom split inside `FilePanel`. The existing activity-rail terminal segment is preserved as a secondary surface ("detached / system" terminals).

**Tech Stack:** Rust (terminal-core unchanged), TypeScript + React 19 (frontend), Vitest (tests), pnpm workspace. Existing `TerminalProvider` reducer, `panelStore` slices, `pane/FilePanel.tsx` rendering tree, `app-ipc` DTOs (unchanged).

---

## File map

### Phase 1 (discoverability)

- Modify `packages/frontend/src/pane/toolbarOverflowTier.ts` — promote `"terminal"` to base tier
- Modify `packages/frontend/src/pane/CommanderToolbarTail.tsx` — render session-count badge on the terminal button
- Modify `packages/frontend/src/pane/PaneHeader.tsx` — add a "Terminal" affordance next to the path bar
- Modify `packages/frontend/src/commands/toolbarConfig.ts` — update help text for the terminal command
- Create `packages/frontend/tests/toolbarTerminalBadge.test.tsx` — badge renders count when sessions exist
- Modify `packages/frontend/tests/toolbarToggle.test.tsx` — verify terminal stays visible at narrow widths

### Phase 2 (pane-bound terminal)

- Modify `packages/frontend/src/terminal/terminalSlice.ts` — add `paneId?: PanelId | "rail"` to `TerminalSession`; add `paneVisibility` and `paneHeightRatio` keyed by panel id
- Modify `packages/frontend/src/app/providers/TerminalProvider.tsx` — new `openPaneTerminal(panelId, uri)`, `togglePaneTerminal(panelId)`, `setPaneTerminalHeight(panelId, ratio)`; existing rail methods become explicit
- Create `packages/frontend/src/pane/PaneTerminalRegion.tsx` — bottom region renderer (tab bar + xterm views + resize handle)
- Create `packages/frontend/src/pane/PaneTerminalResizer.tsx` — vertical drag handle component
- Modify `packages/frontend/src/pane/FilePanel.tsx` — render `<PaneTerminalRegion>` when this pane has visible sessions
- Modify `packages/frontend/src/app/FileOctopusApp.tsx` — pipe pane terminal handlers into FilePanel props and toolbar
- Modify `packages/frontend/src/commands/dispatch.ts` — `op.openTerminal` routes to `openPaneTerminal` for the active pane
- Modify `packages/frontend/src/jobs/ActivityRailPanel.tsx` — only show terminals whose `paneId === "rail"`
- Create `packages/frontend/src/styles/regions/paneTerminal.css` — pane terminal layout styles
- Modify `packages/frontend/src/styles/regions/jobs.css` — strip terminal-only rules; cross-ref new file
- Create `packages/frontend/tests/terminalSlice.paneRoutes.test.ts` — session routing by paneId
- Create `packages/frontend/tests/paneTerminalRegion.test.tsx` — region renders sessions for its pane only
- Modify `packages/frontend/tests/terminalSlice.test.ts` — backfill `paneId: "rail"` on existing fixtures
- Modify `packages/frontend/tests/mockTerminalClient.ts` — no-op shape changes (paneId metadata)

### Phase 3 (preferences + persistence — optional)

- Modify `crates/config/src/preferences.rs` — add `pane_terminal_height_left: f64`, `pane_terminal_height_right: f64`, `pane_terminal_default_open: bool`
- Modify `crates/app-ipc/src/lib.rs` — mirror new preferences in `UserPreferencesDto`
- Modify `packages/ts-api/src/types.ts` — mirror DTO
- Modify `packages/frontend/src/app/providers/TerminalProvider.tsx` — persist height changes through `client.preferences.set`
- Modify `packages/frontend/src/dialogs/SettingsDialog.tsx` — UI for the new preferences

Phase 3 is left at a higher granularity because it depends on the final shape of Phase 2.

---

## Phase 1 — Discoverability polish

### Task 1: Promote `terminal` toolbar section to the base tier

**Files:**

- Modify: `packages/frontend/src/pane/toolbarOverflowTier.ts`

- [ ] **Step 1: Read the current section tiering rules**

Run: `cat /Users/ilya/Documents/FileOctupus/packages/frontend/src/pane/toolbarOverflowTier.ts`

You'll see a switch on `section` that returns a tier number per overflow level. `"terminal"` is currently grouped with the "tools" tier, hiding below medium width.

- [ ] **Step 2: Move `"terminal"` into the always-visible tier**

In `toolbarOverflowTier.ts`, find the `case "terminal":` branch and change it to return tier `0` (always visible). Example after edit:

```ts
case "terminal":
  return 0; // always visible — pane-bound terminal is a primary affordance
```

If a tier-0 group doesn't exist yet, add the case to the first switch arm that returns `0`.

- [ ] **Step 3: Update the snapshot baseline**

Run: `pnpm --filter @fileoctopus/frontend test -- -u toolbarToggle`
Expected: snapshot updates pass; review the diff.

- [ ] **Step 4: Run the full toolbar test suite**

Run: `pnpm --filter @fileoctopus/frontend test -- toolbar`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/pane/toolbarOverflowTier.ts packages/frontend/tests/__snapshots__/
git commit -m "feat(frontend): promote terminal toolbar button to always-visible tier"
```

---

### Task 2: Show running-session count badge on the terminal toolbar button

**Files:**

- Modify: `packages/frontend/src/pane/CommanderToolbarTail.tsx`
- Modify: `packages/frontend/src/pane/toolbarIcons.tsx`
- Create: `packages/frontend/tests/toolbarTerminalBadge.test.tsx`

- [ ] **Step 1: Write the failing test**

```ts
// packages/frontend/tests/toolbarTerminalBadge.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommanderToolbarTail } from "../src/pane/CommanderToolbarTail";
import { makeToolbarHandlersStub } from "./toolbarHandlersStub";
import { TerminalContext } from "../src/app/providers/TerminalProvider";
import { createInitialTerminalState } from "../src/terminal/terminalSlice";

describe("Terminal toolbar badge", () => {
  it("renders running-session count when sessions exist", () => {
    const state = {
      ...createInitialTerminalState(),
      sessions: [
        { id: "a", uri: "local:///tmp", label: "tmp", status: "running" as const, paneId: "left" as const },
        { id: "b", uri: "local:///x",   label: "x",   status: "exited"  as const, paneId: "left" as const },
      ],
    };
    render(
      <TerminalContext.Provider value={{
        terminal: state,
        openEmbeddedTerminal: async () => {},
        openNewTerminalTab: async () => {},
        openPaneTerminal: async () => {},
        markSessionExited: () => {},
        closeTerminalTab: () => {},
        switchTerminalTab: () => {},
        setRailSegment: () => {},
        openExternalTerminal: async () => {},
      }}>
        <CommanderToolbarTail
          panelId="left"
          handlers={makeToolbarHandlersStub()}
          commandContext={{}}
          overflowTier="full"
        />
      </TerminalContext.Provider>,
    );
    const badge = screen.getByLabelText(/terminal sessions/i);
    expect(badge.textContent).toBe("1");
  });

  it("renders no badge when there are zero running sessions", () => {
    const state = createInitialTerminalState();
    render(
      <TerminalContext.Provider value={{ terminal: state /* …same stubs */ } as any}>
        <CommanderToolbarTail panelId="left" handlers={makeToolbarHandlersStub()} commandContext={{}} overflowTier="full" />
      </TerminalContext.Provider>,
    );
    expect(screen.queryByLabelText(/terminal sessions/i)).toBeNull();
  });
});
```

If `tests/toolbarHandlersStub.ts` does not exist, create a small helper that returns a no-op object with every key of `ToolbarHandlers` mapped to `() => undefined`. Read `pane/toolbarActions.ts` to enumerate the required keys.

- [ ] **Step 2: Run test and confirm it fails**

Run: `pnpm --filter @fileoctopus/frontend test -- toolbarTerminalBadge`
Expected: FAIL — `getByLabelText` cannot find `/terminal sessions/i`.

- [ ] **Step 3: Implement the badge in `CommanderToolbarTail.tsx`**

In the block at `CommanderToolbarTail.tsx:212-218`, wrap the existing `TailButton` so it also renders a badge when running sessions exist. Read the file first to find the imports — pull `useTerminal` from `../app/providers/TerminalProvider` and `Badge` from `@fileoctopus/ui`. Replace the existing block with:

```tsx
{
  showTerminal ? (
    <TerminalTailButton commandContext={commandContext} handlers={handlers} />
  ) : null;
}
```

Then add this helper at the bottom of the same file:

```tsx
function TerminalTailButton({
  commandContext,
  handlers,
}: {
  commandContext: ToolbarCommandContext;
  handlers: ToolbarHandlers;
}) {
  const { terminal } = useTerminal();
  const runningCount = terminal.sessions.filter(
    (s) => s.status === "running",
  ).length;
  return (
    <span className="fo-toolbar-button-wrap">
      <TailButton
        commandId="op.openTerminal"
        commandContext={commandContext}
        handlers={handlers}
      />
      {runningCount > 0 ? (
        <Badge
          tone="accent"
          aria-label={`${runningCount} terminal sessions`}
          className="fo-toolbar-button-badge"
        >
          {runningCount}
        </Badge>
      ) : null}
    </span>
  );
}
```

- [ ] **Step 4: Add the badge CSS**

Append to `packages/frontend/src/styles/regions/jobs.css` (or create `styles/regions/toolbar.css` if you'd prefer):

```css
.fo-toolbar-button-wrap {
  position: relative;
  display: inline-flex;
}
.fo-toolbar-button-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  padding: 0 4px;
  font-size: 10px;
  line-height: 16px;
  pointer-events: none;
}
```

- [ ] **Step 5: Run the test to confirm pass**

Run: `pnpm --filter @fileoctopus/frontend test -- toolbarTerminalBadge`
Expected: PASS (both cases).

- [ ] **Step 6: Run typecheck and full test suite**

Run: `pnpm --filter @fileoctopus/frontend typecheck && pnpm --filter @fileoctopus/frontend test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/src/pane/CommanderToolbarTail.tsx packages/frontend/src/styles/regions/jobs.css packages/frontend/tests/toolbarTerminalBadge.test.tsx
git commit -m "feat(frontend): badge terminal toolbar button with running-session count"
```

---

### Task 3: Surface "Open terminal here" in `PaneHeader`

**Files:**

- Modify: `packages/frontend/src/pane/PaneHeader.tsx`
- Modify: `packages/frontend/src/pane/FilePanel.tsx` — pipe the new handler from props
- Modify: `packages/frontend/tests/visualShellFixture.tsx` — stub the new prop

- [ ] **Step 1: Add `onOpenTerminalHere?: () => void` to `PaneHeader` props**

Read `packages/frontend/src/pane/PaneHeader.tsx` to find the props interface. Add the new optional handler. Add an `IconButton` next to the path/breadcrumb area:

```tsx
{
  onOpenTerminalHere ? (
    <IconButton
      label="Open terminal in this folder"
      size="sm"
      onClick={onOpenTerminalHere}
      title="Open terminal in this folder"
    >
      {Icons.terminal()}
    </IconButton>
  ) : null;
}
```

- [ ] **Step 2: Pipe the handler from `FilePanel` props**

In `FilePanel.tsx`, add `onOpenTerminalHere?: () => void;` to `FilePanelProps`, destructure it in the component, and pass it to `<PaneHeader onOpenTerminalHere={onOpenTerminalHere} />`.

- [ ] **Step 3: Wire from `FileOctopusApp.makeFilePanelProps`**

In `app/FileOctopusApp.tsx`, inside `makeFilePanelProps`, add:

```ts
onOpenTerminalHere: () => handleCommandSelect("op.openTerminal", pid),
```

- [ ] **Step 4: Stub in tests**

In `packages/frontend/tests/visualShellFixture.tsx`, find the `FilePanelProps` builder/spread and add `onOpenTerminalHere: () => undefined,`.

- [ ] **Step 5: Run frontend tests**

Run: `pnpm --filter @fileoctopus/frontend test`
Expected: PASS. If a snapshot test in `visualSnapshots.test.tsx` fires, inspect the diff (an icon button was added) and update with `-u` if intended.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/pane/PaneHeader.tsx packages/frontend/src/pane/FilePanel.tsx packages/frontend/src/app/FileOctopusApp.tsx packages/frontend/tests/visualShellFixture.tsx packages/frontend/tests/__snapshots__/
git commit -m "feat(frontend): add 'open terminal here' affordance to pane header"
```

---

### Task 4: Update toolbar tooltip copy

**Files:**

- Modify: `packages/frontend/src/commands/toolbarConfig.ts`

- [ ] **Step 1: Sharpen the help text**

Open `packages/frontend/src/commands/toolbarConfig.ts`. Find the two lines:

```ts
"op.openTerminal": "Open terminal in active folder",
"op.openTerminalExternal": "Open the system terminal in the active folder",
```

Replace with:

```ts
"op.openTerminal": "Open embedded terminal in this folder",
"op.openTerminalExternal": "Open this folder in the system terminal",
```

- [ ] **Step 2: Run frontend tests**

Run: `pnpm --filter @fileoctopus/frontend test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/commands/toolbarConfig.ts
git commit -m "docs(frontend): clarify embedded vs external terminal toolbar copy"
```

---

## Phase 2 — Pane-bound terminal

### Task 5: Extend `TerminalSession` with `paneId`

**Files:**

- Modify: `packages/frontend/src/terminal/terminalSlice.ts`
- Modify: `packages/frontend/tests/terminalSlice.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/frontend/tests/terminalSlice.test.ts`:

```ts
import {
  createInitialTerminalState,
  terminalReducer,
  type TerminalSession,
} from "../src/terminal/terminalSlice";

it("addSession preserves the paneId field", () => {
  const session: TerminalSession = {
    id: "s1",
    uri: "local:///tmp",
    label: "tmp",
    status: "running",
    paneId: "left",
  };
  const next = terminalReducer(createInitialTerminalState(), {
    type: "addSession",
    session,
  });
  expect(next.sessions).toHaveLength(1);
  expect(next.sessions[0].paneId).toBe("left");
});

it("addSession defaults paneId to 'rail' if missing", () => {
  const next = terminalReducer(createInitialTerminalState(), {
    type: "addSession",
    session: {
      id: "s1",
      uri: "local:///tmp",
      label: "tmp",
      status: "running",
    } as TerminalSession,
  });
  expect(next.sessions[0].paneId).toBe("rail");
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm --filter @fileoctopus/frontend test -- terminalSlice`
Expected: FAIL — `paneId` doesn't exist on `TerminalSession`.

- [ ] **Step 3: Implement the type change**

In `packages/frontend/src/terminal/terminalSlice.ts`:

```ts
export type TerminalPaneId = "left" | "right" | "rail";

export interface TerminalSession {
  id: string;
  uri: string;
  label: string;
  status: TerminalSessionStatus;
  exitCode?: number | null;
  paneId: TerminalPaneId;
}
```

Update the `addSession` reducer to default the field:

```ts
case "addSession": {
  const sessions = [...state.sessions, {
    ...action.session,
    paneId: action.session.paneId ?? "rail",
  }];
  return {
    ...state,
    sessions,
    activeSessionId: action.makeActive === false ? state.activeSessionId : action.session.id,
    segment: action.session.paneId === "rail" || !action.session.paneId
      ? "terminal"
      : state.segment,
  };
}
```

Note: only switch to the "terminal" rail segment when the session was opened _into_ the rail. Pane-bound sessions don't move the rail.

- [ ] **Step 4: Confirm tests pass**

Run: `pnpm --filter @fileoctopus/frontend test -- terminalSlice`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/terminal/terminalSlice.ts packages/frontend/tests/terminalSlice.test.ts
git commit -m "feat(frontend): tag terminal sessions with a paneId (left/right/rail)"
```

---

### Task 6: Add per-pane visibility + height state

**Files:**

- Modify: `packages/frontend/src/terminal/terminalSlice.ts`
- Modify: `packages/frontend/tests/terminalSlice.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `terminalSlice.test.ts`:

```ts
it("setPaneTerminalVisible toggles per-pane visibility", () => {
  const start = createInitialTerminalState();
  const next = terminalReducer(start, {
    type: "setPaneTerminalVisible",
    paneId: "left",
    visible: true,
  });
  expect(next.paneVisibility.left).toBe(true);
  expect(next.paneVisibility.right).toBe(false);
});

it("setPaneTerminalHeight clamps between 0.15 and 0.85", () => {
  const next = terminalReducer(createInitialTerminalState(), {
    type: "setPaneTerminalHeight",
    paneId: "left",
    ratio: 2.0,
  });
  expect(next.paneHeightRatio.left).toBe(0.85);

  const next2 = terminalReducer(next, {
    type: "setPaneTerminalHeight",
    paneId: "left",
    ratio: -1,
  });
  expect(next2.paneHeightRatio.left).toBe(0.15);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm --filter @fileoctopus/frontend test -- terminalSlice`
Expected: FAIL — action types not defined.

- [ ] **Step 3: Extend `TerminalState` and reducer**

In `terminalSlice.ts`:

```ts
export interface TerminalState {
  segment: ActivityRailSegment;
  sessions: TerminalSession[];
  activeSessionId: string | null;
  paneVisibility: { left: boolean; right: boolean };
  paneHeightRatio: { left: number; right: number };
  paneActiveSessionId: { left: string | null; right: string | null };
}

export type TerminalAction =
  // … existing variants …
  | {
      type: "setPaneTerminalVisible";
      paneId: "left" | "right";
      visible: boolean;
    }
  | { type: "setPaneTerminalHeight"; paneId: "left" | "right"; ratio: number }
  | {
      type: "setPaneActiveSession";
      paneId: "left" | "right";
      sessionId: string;
    };
```

Update `createInitialTerminalState`:

```ts
export function createInitialTerminalState(): TerminalState {
  return {
    segment: "activity",
    sessions: [],
    activeSessionId: null,
    paneVisibility: { left: false, right: false },
    paneHeightRatio: { left: 0.35, right: 0.35 },
    paneActiveSessionId: { left: null, right: null },
  };
}
```

Add the reducer branches:

```ts
case "setPaneTerminalVisible":
  return {
    ...state,
    paneVisibility: { ...state.paneVisibility, [action.paneId]: action.visible },
  };
case "setPaneTerminalHeight": {
  const clamped = Math.min(0.85, Math.max(0.15, action.ratio));
  return {
    ...state,
    paneHeightRatio: { ...state.paneHeightRatio, [action.paneId]: clamped },
  };
}
case "setPaneActiveSession":
  return {
    ...state,
    paneActiveSessionId: {
      ...state.paneActiveSessionId,
      [action.paneId]: action.sessionId,
    },
  };
```

Update existing `addSession` to set `paneActiveSessionId` when the new session belongs to a pane:

```ts
case "addSession": {
  const session = { ...action.session, paneId: action.session.paneId ?? "rail" };
  const sessions = [...state.sessions, session];
  const paneActiveSessionId =
    session.paneId === "left" || session.paneId === "right"
      ? { ...state.paneActiveSessionId, [session.paneId]: session.id }
      : state.paneActiveSessionId;
  const paneVisibility =
    session.paneId === "left" || session.paneId === "right"
      ? { ...state.paneVisibility, [session.paneId]: true }
      : state.paneVisibility;
  return {
    ...state,
    sessions,
    activeSessionId: action.makeActive === false ? state.activeSessionId : session.id,
    segment: session.paneId === "rail" ? "terminal" : state.segment,
    paneActiveSessionId,
    paneVisibility,
  };
}
```

- [ ] **Step 4: Update `closeSession` to clear the pane-active pointer**

```ts
case "closeSession": {
  const target = state.sessions.find((s) => s.id === action.sessionId);
  const sessions = state.sessions.filter((s) => s.id !== action.sessionId);
  let paneActiveSessionId = state.paneActiveSessionId;
  if (target && (target.paneId === "left" || target.paneId === "right")) {
    if (state.paneActiveSessionId[target.paneId] === action.sessionId) {
      const sibling = sessions.find((s) => s.paneId === target.paneId);
      paneActiveSessionId = {
        ...paneActiveSessionId,
        [target.paneId]: sibling?.id ?? null,
      };
    }
  }
  // … keep existing activeSessionId fallback logic …
  return { ...state, sessions, activeSessionId, paneActiveSessionId, segment: /* same as before */ };
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @fileoctopus/frontend test -- terminalSlice`
Expected: PASS (new tests + existing).

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/terminal/terminalSlice.ts packages/frontend/tests/terminalSlice.test.ts
git commit -m "feat(frontend): per-pane terminal visibility, height, and active session"
```

---

### Task 7: Add `openPaneTerminal` and friends to `TerminalProvider`

**Files:**

- Modify: `packages/frontend/src/app/providers/TerminalProvider.tsx`

- [ ] **Step 1: Add new context methods**

Extend `TerminalContextValue`:

```ts
interface TerminalContextValue {
  terminal: TerminalState;
  openEmbeddedTerminal: (uri: string) => Promise<void>; // legacy: rail
  openPaneTerminal: (paneId: "left" | "right", uri: string) => Promise<void>;
  togglePaneTerminal: (paneId: "left" | "right") => void;
  setPaneTerminalHeight: (paneId: "left" | "right", ratio: number) => void;
  setPaneActiveSession: (paneId: "left" | "right", sessionId: string) => void;
  closeTerminalTab: (sessionId: string) => void;
  switchTerminalTab: (sessionId: string) => void;
  setRailSegment: (segment: ActivityRailSegment) => void;
  openExternalTerminal: (uri: string) => Promise<void>;
  markSessionExited: (sessionId: string, exitCode?: number | null) => void;
}
```

- [ ] **Step 2: Implement `openPaneTerminal`**

Add to the provider body:

```ts
const openPaneTerminal = useCallback(
  async (paneId: "left" | "right", uri: string) => {
    if (isRemoteUri(uri)) {
      throw new Error("Embedded terminal supports local folders only");
    }
    const sessionId = await spawnSession(client, uri);
    dispatch({
      type: "addSession",
      session: {
        id: sessionId,
        uri,
        label: tabLabelForUri(uri),
        status: "running",
        paneId,
      },
    });
  },
  [client],
);

const togglePaneTerminal = useCallback((paneId: "left" | "right") => {
  dispatch({
    type: "setPaneTerminalVisible",
    paneId,
    visible: /* invert in caller */ false,
  });
}, []);
```

Because `togglePaneTerminal` needs the previous value, use a reducer-side `togglePaneVisibility` action instead. Add to `terminalSlice.ts`:

```ts
case "togglePaneTerminal":
  return {
    ...state,
    paneVisibility: {
      ...state.paneVisibility,
      [action.paneId]: !state.paneVisibility[action.paneId],
    },
  };
```

…and the matching action type. Then `togglePaneTerminal` becomes:

```ts
const togglePaneTerminal = useCallback((paneId: "left" | "right") => {
  dispatch({ type: "togglePaneTerminal", paneId });
}, []);
```

- [ ] **Step 3: Wire the rest**

```ts
const setPaneTerminalHeight = useCallback(
  (paneId: "left" | "right", ratio: number) => {
    dispatch({ type: "setPaneTerminalHeight", paneId, ratio });
  },
  [],
);
const setPaneActiveSession = useCallback(
  (paneId: "left" | "right", sessionId: string) => {
    dispatch({ type: "setPaneActiveSession", paneId, sessionId });
  },
  [],
);
```

Add them to the memoized context value at the bottom.

- [ ] **Step 4: Update `StubTerminalProvider` with no-op versions**

In the same file, extend the stub with no-op functions matching the new context shape.

- [ ] **Step 5: Run typecheck**

Run: `pnpm --filter @fileoctopus/frontend typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/app/providers/TerminalProvider.tsx packages/frontend/src/terminal/terminalSlice.ts
git commit -m "feat(frontend): TerminalProvider exposes pane-scoped spawn and toggle"
```

---

### Task 8: Build `PaneTerminalRegion` component

**Files:**

- Create: `packages/frontend/src/pane/PaneTerminalRegion.tsx`
- Create: `packages/frontend/tests/paneTerminalRegion.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/tests/paneTerminalRegion.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PaneTerminalRegion } from "../src/pane/PaneTerminalRegion";
import { mockClient } from "./mockTerminalClient";

describe("PaneTerminalRegion", () => {
  it("only renders sessions belonging to this pane", () => {
    render(
      <PaneTerminalRegion
        paneId="left"
        sessions={[
          {
            id: "a",
            uri: "local:///x",
            label: "x",
            status: "running",
            paneId: "left",
          },
          {
            id: "b",
            uri: "local:///y",
            label: "y",
            status: "running",
            paneId: "right",
          },
          {
            id: "c",
            uri: "local:///z",
            label: "z",
            status: "running",
            paneId: "rail",
          },
        ]}
        activeSessionId="a"
        client={mockClient()}
        onSwitch={() => {}}
        onClose={() => {}}
        onNewSession={() => {}}
        onSessionExited={() => {}}
      />,
    );
    expect(screen.getByText("x")).toBeInTheDocument();
    expect(screen.queryByText("y")).toBeNull();
    expect(screen.queryByText("z")).toBeNull();
  });
});
```

If `mockTerminalClient.ts` doesn't already export a `mockClient()` factory, add one that returns an object shaped like `FileOctopusClient` with the `terminal` namespace as no-ops.

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm --filter @fileoctopus/frontend test -- paneTerminalRegion`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the region**

```tsx
// packages/frontend/src/pane/PaneTerminalRegion.tsx
import type { FileOctopusClient } from "@fileoctopus/ts-api";
import type { TerminalSession } from "../terminal/terminalSlice";
import { TerminalTabBar } from "../terminal/TerminalTabBar";
import { TerminalView } from "../terminal/TerminalView";

export interface PaneTerminalRegionProps {
  paneId: "left" | "right";
  sessions: TerminalSession[];
  activeSessionId: string | null;
  client: FileOctopusClient;
  onSwitch: (sessionId: string) => void;
  onClose: (sessionId: string) => void;
  onNewSession: () => void;
  onSessionExited: (sessionId: string, exitCode?: number | null) => void;
}

export function PaneTerminalRegion({
  paneId,
  sessions,
  activeSessionId,
  client,
  onSwitch,
  onClose,
  onNewSession,
  onSessionExited,
}: PaneTerminalRegionProps) {
  const paneSessions = sessions.filter((s) => s.paneId === paneId);
  if (paneSessions.length === 0) {
    return null;
  }
  return (
    <div
      className="fo-pane-terminal"
      role="region"
      aria-label={`Pane ${paneId} terminal`}
    >
      <TerminalTabBar
        sessions={paneSessions}
        activeSessionId={activeSessionId}
        onSwitch={onSwitch}
        onClose={onClose}
        onNew={onNewSession}
      />
      <div className="fo-pane-terminal-views">
        {paneSessions.map((session) => (
          <div
            key={session.id}
            className="fo-pane-terminal-view-wrap"
            hidden={session.id !== activeSessionId}
          >
            <TerminalView
              client={client}
              sessionId={session.id}
              active={session.id === activeSessionId}
              onExit={(code) => onSessionExited(session.id, code)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @fileoctopus/frontend test -- paneTerminalRegion`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/pane/PaneTerminalRegion.tsx packages/frontend/tests/paneTerminalRegion.test.tsx packages/frontend/tests/mockTerminalClient.ts
git commit -m "feat(frontend): PaneTerminalRegion renders pane-scoped terminals"
```

---

### Task 9: Add the vertical resizer

**Files:**

- Create: `packages/frontend/src/pane/PaneTerminalResizer.tsx`

- [ ] **Step 1: Implement the resizer**

```tsx
// packages/frontend/src/pane/PaneTerminalResizer.tsx
import { useCallback, useRef } from "react";

interface PaneTerminalResizerProps {
  paneRef: React.RefObject<HTMLElement>;
  onResize: (ratio: number) => void;
}

export function PaneTerminalResizer({
  paneRef,
  onResize,
}: PaneTerminalResizerProps) {
  const dragging = useRef(false);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragging.current = true;
      (event.target as Element).setPointerCapture(event.pointerId);
    },
    [],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      const pane = paneRef.current;
      if (!pane) return;
      const rect = pane.getBoundingClientRect();
      const fromBottom = rect.bottom - event.clientY;
      const ratio = Math.min(0.85, Math.max(0.15, fromBottom / rect.height));
      onResize(ratio);
    },
    [paneRef, onResize],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      dragging.current = false;
      (event.target as Element).releasePointerCapture(event.pointerId);
    },
    [],
  );

  return (
    <div
      className="fo-pane-terminal-resizer"
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize terminal"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );
}
```

- [ ] **Step 2: Add CSS**

Create `packages/frontend/src/styles/regions/paneTerminal.css`:

```css
.fo-pane-terminal-resizer {
  height: 6px;
  cursor: row-resize;
  background: var(--fo-color-surface-3, transparent);
  flex-shrink: 0;
}
.fo-pane-terminal-resizer:hover {
  background: var(--fo-color-accent);
}
.fo-pane-terminal {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-top: 1px solid var(--fo-color-border);
}
.fo-pane-terminal-views {
  flex: 1;
  position: relative;
  overflow: hidden;
}
.fo-pane-terminal-view-wrap {
  position: absolute;
  inset: 0;
}
```

Then import the new CSS in `packages/frontend/src/styles/index.css` (or wherever region styles are imported).

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/pane/PaneTerminalResizer.tsx packages/frontend/src/styles/regions/paneTerminal.css packages/frontend/src/styles/
git commit -m "feat(frontend): vertical pane terminal resizer + styles"
```

---

### Task 10: Render the region inside `FilePanel` as a bottom split

**Files:**

- Modify: `packages/frontend/src/pane/FilePanel.tsx`

- [ ] **Step 1: Add new optional props**

In `FilePanel.tsx` near the `FilePanelProps` definition:

```ts
interface FilePanelTerminalProps {
  terminalVisible: boolean;
  terminalHeightRatio: number;
  terminalSessions: TerminalSession[];
  terminalActiveSessionId: string | null;
  onTerminalSwitch: (sessionId: string) => void;
  onTerminalClose: (sessionId: string) => void;
  onTerminalNew: () => void;
  onTerminalResize: (ratio: number) => void;
  onTerminalExit: (sessionId: string, code?: number | null) => void;
  client: FileOctopusClient;
}

export interface FilePanelProps extends FilePanelTerminalProps {
  // … existing fields …
}
```

- [ ] **Step 2: Wrap the existing tree in a column flexbox and conditionally render the region**

Replace the existing return shape with:

```tsx
const paneRef = useRef<HTMLDivElement | null>(null);
const filePart = terminalVisible
  ? { flexBasis: `${(1 - terminalHeightRatio) * 100}%` }
  : undefined;

return (
  <div ref={paneRef} className="fo-file-panel" /* preserve existing classes */>
    <div className="fo-file-panel-files" style={filePart}>
      {/* existing PaneHeader + breadcrumbs + table + filter bar tree */}
    </div>
    {terminalVisible ? (
      <>
        <PaneTerminalResizer paneRef={paneRef} onResize={onTerminalResize} />
        <div
          className="fo-file-panel-terminal"
          style={{ flexBasis: `${terminalHeightRatio * 100}%` }}
        >
          <PaneTerminalRegion
            paneId={panelId}
            sessions={terminalSessions}
            activeSessionId={terminalActiveSessionId}
            client={client}
            onSwitch={onTerminalSwitch}
            onClose={onTerminalClose}
            onNewSession={onTerminalNew}
            onSessionExited={onTerminalExit}
          />
        </div>
      </>
    ) : null}
  </div>
);
```

Add the necessary imports (`PaneTerminalRegion`, `PaneTerminalResizer`, `useRef`, types).

- [ ] **Step 3: Append CSS hooks**

In `packages/frontend/src/styles/regions/paneTerminal.css` add:

```css
.fo-file-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.fo-file-panel-files {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.fo-file-panel-terminal {
  flex: 0 0 auto;
  min-height: 120px;
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 4: Run typecheck and tests**

Run: `pnpm --filter @fileoctopus/frontend typecheck && pnpm --filter @fileoctopus/frontend test`
Expected: PASS. Tests will likely need their `FilePanelProps` fixtures updated — see Task 11.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/pane/FilePanel.tsx packages/frontend/src/styles/regions/paneTerminal.css
git commit -m "feat(frontend): render pane-bound terminal region as bottom split"
```

---

### Task 11: Update fixtures so existing tests still pass

**Files:**

- Modify: `packages/frontend/tests/visualShellFixture.tsx`
- Modify: any test that builds `FilePanelProps` directly

- [ ] **Step 1: Run the suite to find broken builders**

Run: `pnpm --filter @fileoctopus/frontend typecheck`
Expected: TS errors at every place that builds `FilePanelProps`.

- [ ] **Step 2: Add the new fields to the fixture**

In `visualShellFixture.tsx`, locate the props builder and add:

```ts
terminalVisible: false,
terminalHeightRatio: 0.35,
terminalSessions: [],
terminalActiveSessionId: null,
onTerminalSwitch: () => {},
onTerminalClose: () => {},
onTerminalNew: () => {},
onTerminalResize: () => {},
onTerminalExit: () => {},
client: mockClient(),
```

Repeat the same additions wherever else props are built (most tests use the fixture, so it should be one or two spots).

- [ ] **Step 3: Run the full frontend suite**

Run: `pnpm --filter @fileoctopus/frontend test`
Expected: PASS. Snapshots that change because `FilePanel`'s root acquired a new `fo-file-panel-files` wrapper need updating — review the diffs.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/tests/
git commit -m "test(frontend): pass pane terminal props to FilePanel fixtures"
```

---

### Task 12: Pipe the new pane terminal props from `FileOctopusApp`

**Files:**

- Modify: `packages/frontend/src/app/FileOctopusApp.tsx`

- [ ] **Step 1: Pull pane terminal data and dispatchers from `useTerminal`**

Near the top of `FileOctopusAppInner`:

```ts
const {
  terminal,
  openPaneTerminal,
  togglePaneTerminal,
  setPaneTerminalHeight,
  setPaneActiveSession,
  closeTerminalTab,
  markSessionExited,
  openExternalTerminal,
  openEmbeddedTerminal,
  setRailSegment,
} = useTerminal();
```

- [ ] **Step 2: Build pane terminal props in `makeFilePanelProps`**

Inside `makeFilePanelProps(pid)`:

```ts
const paneSessions = terminal.sessions.filter((s) => s.paneId === pid);
const paneActiveSessionId = terminal.paneActiveSessionId[pid] ?? null;

return {
  // … existing props …
  client,
  terminalVisible: terminal.paneVisibility[pid] && paneSessions.length > 0,
  terminalHeightRatio: terminal.paneHeightRatio[pid],
  terminalSessions: paneSessions,
  terminalActiveSessionId: paneActiveSessionId,
  onTerminalSwitch: (sessionId) => setPaneActiveSession(pid, sessionId),
  onTerminalClose: (sessionId) => closeTerminalTab(sessionId),
  onTerminalNew: () => {
    const uri = activeTab(state.panels[pid]).uri;
    void openPaneTerminal(pid, uri).catch((error: unknown) => {
      pushToast({
        tone: "error",
        title:
          error instanceof Error ? error.message : "Failed to open terminal",
      });
    });
  },
  onTerminalResize: (ratio) => {
    setPaneTerminalHeight(pid, ratio);
  },
  onTerminalExit: (sessionId, code) => {
    markSessionExited(sessionId, code);
  },
};
```

- [ ] **Step 3: Re-route `op.openTerminal` to pane-bound spawn**

Find the `openEmbeddedTerminal` handler at `FileOctopusApp.tsx:387-403`. Replace it with:

```ts
openEmbeddedTerminal: (panelId) => {
  const uri = activeTab(state.panels[panelId]).uri;
  if (isRemoteUri(uri)) {
    pushToast({ tone: "error", title: "Embedded terminal supports local folders only" });
    return;
  }
  void openPaneTerminal(panelId, uri).catch((error: unknown) => {
    pushToast({
      tone: "error",
      title: error instanceof Error ? error.message : "Failed to open terminal",
    });
  });
},
```

- [ ] **Step 4: Wire the pane-header affordance**

Already done in Task 3 — verify `onOpenTerminalHere` in `makeFilePanelProps` points at `op.openTerminal` for `pid`. With the dispatch in Step 3, this now spawns into the pane.

- [ ] **Step 5: Run typecheck + tests**

Run: `pnpm --filter @fileoctopus/frontend typecheck && pnpm --filter @fileoctopus/frontend test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/app/FileOctopusApp.tsx
git commit -m "feat(frontend): route op.openTerminal to pane-bound terminal region"
```

---

### Task 13: Filter rail terminal segment to `paneId === 'rail'`

**Files:**

- Modify: `packages/frontend/src/jobs/ActivityRailPanel.tsx`

- [ ] **Step 1: Filter the session list**

Inside `ActivityRailPanel`, replace:

```ts
{terminal.sessions.length > 0 ? (
```

with:

```ts
const railSessions = terminal.sessions.filter((s) => s.paneId === "rail");
const railActiveSessionId = railSessions.find(
  (s) => s.id === terminal.activeSessionId,
)
  ? terminal.activeSessionId
  : (railSessions[0]?.id ?? null);
// later: render railSessions instead of terminal.sessions
```

Update the TabBar and TerminalView props accordingly. The "Open terminal in active folder" empty-state button stays — it now opens into the active pane (because Task 12 changed `op.openTerminal`).

- [ ] **Step 2: Update the collapsed indicator count**

```ts
const openTerminalCount = terminal.sessions.filter(
  (s) => s.status !== "exited" && s.paneId === "rail",
).length;
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @fileoctopus/frontend test`
Expected: PASS. Snapshots in `visualSnapshots.test.tsx` may shift — review.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/jobs/ActivityRailPanel.tsx
git commit -m "feat(frontend): activity rail terminal segment shows rail sessions only"
```

---

### Task 14: Ensure `view.toggleTerminal` command toggles the pane terminal

**Files:**

- Modify: `packages/frontend/src/commands/dispatch.ts`
- Modify: `packages/frontend/src/app/FileOctopusApp.tsx` — pass `togglePaneTerminal` into dispatch deps

- [ ] **Step 1: Add the new dep**

In `dispatch.ts`'s `DispatchDeps` interface, add:

```ts
togglePaneTerminal: (paneId: PanelId) => void;
```

Update the `view.toggleTerminal` branch (lines ~393-407):

```ts
case "view.toggleTerminal": {
  deps.togglePaneTerminal(panelId);
  return true;
}
```

- [ ] **Step 2: Pass it from `FileOctopusApp`**

Add `togglePaneTerminal,` to the destructured `useTerminal()` call (already done in Task 12), then pass it into `useCommandDispatch`:

```ts
togglePaneTerminal: (paneId) => togglePaneTerminal(paneId),
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @fileoctopus/frontend test -- commands.dispatch`
Expected: PASS. The existing toggle test may need to mock the new dep; update it to assert that `togglePaneTerminal` is called.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/commands/dispatch.ts packages/frontend/src/app/FileOctopusApp.tsx packages/frontend/tests/commands.dispatch.test.ts
git commit -m "feat(frontend): view.toggleTerminal now toggles pane bottom terminal"
```

---

### Task 15: Routing test — sessions never bleed across panes

**Files:**

- Create: `packages/frontend/tests/terminalSlice.paneRoutes.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, expect, it } from "vitest";
import {
  createInitialTerminalState,
  terminalReducer,
} from "../src/terminal/terminalSlice";

describe("Terminal pane routing", () => {
  it("keeps left and right sessions isolated", () => {
    let state = createInitialTerminalState();
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "L1",
        uri: "local:///a",
        label: "a",
        status: "running",
        paneId: "left",
      },
    });
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "R1",
        uri: "local:///b",
        label: "b",
        status: "running",
        paneId: "right",
      },
    });
    expect(state.paneActiveSessionId.left).toBe("L1");
    expect(state.paneActiveSessionId.right).toBe("R1");
    expect(state.paneVisibility.left).toBe(true);
    expect(state.paneVisibility.right).toBe(true);
  });

  it("closing a left session does not affect right active session", () => {
    let state = createInitialTerminalState();
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "L1",
        uri: "local:///a",
        label: "a",
        status: "running",
        paneId: "left",
      },
    });
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "R1",
        uri: "local:///b",
        label: "b",
        status: "running",
        paneId: "right",
      },
    });
    state = terminalReducer(state, { type: "closeSession", sessionId: "L1" });
    expect(state.paneActiveSessionId.right).toBe("R1");
    expect(state.paneActiveSessionId.left).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm --filter @fileoctopus/frontend test -- terminalSlice.paneRoutes`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/tests/terminalSlice.paneRoutes.test.ts
git commit -m "test(frontend): terminal sessions stay isolated per pane"
```

---

### Task 16: Manual QA pass and screenshot diff

- [ ] **Step 1: Start the app**

Run: `pnpm dev`

- [ ] **Step 2: Verify Phase 1 acceptance criteria**

- Terminal button is visible in the toolbar at the default window width (no overflow).
- Opening one terminal: badge shows `1` on the toolbar button.
- "Open terminal here" icon next to the path bar opens a terminal in the active folder.

- [ ] **Step 3: Verify Phase 2 acceptance criteria**

- Clicking the toolbar terminal button opens a terminal _as a bottom split in the active pane_, not in the activity rail.
- The terminal's prompt shows `cwd` matching the pane's current folder.
- Dragging the horizontal divider resizes the terminal between 15% and 85% of the pane height.
- Opening a terminal in the left pane does not change the right pane's layout.
- Closing all of a pane's terminals collapses the bottom region.
- The activity-rail Terminal segment only shows "rail" sessions (none, by default — earlier sessions opened via the legacy rail path).

- [ ] **Step 4: Run all checks**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm rust:check && pnpm rust:test`
Expected: PASS.

- [ ] **Step 5: Commit the QA notes if any docs were updated**

(No commit if no changes.)

---

## Phase 3 — Preferences and persistence (optional, deferred)

The following tasks are described at a coarser grain because their exact shape depends on UX decisions surfaced during Phase 2 QA. Each one should be brainstormed before turning into bite-sized steps:

- **Task 17:** Add `pane_terminal_height_left`, `pane_terminal_height_right`, `pane_terminal_default_open` to `crates/config/src/preferences.rs`, mirror in `app-ipc` `UserPreferencesDto`, mirror in `packages/ts-api/src/types.ts`. Persist `setPaneTerminalHeight` through `client.preferences.set` with a debounce.
- **Task 18:** Restore pane terminal visibility + height on app startup from preferences.
- **Task 19:** Add a "cd on folder change" preference: when a pane navigates, optionally send `cd <new uri>\n` to the active session. This requires careful escaping — defer until pattern is reviewed.
- **Task 20:** Confirmation dialog when closing a pane with running terminals.
- **Task 21:** Settings UI for the new preferences in `SettingsDialog.tsx`.

---

## Out of scope

- Multiple windows. Today's app has a single `main` window; pane terminal state is per-pane within that window. Multi-window support requires re-thinking ownership (the security review's S3 finding already discussed this).
- Drag-and-drop terminals between panes.
- Splitting a pane into two terminals (no file region). The pane is always primarily a file view.
- Terminal profiles (custom shells / env / startup commands). Deferred until pattern stabilises.

---

## Risk register

| Risk                                                                    | Mitigation                                                                                                                                                             |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pane terminal resize fights with `SplitResizer` (horizontal pane split) | The pane terminal resizer is _inside_ the pane; pointer events stop at the pane boundary. Manually test that horizontal drag at the pane edge still resizes the split. |
| xterm reflow on pane resize is slow at large scrollback                 | xterm's `FitAddon.fit()` already runs in a `ResizeObserver` callback (`TerminalView.tsx:55`). For Phase 2 the reflow path is unchanged.                                |
| Closing pane mid-running command leaks shell                            | The Phase 1 fix from `terminal-cli-review-2026-05-19.md` (A1) already makes `kill()` actually terminate. Manual QA verifies.                                           |
| Snapshot test churn                                                     | Expected — every `FilePanel` snapshot acquires a wrapper element. Review diffs carefully before `-u` updating.                                                         |

---

## Self-review checklist

The plan covers:

- [x] Discoverability (Phase 1 Tasks 1-4)
- [x] Pane-scoped session model (Phase 2 Tasks 5-6)
- [x] Provider API for pane terminals (Task 7)
- [x] UI rendering (Tasks 8-10)
- [x] Test fixture updates (Task 11)
- [x] Wiring at the app shell level (Tasks 12-14)
- [x] Routing guarantees as tests (Task 15)
- [x] Manual QA gate (Task 16)
- [x] Out-of-scope explicit
- [x] Risk register
- [x] Phase 3 deferred work declared

Method names verified consistent across tasks:

- `openPaneTerminal(paneId, uri)` defined in Task 7, used in Task 12.
- `togglePaneTerminal(paneId)` defined in Task 7, used in Task 14.
- `setPaneTerminalHeight(paneId, ratio)` defined in Task 7, used in Task 12.
- `setPaneActiveSession(paneId, sessionId)` defined in Task 7, used in Task 12.
- `paneId: "left" | "right" | "rail"` defined in Task 5, used throughout.
- Action types `setPaneTerminalVisible`, `setPaneTerminalHeight`, `setPaneActiveSession`, `togglePaneTerminal` defined in Task 6/7.
