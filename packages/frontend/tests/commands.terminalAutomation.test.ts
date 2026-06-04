import { describe, expect, it, vi } from "vitest";
import { buildPaletteEntries } from "../src/commands/paletteEntries";
import { COMMAND_REGISTRY } from "../src/commands/registryData";
import {
  dispatchCommand,
  type CommandDispatchDeps,
} from "../src/commands/dispatch";

function createDeps(
  overrides: Partial<CommandDispatchDeps> = {},
): CommandDispatchDeps {
  return {
    state: {
      panels: {
        left: {
          tabs: [
            {
              id: "tab-1",
              uri: "local:///workspace",
              entriesById: {},
              orderedEntryIds: [],
              selectedIds: new Set(),
              expandedIds: new Set(),
              selectedId: null,
              hoveredId: null,
              sort: { field: "name", direction: "asc" },
              viewMode: "details",
              showHidden: false,
              filterText: "",
              hashMap: {},
              searchResults: null,
              loading: false,
              error: null,
              history: { past: [], future: [] },
              scrollPosition: 0,
              columnWidths: {},
              columnsOrder: [],
            },
          ],
          activeTabId: "tab-1",
          terminal: null,
        },
        right: {
          tabs: [],
          activeTabId: null,
          terminal: null,
        },
      },
      activePanelId: "left",
    },
    selectedEntries: vi.fn(() => []),
    runTerminalCommand: vi.fn(),
    spawnAndRunTerminalCommand: vi.fn(),
    requestTerminalCommand: vi.fn(() => "pnpm test"),
    ...overrides,
  } as unknown as CommandDispatchDeps;
}

describe("terminal automation commands", () => {
  it("registers run and spawn-and-run terminal commands", () => {
    expect(
      COMMAND_REGISTRY.find((command) => command.id === "terminal.runCommand"),
    ).toMatchObject({
      label: "Run Command in Terminal…",
      group: "tools",
    });
    expect(
      COMMAND_REGISTRY.find((command) => command.id === "terminal.spawnAndRun"),
    ).toMatchObject({
      label: "Spawn Terminal and Run Command…",
      group: "tools",
    });
  });

  it("includes terminal automation commands in the palette", () => {
    const entries = buildPaletteEntries();

    expect(entries.some((entry) => entry.id === "terminal.runCommand")).toBe(
      true,
    );
    expect(entries.some((entry) => entry.id === "terminal.spawnAndRun")).toBe(
      true,
    );
  });

  it("dispatches a command directly to the active terminal", () => {
    const deps = createDeps();

    expect(
      dispatchCommand("terminal.runCommand", deps, {
        terminalCommand: "cargo test",
      }),
    ).toBe(true);

    expect(deps.runTerminalCommand).toHaveBeenCalledWith("cargo test");
    expect(deps.requestTerminalCommand).not.toHaveBeenCalled();
  });

  it("prompts when no terminal command is supplied", () => {
    const deps = createDeps({
      requestTerminalCommand: vi.fn(() => "pnpm lint"),
    });

    expect(dispatchCommand("terminal.runCommand", deps)).toBe(true);

    expect(deps.requestTerminalCommand).toHaveBeenCalledWith(
      "Run command in active terminal",
      expect.any(Function),
    );
    expect(deps.runTerminalCommand).toHaveBeenCalledWith("pnpm lint");
  });

  it("supports modal terminal command requests", () => {
    let submit: ((command: string) => void) | null = null;
    const deps = createDeps({
      requestTerminalCommand: vi.fn((_label, onSubmit) => {
        submit = onSubmit;
        return null;
      }),
    });

    expect(dispatchCommand("terminal.runCommand", deps)).toBe(true);
    expect(deps.runTerminalCommand).not.toHaveBeenCalled();

    submit?.("pnpm test");

    expect(deps.runTerminalCommand).toHaveBeenCalledWith("pnpm test");
  });

  it("spawns in the active folder and runs the prompted command", () => {
    const deps = createDeps({
      requestTerminalCommand: vi.fn(() => "npm run dev"),
    });

    expect(dispatchCommand("terminal.spawnAndRun", deps)).toBe(true);

    expect(deps.spawnAndRunTerminalCommand).toHaveBeenCalledWith(
      "left",
      "npm run dev",
    );
  });
});
