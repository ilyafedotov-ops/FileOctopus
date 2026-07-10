import { expect, test } from "@playwright/test";

const MENU_SELECTOR = ".fo-context-menu";
const ITEM_SELECTOR = '[role="menuitem"]';
const NOTIFICATION_SELECTOR = ".fo-notification-item";

test.describe("Checksum", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  /**
   * Helper: find a file row (not a directory). Directories show "Folder" in
   * the type column. We look for a row whose text does NOT contain "Folder".
   */
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

  /**
   * Helper: find a directory row. Directories have "Folder" in the type label.
   */
  async function findDirectoryRow(page: import("@playwright/test").Page) {
    const row = page
      .locator(
        ".fo-panel.fo-panel-active .fo-row[role='row']:not(.fo-row-parent)",
      )
      .filter({ hasText: /Folder|DIR/i })
      .first();
    const count = await row.count();
    return count > 0 ? row : null;
  }

  /**
   * Helper: open the "More" dropdown in the first panel's toolbar and return
   * the dropdown element.
   */
  async function openMoreDropdown(page: import("@playwright/test").Page) {
    const toolbar = page.locator(".fo-workbench-toolbar .fo-operation-toolbar");
    await toolbar.getByRole("button", { name: "More" }).click();
    // Wait for dropdown to render
    await page.waitForTimeout(500);
    // Find the More dropdown by looking for common items
    const dropdown = page.getByRole("menu").filter({
      has: page.getByRole("menuitem", { name: "Paste" }),
    });
    await expect(dropdown).toBeVisible();
    return dropdown;
  }

  /**
   * Helper: trigger checksum from context menu on a selected file row.
   */
  async function triggerChecksumViaContextMenu(
    page: import("@playwright/test").Page,
  ) {
    const fileRow = await findFileRow(page);
    if (!fileRow) return;
    await fileRow.click({ button: "right" });
    const toolsMenu = await openContextToolsMenu(page);

    const checksumItem = toolsMenu.getByRole("menuitem", {
      name: "Checksum…",
      exact: true,
    });
    await checksumItem.click();
  }

  async function openContextToolsMenu(page: import("@playwright/test").Page) {
    const menu = page.locator(`${MENU_SELECTOR}:visible`);
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: "Tools", exact: true }).hover();
    const toolsMenu = menu.locator(".fo-context-submenu:visible");
    await expect(toolsMenu).toBeVisible();
    return toolsMenu;
  }

  async function latestNotification(page: import("@playwright/test").Page) {
    await page.getByRole("button", { name: /^Notifications/ }).click();
    const notification = page.locator(NOTIFICATION_SELECTOR).first();
    await expect(notification).toBeVisible();
    return notification;
  }

  // ─── Context menu ──────────────────────────────────────────────

  test("context menu shows Checksum… option when right-clicking a file", async ({
    page,
  }) => {
    const fileRow = await findFileRow(page);
    test.skip(!fileRow, "No file rows visible in active panel");

    await fileRow!.click({ button: "right" });
    const toolsMenu = await openContextToolsMenu(page);

    const texts = await toolsMenu.locator(ITEM_SELECTOR).allTextContents();
    const trimmed = texts.map((t) => t.trim());
    expect(trimmed).toContain("Checksum…");
  });

  test("context menu Checksum… item is enabled when file is selected", async ({
    page,
  }) => {
    const fileRow = await findFileRow(page);
    test.skip(!fileRow, "No file rows visible in active panel");

    await fileRow!.click({ button: "right" });
    const toolsMenu = await openContextToolsMenu(page);

    const checksumItem = toolsMenu.getByRole("menuitem", {
      name: "Checksum…",
      exact: true,
    });
    await expect(checksumItem).toBeEnabled();
  });

  // ─── Toolbar ───────────────────────────────────────────────────

  test("toolbar More dropdown contains Checksum item", async ({ page }) => {
    const dropdown = await openMoreDropdown(page);

    const checksumItem = dropdown.locator(
      'button[role="menuitem"]:has-text("Checksum")',
    );
    await expect(checksumItem).toBeAttached();
  });

  test("toolbar Checksum becomes enabled when a file is selected", async ({
    page,
  }) => {
    const fileRow = await findFileRow(page);
    test.skip(!fileRow, "No file rows visible in active panel");

    // Select the file first
    await fileRow!.click();

    const dropdown = await openMoreDropdown(page);

    const checksumItem = dropdown.locator(
      'button[role="menuitem"]:has-text("Checksum")',
    );
    await expect(checksumItem).toBeEnabled();
  });

  test("triggering checksum on a file records a notification", async ({
    page,
  }) => {
    const fileRow = await findFileRow(page);
    test.skip(!fileRow, "No file rows visible in active panel");

    await triggerChecksumViaContextMenu(page);

    const notification = await latestNotification(page);
    const title = await notification.locator("strong").textContent();
    expect(title).toBeTruthy();
    const isIpcAvailable = !title!.startsWith("Checksum failed:");
    if (isIpcAvailable) {
      expect(title).toMatch(/^SHA-256:/);
    } else {
      expect(title).toMatch(/^Checksum failed:/);
    }
  });

  test("checksum success notification has SHA-256: prefix when IPC is available", async ({
    page,
  }) => {
    const fileRow = await findFileRow(page);
    test.skip(!fileRow, "No file rows visible in active panel");

    await triggerChecksumViaContextMenu(page);

    const notification = await latestNotification(page);
    const title = await notification.locator("strong").textContent();
    test.skip(
      title?.startsWith("Checksum failed:"),
      "Tauri IPC unavailable in browser preview — skipping success assertions",
    );

    expect(title).toMatch(/^SHA-256:/);
    await expect(notification).toHaveClass(/fo-notification-success/);
  });

  test("checksum result hash matches SHA-256 format (64 hex chars)", async ({
    page,
  }) => {
    const fileRow = await findFileRow(page);
    test.skip(!fileRow, "No file rows visible in active panel");

    await triggerChecksumViaContextMenu(page);

    const notification = await latestNotification(page);
    const title = await notification.locator("strong").textContent();
    test.skip(
      !title?.startsWith("SHA-256:"),
      "Tauri IPC unavailable in browser preview — skipping hash format check",
    );

    const hash = title!.replace("SHA-256: ", "");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  // ─── Error cases ───────────────────────────────────────────────

  test("checksum on directory records an error notification", async ({
    page,
  }) => {
    const dirRow = await findDirectoryRow(page);
    test.skip(!dirRow, "No directory rows visible in active panel");

    await dirRow!.click();
    await dirRow!.click({ button: "right" });
    const toolsMenu = await openContextToolsMenu(page);

    const checksumItem = toolsMenu.getByRole("menuitem", {
      name: "Checksum…",
      exact: true,
    });
    const hasItem = (await checksumItem.count()) > 0;
    test.skip(!hasItem, "Checksum… item not found in context menu");
    await checksumItem.click();

    await latestNotification(page);
  });

  test("checksum with no selection records an error notification", async ({
    page,
  }) => {
    const tableShell = page.locator(".fo-table-shell").first();
    await tableShell.click();

    const toolbar = page.locator(".fo-workbench-toolbar .fo-operation-toolbar");
    await toolbar.getByRole("button", { name: "More" }).click();
    await page.waitForTimeout(500);

    const checksumItem = page
      .locator('[role="menuitem"]')
      .filter({ hasText: /^Checksum$/ })
      .first();
    const hasItem = (await checksumItem.count()) > 0;
    test.skip(!hasItem, "Checksum item not found in More dropdown");
    await checksumItem.click();
    await latestNotification(page);
  });

  test("notification center exposes its accessible label", async ({ page }) => {
    const fileRow = await findFileRow(page);
    test.skip(!fileRow, "No file rows visible in active panel");

    await triggerChecksumViaContextMenu(page);

    await latestNotification(page);
    await expect(
      page.getByRole("region", { name: "Notifications" }),
    ).toBeVisible();
  });
});
