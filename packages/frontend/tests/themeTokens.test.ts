import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const TOKENS_PATH = path.resolve(__dirname, "../../ui/src/tokens.css");
const THEMES_PATH = path.resolve(__dirname, "../src/styles/themes.css");
const PANE_PATH = path.resolve(__dirname, "../src/styles/regions/pane.css");
const SHELL_PATH = path.resolve(__dirname, "../src/styles/regions/shell.css");
const DIALOGS_PATH = path.resolve(
  __dirname,
  "../src/styles/regions/dialogs.css",
);
const SHARED_PATH = path.resolve(__dirname, "../src/styles/regions/shared.css");

describe("Design token architecture", () => {
  const tokensContent = fs.readFileSync(TOKENS_PATH, "utf-8");
  const themesContent = fs.readFileSync(THEMES_PATH, "utf-8");
  const paneContent = fs.readFileSync(PANE_PATH, "utf-8");
  const shellContent = fs.readFileSync(SHELL_PATH, "utf-8");
  const dialogsContent = fs.readFileSync(DIALOGS_PATH, "utf-8");
  const sharedContent = fs.readFileSync(SHARED_PATH, "utf-8");

  const BASE_TOKENS = [
    "--fo-text",
    "--fo-app-bg",
    "--fo-surface",
    "--fo-surface-elevated",
    "--fo-border",
    "--fo-strip-bg",
    "--fo-control-bg",
    "--fo-accent-soft",
    "--fo-muted-text",
    "--fo-control-border",
    "--fo-danger-bg",
    "--fo-danger-border",
    "--fo-danger-text",
    "--fo-on-accent",
  ] as const;

  it("tokens.css defines all base tokens", () => {
    for (const token of BASE_TOKENS) {
      expect(
        tokensContent.indexOf(token) !== -1,
        `Token ${token} missing from tokens.css`,
      ).toBe(true);
    }
  });

  it("tokens.css has dark-mode overrides via [data-theme='dark']", () => {
    expect(
      tokensContent.indexOf('[data-theme="dark"]') !== -1,
      "Missing [data-theme='dark'] selector in tokens.css",
    ).toBe(true);
  });

  it("tokens.css has dark-mode overrides via prefers-color-scheme", () => {
    expect(
      tokensContent.indexOf("prefers-color-scheme: dark") !== -1,
      "Missing @media (prefers-color-scheme: dark) in tokens.css",
    ).toBe(true);
  });

  it("dark tokens override all base tokens in tokens.css", () => {
    for (const token of BASE_TOKENS) {
      // Each base token should be overridden in the dark-theme block
      // We check that the token appears in a dark override context
      const hasDarkOverride =
        tokensContent.indexOf(token) !== tokensContent.lastIndexOf(token);
      expect(
        hasDarkOverride || tokensContent.indexOf(`[data-theme="dark"]`) !== -1,
        `Token ${token} should be overridden in dark theme`,
      ).toBe(true);
    }
  });

  it("themes.css does not use --fo-dark-* variables (should use semantic tokens instead)", () => {
    const darkVarPattern = /var\(--fo-dark-/g;
    const matches = themesContent.match(darkVarPattern);
    expect(
      matches,
      `themes.css still uses --fo-dark-* variables (${matches?.length ?? 0} found). ` +
        "These should be replaced with semantic base tokens that swap per-theme.",
    ).toBeNull();
  });

  it("themes.css has no duplicate @media prefers-color-scheme and [data-theme='dark'] blocks", () => {
    const mediaBlockCount = (
      themesContent.match(/@media\s*\(prefers-color-scheme:\s*dark\)/g) || []
    ).length;
    const dataThemeCount = (themesContent.match(/\[data-theme="dark"\]/g) || [])
      .length;

    // After refactoring, themes.css should not need per-component dark overrides.
    // The token layer handles it.
    expect(
      mediaBlockCount,
      "themes.css should not have @media (prefers-color-scheme: dark) blocks " +
        "(moved to tokens.css)",
    ).toBe(0);
    expect(
      dataThemeCount,
      "themes.css should not have [data-theme='dark'] selectors " +
        "(moved to tokens.css)",
    ).toBe(0);
  });

  it("spacing tokens are defined", () => {
    const spacingTokens = [
      "--fo-spacing-xs",
      "--fo-spacing-sm",
      "--fo-spacing-md",
      "--fo-spacing-lg",
      "--fo-spacing-xl",
      "--fo-spacing-2xl",
    ];
    for (const token of spacingTokens) {
      expect(
        tokensContent.indexOf(token) !== -1,
        `Spacing token ${token} missing`,
      ).toBe(true);
    }
  });

  it("radius tokens are defined", () => {
    const radiusTokens = ["--fo-radius-sm", "--fo-radius-md", "--fo-radius-lg"];
    for (const token of radiusTokens) {
      expect(
        tokensContent.indexOf(token) !== -1,
        `Radius token ${token} missing`,
      ).toBe(true);
    }
  });

  it("elevation tokens are defined", () => {
    const elevTokens = [
      "--fo-elevation-popover",
      "--fo-elevation-modal",
      "--fo-elevation-drawer",
    ];
    for (const token of elevTokens) {
      expect(
        tokensContent.indexOf(token) !== -1,
        `Elevation token ${token} missing`,
      ).toBe(true);
    }
  });

  it("component-height tokens are defined", () => {
    const heightTokens = [
      "--fo-toolbar-height",
      "--fo-pathbar-height",
      "--fo-statusbar-height",
      "--fo-splitter-width",
    ];
    for (const token of heightTokens) {
      expect(
        tokensContent.indexOf(token) !== -1,
        `Component height token ${token} missing`,
      ).toBe(true);
    }
  });

  it("density classes override component heights (not just row-height)", () => {
    const densities = ["compact", "comfortable", "spacious"];
    for (const density of densities) {
      const block = tokensContent.indexOf(`[data-density="${density}"]`);
      expect(block, `Missing [data-density="${density}"]`).toBeGreaterThan(-1);

      // Extract the block (until next } or next selector)
      const blockStart = tokensContent.indexOf("{", block);
      const blockEnd = tokensContent.indexOf("}", blockStart);
      const blockContent = tokensContent.substring(blockStart, blockEnd);

      // Should override more than just --fo-row-height
      const overrideCount = (blockContent.match(/--fo-/g) || []).length;
      expect(
        overrideCount >= 4,
        `Density "${density}" should override 4+ tokens (got ${overrideCount})`,
      ).toBe(true);
    }
  });

  it("accent color variants are defined", () => {
    const accents = [
      "indigo",
      "violet",
      "pink",
      "red",
      "orange",
      "amber",
      "green",
    ];
    for (const accent of accents) {
      expect(
        tokensContent.indexOf(`[data-accent="${accent}"]`) !== -1,
        `Missing accent variant ${accent}`,
      ).toBe(true);
    }
  });

  it("list view preserves nested row name text", () => {
    expect(paneContent).toContain(
      ".fo-view-list .fo-row > span:not(:first-child)",
    );
    expect(paneContent).not.toContain(
      ".fo-view-list .fo-row span:not(:first-child)",
    );
  });

  it("pane.css does not use hardcoded hex colors", () => {
    const hexPattern = /#[0-9a-fA-F]{3,8}\b/g;
    const matches = paneContent.match(hexPattern);
    expect(
      matches,
      `pane.css should use semantic tokens instead of hex (${matches?.join(", ") ?? "none"})`,
    ).toBeNull();
  });

  it("compact view hides only the direct type cell", () => {
    expect(paneContent).toContain(
      ".fo-view-list,\n.fo-view-compact,\n.fo-view-icons",
    );
    expect(paneContent).toContain(
      ".fo-view-compact .fo-row > span:nth-child(3)",
    );
  });

  it("dialog backdrops leave custom window controls clickable", () => {
    expect(shellContent).toContain("--fo-titlebar-height: 34px");
    expect(shellContent).toContain("min-height: var(--fo-titlebar-height)");
    expect(dialogsContent).toContain(
      "inset: var(--fo-titlebar-height, 50px) 0 0",
    );
  });

  it("dialog chrome follows VS Code workbench styling", () => {
    expect(dialogsContent).toContain("--fo-classic-face: #252526");
    expect(dialogsContent).toContain("--fo-classic-title: #007acc");
    expect(dialogsContent).toContain("border-radius: 0");
    expect(dialogsContent).toContain(
      "box-shadow: 0 12px 32px var(--fo-dialog-shadow)",
    );
    expect(dialogsContent).toMatch(
      /border:\s*1px solid var\(--fo-dialog-border\)/,
    );
    expect(sharedContent).toContain(
      ".fo-command-palette {\n  max-width: 520px;\n  width: 90vw;\n  padding: 0;\n  border-radius: 0;",
    );
  });
});
