import { expect, test } from "@playwright/test";

/**
 * E2E tests for the sidebar context menu on pinned/favorite entries.
 *
 * The sidebar renders a "Pinned" section when favorites exist.
 * Right-clicking a favorite entry shows a context menu with 3 items:
 *   - Rename Favorite
 *   - Remove Favorite
 *   - Reveal Path
 */

const SIDEBAR_SELECTOR = "aside.fo-sidebar";
const PINNED_SECTION_SELECTOR = ".fo-sidebar-section";
const FAVORITE_ITEM_SELECTOR = ".fo-sidebar-item";
const CONTEXT_MENU_SELECTOR = ".fo-sidebar-context-menu";
const BACKDROP_SELECTOR = ".fo-sidebar-menu-backdrop";
const RENAME_INPUT_SELECTOR = ".fo-sidebar-rename-input";
const MENU_ITEM_SELECTOR = '[role="menuitem"]';

test.describe("Sidebar context menu", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("sidebar is visible with sections", async ({ page }) => {
    const sidebar = page.locator(SIDEBAR_SELECTOR);
    await expect(sidebar).toBeVisible();

    const sections = sidebar.locator(PINNED_SECTION_SELECTOR);
    const count = await sections.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("right-click on favorite shows context menu with 3 items", async ({
    page,
  }) => {
    // Check if Pinned section with favorites exists
    const sidebar = page.locator(SIDEBAR_SELECTOR);
    const pinnedHeader = sidebar.locator(
      '.fo-sidebar-section-title:text-is("Pinned")',
    );
    const pinnedCount = await pinnedHeader.count();
    test.skip(
      pinnedCount === 0,
      "No Pinned section visible — no favorites to test",
    );

    const favoriteItems = sidebar
      .locator(".fo-sidebar-section")
      .filter({ hasText: "Pinned" })
      .locator(FAVORITE_ITEM_SELECTOR);
    const count = await favoriteItems.count();
    test.skip(count === 0, "No favorite items to right-click");

    // Right-click the first favorite
    await favoriteItems.first().click({ button: "right" });

    // Context menu should appear
    const contextMenu = page.locator(CONTEXT_MENU_SELECTOR);
    await expect(contextMenu).toBeVisible();
    await expect(contextMenu).toHaveAttribute("role", "menu");

    // Should have exactly 3 menu items
    const items = contextMenu.locator(`> ${MENU_ITEM_SELECTOR}`);
    await expect(items).toHaveCount(3);

    // Verify the 3 expected items
    const texts = (await items.allTextContents()).map((t) => t.trim());
    expect(texts).toContain("Rename Favorite");
    expect(texts).toContain("Remove Favorite");
    expect(texts).toContain("Reveal Path");
  });

  test("clicking Remove Favorite removes the entry", async ({ page }) => {
    const sidebar = page.locator(SIDEBAR_SELECTOR);
    const pinnedHeader = sidebar.locator(
      '.fo-sidebar-section-title:text-is("Pinned")',
    );
    const pinnedCount = await pinnedHeader.count();
    test.skip(
      pinnedCount === 0,
      "No Pinned section visible — no favorites to test",
    );

    const pinnedSection = sidebar
      .locator(".fo-sidebar-section")
      .filter({ hasText: "Pinned" });
    const favoriteItems = pinnedSection.locator(FAVORITE_ITEM_SELECTOR);
    const count = await favoriteItems.count();
    test.skip(count === 0, "No favorite items to remove");

    const initialCount = count;
    const firstItemText = await favoriteItems.first().textContent();

    // Right-click first favorite
    await favoriteItems.first().click({ button: "right" });

    // Click "Remove Favorite"
    const removeButton = page
      .locator(CONTEXT_MENU_SELECTOR)
      .locator(`${MENU_ITEM_SELECTOR}:has-text("Remove Favorite")`);
    await expect(removeButton).toBeVisible();
    await removeButton.click();

    // Menu should close
    await expect(page.locator(CONTEXT_MENU_SELECTOR)).not.toBeVisible();

    // Wait a moment for the async operation to complete
    await page.waitForTimeout(500);

    // Re-check pinned items count — should be one fewer
    const newCount = await pinnedSection
      .locator(FAVORITE_ITEM_SELECTOR)
      .count();
    expect(newCount).toBe(initialCount - 1);

    // Verify the removed item is gone
    if (firstItemText) {
      const remaining = await pinnedSection
        .locator(FAVORITE_ITEM_SELECTOR)
        .allTextContents();
      const remainingTrimmed = remaining.map((t) => t.trim());
      // The first item should no longer be present
      expect(remainingTrimmed).not.toContain(firstItemText.trim());
    }
  });

  test("clicking Reveal Path does not throw error", async ({ page }) => {
    const sidebar = page.locator(SIDEBAR_SELECTOR);
    const pinnedHeader = sidebar.locator(
      '.fo-sidebar-section-title:text-is("Pinned")',
    );
    const pinnedCount = await pinnedHeader.count();
    test.skip(
      pinnedCount === 0,
      "No Pinned section visible — no favorites to test",
    );

    const favoriteItems = sidebar
      .locator(".fo-sidebar-section")
      .filter({ hasText: "Pinned" })
      .locator(FAVORITE_ITEM_SELECTOR);
    const count = await favoriteItems.count();
    test.skip(count === 0, "No favorite items to test reveal on");

    // Right-click first favorite
    await favoriteItems.first().click({ button: "right" });

    // Click "Reveal Path" — the IPC call will fail in test environment
    // but we verify no unhandled error crashes the page
    const revealButton = page
      .locator(CONTEXT_MENU_SELECTOR)
      .locator(`${MENU_ITEM_SELECTOR}:has-text("Reveal Path")`);
    await expect(revealButton).toBeVisible();
    await revealButton.click();

    // Menu should close
    await expect(page.locator(CONTEXT_MENU_SELECTOR)).not.toBeVisible();

    // Page should still be functional (no crash)
    await expect(page.locator(SIDEBAR_SELECTOR)).toBeVisible();
  });

  test("clicking Rename Favorite shows inline rename input", async ({
    page,
  }) => {
    const sidebar = page.locator(SIDEBAR_SELECTOR);
    const pinnedHeader = sidebar.locator(
      '.fo-sidebar-section-title:text-is("Pinned")',
    );
    const pinnedCount = await pinnedHeader.count();
    test.skip(
      pinnedCount === 0,
      "No Pinned section visible — no favorites to test",
    );

    const favoriteItems = sidebar
      .locator(".fo-sidebar-section")
      .filter({ hasText: "Pinned" })
      .locator(FAVORITE_ITEM_SELECTOR);
    const count = await favoriteItems.count();
    test.skip(count === 0, "No favorite items to rename");

    // Right-click first favorite
    await favoriteItems.first().click({ button: "right" });

    // Click "Rename Favorite"
    const renameButton = page
      .locator(CONTEXT_MENU_SELECTOR)
      .locator(`${MENU_ITEM_SELECTOR}:has-text("Rename Favorite")`);
    await expect(renameButton).toBeVisible();
    await renameButton.click();

    // Menu should close
    await expect(page.locator(CONTEXT_MENU_SELECTOR)).not.toBeVisible();

    // Inline rename input should appear in the Pinned section
    const renameInput = sidebar.locator(RENAME_INPUT_SELECTOR);
    await expect(renameInput).toBeVisible();

    // Input should be focused and have the current label as value
    await expect(renameInput).toBeFocused();
    const inputValue = await renameInput.inputValue();
    expect(inputValue.length).toBeGreaterThan(0);
  });

  test("backdrop click dismisses context menu", async ({ page }) => {
    const sidebar = page.locator(SIDEBAR_SELECTOR);
    const pinnedHeader = sidebar.locator(
      '.fo-sidebar-section-title:text-is("Pinned")',
    );
    const pinnedCount = await pinnedHeader.count();
    test.skip(
      pinnedCount === 0,
      "No Pinned section visible — no favorites to test",
    );

    const favoriteItems = sidebar
      .locator(".fo-sidebar-section")
      .filter({ hasText: "Pinned" })
      .locator(FAVORITE_ITEM_SELECTOR);
    const count = await favoriteItems.count();
    test.skip(count === 0, "No favorite items to test");

    // Right-click first favorite
    await favoriteItems.first().click({ button: "right" });
    await expect(page.locator(CONTEXT_MENU_SELECTOR)).toBeVisible();

    // Click backdrop to dismiss
    await page.locator(BACKDROP_SELECTOR).click();
    await expect(page.locator(CONTEXT_MENU_SELECTOR)).not.toBeVisible();
  });

  test("Escape key dismisses context menu", async ({ page }) => {
    const sidebar = page.locator(SIDEBAR_SELECTOR);
    const pinnedHeader = sidebar.locator(
      '.fo-sidebar-section-title:text-is("Pinned")',
    );
    const pinnedCount = await pinnedHeader.count();
    test.skip(
      pinnedCount === 0,
      "No Pinned section visible — no favorites to test",
    );

    const favoriteItems = sidebar
      .locator(".fo-sidebar-section")
      .filter({ hasText: "Pinned" })
      .locator(FAVORITE_ITEM_SELECTOR);
    const count = await favoriteItems.count();
    test.skip(count === 0, "No favorite items to test");

    // Right-click first favorite
    await favoriteItems.first().click({ button: "right" });
    await expect(page.locator(CONTEXT_MENU_SELECTOR)).toBeVisible();

    // Press Escape to dismiss
    await page.locator(".fo-shell").press("Escape");
    await expect(page.locator(CONTEXT_MENU_SELECTOR)).not.toBeVisible();
  });
});
