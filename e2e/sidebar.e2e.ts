import { expect, test } from "@playwright/test";

const SIDEBAR_SELECTOR = "aside.fo-sidebar";
const SIDEBAR_MENU_SELECTOR = ".fo-sidebar-context-menu";
const BACKDROP_SELECTOR = ".fo-sidebar-menu-backdrop";
const PINNED_SECTION = ".fo-sidebar-section";

test.describe("Sidebar context menu", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("sidebar is visible with sections", async ({ page }) => {
    const sidebar = page.locator(SIDEBAR_SELECTOR);
    await expect(sidebar).toBeVisible();

    const sections = sidebar.locator(PINNED_SECTION);
    const count = await sections.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("right-clicking a pinned/favorite entry shows context menu with 3 items", async ({
    page,
  }) => {
    const pinnedItems = page.locator(
      ".fo-sidebar-section >> text=Pinned >> .. >> .fo-sidebar-item",
    );
    const count = await pinnedItems.count();

    if (count === 0) {
      test.skip();
      return;
    }

    await pinnedItems.first().click({ button: "right" });

    const menu = page.locator(SIDEBAR_MENU_SELECTOR);
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute("role", "menu");

    const items = menu.locator('[role="menuitem"]');
    const texts = (await items.allTextContents()).map((t) => t.trim());

    expect(texts).toContain("Rename Favorite");
    expect(texts).toContain("Remove Favorite");
    expect(texts).toContain("Reveal Path");
  });

  test("clicking Remove Favorite removes the entry", async ({ page }) => {
    const section = page.locator(
      ".fo-sidebar-section:has(.fo-sidebar-section-title:text-is('Pinned'))",
    );
    let pinnedItems = section.locator(".fo-sidebar-item");
    const initialCount = await pinnedItems.count();

    if (initialCount === 0) {
      test.skip();
      return;
    }

    const targetItem = pinnedItems.first();
    const targetLabel = await targetItem.textContent();

    await targetItem.click({ button: "right" });

    const removeBtn = page.locator(
      `${SIDEBAR_MENU_SELECTOR} >> text=Remove Favorite`,
    );
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();

    const menu = page.locator(SIDEBAR_MENU_SELECTOR);
    await expect(menu).toHaveCount(0);

    pinnedItems = section.locator(".fo-sidebar-item");
    const afterCount = await pinnedItems.count();
    expect(afterCount).toBe(initialCount - 1);

    if (targetLabel) {
      const labels = (await pinnedItems.allTextContents()).map((t) => t.trim());
      expect(labels).not.toContain(targetLabel.trim());
    }
  });

  test("clicking Reveal Path triggers reveal without error", async ({
    page,
  }) => {
    const section = page.locator(
      ".fo-sidebar-section:has(.fo-sidebar-section-title:text-is('Pinned'))",
    );
    const pinnedItems = section.locator(".fo-sidebar-item");
    const count = await pinnedItems.count();

    if (count === 0) {
      test.skip();
      return;
    }

    await pinnedItems.first().click({ button: "right" });

    const revealBtn = page.locator(
      `${SIDEBAR_MENU_SELECTOR} >> text=Reveal Path`,
    );
    await expect(revealBtn).toBeVisible();
    await revealBtn.click();

    const menu = page.locator(SIDEBAR_MENU_SELECTOR);
    await expect(menu).toHaveCount(0);
  });

  test("clicking outside the context menu dismisses it", async ({ page }) => {
    const section = page.locator(
      ".fo-sidebar-section:has(.fo-sidebar-section-title:text-is('Pinned'))",
    );
    const pinnedItems = section.locator(".fo-sidebar-item");
    const count = await pinnedItems.count();

    if (count === 0) {
      test.skip();
      return;
    }

    await pinnedItems.first().click({ button: "right" });

    const menu = page.locator(SIDEBAR_MENU_SELECTOR);
    await expect(menu).toBeVisible();

    const backdrop = page.locator(BACKDROP_SELECTOR);
    await backdrop.click();

    await expect(menu).toHaveCount(0);
  });

  test("Rename Favorite shows inline text input", async ({ page }) => {
    const section = page.locator(
      ".fo-sidebar-section:has(.fo-sidebar-section-title:text-is('Pinned'))",
    );
    const pinnedItems = section.locator(".fo-sidebar-item");
    const count = await pinnedItems.count();

    if (count === 0) {
      test.skip();
      return;
    }

    await pinnedItems.first().click({ button: "right" });

    const renameBtn = page.locator(
      `${SIDEBAR_MENU_SELECTOR} >> text=Rename Favorite`,
    );
    await expect(renameBtn).toBeVisible();
    await renameBtn.click();

    const menu = page.locator(SIDEBAR_MENU_SELECTOR);
    await expect(menu).toHaveCount(0);

    const inlineInput = section.locator(".fo-sidebar-rename-input");
    await expect(inlineInput).toBeVisible();
  });
});
