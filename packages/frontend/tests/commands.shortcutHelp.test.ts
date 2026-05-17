import { describe, expect, it } from "vitest";
import { buildShortcutHelpEntries } from "../src/commands/shortcutHelp";

describe("buildShortcutHelpEntries", () => {
  it("includes registry shortcuts with supplemental entries", () => {
    const entries = buildShortcutHelpEntries();
    const copy = entries.find((entry) => entry.id === "op.copy");
    const filter = entries.find((entry) => entry.id === "filter");

    expect(copy?.windowsLinux).toBe("Ctrl+C");
    expect(filter).toBeDefined();
  });

  it("excludes go-to-location dialog shortcut in favor of path focus", () => {
    const entries = buildShortcutHelpEntries();

    expect(entries.some((entry) => entry.id === "nav.goToLocation")).toBe(
      false,
    );
    expect(entries.some((entry) => entry.id === "path-focus")).toBe(true);
  });
});
