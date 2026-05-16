import { expect, test } from "@playwright/test";

/**
 * E2E tests for the right-click context menu in FileOctopus.
 *
 * The ContextMenu component renders a single unified menu structure.
 * Items are disabled (but still visible) when the menu is triggered from
 * empty space rather than from a file/folder row. This test suite verifies:
 *   - Menu visibility and ARIA roles
 *   - Item groups and separator positions
 *   - Disabled state for file-only actions when invoked from empty space
 *   - Submenu structure (Sort by…)
 */

const MENU_SELECTOR = ".fo-context-menu";
const ITEM_SELECTOR = '[role="menuitem"]';
const SEPARATOR_SELECTOR = '[role="separator"]';
const BACKDROP_SELECTOR = ".fo-menu-backdrop";
const SORT_SUBMENU_SELECTOR = ".fo-context-submenu";

test.describe("Context Menu", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for the app shell to render
    await page.waitForSelector(".fo-panel");
  });

  /**
   * Helper: open context menu by right-clicking on empty space in a panel.
   * The FileTable shell (`.fo-table-shell`) handles onContextMenu with null entry.
   */
  async function openContextMenuOnEmptySpace(
    page: import("@playwright/test").Page,
  ) {
    const tableShell = page.locator(".fo-table-shell").first();
    await tableShell.click({ button: "right" });
    await expect(page.locator(MENU_SELECTOR)).toBeVisible();
  }

  /**
   * Helper: open context menu by right-clicking on a file row.
   * If no file rows exist (empty directory), falls back to empty-space click.
   */
  async function openContextMenuOnFileRow(
    page: import("@playwright/test").Page,
  ) {
    const fileRow = page.locator('.fo-row[role="row"]').first();
    const rowCount = await fileRow.count();

    if (rowCount > 0) {
      await fileRow.click({ button: "right" });
    } else {
      // No rows visible — click empty space; file actions will be disabled
      const tableShell = page.locator(".fo-table-shell").first();
      await tableShell.click({ button: "right" });
    }

    await expect(page.locator(MENU_SELECTOR)).toBeVisible();
  }

  /**
   * Helper: get all visible menu item texts in order (excluding sort submenu items).
   */
  async function getMenuItemTexts(
    page: import("@playwright/test").Page,
  ): Promise<string[]> {
    const items = page.locator(`${MENU_SELECTOR} > ${ITEM_SELECTOR}`);
    return items.allTextContents();
  }

  test("context menu appears on right-click on empty space", async ({
    page,
  }) => {
    await openContextMenuOnEmptySpace(page);

    const menu = page.locator(MENU_SELECTOR);
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute("role", "menu");
  });

  test("context menu appears on right-click on file row", async ({ page }) => {
    await openContextMenuOnFileRow(page);

    const menu = page.locator(MENU_SELECTOR);
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute("role", "menu");
  });

  test("menu has correct ARIA structure: role=menu with menuitem children", async ({
    page,
  }) => {
    await openContextMenuOnEmptySpace(page);

    const menu = page.locator(MENU_SELECTOR);
    await expect(menu).toHaveAttribute("role", "menu");

    // Verify menu items have role="menuitem"
    const items = menu.locator(`> ${ITEM_SELECTOR}`);
    const itemCount = await items.count();
    expect(itemCount).toBeGreaterThan(0);

    // Each direct child button should have role="menuitem"
    for (let i = 0; i < itemCount; i++) {
      await expect(items.nth(i)).toHaveAttribute("role", "menuitem");
    }
  });

  test("separators have role=separator", async ({ page }) => {
    await openContextMenuOnEmptySpace(page);

    const separators = page.locator(`${MENU_SELECTOR} > ${SEPARATOR_SELECTOR}`);
    const sepCount = await separators.count();
    // The component renders at least 5 separators
    expect(sepCount).toBeGreaterThanOrEqual(5);

    for (let i = 0; i < sepCount; i++) {
      await expect(separators.nth(i)).toHaveAttribute("role", "separator");
    }
  });

  // ─── Menu item groups ─────────────────────────────────────────────

  test("contains Open item at top of menu", async ({ page }) => {
    await openContextMenuOnFileRow(page);

    const items = page.locator(`${MENU_SELECTOR} > ${ITEM_SELECTOR}`);
    const firstItemText = await items.first().textContent();
    expect(firstItemText?.trim()).toBe("Open");
  });

  test("contains file action group: Open, Rename", async ({ page }) => {
    await openContextMenuOnFileRow(page);

    const texts = await getMenuItemTexts(page);
    const trimmed = texts.map((t) => t.trim());

    expect(trimmed).toContain("Open");
    expect(trimmed).toContain("Rename");

    // Open comes before Rename
    expect(trimmed.indexOf("Open")).toBeLessThan(trimmed.indexOf("Rename"));
  });

  test("contains clipboard group: Copy, Cut, Paste", async ({ page }) => {
    await openContextMenuOnFileRow(page);

    const texts = await getMenuItemTexts(page);
    const trimmed = texts.map((t) => t.trim());

    expect(trimmed).toContain("Copy");
    expect(trimmed).toContain("Cut");
    expect(trimmed).toContain("Paste");

    // Copy, Cut, Paste appear in order
    const copyIdx = trimmed.indexOf("Copy");
    const cutIdx = trimmed.indexOf("Cut");
    const pasteIdx = trimmed.indexOf("Paste");
    expect(copyIdx).toBeLessThan(cutIdx);
    expect(cutIdx).toBeLessThan(pasteIdx);
  });

  test("contains create group: New Folder, New File", async ({ page }) => {
    await openContextMenuOnEmptySpace(page);

    const texts = await getMenuItemTexts(page);
    const trimmed = texts.map((t) => t.trim());

    expect(trimmed).toContain("New Folder");
    expect(trimmed).toContain("New File");

    // New Folder comes before New File
    expect(trimmed.indexOf("New Folder")).toBeLessThan(
      trimmed.indexOf("New File"),
    );
  });

  test("contains delete group: Move to Trash, Delete Permanently", async ({
    page,
  }) => {
    await openContextMenuOnFileRow(page);

    const texts = await getMenuItemTexts(page);
    const trimmed = texts.map((t) => t.trim());

    expect(trimmed).toContain("Move to Trash");
    expect(trimmed).toContain("Delete Permanently");

    expect(trimmed.indexOf("Move to Trash")).toBeLessThan(
      trimmed.indexOf("Delete Permanently"),
    );
  });

  test("contains info group: Copy Path, Copy Name, Properties", async ({
    page,
  }) => {
    await openContextMenuOnFileRow(page);

    const texts = await getMenuItemTexts(page);
    const trimmed = texts.map((t) => t.trim());

    expect(trimmed).toContain("Copy Path");
    expect(trimmed).toContain("Copy Name");
    expect(trimmed).toContain("Properties");
  });

  test("contains additional tools: Reveal, Compress…, Extract…, Open Terminal, Checksum…, Add Star", async ({
    page,
  }) => {
    await openContextMenuOnFileRow(page);

    const texts = await getMenuItemTexts(page);
    const trimmed = texts.map((t) => t.trim());

    expect(trimmed).toContain("Reveal");
    expect(trimmed).toContain("Compress…");
    expect(trimmed).toContain("Extract…");
    expect(trimmed).toContain("Open Terminal");
    expect(trimmed).toContain("Checksum…");
    // Star label depends on isStarred state — accept either
    const hasStarItem =
      trimmed.includes("Add Star") || trimmed.includes("Remove Star");
    expect(hasStarItem).toBe(true);
  });

  test("contains Open With Default App item", async ({ page }) => {
    await openContextMenuOnFileRow(page);

    const texts = await getMenuItemTexts(page);
    const trimmed = texts.map((t) => t.trim());

    expect(trimmed).toContain("Open With Default App");

    // Open With Default App appears after Open
    const openIdx = trimmed.indexOf("Open");
    const openWithIdx = trimmed.indexOf("Open With Default App");
    expect(openIdx).toBeLessThan(openWithIdx);
  });

  test("contains Copy To and Move To items", async ({ page }) => {
    await openContextMenuOnFileRow(page);

    const texts = await getMenuItemTexts(page);
    const trimmed = texts.map((t) => t.trim());

    expect(trimmed).toContain("Copy To…");
    expect(trimmed).toContain("Move To…");

    // Copy To comes before Move To
    expect(trimmed.indexOf("Copy To…")).toBeLessThan(
      trimmed.indexOf("Move To…"),
    );
  });

  test("contains Copy Parent Folder Path and Copy Resource URI", async ({
    page,
  }) => {
    await openContextMenuOnFileRow(page);

    const texts = await getMenuItemTexts(page);
    const trimmed = texts.map((t) => t.trim());

    expect(trimmed).toContain("Copy Parent Folder Path");
    expect(trimmed).toContain("Copy Resource URI");

    // Both appear after Copy Name
    const copyNameIdx = trimmed.indexOf("Copy Name");
    const parentPathIdx = trimmed.indexOf("Copy Parent Folder Path");
    const uriIdx = trimmed.indexOf("Copy Resource URI");
    expect(copyNameIdx).toBeLessThan(parentPathIdx);
    expect(copyNameIdx).toBeLessThan(uriIdx);
  });

  test("contains view & selection group: Refresh, Show Hidden Files, Select All", async ({
    page,
  }) => {
    await openContextMenuOnEmptySpace(page);

    const texts = await getMenuItemTexts(page);
    const trimmed = texts.map((t) => t.trim());

    expect(trimmed).toContain("Refresh");
    // Label toggles between "Show Hidden Files" and "Hide Hidden Files"
    const hasHiddenToggle =
      trimmed.includes("Show Hidden Files") ||
      trimmed.includes("Hide Hidden Files");
    expect(hasHiddenToggle).toBe(true);
    expect(trimmed).toContain("Select All");
  });

  test("contains Clear Selection item", async ({ page }) => {
    await openContextMenuOnEmptySpace(page);

    const texts = await getMenuItemTexts(page);
    const trimmed = texts.map((t) => t.trim());

    expect(trimmed).toContain("Clear Selection");

    // Clear Selection appears after Select All
    const selectAllIdx = trimmed.indexOf("Select All");
    const clearIdx = trimmed.indexOf("Clear Selection");
    expect(selectAllIdx).toBeLessThan(clearIdx);
  });

  test("contains view mode group: Details View, List View, Icon View, Columns View", async ({
    page,
  }) => {
    await openContextMenuOnEmptySpace(page);

    const texts = await getMenuItemTexts(page);
    const trimmed = texts.map((t) => t.trim());

    expect(trimmed).toContain("Details View");
    expect(trimmed).toContain("List View");
    expect(trimmed).toContain("Icon View");
    expect(trimmed).toContain("Columns View");

    // View modes appear in this order
    const detailsIdx = trimmed.indexOf("Details View");
    const listIdx = trimmed.indexOf("List View");
    const iconIdx = trimmed.indexOf("Icon View");
    const columnsIdx = trimmed.indexOf("Columns View");
    expect(detailsIdx).toBeLessThan(listIdx);
    expect(listIdx).toBeLessThan(iconIdx);
    expect(iconIdx).toBeLessThan(columnsIdx);
  });

  // ─── Sort submenu ───────────────────────────────────────────────

  test("contains Sort by… submenu trigger item", async ({ page }) => {
    await openContextMenuOnEmptySpace(page);

    const sortTrigger = page.locator(
      `${MENU_SELECTOR} > .fo-context-menu-item--submenu`,
    );
    await expect(sortTrigger).toBeVisible();
    await expect(sortTrigger).toHaveAttribute("role", "menuitem");
    await expect(sortTrigger).toContainText("Sort by…");
  });

  test("Sort by… submenu has nested role=menu with sort options", async ({
    page,
  }) => {
    await openContextMenuOnEmptySpace(page);

    const submenu = page.locator(SORT_SUBMENU_SELECTOR);
    await expect(submenu).toHaveAttribute("role", "menu");

    const submenuItems = submenu.locator(ITEM_SELECTOR);
    const submenuTexts = await submenuItems.allTextContents();
    const trimmed = submenuTexts.map((t) => t.trim());

    expect(trimmed).toContain("Name");
    expect(trimmed).toContain("Modified");
    expect(trimmed).toContain("Size");
    expect(trimmed).toContain("Type");
    expect(trimmed).toContain("Created");
    expect(trimmed).toContain("Extension");
  });

  test("Sort submenu items appear in expected order", async ({ page }) => {
    await openContextMenuOnEmptySpace(page);

    const submenu = page.locator(SORT_SUBMENU_SELECTOR);
    const submenuItems = submenu.locator(ITEM_SELECTOR);
    const submenuTexts = (await submenuItems.allTextContents()).map((t) =>
      t.trim(),
    );

    expect(submenuTexts).toEqual([
      "Name",
      "Modified",
      "Size",
      "Type",
      "Created",
      "Extension",
    ]);
  });

  // ─── Item group ordering with separators ───────────────────────

  test("menu items are divided by separators into logical groups", async ({
    page,
  }) => {
    await openContextMenuOnFileRow(page);

    // Collect the children of the menu in DOM order
    const menu = page.locator(MENU_SELECTOR);
    const children = menu.locator("> *");
    const childCount = await children.count();

    // Build an array of { type: "item"|"separator", text? }
    const structure: Array<{ type: string; text?: string }> = [];
    for (let i = 0; i < childCount; i++) {
      const child = children.nth(i);
      const role = await child.getAttribute("role");
      if (role === "separator") {
        structure.push({ type: "separator" });
      } else if (role === "menuitem") {
        const text = (await child.textContent())?.trim() ?? "";
        structure.push({ type: "item", text });
      }
    }

    // Verify separator positions between groups
    // Group 1: Open, Rename
    // Sep
    // Group 2: Copy, Cut, Paste
    // Sep
    // Group 3: New Folder, New File
    // Sep
    // Group 4: Move to Trash, Delete Permanently
    // Sep
    // Group 5: Copy Path, Copy Name, Properties, Reveal, Compress…, Extract…, Open Terminal, Checksum…, Add/Remove Star
    // Sep
    // Group 6: Refresh, Show/Hide Hidden Files, Select All
    // Sep
    // Group 7: Details View, List View, Icon View, Columns View
    // Sep
    // Group 8: Sort by…

    // Verify no two separators are adjacent
    for (let i = 1; i < structure.length; i++) {
      if (structure[i - 1].type === "separator") {
        expect(structure[i].type).not.toBe("separator");
      }
    }

    // Verify first child is an item (not separator) and last child is an item
    expect(structure[0].type).toBe("item");
    expect(structure[structure.length - 1].type).toBe("item");

    // Verify key items are present
    const itemTexts = structure
      .filter((s) => s.type === "item")
      .map((s) => s.text!);
    expect(itemTexts).toContain("Open");
    expect(itemTexts).toContain("Rename");
    expect(itemTexts).toContain("Copy");
    expect(itemTexts).toContain("Cut");
    expect(itemTexts).toContain("Paste");
    expect(itemTexts).toContain("New Folder");
    expect(itemTexts).toContain("New File");
    expect(itemTexts).toContain("Move to Trash");
    expect(itemTexts).toContain("Delete Permanently");
    expect(itemTexts).toContain("Properties");
    expect(itemTexts).toContain("Refresh");
    expect(itemTexts).toContain("Select All");
  });

  // ─── Disabled state for empty-space context menu ───────────────

  test("file-only actions are disabled when menu opened from empty space", async ({
    page,
  }) => {
    await openContextMenuOnEmptySpace(page);

    const menu = page.locator(MENU_SELECTOR);
    const disabledItems = menu.locator(
      `${ITEM_SELECTOR}:not(.fo-context-menu-item--submenu)[disabled]`,
    );
    const disabledTexts = (await disabledItems.allTextContents()).map((t) =>
      t.trim(),
    );

    // These items should be disabled when no file entry is selected
    expect(disabledTexts).toContain("Open");
    expect(disabledTexts).toContain("Open With Default App");
    expect(disabledTexts).toContain("Rename");
    expect(disabledTexts).toContain("Copy To…");
    expect(disabledTexts).toContain("Move To…");
    expect(disabledTexts).toContain("Copy");
    expect(disabledTexts).toContain("Cut");
    expect(disabledTexts).toContain("Move to Trash");
    expect(disabledTexts).toContain("Delete Permanently");
    expect(disabledTexts).toContain("Copy Path");
    expect(disabledTexts).toContain("Copy Name");
    expect(disabledTexts).toContain("Copy Parent Folder Path");
    expect(disabledTexts).toContain("Copy Resource URI");
    expect(disabledTexts).toContain("Properties");
    expect(disabledTexts).toContain("Reveal");
    expect(disabledTexts).toContain("Compress…");
    expect(disabledTexts).toContain("Extract…");
    expect(disabledTexts).toContain("Checksum…");
  });

  test("always-enabled actions are not disabled when menu opened from empty space", async ({
    page,
  }) => {
    await openContextMenuOnEmptySpace(page);

    const menu = page.locator(MENU_SELECTOR);
    const enabledItems = menu.locator(
      `${ITEM_SELECTOR}:not(.fo-context-menu-item--submenu):not([disabled])`,
    );
    const enabledTexts = (await enabledItems.allTextContents()).map((t) =>
      t.trim(),
    );

    // These items are always enabled
    expect(enabledTexts).toContain("New Folder");
    expect(enabledTexts).toContain("New File");
    expect(enabledTexts).toContain("Open Terminal");
    expect(enabledTexts).toContain("Refresh");
    expect(enabledTexts).toContain("Select All");
    expect(enabledTexts).toContain("Clear Selection");
    expect(enabledTexts).toContain("Details View");
    expect(enabledTexts).toContain("List View");
    expect(enabledTexts).toContain("Icon View");
    expect(enabledTexts).toContain("Columns View");
  });

  // ─── Menu dismissal ────────────────────────────────────────────

  test("context menu closes when clicking the backdrop", async ({ page }) => {
    await openContextMenuOnEmptySpace(page);

    const backdrop = page.locator(BACKDROP_SELECTOR);
    await expect(backdrop).toBeVisible();
    await backdrop.click();

    await expect(page.locator(MENU_SELECTOR)).not.toBeVisible();
  });

  test("context menu closes on Escape key", async ({ page }) => {
    await openContextMenuOnEmptySpace(page);
    await expect(page.locator(MENU_SELECTOR)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator(MENU_SELECTOR)).not.toBeVisible();
  });
});
