import { test, expect } from "@playwright/test";

test.describe("Diagnostics dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-shell");
  });

  test("opens from Help menu and shows app metadata", async ({ page }) => {
    // Find the Help menu trigger — it may have mnemonic underline (<u>H</u>elp)
    const helpTrigger = page
      .getByRole("menubar")
      .locator("[role='menuitem']")
      .filter({ hasText: /Help/i });
    await helpTrigger.click();

    // Click Diagnostics… in the Help dropdown
    const diagItem = page.getByRole("menuitem", { name: "Diagnostics…" });
    await diagItem.click();

    // Dialog should be open
    await expect(page.locator("#diagnostics-title")).toHaveText("Diagnostics");
    // Check the title is visible
    await expect(page.locator("#diagnostics-title")).toBeVisible();
  });

  test("export diagnostics shows success message in preview mode", async ({
    page,
  }) => {
    const helpTrigger = page
      .getByRole("menubar")
      .locator("[role='menuitem']")
      .filter({ hasText: /Help/i });
    await helpTrigger.click();
    await page.getByRole("menuitem", { name: "Diagnostics…" }).click();

    await expect(page.locator("#diagnostics-title")).toBeVisible();

    await page
      .getByLabel("Destination")
      .fill("/tmp/fileoctopus-diagnostics-e2e.zip");
    await page.getByRole("button", { name: "Export bundle" }).click();

    await expect(page.getByText(/Exported 2 file\(s\)\./)).toBeVisible({
      timeout: 15_000,
    });
  });
});
