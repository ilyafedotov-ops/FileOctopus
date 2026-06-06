import { expect, test } from "@playwright/test";

/**
 * E2E tests for the right-click context menu in FileOctopus.
 *
 * The ContextMenu component renders two different menu structures:
 *   - File entry menu: when right-clicking on a file/directory row
 *   - Pane background menu: when right-clicking on empty space
 *
 * The file entry menu has many items (Open, Cut, Copy, Paste, Pack/Unpack,
 * view modes, Sort submenu, etc.) while the pane background menu is simpler
 * (Paste, New Folder, New File, Refresh, Show/Hide Hidden, Properties).
 */

const MENU_SELECTOR = ".fo-context-menu";
const ITEM_SELECTOR = '[role="menuitem"]';
const SEPARATOR_SELECTOR = '[role="separator"]';
const BACKDROP_SELECTOR = ".fo-menu-backdrop";

test.describe("Context Menu", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  async function openContextMenuOnEmptySpace(
    page: import("@playwright/test").Page,
  ) {
    const tableShell = page.locator(".fo-table-shell").first();
    await tableShell.click({ button: "right" });
    await expect(page.locator(MENU_SELECTOR)).toBeVisible();
  }

  async function openContextMenuOnFileRow(
    page: import("@playwright/test").Page,
  ) {
    const fileRow = page
      .locator(
        ".fo-panel.fo-panel-active .fo-row[role='row']:not(.fo-row-parent)",
      )
      .first();
    const rowCount = await fileRow.count();

    if (rowCount > 0) {
      await fileRow.click({ button: "right" });
    } else {
      const tableShell = page.locator(".fo-table-shell").first();
      await tableShell.click({ button: "right" });
    }

    await expect(page.locator(MENU_SELECTOR)).toBeVisible();
  }

  async function getMenuItemTexts(
    page: import("@playwright/test").Page,
  ): Promise<string[]> {
    const items = page.locator(`${MENU_SELECTOR} ${ITEM_SELECTOR}`);
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

    const items = menu.locator(`> ${ITEM_SELECTOR}`);
    const itemCount = await items.count();
    expect(itemCount).toBeGreaterThan(0);

    for (let i = 0; i < itemCount; i++) {
      await expect(items.nth(i)).toHaveAttribute("role", "menuitem");
    }
  });

  test("separators have role=separator", async ({ page }) => {
    await openContextMenuOnFileRow(page);

    const separators = page.locator(`${MENU_SELECTOR} > ${SEPARATOR_SELECTOR}`);
    const sepCount = await separators.count();
    // The file entry menu renders at least 4 separators
    expect(sepCount).toBeGreaterThanOrEqual(4);

    for (let i = 0; i < sepCount; i++) {
      await expect(separators.nth(i)).toHaveAttribute("role", "separator");
    }
  });

  // ─── Menu item groups ─────────────────────────────────────────────

  test("contains Open item at top of menu", async ({ page }) => {
    await openContextMenuOnFileRow(page);

    const items = page.locator(`${MENU_SELECTOR} ${ITEM_SELECTOR}`);
    const firstItemText = await items.first().textContent();
    expect(firstItemText?.trim()).toBe("Open");
  });

  test("contains file action group: Open, Rename…", async ({ page }) => {
    await openContextMenuOnFileRow(page);

    const texts = await getMenuItemTexts(page);
    const trimmed = texts.map((t) => t.trim());

    expect(trimmed).toContain("Open");
    const hasRename = trimmed.some((t) => t.startsWith("Rename"));
    expect(hasRename).toBe(true);

    const openIdx = trimmed.indexOf("Open");
    const renameIdx = trimmed.findIndex((t) => t.startsWith("Rename"));
    expect(openIdx).toBeLessThan(renameIdx);
  });

  test("contains clipboard group: Cut, Copy, Paste", async ({ page }) => {
    await openContextMenuOnFileRow(page);

    const texts = await getMenuItemTexts(page);
    const trimmed = texts.map((t) => t.trim());

    expect(trimmed).toContain("Copy");
    expect(trimmed).toContain("Cut");
    // Paste may be "Paste" or "Paste Into Folder" depending on entry type
    const hasPaste = trimmed.some((t) => t.startsWith("Paste"));
    expect(hasPaste).toBe(true);

    // Cut, Copy, Paste appear in order (Cut before Copy)
    const copyIdx = trimmed.indexOf("Copy");
    const cutIdx = trimmed.indexOf("Cut");
    const pasteIdx = trimmed.findIndex((t) => t.startsWith("Paste"));
    expect(cutIdx).toBeLessThan(copyIdx);
    expect(copyIdx).toBeLessThan(pasteIdx);
  });

  test("contains create group: New Folder, New File", async ({ page }) => {
    await openContextMenuOnEmptySpace(page);

    const texts = await getMenuItemTexts(page);
    const trimmed = texts.map((t) => t.trim());

    expect(trimmed).toContain("New Folder");
    expect(trimmed).toContain("New File");

    expect(trimmed.indexOf("New Folder")).toBeLessThan(
      trimmed.indexOf("New File"),
    );
  });

  test("contains delete group: Delete…, Delete Permanently…", async ({
    page,
  }) => {
    await openContextMenuOnFileRow(page);

    const texts = await getMenuItemTexts(page);
    const trimmed = texts.map((t) => t.trim());

    const hasDefaultDelete = trimmed.some((t) => t.startsWith("Delete"));
    const hasPermanentDelete = trimmed.some((t) =>
      t.startsWith("Delete Permanently"),
    );
    const hasTrash = trimmed.some((t) => t.startsWith("Move to Trash"));
    expect(hasDefaultDelete).toBe(true);
    expect(hasPermanentDelete).toBe(true);
    expect(hasTrash).toBe(false);

    const defaultDeleteIdx = trimmed.findIndex(
      (t) => t.startsWith("Delete") && !t.startsWith("Delete Permanently"),
    );
    const permanentDeleteIdx = trimmed.findIndex((t) =>
      t.startsWith("Delete Permanently"),
    );
    expect(defaultDeleteIdx).toBeLessThan(permanentDeleteIdx);
  });

  test("contains info group: Copy Path, Copy Name, Properties…", async ({
    page,
  }) => {
    await openContextMenuOnFileRow(page);

    const texts = await getMenuItemTexts(page);
    const trimmed = texts.map((t) => t.trim());

    expect(trimmed).toContain("Copy Path");
    expect(trimmed).toContain("Copy Name");
    const hasProperties = trimmed.some((t) => t.startsWith("Properties"));
    expect(hasProperties).toBe(true);
  });

  test("contains additional tools: Reveal, Pack…, Unpack…, Open Terminal, Checksum…, Add Star", async ({
    page,
  }) => {
    await openContextMenuOnFileRow(page);

    const texts = await getMenuItemTexts(page);
    const trimmed = texts.map((t) => t.trim());

    const hasReveal = trimmed.some((t) => t.includes("Reveal"));
    expect(hasReveal).toBe(true);
    expect(trimmed).toContain("Pack…");
    expect(trimmed).toContain("Unpack…");
    expect(trimmed).toContain("Open Terminal");
    expect(trimmed).toContain("Checksum…");
    const hasStarItem =
      trimmed.includes("Add Star") || trimmed.includes("Remove Star");
    expect(hasStarItem).toBe(true);
  });

  test("contains Open With Default App or Open in Other Pane item", async ({
    page,
  }) => {
    await openContextMenuOnFileRow(page);

    const texts = await getMenuItemTexts(page);
    const trimmed = texts.map((t) => t.trim());

    // Directories show "Open in Other Pane", files show "Open With Default App"
    const hasOpenWith =
      trimmed.includes("Open With Default App") ||
      trimmed.includes("Open in Other Pane");
    expect(hasOpenWith).toBe(true);

    // Appears after Open
    const openIdx = trimmed.indexOf("Open");
    const openWithIdx = Math.max(
      trimmed.indexOf("Open With Default App"),
      trimmed.indexOf("Open in Other Pane"),
    );
    expect(openIdx).toBeLessThan(openWithIdx);
  });

  test("contains Copy To and Move To items", async ({ page }) => {
    await openContextMenuOnFileRow(page);

    const texts = await getMenuItemTexts(page);
    const trimmed = texts.map((t) => t.trim());

    expect(trimmed).toContain("Copy To…");
    expect(trimmed).toContain("Move To…");

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

    const copyNameIdx = trimmed.indexOf("Copy Name");
    const parentPathIdx = trimmed.indexOf("Copy Parent Folder Path");
    const uriIdx = trimmed.indexOf("Copy Resource URI");
    expect(copyNameIdx).toBeLessThan(parentPathIdx);
    expect(copyNameIdx).toBeLessThan(uriIdx);
  });

  test("contains view & selection group: Refresh, Select All, Clear Selection", async ({
    page,
  }) => {
    await openContextMenuOnFileRow(page);

    const texts = await getMenuItemTexts(page);
    const trimmed = texts.map((t) => t.trim());

    expect(trimmed).toContain("Refresh");
    expect(trimmed).toContain("Select All");
    expect(trimmed).toContain("Clear Selection");
  });

  test("pane background menu contains Refresh and Show Hidden Files", async ({
    page,
  }) => {
    await openContextMenuOnEmptySpace(page);

    const texts = await getMenuItemTexts(page);
    const trimmed = texts.map((t) => t.trim());

    expect(trimmed).toContain("Refresh");
    const hasHiddenToggle =
      trimmed.includes("Show Hidden Files") ||
      trimmed.includes("Hide Hidden Files");
    expect(hasHiddenToggle).toBe(true);
  });

  test("contains Clear Selection item in file entry menu", async ({ page }) => {
    await openContextMenuOnFileRow(page);

    const texts = await getMenuItemTexts(page);
    const trimmed = texts.map((t) => t.trim());

    expect(trimmed).toContain("Clear Selection");

    const selectAllIdx = trimmed.indexOf("Select All");
    const clearIdx = trimmed.indexOf("Clear Selection");
    expect(selectAllIdx).toBeLessThan(clearIdx);
  });

  test("contains view mode group: Details View, List View, Icon View, Columns View", async ({
    page,
  }) => {
    await openContextMenuOnFileRow(page);

    const texts = await getMenuItemTexts(page);
    const trimmed = texts.map((t) => t.trim());

    expect(trimmed).toContain("Details View");
    expect(trimmed).toContain("List View");
    expect(trimmed).toContain("Icon View");
    expect(trimmed).toContain("Columns View");

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
    await openContextMenuOnFileRow(page);

    const sortTrigger = page.locator(
      `${MENU_SELECTOR} > .fo-context-menu-item--submenu`,
      { hasText: "Sort by" },
    );
    await expect(sortTrigger).toBeVisible();
    await expect(sortTrigger).toHaveAttribute("role", "menuitem");
    await expect(sortTrigger).toContainText("Sort by");
  });

  test("Sort by… submenu has nested role=menu with sort options", async ({
    page,
  }) => {
    await openContextMenuOnFileRow(page);

    // Hover Sort by… to reveal the nested submenu
    const sortTrigger = page.locator(
      `${MENU_SELECTOR} > .fo-context-menu-item--submenu`,
      { hasText: "Sort by" },
    );
    await sortTrigger.hover();
    await page.waitForTimeout(300);

    const submenu = sortTrigger.locator(".fo-context-submenu");
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
    await openContextMenuOnFileRow(page);

    // Hover Sort by… to reveal the nested submenu
    const sortTrigger = page.locator(
      `${MENU_SELECTOR} > .fo-context-menu-item--submenu`,
      { hasText: "Sort by" },
    );
    await sortTrigger.hover();
    await page.waitForTimeout(300);

    const submenu = sortTrigger.locator(".fo-context-submenu");
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

    const menu = page.locator(MENU_SELECTOR);
    const children = menu.locator("> *");
    const childCount = await children.count();

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
    const hasRename = itemTexts.some((t) => t.startsWith("Rename"));
    expect(hasRename).toBe(true);
    expect(itemTexts).toContain("Copy");
    expect(itemTexts).toContain("Cut");
    // Paste may be "Paste" or "Paste Into Folder"
    const hasPaste = itemTexts.some((t) => t.startsWith("Paste"));
    expect(hasPaste).toBe(true);
    expect(itemTexts).toContain("Refresh");
    expect(itemTexts).toContain("Select All");
  });

  // ─── Pane background menu ──────────────────────────────────────

  test("file-only actions are not present in pane background menu", async ({
    page,
  }) => {
    await openContextMenuOnEmptySpace(page);

    const menu = page.locator(MENU_SELECTOR);
    const itemTexts = (await menu.locator(ITEM_SELECTOR).allTextContents()).map(
      (t) => t.trim(),
    );

    // File-only items should NOT appear in the pane background menu
    expect(itemTexts).not.toContain("Open");
    expect(itemTexts).not.toContain("Cut");
    expect(itemTexts).not.toContain("Copy");
  });

  test("always-enabled actions are present in pane background menu", async ({
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

    // These items should always be enabled in the pane background menu
    expect(enabledTexts).toContain("New Folder");
    expect(enabledTexts).toContain("New File");
    expect(enabledTexts).toContain("Refresh");
  });

  test("context menu closes when clicking the backdrop", async ({ page }) => {
    await openContextMenuOnFileRow(page);
    await expect(page.locator(MENU_SELECTOR)).toBeVisible();

    await page.locator(BACKDROP_SELECTOR).click({ position: { x: 5, y: 5 } });
    await expect(page.locator(MENU_SELECTOR)).not.toBeVisible();
  });

  test("context menu closes on Escape key", async ({ page }) => {
    await openContextMenuOnFileRow(page);
    await expect(page.locator(MENU_SELECTOR)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator(MENU_SELECTOR)).not.toBeVisible();
  });
});
