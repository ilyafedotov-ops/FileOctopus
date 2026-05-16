import { test, expect } from "@playwright/test";

test.describe("Empty directory state", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test.skip("shows empty placeholder when navigating to an empty directory", async ({
    page,
  }) => {
    // NOTE: Skipped because navigating to an arbitrary empty temp directory
    // requires filesystem setup that depends on the Tauri backend runtime.
    // To test manually: navigate the active panel to an empty directory and
    // verify the empty state placeholder appears.

    const emptyState = page.locator(".fo-empty-directory");
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText("This folder is empty");
    await expect(emptyState.locator(".fo-empty-directory-icon")).toBeVisible();
  });

  test("empty directory component class does not appear when panel has entries", async ({
    page,
  }) => {
    const emptyState = page.locator(".fo-empty-directory");
    await expect(emptyState).toHaveCount(0);
  });
});
