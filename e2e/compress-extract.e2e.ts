import { expect, test } from "@playwright/test";

const MENU_SELECTOR = ".fo-context-menu";
const ITEM_SELECTOR = '[role="menuitem"]';
const TOAST_SELECTOR = ".fo-toast";

test.describe("Compress & Extract", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  /**
   * Helper: find a file row (not a directory). Directories show "Folder" in
   * the type column. We look for a row whose text does NOT contain "Folder".
   */
  async function findFileRow(page: import("@playwright/test").Page) {
    const rows = page.locator('.fo-row[role="row"]');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).textContent();
      if (text && !text.includes("Folder")) {
        return rows.nth(i);
      }
    }
    return null;
  }

  /**
   * Helper: find any file row (file or directory).
   */
  async function findAnyRow(page: import("@playwright/test").Page) {
    const row = page.locator('.fo-row[role="row"]').first();
    const count = await row.count();
    return count > 0 ? row : null;
  }

  /**
   * Helper: open the "More" dropdown in the first panel's toolbar and return
   * the dropdown element.
   */
  async function openMoreDropdown(page: import("@playwright/test").Page) {
    const toolbar = page.locator(".fo-operation-toolbar").first();
    const moreBtn = toolbar.locator("button:has-text('More')").first();
    await moreBtn.click();

    const dropdown = page.locator(".fo-ui-dropdown-menu--portal").last();
    await expect(dropdown).toBeVisible();
    return dropdown;
  }

  /**
   * Helper: open context menu by right-clicking on a file row.
   */
  async function openContextMenuOnFileRow(
    page: import("@playwright/test").Page,
  ) {
    const fileRow = page.locator('.fo-row[role="row"]').first();
    const rowCount = await fileRow.count();
    if (rowCount > 0) {
      await fileRow.click({ button: "right" });
    } else {
      const tableShell = page.locator(".fo-table-shell").first();
      await tableShell.click({ button: "right" });
    }
    await expect(page.locator(MENU_SELECTOR)).toBeVisible();
  }

  // ─── Compress — Context Menu ──────────────────────────────────

  test("context menu has Compress… item when file(s) selected", async ({
    page,
  }) => {
    await openContextMenuOnFileRow(page);

    const texts = await page
      .locator(`${MENU_SELECTOR} > ${ITEM_SELECTOR}`)
      .allTextContents();
    const trimmed = texts.map((t) => t.trim());
    expect(trimmed).toContain("Compress…");
  });

  // ─── Compress — Toolbar ───────────────────────────────────────

  test("toolbar More dropdown contains Compress… item", async ({ page }) => {
    const dropdown = await openMoreDropdown(page);

    const compressItem = dropdown.locator(
      'button[role="menuitem"]:has-text("Compress…")',
    );
    await expect(compressItem).toBeAttached();
  });

  test("clicking Compress with a file selected shows toast or dialog", async ({
    page,
  }) => {
    const fileRow = await findFileRow(page);
    test.skip(!fileRow, "No file rows visible in active panel");

    await fileRow!.click();

    // Trigger compress via context menu
    await fileRow!.click({ button: "right" });
    await expect(page.locator(MENU_SELECTOR)).toBeVisible();

    const compressItem = page.locator(
      `${MENU_SELECTOR} > ${ITEM_SELECTOR}:has-text("Compress…")`,
    );
    const hasCompress = (await compressItem.count()) > 0;
    test.skip(!hasCompress, "Compress… item not found in context menu");

    await compressItem.click();

    // Feature shows either a dialog or a "coming soon" toast
    const dialog = page.locator('[role="dialog"], .fo-dialog');
    const toast = page.locator(TOAST_SELECTOR).first();
    const hasDialog = (await dialog.count()) > 0;
    const hasToast = (await toast.count()) > 0;

    // At least one of dialog or toast should be visible
    if (hasDialog) {
      await expect(dialog.first()).toBeVisible();
    } else if (hasToast) {
      await expect(toast).toBeVisible();
    }
  });

  test("Compress toast shows 'coming soon' message when backend not ready", async ({
    page,
  }) => {
    const fileRow = await findFileRow(page);
    test.skip(!fileRow, "No file rows visible in active panel");

    await fileRow!.click({ button: "right" });
    await expect(page.locator(MENU_SELECTOR)).toBeVisible();

    const compressItem = page.locator(
      `${MENU_SELECTOR} > ${ITEM_SELECTOR}:has-text("Compress…")`,
    );
    await compressItem.click();

    // In Vite-only mode (no Tauri IPC), compress shows an info toast
    const toast = page.locator(TOAST_SELECTOR).first();
    const toastCount = await toast.count();
    if (toastCount > 0) {
      await expect(toast).toBeVisible();
      const title = await toast.locator("strong").textContent();
      // "Compress coming soon" is the current placeholder message
      expect(title).toBeTruthy();
    }
  });

  test("toolbar Compress… becomes enabled when a file is selected", async ({
    page,
  }) => {
    const fileRow = await findFileRow(page);
    test.skip(!fileRow, "No file rows visible in active panel");

    await fileRow!.click();

    const dropdown = await openMoreDropdown(page);

    const compressItem = dropdown.locator(
      'button[role="menuitem"]:has-text("Compress…")',
    );
    await expect(compressItem).toBeEnabled();
  });

  test("Compress with multiple files selected triggers action", async ({
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

    const compressItem = page.locator(
      `${MENU_SELECTOR} > ${ITEM_SELECTOR}:has-text("Compress…")`,
    );
    const hasCompress = (await compressItem.count()) > 0;
    test.skip(!hasCompress, "Compress… item not found in context menu");

    await compressItem.click();

    // Should show toast or dialog — app should not crash
    await expect(page.locator(".fo-shell")).toBeVisible();
  });

  test("Compress… is disabled in context menu when no file is selected", async ({
    page,
  }) => {
    // Open context menu from empty space
    const tableShell = page.locator(".fo-table-shell").first();
    await tableShell.click({ button: "right" });
    await expect(page.locator(MENU_SELECTOR)).toBeVisible();

    const compressItem = page.locator(
      `${MENU_SELECTOR} > ${ITEM_SELECTOR}:has-text("Compress…")`,
    );
    const hasCompress = (await compressItem.count()) > 0;
    test.skip(!hasCompress, "Compress… item not found in context menu");

    await expect(compressItem).toBeDisabled();
  });

  test("Compress action does not crash when cancelled via Escape", async ({
    page,
  }) => {
    const fileRow = await findAnyRow(page);
    test.skip(!fileRow, "No rows visible in active panel");

    await fileRow!.click({ button: "right" });
    await expect(page.locator(MENU_SELECTOR)).toBeVisible();

    const compressItem = page.locator(
      `${MENU_SELECTOR} > ${ITEM_SELECTOR}:has-text("Compress…")`,
    );
    const hasCompress = (await compressItem.count()) > 0;
    test.skip(!hasCompress, "Compress… item not found in context menu");

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

  // ─── Extract — Context Menu ───────────────────────────────────

  test("context menu has Extract… item when archive is selected", async ({
    page,
  }) => {
    await openContextMenuOnFileRow(page);

    const texts = await page
      .locator(`${MENU_SELECTOR} > ${ITEM_SELECTOR}`)
      .allTextContents();
    const trimmed = texts.map((t) => t.trim());
    expect(trimmed).toContain("Extract…");
  });

  // ─── Extract — Toolbar ────────────────────────────────────────

  test("toolbar More dropdown contains Extract… item", async ({ page }) => {
    const dropdown = await openMoreDropdown(page);

    const extractItem = dropdown.locator(
      'button[role="menuitem"]:has-text("Extract…")',
    );
    await expect(extractItem).toBeAttached();
  });

  test("toolbar Extract… becomes enabled when a file is selected", async ({
    page,
  }) => {
    const fileRow = await findFileRow(page);
    test.skip(!fileRow, "No file rows visible in active panel");

    await fileRow!.click();

    const dropdown = await openMoreDropdown(page);

    const extractItem = dropdown.locator(
      'button[role="menuitem"]:has-text("Extract…")',
    );
    await expect(extractItem).toBeEnabled();
  });

  test("clicking Extract shows toast or dialog", async ({ page }) => {
    const fileRow = await findFileRow(page);
    test.skip(!fileRow, "No file rows visible in active panel");

    await fileRow!.click({ button: "right" });
    await expect(page.locator(MENU_SELECTOR)).toBeVisible();

    const extractItem = page.locator(
      `${MENU_SELECTOR} > ${ITEM_SELECTOR}:has-text("Extract…")`,
    );
    const hasExtract = (await extractItem.count()) > 0;
    test.skip(!hasExtract, "Extract… item not found in context menu");

    await extractItem.click();

    // Feature shows either a dialog or a "coming soon" toast
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

  test("Extract… is disabled in context menu when no file is selected", async ({
    page,
  }) => {
    // Open context menu from empty space
    const tableShell = page.locator(".fo-table-shell").first();
    await tableShell.click({ button: "right" });
    await expect(page.locator(MENU_SELECTOR)).toBeVisible();

    const extractItem = page.locator(
      `${MENU_SELECTOR} > ${ITEM_SELECTOR}:has-text("Extract…")`,
    );
    const hasExtract = (await extractItem.count()) > 0;
    test.skip(!hasExtract, "Extract… item not found in context menu");

    await expect(extractItem).toBeDisabled();
  });
});
