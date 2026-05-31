import { expect, test } from "@playwright/test";

/**
 * E2E tests for the MenuBar rendering and interaction.
 *
 * MenuBar renders inside .fo-menubar-host within the TitleBar.
 * Each menu (File, Edit, View, Go, Tools, Window, Help) is a DropdownMenu
 * with triggerClassName="fo-menubar-trigger". Dropdowns are portalled to
 * <body> as .fo-menu-surface elements with role="menu".
 *
 * Keyboard: Alt+<mnemonic> opens a menu; ArrowLeft/Right navigates between
 * open menus; Escape closes. Menu items requiring IPC (file operations,
 * settings, exit, etc.) are skipped.
 */

const MENUBAR_SELECTOR = ".fo-menubar";
const TRIGGER_SELECTOR = ".fo-menubar-trigger";
const TRIGGER_INNER_SELECTOR = ".fo-menubar-trigger-inner";
const DROPDOWN_SELECTOR = ".fo-menu-surface";

const MENU_LABELS = [
  "File",
  "Edit",
  "View",
  "Go",
  "Tools",
  "Window",
  "Help",
] as const;

async function shellPress(page: import("@playwright/test").Page, key: string) {
  await page.locator(".fo-shell").press(key);
}

test.describe("MenuBar — rendering and structure", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-shell");
    await page.waitForSelector(MENUBAR_SELECTOR);
  });

  test("menubar container renders with .fo-menubar and role=menubar", async ({
    page,
  }) => {
    const menubar = page.locator(MENUBAR_SELECTOR);
    await expect(menubar).toBeVisible();
    await expect(menubar).toHaveAttribute("role", "menubar");
  });

  test("menubar has exactly 7 trigger buttons with .fo-menubar-trigger", async ({
    page,
  }) => {
    const triggers = page.locator(TRIGGER_SELECTOR);
    await expect(triggers).toHaveCount(7);
  });

  test("each trigger contains a .fo-menubar-trigger-inner span with role=menuitem", async ({
    page,
  }) => {
    const inners = page.locator(TRIGGER_INNER_SELECTOR);
    const count = await inners.count();
    expect(count).toBe(7);
    for (let i = 0; i < count; i++) {
      await expect(inners.nth(i)).toHaveAttribute("role", "menuitem");
    }
  });

  test("triggers have correct text labels in order", async ({ page }) => {
    const inners = page.locator(TRIGGER_INNER_SELECTOR);
    const texts = await inners.allTextContents();
    const trimmed = texts.map((t) => t.trim());
    expect(trimmed).toEqual([...MENU_LABELS]);
  });

  test("triggers have aria-haspopup=menu and aria-expanded=false when closed", async ({
    page,
  }) => {
    const triggers = page.locator(TRIGGER_SELECTOR);
    const count = await triggers.count();
    for (let i = 0; i < count; i++) {
      await expect(triggers.nth(i)).toHaveAttribute("aria-haspopup", "menu");
      await expect(triggers.nth(i)).toHaveAttribute("aria-expanded", "false");
    }
  });
});

test.describe("MenuBar — dropdown open/close", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-shell");
    await page.waitForSelector(MENUBAR_SELECTOR);
  });

  test("clicking File trigger opens a dropdown with .fo-menu-surface", async ({
    page,
  }) => {
    const fileTrigger = page.locator(TRIGGER_INNER_SELECTOR).first();
    await fileTrigger.click();
    const surface = page.locator(DROPDOWN_SELECTOR);
    await expect(surface).toBeVisible();
    await expect(surface).toHaveAttribute("role", "menu");
  });

  test("open dropdown has menu items (role=menuitem)", async ({ page }) => {
    const fileTrigger = page.locator(TRIGGER_INNER_SELECTOR).first();
    await fileTrigger.click();
    const items = page.locator(`${DROPDOWN_SELECTOR} [role="menuitem"]`);
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("File dropdown contains New Folder item", async ({ page }) => {
    const fileTrigger = page.locator(TRIGGER_INNER_SELECTOR).first();
    await fileTrigger.click();
    const label = page.locator(
      `${DROPDOWN_SELECTOR} [role="menuitem"] .fo-ui-dropdown-label`,
    );
    const texts = (await label.allTextContents()).map((t) => t.trim());
    const hasNewFolder = texts.some((t) => t.startsWith("New Folder"));
    expect(hasNewFolder).toBe(true);
  });

  test("Escape closes the open dropdown", async ({ page }) => {
    const fileTrigger = page.locator(TRIGGER_INNER_SELECTOR).first();
    await fileTrigger.click();
    await expect(page.locator(DROPDOWN_SELECTOR)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator(DROPDOWN_SELECTOR)).not.toBeVisible();
  });

  test("clicking outside the dropdown closes it", async ({ page }) => {
    const fileTrigger = page.locator(TRIGGER_INNER_SELECTOR).first();
    await fileTrigger.click();
    await expect(page.locator(DROPDOWN_SELECTOR)).toBeVisible();

    await page.locator("body").click({ position: { x: 5, y: 500 } });
    await expect(page.locator(DROPDOWN_SELECTOR)).not.toBeVisible();
  });
});

test.describe("MenuBar — keyboard navigation between triggers", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-shell");
    await page.waitForSelector(MENUBAR_SELECTOR);
  });

  test("ArrowRight moves focus from File dropdown to Edit dropdown", async ({
    page,
  }) => {
    const fileTrigger = page.locator(TRIGGER_SELECTOR).first();
    await fileTrigger.click();
    await expect(page.locator(DROPDOWN_SELECTOR)).toBeVisible();

    await page.keyboard.press("ArrowRight");
    const editTrigger = page.locator(TRIGGER_SELECTOR).nth(1);
    await expect(editTrigger).toHaveAttribute("aria-expanded", "true");
    await expect(fileTrigger).toHaveAttribute("aria-expanded", "false");
  });

  test("ArrowLeft wraps from File to Help dropdown", async ({ page }) => {
    const fileTrigger = page.locator(TRIGGER_SELECTOR).first();
    await fileTrigger.click();
    await expect(page.locator(DROPDOWN_SELECTOR)).toBeVisible();

    await page.keyboard.press("ArrowLeft");
    const helpTrigger = page.locator(TRIGGER_SELECTOR).last();
    await expect(helpTrigger).toHaveAttribute("aria-expanded", "true");
    await expect(fileTrigger).toHaveAttribute("aria-expanded", "false");
  });

  test("Alt+mnemonic opens the corresponding menu", async ({ page }) => {
    await shellPress(page, "Alt+f");
    const fileTrigger = page.locator(TRIGGER_SELECTOR).first();
    await expect(fileTrigger).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(DROPDOWN_SELECTOR)).toBeVisible();
  });
});

test.describe("MenuBar — Help menu and app menu triggers", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-shell");
    await page.waitForSelector(MENUBAR_SELECTOR);
  });

  test("Help trigger is the last trigger and opens help dropdown", async ({
    page,
  }) => {
    const helpTrigger = page.locator(TRIGGER_SELECTOR).last();
    const innerText = await helpTrigger
      .locator(TRIGGER_INNER_SELECTOR)
      .textContent();
    expect(innerText?.trim()).toBe("Help");

    await helpTrigger.click();
    await expect(page.locator(DROPDOWN_SELECTOR)).toBeVisible();

    const items = page.locator(
      `${DROPDOWN_SELECTOR} [role="menuitem"] .fo-ui-dropdown-label`,
    );
    const texts = (await items.allTextContents()).map((t) => t.trim());
    const hasAbout = texts.some((t) => t.includes("About FileOctopus"));
    expect(hasAbout).toBe(true);
  });

  test("Help dropdown contains Keyboard Shortcuts item", async ({ page }) => {
    const helpTrigger = page.locator(TRIGGER_SELECTOR).last();
    await helpTrigger.click();
    await expect(page.locator(DROPDOWN_SELECTOR)).toBeVisible();

    const labels = page.locator(
      `${DROPDOWN_SELECTOR} [role="menuitem"] .fo-ui-dropdown-label`,
    );
    const texts = (await labels.allTextContents()).map((t) => t.trim());
    const hasShortcuts = texts.some((t) => t.startsWith("Keyboard Shortcuts"));
    expect(hasShortcuts).toBe(true);
  });
});

test.describe("MenuBar — menu items requiring IPC (skipped)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-shell");
    await page.waitForSelector(MENUBAR_SELECTOR);
  });

  test.skip("clicking New Folder invokes IPC create-folder", async ({
    page,
  }) => {
    const fileTrigger = page.locator(TRIGGER_INNER_SELECTOR).first();
    await fileTrigger.click();
    await expect(page.locator(DROPDOWN_SELECTOR)).toBeVisible();

    const newItem = page.locator(`${DROPDOWN_SELECTOR} [role="menuitem"]`, {
      hasText: "New Folder",
    });
    await newItem.click();
    await expect(page.locator(DROPDOWN_SELECTOR)).not.toBeVisible();
  });

  test.skip("clicking Exit invokes IPC quit", async ({ page }) => {
    const fileTrigger = page.locator(TRIGGER_INNER_SELECTOR).first();
    await fileTrigger.click();
    await expect(page.locator(DROPDOWN_SELECTOR)).toBeVisible();

    const exitItem = page.locator(`${DROPDOWN_SELECTOR} [role="menuitem"]`, {
      hasText: "Exit",
    });
    await exitItem.click();
    await expect(page.locator(DROPDOWN_SELECTOR)).not.toBeVisible();
  });

  test.skip("clicking Settings in File menu invokes IPC settings", async ({
    page,
  }) => {
    const fileTrigger = page.locator(TRIGGER_INNER_SELECTOR).first();
    await fileTrigger.click();
    await expect(page.locator(DROPDOWN_SELECTOR)).toBeVisible();

    const settingsItem = page.locator(
      `${DROPDOWN_SELECTOR} [role="menuitem"]`,
      { hasText: "Settings" },
    );
    await settingsItem.click();
    await expect(page.locator(DROPDOWN_SELECTOR)).not.toBeVisible();
  });
});
