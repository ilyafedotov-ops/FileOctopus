import { describe, expect, it, beforeEach } from "vitest";
import {
  applyThemePreference,
  applyDensityPreference,
  applyAccentPreference,
  applyFontScalePreference,
  applyIconScalePreference,
  applySplitRatio,
  applyChromeLayout,
  rowHeightForDensity,
  viewModeFromPreference,
} from "../src/applyPreferences";

describe("rowHeightForDensity", () => {
  it("returns 20 for comfortable", () => {
    expect(rowHeightForDensity("comfortable")).toBe(20);
  });
  it("returns 18 for compact", () => {
    expect(rowHeightForDensity("compact")).toBe(18);
  });
  it("returns 24 for spacious", () => {
    expect(rowHeightForDensity("spacious")).toBe(24);
  });
});

describe("viewModeFromPreference", () => {
  it("returns details for unknown values", () => {
    expect(viewModeFromPreference("unknown")).toBe("details");
  });
  it("returns details for empty string", () => {
    expect(viewModeFromPreference("")).toBe("details");
  });
  it("returns list for list", () => {
    expect(viewModeFromPreference("list")).toBe("list");
  });
  it("returns compact for compact", () => {
    expect(viewModeFromPreference("compact")).toBe("compact");
  });
  it("returns icons for icons", () => {
    expect(viewModeFromPreference("icons")).toBe("icons");
  });
  it("returns columns for columns", () => {
    expect(viewModeFromPreference("columns")).toBe("columns");
  });
});

describe("applyDensityPreference", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.documentElement;
    delete root.dataset.density;
  });

  it("resolves compact and sets data-density", () => {
    const result = applyDensityPreference("compact");
    expect(result).toBe("compact");
    expect(root.dataset.density).toBe("compact");
  });

  it("resolves spacious and sets data-density", () => {
    const result = applyDensityPreference("spacious");
    expect(result).toBe("spacious");
    expect(root.dataset.density).toBe("spacious");
  });

  it("defaults to comfortable for unknown values", () => {
    const result = applyDensityPreference("mega");
    expect(result).toBe("comfortable");
    expect(root.dataset.density).toBe("comfortable");
  });

  it("defaults to comfortable for empty string", () => {
    const result = applyDensityPreference("");
    expect(result).toBe("comfortable");
    expect(root.dataset.density).toBe("comfortable");
  });
});

describe("applyAccentPreference", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.documentElement;
    delete root.dataset.accent;
  });

  it("sets known accent blue", () => {
    expect(applyAccentPreference("blue")).toBe("blue");
    expect(root.dataset.accent).toBe("blue");
  });

  it("sets known accent indigo", () => {
    expect(applyAccentPreference("indigo")).toBe("indigo");
    expect(root.dataset.accent).toBe("indigo");
  });

  it("sets known accent violet", () => {
    expect(applyAccentPreference("violet")).toBe("violet");
  });

  it("sets known accent pink", () => {
    expect(applyAccentPreference("pink")).toBe("pink");
  });

  it("sets known accent red", () => {
    expect(applyAccentPreference("red")).toBe("red");
  });

  it("sets known accent orange", () => {
    expect(applyAccentPreference("orange")).toBe("orange");
  });

  it("sets known accent amber", () => {
    expect(applyAccentPreference("amber")).toBe("amber");
  });

  it("sets known accent green", () => {
    expect(applyAccentPreference("green")).toBe("green");
  });

  it("defaults to blue for unknown accent", () => {
    expect(applyAccentPreference("neon-pink")).toBe("blue");
    expect(root.dataset.accent).toBe("blue");
  });

  it("defaults to blue for empty string", () => {
    expect(applyAccentPreference("")).toBe("blue");
  });
});

describe("applyFontScalePreference", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.documentElement;
    delete root.dataset.fontScale;
  });

  it("sets small", () => {
    expect(applyFontScalePreference("small")).toBe("small");
    expect(root.dataset.fontScale).toBe("small");
  });

  it("sets medium", () => {
    expect(applyFontScalePreference("medium")).toBe("medium");
    expect(root.dataset.fontScale).toBe("medium");
  });

  it("sets large", () => {
    expect(applyFontScalePreference("large")).toBe("large");
    expect(root.dataset.fontScale).toBe("large");
  });

  it("defaults to medium for unknown", () => {
    expect(applyFontScalePreference("huge")).toBe("medium");
  });
});

describe("applyIconScalePreference", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.documentElement;
    delete root.dataset.iconScale;
  });

  it("sets small", () => {
    expect(applyIconScalePreference("small")).toBe("small");
    expect(root.dataset.iconScale).toBe("small");
  });

  it("sets medium", () => {
    expect(applyIconScalePreference("medium")).toBe("medium");
  });

  it("sets large", () => {
    expect(applyIconScalePreference("large")).toBe("large");
  });

  it("defaults to medium for unknown", () => {
    expect(applyIconScalePreference("tiny")).toBe("medium");
  });
});

describe("applyThemePreference", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.documentElement;
    delete root.dataset.theme;
  });

  it("sets known theme light", () => {
    applyThemePreference("light");
    expect(root.dataset.theme).toBe("light");
  });

  it("sets known theme dark", () => {
    applyThemePreference("dark");
    expect(root.dataset.theme).toBe("dark");
  });

  it("sets known theme commander-blue", () => {
    applyThemePreference("commander-blue");
    expect(root.dataset.theme).toBe("commander-blue");
  });

  it("sets known theme aubergine-technical", () => {
    applyThemePreference("aubergine-technical");
    expect(root.dataset.theme).toBe("aubergine-technical");
  });

  it("falls back to system for unknown themes", () => {
    applyThemePreference("neon");
    expect(root.dataset.theme).toBe("system");
  });

  it("falls back to system for 'system' theme", () => {
    applyThemePreference("system");
    expect(root.dataset.theme).toBe("system");
  });
});

describe("applySplitRatio", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.documentElement;
    root.style.removeProperty("--fo-left-pane-fr");
    root.style.removeProperty("--fo-right-pane-fr");
  });

  it("clamps ratio to [0.25, 0.75]", () => {
    expect(applySplitRatio(0.1)).toBe(0.25);
    expect(applySplitRatio(0.9)).toBe(0.75);
  });

  it("defaults to 0.5 for NaN", () => {
    expect(applySplitRatio(NaN)).toBe(0.5);
  });

  it("defaults to 0.5 for zero", () => {
    expect(applySplitRatio(0)).toBe(0.5);
  });

  it("sets CSS custom properties for 50/50 split", () => {
    applySplitRatio(0.5);
    expect(root.style.getPropertyValue("--fo-left-pane-fr")).toBe("50fr");
    expect(root.style.getPropertyValue("--fo-right-pane-fr")).toBe("50fr");
  });

  it("sets CSS custom properties for 75/25 split", () => {
    applySplitRatio(0.75);
    expect(root.style.getPropertyValue("--fo-left-pane-fr")).toBe("75fr");
    expect(root.style.getPropertyValue("--fo-right-pane-fr")).toBe("25fr");
  });

  it("sets CSS custom properties for 25/75 split", () => {
    applySplitRatio(0.25);
    expect(root.style.getPropertyValue("--fo-left-pane-fr")).toBe("25fr");
    expect(root.style.getPropertyValue("--fo-right-pane-fr")).toBe("75fr");
  });

  it("ensures minimum 1fr for both sides", () => {
    // Even a ratio very close to 0 or 1 should produce at least 1fr
    applySplitRatio(0.01);
    const left = root.style.getPropertyValue("--fo-left-pane-fr");
    const right = root.style.getPropertyValue("--fo-right-pane-fr");
    expect(parseInt(left)).toBeGreaterThanOrEqual(1);
    expect(parseInt(right)).toBeGreaterThanOrEqual(1);
  });
});

describe("applyChromeLayout", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.documentElement;
    delete root.dataset.statusBar;
    delete root.dataset.toolbarHidden;
  });

  it("shows status bar when visible=true", () => {
    applyChromeLayout(true, true);
    expect(root.dataset.statusBar).toBe("visible");
  });

  it("hides status bar when visible=false", () => {
    applyChromeLayout(false, true);
    expect(root.dataset.statusBar).toBe("hidden");
  });

  it("shows toolbar when visible=true (no dataset attribute)", () => {
    applyChromeLayout(true, true);
    expect(root.dataset.toolbarHidden).toBeUndefined();
  });

  it("hides toolbar when visible=false", () => {
    applyChromeLayout(true, false);
    expect(root.dataset.toolbarHidden).toBe("true");
  });
});
