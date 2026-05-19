import { test, expect } from "@playwright/test";

test.describe("Diagnostics dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-shell");
  });

  test("opens from Help menu and shows app metadata", async ({ page }) => {
    await page.getByRole("menuitem", { name: /Help/i }).click();
    await page.getByRole("menuitem", { name: "Diagnostics…" }).click();

    await expect(page.locator("#diagnostics-title")).toHaveText("Diagnostics");
    await expect(page.getByText("Runtime information")).toBeVisible();
  });

  test("export diagnostics shows success message in preview mode", async ({
    page,
  }) => {
    await page.getByRole("menuitem", { name: /Help/i }).click();
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
