import { describe, expect, it } from "vitest";
import {
  viewModeCommandId,
  VIEW_MODE_COMMAND_IDS,
} from "../src/commands/viewModeCommands";

describe("viewModeCommandId", () => {
  it("returns correct command ID for each view mode", () => {
    expect(viewModeCommandId("details")).toBe("view.details");
    expect(viewModeCommandId("list")).toBe("view.list");
    expect(viewModeCommandId("compact")).toBe("view.compact");
    expect(viewModeCommandId("icons")).toBe("view.icons");
    expect(viewModeCommandId("columns")).toBe("view.columns");
  });

  it("returns undefined for unknown mode", () => {
    expect(viewModeCommandId("unknown")).toBeUndefined();
    expect(viewModeCommandId("")).toBeUndefined();
  });
});

describe("VIEW_MODE_COMMAND_IDS", () => {
  it("has an entry for every standard view mode", () => {
    const modes = ["details", "list", "compact", "icons", "columns"];
    for (const mode of modes) {
      expect(
        VIEW_MODE_COMMAND_IDS[mode as keyof typeof VIEW_MODE_COMMAND_IDS],
      ).toBeTruthy();
    }
  });

  it("maps each mode to a view.* command", () => {
    for (const [, cmdId] of Object.entries(VIEW_MODE_COMMAND_IDS)) {
      expect(cmdId.startsWith("view.")).toBe(true);
    }
  });
});
