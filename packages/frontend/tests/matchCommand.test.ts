import { describe, expect, it } from "vitest";
import { matchCommand } from "../src/utils/matchCommand";

describe("matchCommand", () => {
  it("matches exact label substring", () => {
    expect(matchCommand("copy", { label: "Copy selection" })).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(matchCommand("REFRESH", { label: "Refresh pane" })).toBe(true);
  });

  it("matches fuzzy characters in order", () => {
    expect(matchCommand("cp", { label: "Copy selection" })).toBe(true);
  });

  it("rejects non-matching query", () => {
    expect(matchCommand("xyz", { label: "Copy selection" })).toBe(false);
  });

  it("rejects non-sequential fuzzy match", () => {
    // "zp" — z doesn't exist in "Copy selection" at all
    expect(matchCommand("zp", { label: "Copy selection" })).toBe(false);
  });

  it("matches empty query (always true)", () => {
    expect(matchCommand("", { label: "Copy selection" })).toBe(true);
  });

  it("matches against shortcut key too", () => {
    expect(
      matchCommand("ctrl+c", {
        label: "Copy selection",
        shortcutKey: "Ctrl+C",
      }),
    ).toBe(true);
  });

  it("matches against category", () => {
    expect(
      matchCommand("view", { label: "Toggle hidden files", category: "View" }),
    ).toBe(true);
  });
});
