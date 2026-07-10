/**
 * E2E tests for inline rename, Go To Location, and content search features.
 */
import { test, expect } from "@playwright/test";

async function shellPress(page: import("@playwright/test").Page, key: string) {
  await page.locator(".fo-shell").press(key);
}

function operationalRows(page: import("@playwright/test").Page) {
  return page.locator(
    ".fo-panel.fo-panel-active .fo-row[role='row']:not(.fo-row-parent)",
  );
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
    const row = operationalRows(page).first();
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
    const row = operationalRows(page).first();
    const count = await row.count();
    test.skip(count === 0, "No rows in panel");

    await row.click();
    const name = await row.locator(".fo-row-text").textContent();

    await shellPress(page, "F2");
    const renameInput = page.locator(".fo-row-rename-input");
    await expect(renameInput).toBeVisible({ timeout: 3000 });

    const inputValue = await renameInput.inputValue();
    expect(inputValue.trim()).toBe(name?.trim() ?? "");
  });

  test("Escape cancels inline rename without error", async ({ page }) => {
    const row = operationalRows(page).first();
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
    const row = operationalRows(page)
      .filter({ hasNotText: /Folder|DIR/i })
      .first();
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
    const dirRow = operationalRows(page)
      .filter({ hasText: /Folder|DIR/i })
      .first();
    const count = await dirRow.count();
    test.skip(count === 0, "No directory rows in panel");

    await dirRow.click();
    await shellPress(page, "F2");

    const renameInput = page.locator(".fo-row-rename-input");
    await expect(renameInput).toBeVisible({ timeout: 3000 });
  });
});

test.describe("Path focus", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("Ctrl+L focuses breadcrumb path input in active panel header", async ({
    page,
  }) => {
    await shellPress(page, "Control+l");

    const input = page.locator(
      '.fo-panel-active input.fo-path[aria-label="Current path"]',
    );
    await expect(input).toBeVisible({ timeout: 3000 });
    await expect(
      page.locator(
        '.fo-panel:not(.fo-panel-active) input.fo-path[aria-label="Current path"]',
      ),
    ).toHaveCount(0);
  });

  test("breadcrumb input is auto-focused when Ctrl+L is pressed", async ({
    page,
  }) => {
    await shellPress(page, "Control+l");

    const input = page.locator(
      '.fo-panel-active input.fo-path[aria-label="Current path"]',
    );
    await expect(input).toBeFocused();
  });

  test("breadcrumb edit area contains a text input", async ({ page }) => {
    await shellPress(page, "Control+l");

    const input = page.locator(
      '.fo-panel-active input.fo-path[aria-label="Current path"]',
    );
    await expect(input).toBeVisible({ timeout: 3000 });
  });

  test("Escape blurs the breadcrumb input", async ({ page }) => {
    await shellPress(page, "Control+l");

    const input = page.locator(
      '.fo-panel-active input.fo-path[aria-label="Current path"]',
    );
    await expect(input).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(input).not.toBeVisible();
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

  test("content search input is available in the active panel", async ({
    page,
  }) => {
    const input = page.locator(".fo-panel-active .fo-content-search-input");
    await expect(input).toBeVisible();
    await input.focus();
    await expect(input).toBeFocused();
  });

  test("content search input has the expected prompt", async ({ page }) => {
    const input = page.locator(".fo-panel-active .fo-content-search-input");
    await expect(input).toHaveAttribute(
      "placeholder",
      "Search in file contents…",
    );
  });

  test("content search input accepts a query", async ({ page }) => {
    const input = page.locator(".fo-panel-active .fo-content-search-input");
    await input.fill("needle");
    await expect(input).toHaveValue("needle");
  });
});
