import { describe, expect, it } from "vitest";
import {
  THEMES,
  isKnownTheme,
  selectableThemes,
  themeById,
} from "../src/themeRegistry";

describe("themeRegistry", () => {
  it("recognizes built-in themes", () => {
    expect(isKnownTheme("system")).toBe(true);
    expect(isKnownTheme("light")).toBe(true);
    expect(isKnownTheme("dark")).toBe(true);
    expect(isKnownTheme("commander-blue")).toBe(true);
    expect(isKnownTheme("aubergine-technical")).toBe(true);
  });

  it("rejects unknown ids", () => {
    expect(isKnownTheme("neon")).toBe(false);
    expect(themeById("neon")).toBeUndefined();
  });

  it("marks commander-blue as a selectable dark theme", () => {
    const theme = themeById("commander-blue");
    expect(theme?.isDark).toBe(true);
    expect(theme?.selectable).toBe(true);
  });

  it("exposes Aubergine Muted Technical as a selectable dark theme", () => {
    expect(themeById("aubergine-technical")).toEqual({
      id: "aubergine-technical",
      label: "Aubergine Muted Technical",
      isDark: true,
      selectable: true,
    });
  });

  it("returns only selectable themes for the picker", () => {
    const ids = selectableThemes().map((t) => t.id);
    expect(ids).toContain("commander-blue");
    expect(ids).toContain("aubergine-technical");
    expect(selectableThemes().length).toBe(
      THEMES.filter((t) => t.selectable).length,
    );
  });
});
