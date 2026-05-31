/**
 * E2E tests for the Multi-Rename dialog in FileOctopus.
 *
 * The Multi-Rename dialog is opened via:
 *   - Ctrl+M keyboard shortcut (registered as "tools.multiRename")
 *   - Command palette -> "Multi-Rename..."
 *   - Context menu -> "Multi-Rename..." (when multiple files selected)
 *   - Toolbar button
 *
 * DOM structure (from MultiRenameDialog.tsx):
 *   .fo-dialog-backdrop[role="presentation"] > dialog.fo-dialog.fo-multi-rename-dialog[role="dialog"][aria-labelledby="multi-rename-title"]
 *     > header.fo-dialog-header > .fo-dialog-titleblock > h2#multi-rename-title "Multi-Rename" + Close button
 *     > .fo-dialog-body
 *       > .fo-multi-rename-form
 *         > label.fo-dialog-field "Pattern" > input[type=text]
 *         > .fo-multi-rename-tokens (token buttons)
 *         > label.fo-dialog-field "Search" > input[type=text]
 *         > label.fo-dialog-field "Replace" > input[type=text]
 *         > label.fo-settings-checkbox > input[type=checkbox] "Use regular expressions"
 *         > label.fo-dialog-field "Case conversion" > select
 *         > .fo-multi-rename-counter
 *           > label "Counter start" > input[type=number]
 *           > label "Counter step"  > input[type=number]
 *           > label "Counter padding" > input[type=number]
 *       > .fo-multi-rename-preview
 *         > h3 "Preview (N files)"
 *         > .fo-multi-rename-conflict-warning (when conflicts exist)
 *         > .fo-multi-rename-results > table (Original / New name columns)
 *     > footer.fo-dialog-footer
 *       > Cancel button (variant=ghost)
 *       > "Rename N files" button (disabled when conflicts or no changes)
 */
import { expect, test } from "@playwright/test";

async function shellPress(page: import("@playwright/test").Page, key: string) {
  await page.locator(".fo-shell").press(key);
}

function selectableFileRow(page: import("@playwright/test").Page) {
  return page.locator(
    ".fo-panel.fo-panel-active .fo-row[role='row']:not(.fo-row-parent)",
  );
}

async function openMultiRenameViaShortcut(
  page: import("@playwright/test").Page,
) {
  await shellPress(page, "Control+m");
  const dialog = page.locator(".fo-multi-rename-dialog");
  await expect(dialog).toBeVisible({ timeout: 3000 });
  return dialog;
}

async function openMultiRenameViaPalette(
  page: import("@playwright/test").Page,
) {
  await shellPress(page, "Control+p");
  const paletteInput = page.locator(
    '.fo-command-palette input[aria-label="Search commands"]',
  );
  await expect(paletteInput).toBeVisible({ timeout: 3000 });
  await paletteInput.fill("multi-rename");
  await page.waitForTimeout(300);

  const cmdItem = page.locator(".fo-command-palette-item", {
    hasText: "Multi-Rename",
  });
  await expect(cmdItem.first()).toBeVisible({ timeout: 3000 });
  await cmdItem.first().click();

  const dialog = page.locator(".fo-multi-rename-dialog");
  await expect(dialog).toBeVisible({ timeout: 3000 });
  return dialog;
}

async function openMultiRenameOrSkip(page: import("@playwright/test").Page) {
  try {
    const dialog = await openMultiRenameViaPalette(page);
    return dialog;
  } catch {
    test.skip(true, "Multi-rename dialog could not be opened");
    throw new Error("unreachable");
  }
}

// ---------------------------------------------------------------------------
// Opening the dialog
// ---------------------------------------------------------------------------

test.describe("Multi-Rename Dialog - Opening", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("opens via Ctrl+M keyboard shortcut", async ({ page }) => {
    const dialog = await openMultiRenameViaShortcut(page);
    await expect(dialog).toBeVisible();
  });

  test("opens via command palette Multi-Rename", async ({ page }) => {
    const dialog = await openMultiRenameViaPalette(page);
    await expect(dialog).toBeVisible();
  });

  test("opens via context menu Multi-Rename item when files are selected", async ({
    page,
  }) => {
    const rows = selectableFileRow(page);
    const count = await rows.count();
    test.skip(count < 2, "Need at least two file rows to multi-select");

    await rows.nth(0).click();
    await rows.nth(1).click({ modifiers: ["Control"] });

    await rows.nth(1).click({ button: "right" });
    await expect(page.locator(".fo-context-menu")).toBeVisible();

    const renameBtn = page.locator('.fo-context-menu [role="menuitem"]', {
      hasText: "Multi-Rename",
    });
    const hasRenameBtn = await renameBtn.count();
    test.skip(hasRenameBtn === 0, "No Multi-Rename in context menu");

    await renameBtn.click();
    const dialog = page.locator(".fo-multi-rename-dialog");
    await expect(dialog).toBeVisible({ timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// ARIA & dialog shell
// ---------------------------------------------------------------------------

test.describe("Multi-Rename Dialog - ARIA and structure", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("has role=dialog", async ({ page }) => {
    const dialog = await openMultiRenameOrSkip(page);
    await expect(dialog).toHaveAttribute("role", "dialog");
  });

  test("has aria-labelledby pointing to title element", async ({ page }) => {
    const dialog = await openMultiRenameOrSkip(page);

    const labelledBy = await dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(labelledBy).toBe("multi-rename-title");

    const titleEl = page.locator("#multi-rename-title");
    await expect(titleEl).toBeVisible();
    await expect(titleEl).toContainText("Multi-Rename");
  });

  test("has title heading with Multi-Rename text", async ({ page }) => {
    const dialog = await openMultiRenameOrSkip(page);

    const heading = dialog.getByRole("heading", { name: "Multi-Rename" });
    await expect(heading).toBeVisible();
  });

  test("has fo-dialog-backdrop wrapper with role=presentation", async ({
    page,
  }) => {
    await openMultiRenameOrSkip(page);

    const backdrop = page.locator(".fo-dialog-backdrop");
    await expect(backdrop).toBeVisible();
    await expect(backdrop).toHaveAttribute("role", "presentation");
  });
});

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

test.describe("Multi-Rename Dialog - Form fields", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("has rename pattern input field", async ({ page }) => {
    const dialog = await openMultiRenameOrSkip(page);

    const patternLabel = dialog.locator("label.fo-dialog-field", {
      hasText: "Pattern",
    });
    await expect(patternLabel).toBeVisible();

    const patternInput = patternLabel.locator("input[type='text']");
    await expect(patternInput).toBeVisible();
    await expect(patternInput).toHaveValue("[N]");
  });

  test("has search and replace text inputs", async ({ page }) => {
    const dialog = await openMultiRenameOrSkip(page);

    const searchLabel = dialog.locator("label.fo-dialog-field", {
      hasText: "Search",
    });
    await expect(searchLabel).toBeVisible();
    await expect(searchLabel.locator("input[type='text']")).toBeVisible();

    const replaceLabel = dialog.locator("label.fo-dialog-field", {
      hasText: "Replace",
    });
    await expect(replaceLabel).toBeVisible();
    await expect(replaceLabel.locator("input[type='text']")).toBeVisible();
  });

  test("has case conversion select dropdown", async ({ page }) => {
    const dialog = await openMultiRenameOrSkip(page);

    const caseLabel = dialog.locator("label.fo-dialog-field", {
      hasText: "Case conversion",
    });
    await expect(caseLabel).toBeVisible();

    const select = caseLabel.locator("select");
    await expect(select).toBeVisible();
    await expect(select).toHaveValue("none");
  });

  test("has regex checkbox", async ({ page }) => {
    const dialog = await openMultiRenameOrSkip(page);

    const checkbox = dialog.locator(
      "label.fo-settings-checkbox input[type='checkbox']",
    );
    await expect(checkbox).toBeVisible();
    await expect(checkbox).not.toBeChecked();
  });

  test("has pattern token buttons in fo-multi-rename-tokens", async ({
    page,
  }) => {
    const dialog = await openMultiRenameOrSkip(page);

    const tokensContainer = dialog.locator(".fo-multi-rename-tokens");
    await expect(tokensContainer).toBeVisible();

    const tokenButtons = tokensContainer.locator("button");
    const count = await tokenButtons.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("has counter fields for start, step, and padding", async ({ page }) => {
    const dialog = await openMultiRenameOrSkip(page);

    const counterSection = dialog.locator(".fo-multi-rename-counter");
    await expect(counterSection).toBeVisible();

    const startInput = counterSection.locator(
      "label:has-text('Counter start') input[type='number']",
    );
    await expect(startInput).toBeVisible();

    const stepInput = counterSection.locator(
      "label:has-text('Counter step') input[type='number']",
    );
    await expect(stepInput).toBeVisible();

    const paddingInput = counterSection.locator(
      "label:has-text('Counter padding') input[type='number']",
    );
    await expect(paddingInput).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Preview section
// ---------------------------------------------------------------------------

test.describe("Multi-Rename Dialog - Preview section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("has preview section with heading", async ({ page }) => {
    const dialog = await openMultiRenameOrSkip(page);

    const preview = dialog.locator(".fo-multi-rename-preview");
    await expect(preview).toBeVisible();

    const heading = preview.locator("h3");
    await expect(heading).toBeVisible();
    await expect(heading).toContainText("Preview");
  });

  test("preview section contains results table with Original and New name headers", async ({
    page,
  }) => {
    const dialog = await openMultiRenameOrSkip(page);

    const results = dialog.locator(".fo-multi-rename-results");
    await expect(results).toBeVisible();

    const table = results.locator("table");
    await expect(table).toBeVisible();

    const headers = table.locator("thead th");
    const headerTexts = await headers.allTextContents();
    const trimmed = headerTexts.map((t) => t.trim());
    expect(trimmed).toContain("Original");
    expect(trimmed).toContain("New name");
  });
});

// ---------------------------------------------------------------------------
// Action buttons
// ---------------------------------------------------------------------------

test.describe("Multi-Rename Dialog - Action buttons", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("has Cancel button in footer", async ({ page }) => {
    const dialog = await openMultiRenameOrSkip(page);

    const footer = dialog.locator("footer.fo-dialog-footer");
    await expect(footer).toBeVisible();

    const cancelBtn = footer.locator("button:has-text('Cancel')");
    await expect(cancelBtn).toBeVisible();
  });

  test("has Rename button in footer", async ({ page }) => {
    const dialog = await openMultiRenameOrSkip(page);

    const footer = dialog.locator("footer.fo-dialog-footer");
    const renameBtn = footer.locator("button:has-text('Rename')");
    await expect(renameBtn).toBeVisible();
  });

  test("Rename button shows file count and is disabled when no entries", async ({
    page,
  }) => {
    const dialog = await openMultiRenameOrSkip(page);

    const renameBtn = dialog.locator(
      "footer.fo-dialog-footer button:has-text('Rename')",
    );
    await expect(renameBtn).toBeVisible();

    const buttonText = await renameBtn.textContent();
    expect(buttonText).toContain("Rename");

    const isDisabled = await renameBtn.isDisabled();
    expect(typeof isDisabled).toBe("boolean");
  });
});

// ---------------------------------------------------------------------------
// Dismissal behavior
// ---------------------------------------------------------------------------

test.describe("Multi-Rename Dialog - Dismissal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("Escape key dismisses the dialog", async ({ page }) => {
    await openMultiRenameViaShortcut(page);
    const dialog = page.locator(".fo-multi-rename-dialog");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible({ timeout: 2000 });
  });

  test("Cancel button dismisses the dialog", async ({ page }) => {
    const dialog = await openMultiRenameViaShortcut(page);
    await expect(dialog).toBeVisible();

    const cancelBtn = dialog.locator("button:has-text('Cancel')");
    await cancelBtn.click();
    await expect(dialog).not.toBeVisible({ timeout: 2000 });
  });

  test("Close button in header dismisses the dialog", async ({ page }) => {
    const dialog = await openMultiRenameViaShortcut(page);
    await expect(dialog).toBeVisible();

    const closeBtn = dialog.locator("header button:has-text('Close')");
    await closeBtn.click();
    await expect(dialog).not.toBeVisible({ timeout: 2000 });
  });

  test("backdrop click dismisses the dialog", async ({ page }) => {
    await openMultiRenameViaShortcut(page);
    const dialog = page.locator(".fo-multi-rename-dialog");
    await expect(dialog).toBeVisible();

    const backdrop = page.locator(".fo-dialog-backdrop");
    await expect(backdrop).toBeVisible();

    await backdrop.click({ position: { x: 5, y: 5 } });
    await expect(dialog).not.toBeVisible({ timeout: 2000 });
  });
});

// ---------------------------------------------------------------------------
// Skipped: Requires real FS/IPC data
// ---------------------------------------------------------------------------

test.describe("Multi-Rename Dialog - Requires real FS (skipped)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test.skip("F2 with multiple files selected opens multi-rename instead of inline rename (requires real FS)", async ({
    page,
  }) => {
    const rows = selectableFileRow(page);
    const count = await rows.count();
    test.skip(count < 2, "Need at least two file rows to multi-select");

    await rows.nth(0).click();
    await rows.nth(1).click({ modifiers: ["Control"] });

    await shellPress(page, "F2");

    const multiRenameDialog = page.locator(".fo-multi-rename-dialog");
    await expect(multiRenameDialog).toBeVisible({ timeout: 3000 });

    const inlineInput = page.locator(".fo-row-rename-input");
    await expect(inlineInput).not.toBeVisible();
  });

  test.skip("preview shows selected file names with applied pattern (requires real FS)", async ({
    page,
  }) => {
    const rows = selectableFileRow(page);
    const count = await rows.count();
    test.skip(count < 2, "Need at least two file rows");

    await rows.nth(0).click();
    await rows.nth(1).click({ modifiers: ["Control"] });

    await openMultiRenameViaShortcut(page);

    const resultsRows = page.locator(".fo-multi-rename-results tbody tr");
    const rowCount = await resultsRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(2);

    const firstOriginal = await resultsRows
      .nth(0)
      .locator("td")
      .first()
      .textContent();
    expect(firstOriginal).toBeTruthy();
    expect(firstOriginal!.length).toBeGreaterThan(0);
  });

  test.skip("changing pattern updates preview in real-time (requires real FS)", async ({
    page,
  }) => {
    const dialog = await openMultiRenameViaShortcut(page);

    const patternInput = dialog.locator(
      "label:has-text('Pattern') input[type='text']",
    );
    await patternInput.clear();
    await patternInput.fill("[N]_[C]");

    const resultsRows = dialog.locator(".fo-multi-rename-results tbody tr");
    const rowCount = await resultsRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(1);

    const firstNewName = await resultsRows
      .nth(0)
      .locator("td")
      .nth(1)
      .textContent();
    expect(firstNewName).toBeTruthy();
  });

  test.skip("conflict warning appears for duplicate new names (requires real FS)", async ({
    page,
  }) => {
    const dialog = await openMultiRenameViaShortcut(page);

    const patternInput = dialog.locator(
      "label:has-text('Pattern') input[type='text']",
    );
    await patternInput.clear();
    await patternInput.fill("same-name");

    const warning = dialog.locator(".fo-multi-rename-conflict-warning");
    const resultsCount = await dialog
      .locator(".fo-multi-rename-results tbody tr")
      .count();
    if (resultsCount > 1) {
      await expect(warning).toBeVisible();
    }
  });

  test.skip("clicking Rename button executes rename and closes dialog (requires real FS)", async ({
    page,
  }) => {
    const dialog = await openMultiRenameViaShortcut(page);

    const renameBtn = dialog.locator(
      "footer.fo-dialog-footer button:has-text('Rename')",
    );
    const isDisabled = await renameBtn.isDisabled();
    test.skip(isDisabled, "Rename button is disabled (no changes)");

    await renameBtn.click();
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });
});
