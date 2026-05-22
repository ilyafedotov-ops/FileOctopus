import { describe, expect, it } from "vitest";
import {
  COMMAND_DEFINITIONS,
  formatCommandShortcut,
  getCommand,
  TOOLBAR_GROUPS,
} from "../src/commands/registry";
import { COMMAND_REGISTRY } from "../src/commands/registryData";

describe("commands/registry", () => {
  it("defines toolbar groups in spec order", () => {
    expect(TOOLBAR_GROUPS).toEqual([
      "navigation",
      "creation",
      "operation",
      "view",
    ]);
  });

  it("resolves command shortcuts", () => {
    expect(formatCommandShortcut("op.rename")).toBe("F2");
    expect(getCommand("nav.refresh").label).toBe("Refresh");
  });

  it("includes compact view command", () => {
    expect(
      COMMAND_DEFINITIONS.some((command) => command.id === "view.compact"),
    ).toBe(true);
  });

  it("includes network navigation commands", () => {
    expect(
      COMMAND_DEFINITIONS.some(
        (command) => command.id === "nav.networkLocations",
      ),
    ).toBe(true);
    expect(
      COMMAND_DEFINITIONS.some((command) => command.id === "nav.addServer"),
    ).toBe(true);
    expect(
      COMMAND_DEFINITIONS.some((command) => command.id === "nav.connectServer"),
    ).toBe(true);
  });

  it("derives CommandId from the registry", () => {
    const idsFromRegistry = COMMAND_DEFINITIONS.map((command) => command.id);
    expect(idsFromRegistry.length).toBeGreaterThan(0);
    expect(new Set(idsFromRegistry).size).toBe(idsFromRegistry.length);
  });

  it("has a non-empty registry", () => {
    expect(COMMAND_REGISTRY.length).toBeGreaterThan(0);
    expect(COMMAND_DEFINITIONS.length).toBe(COMMAND_REGISTRY.length);
  });
});
