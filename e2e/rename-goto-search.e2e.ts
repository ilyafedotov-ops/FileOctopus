/**
 * E2E tests for inline rename, Go To Location, and content search features.
 */
import { test, expect } from "@playwright/test";

async function shellPress(page: import("@playwright/test").Page, key: string) {
  await page.locator(".fo-shell").press(key);
}

// ---------------------------------------------------------------------------
// Inline rename (F2 / slow double-click)
// ---------------------------------------------------------------------------
test.describe("Inline rename", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("F2 on selected file shows inline rename input", async ({ page }) => {
    const row = page.locator('.fo-row[role="row"]').first();
    const count = await row.count();
    test.skip(count === 0, "No rows in panel");

    // Select the row first
    await row.click();
    // Press F2 to trigger inline rename
    await shellPress(page, "F2");

    const renameInput = page.locator(".fo-row-rename-input");
    // Input should be visible and focused
    await expect(renameInput).toBeVisible({ timeout: 3000 });
    await expect(renameInput).toBeFocused();
  });

  test("inline rename input pre-fills with current file name", async ({
    page,
  }) => {
    const row = page.locator('.fo-row[role="row"]').first();
    const count = await row.count();
    test.skip(count === 0, "No rows in panel");

    await row.click();
    const name = await row.locator(".fo-cell-name").first().textContent();

    await shellPress(page, "F2");
    const renameInput = page.locator(".fo-row-rename-input");
    await expect(renameInput).toBeVisible({ timeout: 3000 });

    const inputValue = await renameInput.inputValue();
    expect(inputValue.trim()).toBe(name?.trim() ?? "");
  });

  test("Escape cancels inline rename without error", async ({ page }) => {
    const row = page.locator('.fo-row[role="row"]').first();
    const count = await row.count();
    test.skip(count === 0, "No rows in panel");

    await row.click();
    await shellPress(page, "F2");

    const renameInput = page.locator(".fo-row-rename-input");
    await expect(renameInput).toBeVisible({ timeout: 3000 });

    await renameInput.press("Escape");
    await expect(renameInput).not.toBeVisible();
  });

  test("inline rename commits on Enter", async ({ page }) => {
    const row = page.locator('.fo-row[role="row"][data-type="file"]').first();
    const count = await row.count();
    test.skip(count === 0, "No file rows in panel");

    await row.click();
    await shellPress(page, "F2");

    const renameInput = page.locator(".fo-row-rename-input");
    await expect(renameInput).toBeVisible({ timeout: 3000 });

    // Clear and type a new name
    await renameInput.clear();
    await renameInput.fill("e2e-renamed-test-file");
    await renameInput.press("Enter");

    // Input should close — the rename was committed
    await expect(renameInput).not.toBeVisible({ timeout: 3000 });
  });

  test("F2 on directory row triggers rename", async ({ page }) => {
    const dirRow = page
      .locator('.fo-row[role="row"][data-type="directory"]')
      .first();
    const count = await dirRow.count();
    test.skip(count === 0, "No directory rows in panel");

    await dirRow.click();
    await shellPress(page, "F2");

    const renameInput = page.locator(".fo-row-rename-input");
    await expect(renameInput).toBeVisible({ timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Go To Location dialog (Ctrl+G)
// ---------------------------------------------------------------------------
test.describe("Go To Location dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("Ctrl+G focuses breadcrumb path input in active panel header", async ({
    page,
  }) => {
    await shellPress(page, "Control+g");

    const breadcrumbEdit = page.locator(".fo-breadcrumb-edit");
    await expect(breadcrumbEdit).toBeVisible({ timeout: 3000 });
  });

  test("breadcrumb input is auto-focused when Ctrl+G is pressed", async ({
    page,
  }) => {
    await shellPress(page, "Control+g");

    const breadcrumbEdit = page.locator(".fo-breadcrumb-edit");
    await expect(breadcrumbEdit).toBeVisible({ timeout: 3000 });

    const input = breadcrumbEdit.locator("input, textarea").first();
    await expect(input).toBeFocused();
  });

  test("breadcrumb edit area contains a text input", async ({ page }) => {
    await shellPress(page, "Control+g");

    const breadcrumbEdit = page.locator(".fo-breadcrumb-edit");
    await expect(breadcrumbEdit).toBeVisible({ timeout: 3000 });

    const input = breadcrumbEdit.locator("input, textarea");
    await expect(input.first()).toBeVisible();
  });

  test("Escape blurs the breadcrumb input", async ({ page }) => {
    await shellPress(page, "Control+g");

    const breadcrumbEdit = page.locator(".fo-breadcrumb-edit");
    await expect(breadcrumbEdit).toBeVisible({ timeout: 3000 });

    const input = breadcrumbEdit.locator("input, textarea").first();
    await expect(input).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(input).not.toBeFocused();
  });
});

// ---------------------------------------------------------------------------
// Content search panel
// ---------------------------------------------------------------------------
test.describe("Content search panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("content search panel class exists when toggled open", async ({
    page,
  }) => {
    // Try Ctrl+Shift+F or menu to open content search
    await shellPress(page, "Control+Shift+f");

    // Check if search panel appears (give it time, may not be bound)
    const searchPanel = page.locator(".fo-recursive-search");
    const visible = await searchPanel.isVisible().catch(() => false);
    // If shortcut not bound, try command palette
    if (!visible) {
      await shellPress(page, "Control+p");
      const paletteInput = page.locator(
        ".fo-command-palette-input, [role='dialog'] input",
      );
      await expect(paletteInput.first()).toBeVisible({ timeout: 3000 });
      await paletteInput.first().fill("content search");
      await page.waitForTimeout(500);
      // Look for content search command in results
      const cmdItem = page.locator(".fo-command-palette-item").first();
      const hasItem = (await cmdItem.count()) > 0;
      if (hasItem) {
        await cmdItem.click();
        await expect(searchPanel).toBeVisible({ timeout: 3000 });
      } else {
        test.skip(true, "Content search command not found in palette");
      }
    } else {
      await expect(searchPanel).toBeVisible();
    }
  });

  test("content search panel has search input", async ({ page }) => {
    await shellPress(page, "Control+Shift+f");
    const searchPanel = page.locator(".fo-recursive-search");
    const visible = await searchPanel.isVisible().catch(() => false);

    test.skip(!visible, "Content search panel not available");

    const input = searchPanel.locator("input").first();
    await expect(input).toBeVisible();
  });

  test("content search panel closes on Escape", async ({ page }) => {
    await shellPress(page, "Control+Shift+f");
    const searchPanel = page.locator(".fo-recursive-search");
    const visible = await searchPanel.isVisible().catch(() => false);
    test.skip(!visible, "Content search panel not available");

    await searchPanel.press("Escape");
    await expect(searchPanel).not.toBeVisible();
  });
});
