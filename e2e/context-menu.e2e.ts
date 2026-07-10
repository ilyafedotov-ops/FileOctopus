import { expect, test, type Locator, type Page } from "@playwright/test";

const MENU_SELECTOR = ".fo-context-menu";
const TOP_LEVEL_ITEMS =
  ":scope > [role='menuitem'], :scope > .fo-context-menu-submenu > [role='menuitem']";

test.describe("Context Menu", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  async function visibleMenu(page: Page) {
    const menu = page.locator(`${MENU_SELECTOR}:visible`);
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute("role", "menu");
    return menu;
  }

  async function openFileMenu(page: Page) {
    const row = page
      .locator(
        ".fo-panel.fo-panel-active .fo-row[role='row']:not(.fo-row-parent)",
      )
      .first();
    test.skip(
      (await row.count()) === 0,
      "No file rows visible in active panel",
    );
    await row.click({ button: "right" });
    return visibleMenu(page);
  }

  async function openBackgroundMenu(page: Page) {
    await page.locator(".fo-table-shell").first().click({ button: "right" });
    return visibleMenu(page);
  }

  async function openSubmenu(menu: Locator, label: string) {
    const trigger = menu
      .locator(".fo-context-menu-item--submenu:visible")
      .filter({ hasText: new RegExp(`^${label}$`) });
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    await trigger.hover();
    const submenu = menu.locator(".fo-context-submenu:visible");
    await expect(submenu).toBeVisible();
    await expect(submenu).toHaveAttribute("role", "menu");
    return submenu;
  }

  async function topLevelTexts(menu: Locator) {
    return (await menu.locator(TOP_LEVEL_ITEMS).allTextContents()).map((text) =>
      text.trim(),
    );
  }

  test("opens distinct file and pane background menus", async ({ page }) => {
    const fileMenu = await openFileMenu(page);
    expect(
      (await topLevelTexts(fileMenu)).some((text) => text.startsWith("Open")),
    ).toBe(true);
    await page.keyboard.press("Escape");

    const backgroundMenu = await openBackgroundMenu(page);
    expect(await topLevelTexts(backgroundMenu)).toContain("New Folder");
  });

  test("uses menuitem and separator roles", async ({ page }) => {
    const menu = await openFileMenu(page);
    const items = menu.locator(TOP_LEVEL_ITEMS);
    expect(await items.count()).toBeGreaterThan(0);
    for (let index = 0; index < (await items.count()); index += 1) {
      await expect(items.nth(index)).toHaveAttribute("role", "menuitem");
    }
    const separators = menu.locator(":scope > [role='separator']");
    expect(await separators.count()).toBeGreaterThanOrEqual(4);
  });

  test("file menu exposes the current primary action groups", async ({
    page,
  }) => {
    const menu = await openFileMenu(page);
    const items = await topLevelTexts(menu);
    for (const label of [
      "Open",
      "Cut",
      "Copy",
      "Rename…",
      "Copy To…",
      "Move To…",
      "Tools",
      "Delete…",
      "Properties…",
    ]) {
      expect(items.some((text) => text.startsWith(label))).toBe(true);
    }
    expect(
      items.some((text) => text === "Add Star" || text === "Remove Star"),
    ).toBe(true);
  });

  test("Copy submenu exposes path and URI actions", async ({ page }) => {
    const menu = await openFileMenu(page);
    const submenu = await openSubmenu(menu, "Copy");
    await expect(
      submenu.getByRole("menuitem", { name: "Copy Path" }),
    ).toBeVisible();
    await expect(
      submenu.getByRole("menuitem", { name: "Copy Name" }),
    ).toBeVisible();
    await expect(
      submenu.getByRole("menuitem", { name: "Copy Parent Folder Path" }),
    ).toBeVisible();
    await expect(
      submenu.getByRole("menuitem", { name: "Copy Resource URI" }),
    ).toBeVisible();
  });

  test("Open With submenu exposes terminal and reveal actions", async ({
    page,
  }) => {
    const menu = await openFileMenu(page);
    const submenu = await openSubmenu(menu, "Open With");
    await expect(
      submenu.getByRole("menuitem", { name: "Open Terminal" }),
    ).toBeVisible();
    await expect(
      submenu.getByRole("menuitem", { name: "Open External Terminal" }),
    ).toBeVisible();
    await expect(
      submenu.getByRole("menuitem", { name: "Reveal in System File Manager" }),
    ).toBeVisible();
  });

  test("Tools submenu exposes archive, checksum, and permanent delete", async ({
    page,
  }) => {
    const menu = await openFileMenu(page);
    const submenu = await openSubmenu(menu, "Tools");
    await expect(
      submenu.getByRole("menuitem", { name: "Pack…" }),
    ).toBeVisible();
    await expect(
      submenu.getByRole("menuitem", { name: "Checksum…" }),
    ).toBeVisible();
    await expect(
      submenu.getByRole("menuitem", { name: /Delete Permanently…/ }),
    ).toBeVisible();
  });

  test("Tags submenu exposes the supported colors", async ({ page }) => {
    const menu = await openFileMenu(page);
    const trigger = menu
      .locator(".fo-context-menu-item--submenu:visible")
      .filter({ hasText: /^Tags$/ });
    test.skip(
      (await trigger.count()) === 0,
      "Tags are unavailable for this entry",
    );
    const submenu = await openSubmenu(menu, "Tags");
    for (const color of ["Red", "Orange", "Green", "Blue", "Violet"]) {
      await expect(
        submenu.getByRole("menuitem", { name: color }),
      ).toBeVisible();
    }
  });

  test("background menu contains only pane-scoped actions", async ({
    page,
  }) => {
    const menu = await openBackgroundMenu(page);
    const items = await topLevelTexts(menu);
    for (const label of [
      "Paste",
      "New Folder",
      "New File",
      "Refresh",
      "Details View",
      "Current Folder Properties",
    ]) {
      expect(items).toContain(label);
    }
    expect(
      items.some(
        (text) => text === "Show Hidden Files" || text === "Hide Hidden Files",
      ),
    ).toBe(true);
    for (const label of ["Open", "Cut", "Copy", "Rename…", "Delete…"]) {
      expect(items.some((text) => text.startsWith(label))).toBe(false);
    }
  });

  test("closes when the backdrop is clicked", async ({ page }) => {
    const menu = await openFileMenu(page);
    await page.locator(".fo-menu-backdrop").click({ position: { x: 5, y: 5 } });
    await expect(menu).not.toBeVisible();
  });

  test("closes on Escape", async ({ page }) => {
    const menu = await openFileMenu(page);
    await page.keyboard.press("Escape");
    await expect(menu).not.toBeVisible();
  });
});
