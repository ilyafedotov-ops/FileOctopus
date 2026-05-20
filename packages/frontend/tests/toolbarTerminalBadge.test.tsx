import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TerminalContext } from "../src/app/providers/TerminalProvider";
import { CommanderToolbarTail } from "../src/pane/CommanderToolbarTail";
import { createInitialTerminalState } from "../src/terminal/terminalSlice";
import type { ToolbarActionHandlers } from "../src/pane/toolbarActions";
import type { ToolbarCommandContext } from "../src/commands/toolbarCommandState";

function noop() {
  return vi.fn();
}

function makeHandlers(): ToolbarActionHandlers {
  return {
    onBack: noop(),
    onForward: noop(),
    onUp: noop(),
    onRoot: noop(),
    onHome: noop(),
    onDrives: noop(),
    onRefresh: noop(),
    onCommandSearch: noop(),
    onView: noop(),
    onCommand: noop(),
    onCustomizeToolbar: noop(),
    dropdowns: {
      selectedCount: 0,
      canRename: false,
      canPaste: false,
      showHidden: false,
      viewMode: "details",
      onCreateFolder: noop(),
      onCreateFile: noop(),
      onRename: noop(),
      onCopy: noop(),
      onCut: noop(),
      onCopyOperation: noop(),
      onMove: noop(),
      onPaste: noop(),
      onTrash: noop(),
      onPermanentDelete: noop(),
      onCopyPath: noop(),
      onCopyName: noop(),
      onProperties: noop(),
      onSelectAll: noop(),
      onToggleHidden: noop(),
      onViewMode: noop(),
      onRevealInFileManager: noop(),
      onCalculateSize: noop(),
      onCompress: noop(),
      onExtract: noop(),
      onOpenTerminal: noop(),
      onOpenTerminalExternal: noop(),
      onChecksum: noop(),
    },
  };
}

const commandContext: ToolbarCommandContext = {
  selectedCount: 0,
  canRename: false,
  canPaste: false,
  canView: true,
  canEdit: true,
};

function terminalContextValue(
  terminal = createInitialTerminalState(),
): React.ComponentProps<typeof TerminalContext.Provider>["value"] {
  return {
    terminal,
    openEmbeddedTerminal: async () => {},
    openPaneTerminal: async () => {},
    openNewTerminalTab: async () => {},
    togglePaneTerminal: async () => {},
    markSessionExited: () => {},
    closeTerminalTab: () => {},
    switchTerminalTab: () => {},
    setRailSegment: () => {},
    setPaneTerminalCollapsed: () => {},
    setPaneTerminalMaximized: () => {},
    setPaneTerminalSplit: () => {},
    setPaneActiveSession: () => {},
    closePaneTerminal: () => {},
    syncTerminalCwd: () => {},
    openExternalTerminal: async () => {},
    registerTerminalSessionHandlers: () => () => {},
  };
}

afterEach(() => {
  cleanup();
});

describe("Terminal toolbar badge", () => {
  it("renders running-session count when sessions exist", () => {
    const state = {
      ...createInitialTerminalState(),
      sessions: [
        {
          id: "a",
          uri: "local:///tmp",
          label: "tmp",
          status: "running" as const,
          paneId: "left" as const,
        },
        {
          id: "b",
          uri: "local:///x",
          label: "x",
          status: "exited" as const,
          paneId: "left" as const,
        },
      ],
    };
    render(
      <TerminalContext.Provider value={terminalContextValue(state)}>
        <CommanderToolbarTail
          overflowTier="full"
          commandContext={commandContext}
          handlers={makeHandlers()}
          hotlistTargets={[]}
          hotlistOverflow={[]}
          jobsDisplay={{
            label: "Jobs",
            ariaLabel: "Jobs",
            activeCount: 0,
          }}
          onOpenHotlistTarget={() => undefined}
        />
      </TerminalContext.Provider>,
    );
    const badge = screen.getByLabelText(/terminal sessions/i);
    expect(badge.textContent).toBe("1");
  });

  it("renders no badge when there are zero running sessions", () => {
    render(
      <TerminalContext.Provider
        value={terminalContextValue(createInitialTerminalState())}
      >
        <CommanderToolbarTail
          overflowTier="full"
          commandContext={commandContext}
          handlers={makeHandlers()}
          hotlistTargets={[]}
          hotlistOverflow={[]}
          jobsDisplay={{
            label: "Jobs",
            ariaLabel: "Jobs",
            activeCount: 0,
          }}
          onOpenHotlistTarget={() => undefined}
        />
      </TerminalContext.Provider>,
    );
    expect(screen.queryByLabelText(/terminal sessions/i)).toBeNull();
  });
});
