import { describe, expect, it } from "vitest";
import {
  COMMAND_DEFINITIONS,
  formatCommandShortcut,
  getCommand,
  TOOLBAR_GROUPS,
} from "../src/commands/registry";

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
});
