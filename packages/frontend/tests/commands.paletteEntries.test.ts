import { describe, expect, it } from "vitest";
import { buildPaletteEntries } from "../src/commands/paletteEntries";

describe("buildPaletteEntries", () => {
  it("includes registry commands with categories", () => {
    const entries = buildPaletteEntries();
    const goTo = entries.find((entry) => entry.id === "nav.goToLocation");

    expect(goTo).toBeDefined();
    expect(goTo?.category).toBe("Navigation");
  });

  it("excludes nested command palette entry", () => {
    const entries = buildPaletteEntries();

    expect(entries.some((entry) => entry.id === "app.commandPalette")).toBe(
      false,
    );
  });

  it("includes legacy switch-pane and filter entries", () => {
    const entries = buildPaletteEntries();

    expect(entries.some((entry) => entry.id === "switch-pane")).toBe(true);
    expect(entries.some((entry) => entry.id === "filter")).toBe(true);
  });

  it("includes Git Review in the palette", () => {
    const entries = buildPaletteEntries();
    const gitReview = entries.find((entry) => entry.id === "git.reviewChanges");

    expect(gitReview?.label).toBe("Review Git Changes");
    expect(gitReview?.category).toBe("Git");
  });
});
