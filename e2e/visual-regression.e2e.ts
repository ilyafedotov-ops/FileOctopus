import { test, expect } from "@playwright/test";

const SNAPSHOT_OPTS = { maxDiffPixelRatio: 0.15 };

test.describe("Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-shell");
    await page.waitForLoadState("networkidle");
  });

  test("main shell — full page screenshot", async ({ page }) => {
    await expect(page).toHaveScreenshot("main-shell.png", SNAPSHOT_OPTS);
  });

  test("sidebar region", async ({ page }) => {
    const sidebar = page.locator("aside.fo-sidebar");
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toHaveScreenshot("sidebar.png", SNAPSHOT_OPTS);
  });

  test("toolbar region", async ({ page }) => {
    const toolbar = page.locator(".fo-operation-toolbar").first();
    await expect(toolbar).toBeVisible();
    await expect(toolbar).toHaveScreenshot("toolbar.png", SNAPSHOT_OPTS);
  });

  test("file table region", async ({ page }) => {
    const table = page.locator(".fo-table-shell").first();
    await expect(table).toBeVisible();
    await expect(table).toHaveScreenshot("file-table.png", SNAPSHOT_OPTS);
  });

  test("status bar region", async ({ page }) => {
    const statusBar = page.locator("footer.fo-status");
    await expect(statusBar).toBeVisible();
    await expect(statusBar).toHaveScreenshot("status-bar.png", SNAPSHOT_OPTS);
  });

  test("context menu open on file row", async ({ page }) => {
    const fileRow = page.locator('.fo-row[role="row"]').first();
    const rowCount = await fileRow.count();

    if (rowCount > 0) {
      await fileRow.click({ button: "right" });
    } else {
      const tableShell = page.locator(".fo-table-shell").first();
      await tableShell.click({ button: "right" });
    }

    const menu = page.locator(".fo-context-menu");
    await expect(menu).toBeVisible();
    await expect(menu).toHaveScreenshot("context-menu-file.png", SNAPSHOT_OPTS);
  });

  test("context menu open on empty space", async ({ page }) => {
    const tableShell = page.locator(".fo-table-shell").first();
    await tableShell.click({ button: "right" });

    const menu = page.locator(".fo-context-menu");
    await expect(menu).toBeVisible();
    await expect(menu).toHaveScreenshot(
      "context-menu-empty.png",
      SNAPSHOT_OPTS,
    );
  });

  test("settings dialog open (Ctrl+,)", async ({ page }) => {
    await page.locator(".fo-shell").press("Control+,");

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveScreenshot("settings-dialog.png", SNAPSHOT_OPTS);
  });

  test("shortcuts dialog open (Ctrl+/)", async ({ page }) => {
    await page.locator(".fo-shell").press("Control+/");

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveScreenshot(
      "shortcuts-dialog.png",
      SNAPSHOT_OPTS,
    );
  });

  test("command palette open (Ctrl+P)", async ({ page }) => {
    await page.locator(".fo-shell").press("Control+p");

    const palette = page.locator(".fo-command-palette");
    await expect(palette).toBeVisible();
    await expect(palette).toHaveScreenshot(
      "command-palette.png",
      SNAPSHOT_OPTS,
    );
  });

  test("light theme (default)", async ({ page }) => {
    const shell = page.locator(".fo-shell");
    await expect(shell).toBeVisible();
    await expect(shell).toHaveScreenshot("light-theme.png", SNAPSHOT_OPTS);
  });

  test("dark theme (switch in settings)", async ({ page }) => {
    await page.locator(".fo-shell").press("Control+,");

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    const themeToggle = dialog
      .locator(
        "button:has-text('Dark'), button:has-text('dark'), [aria-label*='theme'], [data-testid*='theme']",
      )
      .first();

    if (await themeToggle.isVisible()) {
      await themeToggle.click();
    } else {
      const darkOption = dialog.locator("text=Dark").first();
      if (await darkOption.isVisible()) {
        await darkOption.click();
      }
    }

    await page.waitForTimeout(300);

    const shell = page.locator(".fo-shell");
    await expect(shell).toBeVisible();
    await expect(shell).toHaveScreenshot("dark-theme.png", SNAPSHOT_OPTS);
  });
});
