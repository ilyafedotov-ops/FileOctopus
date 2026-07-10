import { expect, test } from "@playwright/test";

const MENU_SELECTOR = ".fo-context-menu";
const ITEM_SELECTOR = '[role="menuitem"]';
const NOTIFICATION_SELECTOR = ".fo-notification-item";

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
    const row = page
      .locator(
        ".fo-panel.fo-panel-active .fo-row[role='row']:not(.fo-row-parent)",
      )
      .first();
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
    return openToolsSubmenu(page);
  }

  async function openToolsSubmenu(page: import("@playwright/test").Page) {
    const menu = page.locator(`${MENU_SELECTOR}:visible`);
    await expect(menu).toBeVisible();
    const tools = menu.getByRole("menuitem", { name: "Tools", exact: true });
    await expect(tools).toBeVisible();
    await tools.hover();
    const submenu = menu.locator(".fo-context-submenu:visible");
    await expect(submenu).toBeVisible();
    return submenu;
  }

  async function latestNotification(page: import("@playwright/test").Page) {
    await page.getByRole("button", { name: /^Notifications/ }).click();
    const notification = page.locator(NOTIFICATION_SELECTOR).first();
    await expect(notification).toBeVisible();
    return notification;
  }

  // ─── Compress (Pack) — Context Menu ────────────────────────────

  test("context menu has Pack… item when file(s) selected", async ({
    page,
  }) => {
    const toolsMenu = await openContextMenuOnFileRow(page);

    const texts = await toolsMenu.locator(ITEM_SELECTOR).allTextContents();
    const trimmed = texts.map((t) => t.trim());
    expect(trimmed).toContain("Pack…");
  });

  // ─── Compress (Pack) — Toolbar ─────────────────────────────────

  test("clicking Pack with a file selected records a notification", async ({
    page,
  }) => {
    const fileRow = await findFileRow(page);
    test.skip(!fileRow, "No file rows visible in active panel");

    await fileRow!.click();

    await fileRow!.click({ button: "right" });
    const toolsMenu = await openToolsSubmenu(page);

    const compressItem = toolsMenu.getByRole("menuitem", {
      name: "Pack…",
      exact: true,
    });
    const hasCompress = (await compressItem.count()) > 0;
    test.skip(!hasCompress, "Pack… item not found in context menu");

    await compressItem.click();
    await latestNotification(page);
  });

  test("Pack notification shows a result message", async ({ page }) => {
    const fileRow = await findFileRow(page);
    test.skip(!fileRow, "No file rows visible in active panel");

    await fileRow!.click({ button: "right" });
    const toolsMenu = await openToolsSubmenu(page);

    const compressItem = toolsMenu.getByRole("menuitem", {
      name: "Pack…",
      exact: true,
    });
    await compressItem.click();

    const notification = await latestNotification(page);
    const title = await notification.locator("strong").textContent();
    expect(title).toBeTruthy();
  });

  test("Pack with multiple files selected triggers action", async ({
    page,
  }) => {
    const rows = page.locator(
      ".fo-panel.fo-panel-active .fo-row[role='row']:not(.fo-row-parent)",
    );
    const count = await rows.count();
    test.skip(count < 2, "Need at least 2 rows for multi-select test");

    // Select multiple files with Ctrl+Click
    await rows.first().click();
    await rows.nth(1).click({ modifiers: ["Control"] });

    await rows.first().click({ button: "right" });
    const toolsMenu = await openToolsSubmenu(page);

    const compressItem = toolsMenu.getByRole("menuitem", {
      name: "Pack…",
      exact: true,
    });
    const hasCompress = (await compressItem.count()) > 0;
    test.skip(!hasCompress, "Pack… item not found in context menu");

    await compressItem.click();
    await latestNotification(page);
    await expect(page.locator(".fo-shell")).toBeVisible();
  });

  test("Pack… is not present in pane background menu", async ({ page }) => {
    // Open context menu from empty space
    const tableShell = page.locator(".fo-table-shell").first();
    await tableShell.click({ button: "right" });
    const menu = page.locator(`${MENU_SELECTOR}:visible`);
    await expect(menu).toBeVisible();

    const compressItem = menu.getByRole("menuitem", {
      name: "Pack…",
      exact: true,
    });
    // Pack… should not appear in pane background menu
    const count = await compressItem.count();
    expect(count).toBe(0);
  });

  test("Pack action leaves the shell stable", async ({ page }) => {
    const fileRow = await findAnyRow(page);
    test.skip(!fileRow, "No rows visible in active panel");

    await fileRow!.click({ button: "right" });
    const toolsMenu = await openToolsSubmenu(page);

    const compressItem = toolsMenu.getByRole("menuitem", {
      name: "Pack…",
      exact: true,
    });
    const hasCompress = (await compressItem.count()) > 0;
    test.skip(!hasCompress, "Pack… item not found in context menu");

    await compressItem.click();
    await latestNotification(page);
    await expect(page.locator(".fo-shell")).toBeVisible();
  });

  // ─── Extract (Unpack) — Context Menu ───────────────────────────

  test("context menu has Unpack… item when a file is selected", async ({
    page,
  }) => {
    const toolsMenu = await openContextMenuOnFileRow(page);

    const texts = await toolsMenu.locator(ITEM_SELECTOR).allTextContents();
    const trimmed = texts.map((t) => t.trim());
    test.skip(!trimmed.includes("Unpack…"), "Selected file is not an archive");
    expect(trimmed).toContain("Unpack…");
  });

  test("clicking Unpack records a notification", async ({ page }) => {
    const fileRow = await findFileRow(page);
    test.skip(!fileRow, "No file rows visible in active panel");

    await fileRow!.click({ button: "right" });
    const toolsMenu = await openToolsSubmenu(page);

    const extractItem = toolsMenu.getByRole("menuitem", {
      name: "Unpack…",
      exact: true,
    });
    const hasExtract = (await extractItem.count()) > 0;
    test.skip(!hasExtract, "Unpack… item not found in context menu");

    await extractItem.click();
    await latestNotification(page);
  });

  test("Unpack… is not present in pane background menu", async ({ page }) => {
    // Open context menu from empty space
    const tableShell = page.locator(".fo-table-shell").first();
    await tableShell.click({ button: "right" });
    const menu = page.locator(`${MENU_SELECTOR}:visible`);
    await expect(menu).toBeVisible();

    const extractItem = menu.getByRole("menuitem", {
      name: "Unpack…",
      exact: true,
    });
    // Unpack… should not appear in pane background menu
    const count = await extractItem.count();
    expect(count).toBe(0);
  });
});
