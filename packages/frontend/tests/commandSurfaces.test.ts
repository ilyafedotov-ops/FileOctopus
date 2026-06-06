/**
 * UPP-B1: Command surface model tests.
 *
 * Validates:
 * - Every command has a `surfaces` field (no legacy-only commands left behind)
 * - Surfaces contain only valid CommandSurface values
 * - Commander-style F-key commands are correctly assigned to "fkey" surface
 * - Toolbar has primary file actions but not app-level toggles
 * - Context menu has file-operation commands but not view-mode toggles
 * - No command appears on a surface that contradicts its group
 * - `commandsForSurface()` returns correct results
 * - Destructive commands are never on toolbar (require confirmation dialog)
 */

import { describe, it, expect } from "vitest";
import {
  COMMAND_DEFINITIONS,
  commandsForSurface,
} from "../src/commands/registry";
import type { CommandSurface } from "../src/commands/types";

const VALID_SURFACES: ReadonlySet<string> = new Set<CommandSurface>([
  "toolbar",
  "menu",
  "fkey",
  "palette",
  "context",
]);

describe("UPP-B1: Command surface model", () => {
  it("every command has explicit surfaces defined", () => {
    const withoutSurfaces = COMMAND_DEFINITIONS.filter((cmd) => !cmd.surfaces);
    expect(withoutSurfaces).toEqual([]);
  });

  it("all surface values are valid CommandSurface types", () => {
    for (const cmd of COMMAND_DEFINITIONS) {
      if (cmd.surfaces) {
        for (const surface of cmd.surfaces) {
          expect(VALID_SURFACES.has(surface)).toBe(true);
        }
      }
    }
  });

  it("surfaces arrays contain no duplicates", () => {
    for (const cmd of COMMAND_DEFINITIONS) {
      if (cmd.surfaces) {
        const unique = new Set(cmd.surfaces);
        expect(unique.size).toBe(cmd.surfaces.length);
      }
    }
  });

  it("commander F-key commands are on fkey surface", () => {
    const fkeyIds = new Set([
      "op.view", // F3
      "op.edit", // F4
      "op.copyTo", // F5
      "op.moveTo", // F6
      "create.folder", // F7
      "op.delete", // F8
    ]);

    for (const cmd of COMMAND_DEFINITIONS) {
      if (fkeyIds.has(cmd.id)) {
        expect(cmd.surfaces).toContain("fkey");
      }
    }
  });

  it("destructive commands are NOT on toolbar surface", () => {
    const destructive = COMMAND_DEFINITIONS.filter((cmd) => cmd.destructive);
    for (const cmd of destructive) {
      expect(cmd.surfaces).not.toContain("toolbar");
    }
  });

  it("toolbar includes core file operations", () => {
    const toolbarIds = new Set(commandsForSurface("toolbar").map((c) => c.id));
    expect(toolbarIds.has("op.copy")).toBe(true);
    expect(toolbarIds.has("op.cut")).toBe(true);
    expect(toolbarIds.has("op.paste")).toBe(true);
    expect(toolbarIds.has("op.open")).toBe(true);
    expect(toolbarIds.has("op.rename")).toBe(true);
    expect(toolbarIds.has("op.delete")).toBe(true);
  });

  it("toolbar does NOT include app-level toggles", () => {
    const toolbarIds = new Set(commandsForSurface("toolbar").map((c) => c.id));
    expect(toolbarIds.has("view.toggleStatusBar")).toBe(false);
    expect(toolbarIds.has("view.toggleDualPane")).toBe(false);
    expect(toolbarIds.has("view.toggleSidebar")).toBe(false);
    expect(toolbarIds.has("layout.switchPane")).toBe(false);
  });

  it("context menu has file-operation commands", () => {
    const contextIds = new Set(commandsForSurface("context").map((c) => c.id));
    expect(contextIds.has("op.open")).toBe(true);
    expect(contextIds.has("op.copyTo")).toBe(true);
    expect(contextIds.has("op.moveTo")).toBe(true);
    expect(contextIds.has("op.rename")).toBe(true);
    expect(contextIds.has("op.delete")).toBe(true);
    expect(contextIds.has("op.properties")).toBe(true);
  });

  it("context menu does NOT have view-mode toggles", () => {
    const contextIds = new Set(commandsForSurface("context").map((c) => c.id));
    expect(contextIds.has("view.details")).toBe(false);
    expect(contextIds.has("view.list")).toBe(false);
    expect(contextIds.has("view.icons")).toBe(false);
    expect(contextIds.has("view.compact")).toBe(false);
  });

  it("palette includes navigation and app commands", () => {
    const paletteIds = new Set(commandsForSurface("palette").map((c) => c.id));
    expect(paletteIds.has("nav.back")).toBe(true);
    expect(paletteIds.has("nav.forward")).toBe(true);
    expect(paletteIds.has("app.settings")).toBe(true);
    expect(paletteIds.has("app.commandPalette")).toBe(true);
  });

  it("commandsForSurface returns consistent results", () => {
    for (const surface of [
      "toolbar",
      "menu",
      "fkey",
      "palette",
      "context",
    ] as const) {
      const commands = commandsForSurface(surface);
      expect(commands.length).toBeGreaterThan(0);
      for (const cmd of commands) {
        expect(cmd.surfaces).toContain(surface);
      }
    }
  });
});
