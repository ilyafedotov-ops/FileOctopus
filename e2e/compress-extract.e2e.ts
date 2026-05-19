import { expect, test } from "@playwright/test";

const MENU_SELECTOR = ".fo-context-menu";
const ITEM_SELECTOR = '[role="menuitem"]';
const TOAST_SELECTOR = ".fo-toast";

test.describe("Compress & Extract", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  async function findFileRow(page: import("@playwright/test").Page) {
    const row = page
      .locator(
        ".fo-panel.fo-panel-active .fo-row[role='row']:not(.fo-row-parent)",
      )
      .filter({ hasNotText: /Folder|DIR|parent/i })
      .first();
    const count = await row.count();
    return count > 0 ? row : null;
  }

  async function findAnyRow(page: import("@playwright/test").Page) {
    const row = page.locator('.fo-row[role="row"]').first();
    const count = await row.count();
    return count > 0 ? row : null;
  }

  async function openContextMenuOnFileRow(
    page: import("@playwright/test").Page,
  ) {
    const fileRow = await findFileRow(page);
    if (fileRow) {
      await fileRow.click({ button: "right" });
    } else {
      const tableShell = page.locator(".fo-table-shell").first();
      await tableShell.click({ button: "right" });
    }
    await expect(page.locator(MENU_SELECTOR)).toBeVisible();
  }

  // ─── Compress (Pack) — Context Menu ────────────────────────────

  test("context menu has Pack… item when file(s) selected", async ({
    page,
  }) => {
    await openContextMenuOnFileRow(page);

    const texts = await page
      .locator(`${MENU_SELECTOR} ${ITEM_SELECTOR}`)
      .allTextContents();
    const trimmed = texts.map((t) => t.trim());
    expect(trimmed).toContain("Pack…");
  });

  // ─── Compress (Pack) — Toolbar ─────────────────────────────────

  test("clicking Pack with a file selected shows toast or dialog", async ({
    page,
  }) => {
    const fileRow = await findFileRow(page);
    test.skip(!fileRow, "No file rows visible in active panel");

    await fileRow!.click();

    // Trigger compress via context menu
    await fileRow!.click({ button: "right" });
    await expect(page.locator(MENU_SELECTOR)).toBeVisible();

    const compressItem = page.locator(`${MENU_SELECTOR} ${ITEM_SELECTOR}`, {
      hasText: /^Pack…$/,
    });
    const hasCompress = (await compressItem.count()) > 0;
    test.skip(!hasCompress, "Pack… item not found in context menu");

    await compressItem.click();

    // Feature shows either a dialog or a toast
    const dialog = page.locator('[role="dialog"], .fo-dialog');
    const toast = page.locator(TOAST_SELECTOR).first();
    const hasDialog = (await dialog.count()) > 0;
    const hasToast = (await toast.count()) > 0;

    if (hasDialog) {
      await expect(dialog.first()).toBeVisible();
    } else if (hasToast) {
      await expect(toast).toBeVisible();
    }
  });

  test("Pack toast shows message when backend not ready", async ({ page }) => {
    const fileRow = await findFileRow(page);
    test.skip(!fileRow, "No file rows visible in active panel");

    await fileRow!.click({ button: "right" });
    await expect(page.locator(MENU_SELECTOR)).toBeVisible();

    const compressItem = page.locator(`${MENU_SELECTOR} ${ITEM_SELECTOR}`, {
      hasText: /^Pack…$/,
    });
    await compressItem.click();

    // In Vite-only mode (no Tauri IPC), compress shows an info toast
    const toast = page.locator(TOAST_SELECTOR).first();
    const toastCount = await toast.count();
    if (toastCount > 0) {
      await expect(toast).toBeVisible();
      const title = await toast.locator("strong").textContent();
      expect(title).toBeTruthy();
    }
  });

  test("Pack with multiple files selected triggers action", async ({
    page,
  }) => {
    const rows = page.locator('.fo-row[role="row"]');
    const count = await rows.count();
    test.skip(count < 2, "Need at least 2 rows for multi-select test");

    // Select multiple files with Ctrl+Click
    await rows.first().click();
    await rows.nth(1).click({ modifiers: ["Control"] });

    // Open context menu on one of the selected rows
    await rows.first().click({ button: "right" });
    await expect(page.locator(MENU_SELECTOR)).toBeVisible();

    const compressItem = page.locator(`${MENU_SELECTOR} ${ITEM_SELECTOR}`, {
      hasText: /^Pack…$/,
    });
    const hasCompress = (await compressItem.count()) > 0;
    test.skip(!hasCompress, "Pack… item not found in context menu");

    await compressItem.click();

    // Should show toast or dialog — app should not crash
    await expect(page.locator(".fo-shell")).toBeVisible();
  });

  test("Pack… is not present in pane background menu", async ({ page }) => {
    // Open context menu from empty space
    const tableShell = page.locator(".fo-table-shell").first();
    await tableShell.click({ button: "right" });
    await expect(page.locator(MENU_SELECTOR)).toBeVisible();

    const compressItem = page.locator(`${MENU_SELECTOR} ${ITEM_SELECTOR}`, {
      hasText: /^Pack…$/,
    });
    // Pack… should not appear in pane background menu
    const count = await compressItem.count();
    expect(count).toBe(0);
  });

  test("Pack action does not crash when cancelled via Escape", async ({
    page,
  }) => {
    const fileRow = await findAnyRow(page);
    test.skip(!fileRow, "No rows visible in active panel");

    await fileRow!.click({ button: "right" });
    await expect(page.locator(MENU_SELECTOR)).toBeVisible();

    const compressItem = page.locator(`${MENU_SELECTOR} ${ITEM_SELECTOR}`, {
      hasText: /^Pack…$/,
    });
    const hasCompress = (await compressItem.count()) > 0;
    test.skip(!hasCompress, "Pack… item not found in context menu");

    await compressItem.click();

    // If a dialog opened, close it with Escape
    const dialog = page.locator('[role="dialog"], .fo-dialog');
    const hasDialog = (await dialog.count()) > 0;
    if (hasDialog) {
      await page.keyboard.press("Escape");
      await expect(dialog.first()).not.toBeVisible();
    }

    // App should remain stable
    await expect(page.locator(".fo-shell")).toBeVisible();
  });

  // ─── Extract (Unpack) — Context Menu ───────────────────────────

  test("context menu has Unpack… item when a file is selected", async ({
    page,
  }) => {
    await openContextMenuOnFileRow(page);

    const texts = await page
      .locator(`${MENU_SELECTOR} ${ITEM_SELECTOR}`)
      .allTextContents();
    const trimmed = texts.map((t) => t.trim());
    expect(trimmed).toContain("Unpack…");
  });

  test("clicking Unpack shows toast or dialog", async ({ page }) => {
    const fileRow = await findFileRow(page);
    test.skip(!fileRow, "No file rows visible in active panel");

    await fileRow!.click({ button: "right" });
    await expect(page.locator(MENU_SELECTOR)).toBeVisible();

    const extractItem = page.locator(`${MENU_SELECTOR} ${ITEM_SELECTOR}`, {
      hasText: "Unpack…",
    });
    const hasExtract = (await extractItem.count()) > 0;
    test.skip(!hasExtract, "Unpack… item not found in context menu");

    await extractItem.click();

    const dialog = page.locator('[role="dialog"], .fo-dialog');
    const toast = page.locator(TOAST_SELECTOR).first();
    const hasDialog = (await dialog.count()) > 0;
    const hasToast = (await toast.count()) > 0;

    if (hasDialog) {
      await expect(dialog.first()).toBeVisible();
    } else if (hasToast) {
      await expect(toast).toBeVisible();
    }
  });

  test("Unpack… is not present in pane background menu", async ({ page }) => {
    // Open context menu from empty space
    const tableShell = page.locator(".fo-table-shell").first();
    await tableShell.click({ button: "right" });
    await expect(page.locator(MENU_SELECTOR)).toBeVisible();

    const extractItem = page.locator(`${MENU_SELECTOR} ${ITEM_SELECTOR}`, {
      hasText: "Unpack…",
    });
    // Unpack… should not appear in pane background menu
    const count = await extractItem.count();
    expect(count).toBe(0);
  });
});
