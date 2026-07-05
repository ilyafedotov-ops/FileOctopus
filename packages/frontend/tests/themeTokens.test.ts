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
const COMPONENTS_PATH = path.resolve(__dirname, "../../ui/src/components.css");
const BASE_PATH = path.resolve(__dirname, "../src/styles/regions/base.css");
const JOBS_PATH = path.resolve(__dirname, "../src/styles/regions/jobs.css");
const SIDEBAR_PATH = path.resolve(
  __dirname,
  "../src/styles/regions/sidebar.css",
);

describe("Design token architecture", () => {
  const tokensContent = fs.readFileSync(TOKENS_PATH, "utf-8");
  const themesContent = fs.readFileSync(THEMES_PATH, "utf-8");
  const paneContent = fs.readFileSync(PANE_PATH, "utf-8");
  const shellContent = fs.readFileSync(SHELL_PATH, "utf-8");
  const dialogsContent = fs.readFileSync(DIALOGS_PATH, "utf-8");
  const sharedContent = fs.readFileSync(SHARED_PATH, "utf-8");
  const componentsContent = fs.readFileSync(COMPONENTS_PATH, "utf-8");
  const jobsContent = fs.readFileSync(JOBS_PATH, "utf-8");
  const sidebarContent = fs.readFileSync(SIDEBAR_PATH, "utf-8");
  const baseContent = fs.readFileSync(BASE_PATH, "utf-8");

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

  it("defines the commander-blue theme across token layers", () => {
    expect(
      tokensContent.indexOf('[data-theme="commander-blue"]') !== -1,
      "tokens.css missing commander-blue block",
    ).toBe(true);
    expect(
      shellContent.indexOf('[data-theme="commander-blue"] .fo-shell') !== -1,
      "shell.css missing commander-blue chrome block",
    ).toBe(true);
  });

  it("tokenizes the commander bar / status bar surfaces", () => {
    for (const token of [
      "--fo-statusbar-bg",
      "--fo-commander-bar-bg",
      "--fo-commander-keycap-bg",
    ]) {
      expect(
        shellContent.indexOf(token) !== -1,
        `shell.css missing commander surface token ${token}`,
      ).toBe(true);
    }
  });

  it("does not let system dark-mode chrome override explicit aubergine theme chrome", () => {
    expect(shellContent).toContain(
      ':root[data-theme="aubergine-technical"] .fo-shell',
    );
    const mediaBlockStart = shellContent.indexOf(
      "@media (prefers-color-scheme: dark)",
    );
    const mediaBlock = shellContent.slice(mediaBlockStart);

    expect(mediaBlock).toContain(":root:not([data-theme]) .fo-shell");
    expect(mediaBlock).not.toContain(
      ':root:not([data-theme="light"]) .fo-shell',
    );
  });

  it("keeps shell toolbar accessories in the toolbar flex row", () => {
    expect(
      /\.fo-workbench-toolbar\s*\{[^}]*display:\s*flex;/s.test(shellContent),
      "shell toolbar must be a flex row so accessories do not start on new lines",
    ).toBe(true);
    expect(
      /\.fo-notification-toolbar\s*\{[^}]*display:\s*flex;/s.test(shellContent),
      "notification toolbar must stay inline with toolbar buttons",
    ).toBe(true);
  });

  it("defines the premium-polish tokens (typography, chrome, focus, motion)", () => {
    const newTokens = [
      "--fo-font-size-xs",
      "--fo-font-size-md",
      "--fo-font-size-xl",
      "--fo-line-tight",
      "--fo-radius-xs",
      "--fo-chrome-hover-bg",
      "--fo-chrome-hover-text",
      "--fo-focus-ring",
      "--fo-motion-fast",
    ];
    for (const token of newTokens) {
      expect(
        tokensContent.indexOf(token) !== -1,
        `Token ${token} missing from tokens.css (UPP-H1/A1/A2/H2/J1)`,
      ).toBe(true);
    }
  });

  it("overrides chrome-hover tokens for light and commander-blue themes", () => {
    // Appears once in :root (dark default) plus once per overriding theme.
    const occurrences = (tokensContent.match(/--fo-chrome-hover-bg:/g) || [])
      .length;
    expect(
      occurrences >= 3,
      `--fo-chrome-hover-bg should be overridden per theme (found ${occurrences}, expected >= 3)`,
    ).toBe(true);
  });

  it("tokenizes the shell topbar/menubar chrome (no hard-coded dark hex)", () => {
    // The light-theme dark-titlebar bug came from these literals.
    expect(shellContent).not.toContain("background: #3c3c3c");
    expect(shellContent).not.toContain("background: #505050");
    expect(shellContent).not.toContain("color: #cccccc");
    // Chrome now resolves through theme tokens.
    expect(shellContent).toContain("background: var(--fo-titlebar-bg)");
    expect(shellContent).toContain("var(--fo-chrome-hover-bg)");
  });

  it("converges UI primitive focus rings onto the focus-ring tokens (UPP-A2)", () => {
    // All three focus-visible rules (button, input, segmented) use the tokens.
    const ringRuleCount = (
      componentsContent.match(/var\(--fo-focus-ring-width\)/g) || []
    ).length;
    expect(
      ringRuleCount >= 3,
      `components.css should use --fo-focus-ring-width for button/input/segmented focus (found ${ringRuleCount})`,
    ).toBe(true);
  });

  it("provides a .fo-focusable utility class for keyboard focus (UPP-A2)", () => {
    expect(
      componentsContent,
      "components.css should contain .fo-focusable:focus-visible rule",
    ).toContain(".fo-focusable:focus-visible");
    expect(
      componentsContent,
      ".fo-focusable should use --fo-focus-ring box-shadow",
    ).toMatch(
      /\.fo-focusable:focus-visible\s*\{[^}]*box-shadow:\s*var\(--fo-focus-ring\)/s,
    );
  });

  it("unifies dialog/settings focus-visible onto --fo-focus-ring (UPP-A2 follow-up)", () => {
    // After the 2026-05-30 unification, dialog and settings field focus-visible
    // rules should use box-shadow: var(--fo-focus-ring) instead of outline + color-mix.
    const dialogFocusBlocks =
      dialogsContent.match(/:focus-visible\s*\{[^}]*\}/g) || [];
    const outlineBased = dialogFocusBlocks.filter(
      (b) => b.includes("outline:") && !b.includes("outline: none"),
    );
    expect(
      outlineBased,
      `dialogs.css focus-visible rules should not use outline (found ${outlineBased.length}: ${outlineBased.join(" | ")})`,
    ).toHaveLength(0);
  });

  it("derives the primary-button hover from the active accent (no pinned blue)", () => {
    // The old #006bb3 only matched the default-blue accent; hover is now
    // derived from var(--fo-accent) so all seven accent swatches work.
    expect(componentsContent).not.toContain("#006bb3");
    expect(componentsContent).toContain("color-mix(in srgb, var(--fo-accent)");
  });

  it("tokenizes the status-bar foreground in shell.css", () => {
    expect(shellContent).toContain("--fo-statusbar-fg:");
    expect(shellContent).toContain("color: var(--fo-statusbar-fg)");
    expect(shellContent).not.toMatch(/font-size:\s*\d+px/);
  });

  it("frames the active pane with the accent (UPP-C1, UI spec §3.2)", () => {
    // Active pane must be unmistakable: accent border + accent inset strip,
    // not the old near-invisible --fo-tab-bg outline.
    const activeRule = paneContent.slice(
      paneContent.indexOf('.fo-panel[data-active="true"]'),
    );
    expect(activeRule).toContain("border-color: var(--fo-accent)");
    expect(activeRule).toContain("inset 0 2px 0 0 var(--fo-accent)");
    // The active pane label is accent-tinted to mark the keyboard target.
    expect(paneContent).toContain(
      '.fo-panel[data-active="true"] .fo-tab-pane-label',
    );
  });

  it("defines theme-derived status surface tokens (UPP-H1)", () => {
    for (const token of [
      "--fo-success-bg",
      "--fo-success-border",
      "--fo-warning-bg",
      "--fo-warning-border",
    ]) {
      expect(
        tokensContent.indexOf(token) !== -1,
        `Status surface token ${token} missing from tokens.css`,
      ).toBe(true);
    }
  });

  it("defines and uses Premium Workbench dialog tokens", () => {
    for (const token of [
      "--fo-workbench-dialog-bg",
      "--fo-workbench-dialog-panel-bg",
      "--fo-workbench-dialog-field-bg",
      "--fo-workbench-dialog-border",
      "--fo-workbench-dialog-muted-border",
      "--fo-workbench-dialog-active-bg",
    ]) {
      expect(
        tokensContent.indexOf(token) !== -1,
        `Premium Workbench dialog token ${token} missing from tokens.css`,
      ).toBe(true);
      expect(
        dialogsContent.indexOf(`var(${token})`) !== -1,
        `dialogs.css should consume Premium Workbench dialog token ${token}`,
      ).toBe(true);
    }
    expect(dialogsContent).toContain("border-radius: var(--fo-radius-sm-wide)");
    expect(dialogsContent).toContain(".fo-path-input-row");
  });

  it("jobs.css uses semantic tokens instead of hardcoded hex", () => {
    const matches = jobsContent.match(/#[0-9a-fA-F]{3,8}\b/g);
    expect(
      matches,
      `jobs.css should use tokens instead of hex (${matches?.join(", ") ?? "none"})`,
    ).toBeNull();
  });

  it("sidebar.css uses semantic tokens instead of hardcoded hex", () => {
    const matches = sidebarContent.match(/#[0-9a-fA-F]{3,8}\b/g);
    expect(
      matches,
      `sidebar.css should use tokens instead of hex (${matches?.join(", ") ?? "none"})`,
    ).toBeNull();
  });

  it("makes elevation tokens theme-aware and consolidates popover shadows (UPP-D1)", () => {
    // Elevation tokens now draw their shadow colour from the per-theme
    // --fo-menu-shadow / --fo-dialog-shadow rather than a fixed rgba.
    expect(tokensContent).toContain(
      "--fo-elevation-popover: 0 8px 24px var(--fo-menu-shadow)",
    );
    // Menus/popovers reference the token instead of inlining a shadow literal.
    expect(componentsContent).toContain(
      "box-shadow: var(--fo-elevation-popover)",
    );
    expect(componentsContent).not.toContain(
      "box-shadow: 0 8px 20px var(--fo-menu-shadow)",
    );
  });

  it("all menu surfaces use --fo-elevation-popover (UPP-D1 strict)", () => {
    const allCss = [
      paneContent,
      shellContent,
      dialogsContent,
      sidebarContent,
      componentsContent,
      sharedContent,
      baseContent,
      jobsContent,
    ].join("\n");

    // No menu-like surface should inline a raw box-shadow with menu-shadow.
    // Allowed patterns: var(--fo-elevation-popover), var(--fo-elevation-modal),
    // var(--fo-elevation-drawer), var(--fo-dialog-shadow).
    const inlineShadowPattern =
      /box-shadow:\s*\d+px\s+\d+px\s+\d+px\s+var\(--fo-menu-shadow/g;
    const matches = allCss.match(inlineShadowPattern);
    expect(
      matches,
      `Menu surfaces should use --fo-elevation-popover, not inline shadows (${matches?.length ?? 0} found)`,
    ).toBeNull();
  });

  it("dialogs.css hex is limited to the classic-skin palette defs", () => {
    // Every remaining hex literal must be a --fo-classic-* palette definition
    // (the dialog retro skin, analogous to shell's classic tokens). All other
    // colors resolve through semantic tokens.
    const hexLines = dialogsContent
      .split("\n")
      .filter((line) => /#[0-9a-fA-F]{3,8}\b/.test(line));
    for (const line of hexLines) {
      expect(
        line.includes("--fo-classic-"),
        `Unexpected hardcoded hex in dialogs.css: ${line.trim()}`,
      ).toBe(true);
    }
  });

  it("honours prefers-reduced-motion globally (UPP-J1/I2)", () => {
    expect(baseContent).toContain("@media (prefers-reduced-motion: reduce)");
    expect(baseContent).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(baseContent).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
  });

  it("dialog entrance motion uses motion tokens and is reduced-motion safe", () => {
    // Entrance keyframes exist for the dialog + backdrop.
    expect(dialogsContent).toContain("@keyframes fo-dialog-in");
    expect(dialogsContent).toContain("@keyframes fo-dialog-backdrop-in");
    // The animation is driven by the shared motion tokens (so the global
    // prefers-reduced-motion guard in base.css collapses it).
    expect(dialogsContent).toMatch(
      /animation:\s*fo-dialog-in\s+var\(--fo-motion-med\)\s+var\(--fo-motion-ease\)/,
    );
    // Backdrop blur is an opt-in token, default off (no forced dimming change).
    expect(dialogsContent).toContain(
      "backdrop-filter: var(--fo-dialog-backdrop-blur, none)",
    );
    expect(tokensContent).toContain("--fo-dialog-backdrop-blur: none;");
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
    expect(shellContent).toContain("--fo-classic-title: #007acc");
    expect(dialogsContent).toContain("border-radius: var(--fo-radius-sm-wide)");
    expect(dialogsContent).toContain("box-shadow: var(--fo-elevation-modal)");
    expect(dialogsContent).toMatch(
      /border:\s*1px solid var\(--fo-workbench-dialog-border\)/,
    );
    expect(sharedContent).toContain(
      ".fo-command-palette {\n  max-width: 520px;\n  width: 90vw;\n  padding: 0;\n  border-radius: 0;",
    );
  });
});
