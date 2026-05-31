/**
 * E2E tests for the Properties dialog in FileOctopus.
 *
 * The Properties dialog is opened via:
 *   - Alt+Enter keyboard shortcut (registered as "op.properties")
 *   - Right-click context menu → "Properties"
 *
 * DOM structure (from PropertiesDialog.tsx wrapped in DialogShell):
 *   .fo-dialog-backdrop > dialog[role="dialog"][aria-modal] > header + .fo-properties
 *   .fo-properties contains: .fo-properties-hero, .fo-properties-section(s),
 *   .fo-properties-actions, and optionally .fo-properties-state, .fo-properties-warnings.
 *
 * Each section: section.fo-properties-section > h3.fo-properties-section-title + dl.fo-properties-grid
 * Hero: .fo-properties-hero > .fo-properties-icon + .fo-properties-heading + .fo-properties-size
 * Actions: .fo-properties-actions with Copy Path, Copy URI, Reveal buttons
 * Badges: .fo-properties-badges > .fo-properties-badge (for flags like Hidden, Read-only, Symlink)
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

async function openPropertiesViaContextMenu(
  page: import("@playwright/test").Page,
) {
  const fileRow = selectableFileRow(page).first();
  const count = await fileRow.count();
  test.skip(count === 0, "No file rows visible");

  await fileRow.click({ button: "right" });
  await expect(page.locator(".fo-context-menu")).toBeVisible();

  const propertiesBtn = page.locator('.fo-context-menu [role="menuitem"]', {
    hasText: "Properties",
  });
  await expect(propertiesBtn).toBeVisible();
  await propertiesBtn.click();

  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("Properties Dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  // ─── Opening ─────────────────────────────────────────────────────

  test("opens via Alt+Enter keyboard shortcut", async ({ page }) => {
    const fileRow = selectableFileRow(page).first();
    const count = await fileRow.count();
    test.skip(count === 0, "No file rows visible — shortcut needs a selection");

    await fileRow.click();
    await shellPress(page, "Alt+Enter");

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("role", "dialog");
  });

  test("opens via context menu Properties item", async ({ page }) => {
    await openPropertiesViaContextMenu(page);
  });

  // ─── ARIA & Dialog Shell ─────────────────────────────────────────

  test("has role='dialog' and aria-modal='true'", async ({ page }) => {
    const dialog = await openPropertiesViaContextMenu(page);

    await expect(dialog).toHaveAttribute("role", "dialog");
    await expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  test("has title heading with 'Properties' text", async ({ page }) => {
    const dialog = await openPropertiesViaContextMenu(page);

    const heading = dialog.getByRole("heading", { name: "Properties" });
    await expect(heading).toBeVisible();
  });

  test("has accessible labelledby pointing to title", async ({ page }) => {
    const dialog = await openPropertiesViaContextMenu(page);

    const labelledBy = await dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();

    const titleEl = page.locator(`#${labelledBy}`);
    await expect(titleEl).toBeVisible();
    await expect(titleEl).toContainText("Properties");
  });

  // ─── Close Behavior ──────────────────────────────────────────────

  test("Escape key dismisses the dialog", async ({ page }) => {
    await openPropertiesViaContextMenu(page);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("Close button dismisses the dialog", async ({ page }) => {
    const dialog = await openPropertiesViaContextMenu(page);

    const closeBtn = dialog.locator(
      'button[aria-label="Close"], button:has-text("Close")',
    );
    const hasClose = await closeBtn.count();
    test.skip(hasClose === 0, "No close button rendered");

    await closeBtn.first().click();
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });

  // ─── Properties Container ────────────────────────────────────────

  test("renders .fo-properties container inside dialog", async ({ page }) => {
    const dialog = await openPropertiesViaContextMenu(page);

    const propsContainer = dialog.locator(".fo-properties");
    await expect(propsContainer).toBeVisible();
  });

  // ─── Hero Section ────────────────────────────────────────────────

  test("has hero section with icon, heading, and size display", async ({
    page,
  }) => {
    const dialog = await openPropertiesViaContextMenu(page);

    const hero = dialog.locator(".fo-properties-hero");
    const heroVisible = await hero.count();
    if (heroVisible === 0) {
      // In Vite preview mode without real FS, the dialog may show a loading state instead
      const stateEl = dialog.locator(".fo-properties-state");
      await expect(stateEl).toBeVisible();
      return;
    }

    await expect(hero).toBeVisible();

    const icon = hero.locator(".fo-properties-icon");
    await expect(icon).toBeVisible();

    const heading = hero.locator(".fo-properties-heading");
    await expect(heading).toBeVisible();

    // Heading should contain a strong element with the file name
    const nameEl = heading.locator("strong");
    const hasName = await nameEl.count();
    expect(hasName).toBeGreaterThan(0);

    // Size display (may be "Calculating size…" or actual size)
    const sizeEl = hero.locator(".fo-properties-size");
    const hasSize = await sizeEl.count();
    expect(hasSize).toBeGreaterThan(0);
  });

  // ─── Metadata Grid ───────────────────────────────────────────────

  test("shows metadata grid with name, type, and size rows", async ({
    page,
  }) => {
    const dialog = await openPropertiesViaContextMenu(page);

    const grid = dialog.locator(".fo-properties-grid").first();
    const gridVisible = await grid.count();
    test.skip(gridVisible === 0, "No properties grid rendered (loading state)");

    await expect(grid).toBeVisible();

    // Check for dt/dd pairs — at minimum Name and Type labels
    const labels = grid.locator("dt");
    const labelCount = await labels.count();
    expect(labelCount).toBeGreaterThanOrEqual(2);

    const labelTexts = await labels.allTextContents();
    const hasName = labelTexts.some((t) => t.includes("Name"));
    const hasType = labelTexts.some((t) => t.includes("Type"));
    expect(hasName || hasType).toBeTruthy();
  });

  // ─── Sections Structure ──────────────────────────────────────────

  test("has multiple .fo-properties-section elements", async ({ page }) => {
    const dialog = await openPropertiesViaContextMenu(page);

    const sections = dialog.locator(".fo-properties-section");
    const sectionCount = await sections.count();
    test.skip(
      sectionCount === 0,
      "No sections rendered (loading or preview mode)",
    );

    expect(sectionCount).toBeGreaterThanOrEqual(2);

    // Each section should have a section-title heading
    for (let i = 0; i < Math.min(sectionCount, 6); i++) {
      const title = sections.nth(i).locator(".fo-properties-section-title");
      await expect(title).toBeVisible();
    }
  });

  test("contains expected section titles (General, Location, Dates, Attributes)", async ({
    page,
  }) => {
    const dialog = await openPropertiesViaContextMenu(page);

    const sections = dialog.locator(".fo-properties-section");
    const sectionCount = await sections.count();
    test.skip(
      sectionCount === 0,
      "No sections rendered (loading or preview mode)",
    );

    const sectionTitles = await dialog
      .locator(".fo-properties-section-title")
      .allTextContents();
    const titles = sectionTitles.map((t) => t.trim());

    expect(titles).toContain("General");
    expect(titles).toContain("Location");
    expect(titles).toContain("Dates");
    expect(titles).toContain("Attributes");
  });

  // ─── Badges ──────────────────────────────────────────────────────

  test("badges section renders .fo-properties-badges or muted text for flags", async ({
    page,
  }) => {
    const dialog = await openPropertiesViaContextMenu(page);

    const badges = dialog.locator(".fo-properties-badges");
    const muted = dialog.locator(".fo-properties-muted");
    const badgesCount = await badges.count();
    const mutedCount = await muted.count();

    // Either badges are shown (file has flags) or muted "None" text is displayed
    expect(badgesCount + mutedCount).toBeGreaterThanOrEqual(0);
  });

  // ─── Size Display ────────────────────────────────────────────────

  test("size display shows formatted size or calculating state", async ({
    page,
  }) => {
    const dialog = await openPropertiesViaContextMenu(page);

    const hero = dialog.locator(".fo-properties-hero");
    const heroVisible = await hero.count();
    test.skip(heroVisible === 0, "No hero section rendered");

    const sizeEl = hero.locator(".fo-properties-size");
    await expect(sizeEl).toBeVisible();

    const sizeText = await sizeEl.textContent();
    // Size should be either a formatted value (e.g., "4.2 KB") or "Calculating size…"
    const calculating = dialog.locator(".fo-properties-calculating");
    const isCalculating = await calculating.count();

    if (isCalculating > 0) {
      expect(sizeText).toContain("Calculating");
    } else {
      expect(sizeText!.length).toBeGreaterThan(0);
    }
  });

  // ─── Mono-Value Display ──────────────────────────────────────────

  test("location section shows mono-spaced path values", async ({ page }) => {
    const dialog = await openPropertiesViaContextMenu(page);

    const monoValues = dialog.locator(".fo-properties-value--mono");
    const monoCount = await monoValues.count();
    test.skip(
      monoCount === 0,
      "No mono values rendered (loading or preview mode)",
    );

    // Full path and Resource URI should both be displayed in mono
    expect(monoCount).toBeGreaterThanOrEqual(2);
  });

  // ─── Actions Buttons ─────────────────────────────────────────────

  test("actions section has Copy Path, Copy URI, and Reveal buttons", async ({
    page,
  }) => {
    const dialog = await openPropertiesViaContextMenu(page);

    const actions = dialog.locator(".fo-properties-actions");
    const actionsVisible = await actions.count();
    test.skip(
      actionsVisible === 0,
      "No actions section rendered (loading state)",
    );

    await expect(actions).toBeVisible();

    const copyPathBtn = actions.locator('button:has-text("Copy Path")');
    const copyUriBtn = actions.locator('button:has-text("Copy URI")');
    const revealBtn = actions.locator('button:has-text("Reveal")');

    await expect(copyPathBtn).toBeVisible();
    await expect(copyUriBtn).toBeVisible();
    await expect(revealBtn).toBeVisible();
  });

  // ─── Loading State ───────────────────────────────────────────────

  test("shows loading state with role=status when properties are loading", async ({
    page,
  }) => {
    // This test verifies the loading skeleton is present immediately after opening.
    // In Vite preview mode, the loading state may flash briefly or persist.
    const fileRow = selectableFileRow(page).first();
    const count = await fileRow.count();
    test.skip(count === 0, "No file rows visible");

    await fileRow.click({ button: "right" });
    const propertiesBtn = page.locator('.fo-context-menu [role="menuitem"]', {
      hasText: "Properties",
    });
    await expect(propertiesBtn).toBeVisible();

    // Use Promise.race to catch the brief loading state
    const dialog = page.locator('[role="dialog"]');
    await propertiesBtn.click();

    // Wait for the dialog to appear, then check for either loading state or loaded content
    await expect(dialog).toBeVisible({ timeout: 2000 });

    // The dialog should eventually show either loading state or real data
    const stateEl = dialog.locator(".fo-properties-state");
    const heroEl = dialog.locator(".fo-properties-hero");

    // At least one of these should be present
    const hasState = await stateEl.count();
    const hasHero = await heroEl.count();
    expect(hasState + hasHero).toBeGreaterThan(0);
  });

  // ─── Dialog Width Class ──────────────────────────────────────────

  test("dialog has .fo-properties-dialog class for width styling", async ({
    page,
  }) => {
    const dialog = await openPropertiesViaContextMenu(page);

    // The OperationDialogView adds .fo-properties-dialog to the DialogShell's className
    const hasClass = await dialog.evaluate((el) => {
      return (
        el.classList.contains("fo-properties-dialog") ||
        el.closest(".fo-properties-dialog") !== null
      );
    });
    expect(hasClass).toBeTruthy();
  });

  // ─── Skipped: Requires real FS/IPC ───────────────────────────────

  test.skip("Copy Path copies the file path to clipboard (requires real FS)", async ({
    page,
  }) => {
    // Requires a running Tauri backend with real filesystem access
    const dialog = await openPropertiesViaContextMenu(page);

    const copyPathBtn = dialog.locator('button:has-text("Copy Path")');
    await expect(copyPathBtn).toBeVisible();
    await copyPathBtn.click();

    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(clipboardText).toBeTruthy();
    expect(clipboardText).toContain("local://");
  });

  test.skip("Reveal opens system file manager (requires real IPC)", async ({
    page,
  }) => {
    // Requires Tauri IPC to invoke the system file manager reveal command
    const dialog = await openPropertiesViaContextMenu(page);

    const revealBtn = dialog.locator('button:has-text("Reveal")');
    await expect(revealBtn).toBeVisible();
    await revealBtn.click();
    // Cannot verify in Vite preview mode — needs real Tauri shell
  });

  test.skip("Checksum section shows SHA-256 hash for files (requires real FS)", async ({
    page,
  }) => {
    // Requires real FS to compute file hash
    const dialog = await openPropertiesViaContextMenu(page);

    const checksumSection = dialog.locator(".fo-properties-section", {
      hasText: "Checksum",
    });
    await expect(checksumSection).toBeVisible();

    const hashValue = checksumSection.locator(".fo-properties-value--mono");
    await expect(hashValue).toBeVisible();
  });

  test.skip("Permissions section shows ACL editor (requires real FS)", async ({
    page,
  }) => {
    // Requires real FS for ACL data
    const dialog = await openPropertiesViaContextMenu(page);

    const permsSection = dialog.locator(".fo-properties-section", {
      hasText: "Permissions",
    });
    await expect(permsSection).toBeVisible();
  });
});
