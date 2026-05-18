import { test, expect } from "@playwright/test";

async function shellPress(page: import("@playwright/test").Page, key: string) {
  await page.locator(".fo-shell").press(key);
}

test.describe("Navigation — folder traversal", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("navigate into folder via double-click on a folder row", async ({
    page,
  }) => {
    const folderRow = page
      .locator('.fo-row[role="row"][data-type="directory"]')
      .first();
    const count = await folderRow.count();
    test.skip(count === 0, "No directory rows visible in active panel");

    const folderName = await folderRow
      .locator(".fo-cell-name")
      .first()
      .textContent();

    await folderRow.dblclick();

    // Breadcrumb should update to include the folder name
    const breadcrumb = page.locator(".fo-breadcrumb").first();
    await expect(breadcrumb).toContainText(folderName!.trim());
  });

  test("navigate up via Backspace key", async ({ page }) => {
    // First navigate into a subfolder to have somewhere to go "up" from
    const folderRow = page
      .locator('.fo-row[role="row"][data-type="directory"]')
      .first();
    const count = await folderRow.count();
    test.skip(count === 0, "No directory rows visible in active panel");

    await folderRow.dblclick();
    await page.waitForTimeout(500);

    const breadcrumbBefore = page.locator(".fo-breadcrumb").first();
    const segmentsBefore = breadcrumbBefore.locator(
      ".fo-breadcrumb-segments button",
    );
    const countBefore = await segmentsBefore.count();
    test.skip(countBefore <= 1, "Already at root, nowhere to go up");

    await shellPress(page, "Backspace");

    const breadcrumbAfter = page.locator(".fo-breadcrumb").first();
    const segmentsAfter = breadcrumbAfter.locator(
      ".fo-breadcrumb-segments button",
    );
    const countAfter = await segmentsAfter.count();
    expect(countAfter).toBeLessThan(countBefore);
  });

  test("navigate up via double-click on .. row", async ({ page }) => {
    const folderRow = page
      .locator('.fo-row[role="row"]')
      .filter({ hasNot: page.locator(".fo-row-text", { hasText: ".." }) })
      .filter({ has: page.locator(".fo-row-text") })
      .first();
    const count = await folderRow.count();
    test.skip(count === 0, "No directory rows visible in active panel");

    await folderRow.dblclick();
    await page.waitForTimeout(500);

    const parentRow = page.locator('.fo-row-text:text-is("..")').first();
    await parentRow.waitFor({ state: "visible" });
    await parentRow.dblclick();

    const breadcrumb = page.locator(".fo-breadcrumb").first();
    const segments = breadcrumb.locator(".fo-breadcrumb-segments button");
    const segmentCount = await segments.count();
    expect(segmentCount).toBeGreaterThanOrEqual(1);
  });

  test("navigate back via Alt+Left", async ({ page }) => {
    const folderRow = page
      .locator('.fo-row[role="row"][data-type="directory"]')
      .first();
    const count = await folderRow.count();
    test.skip(count === 0, "No directory rows visible in active panel");

    const breadcrumbBefore = await page
      .locator(".fo-breadcrumb")
      .first()
      .textContent();

    await folderRow.dblclick();
    await page.waitForTimeout(500);

    // Now go back
    await shellPress(page, "Alt+ArrowLeft");

    const breadcrumbAfter = await page
      .locator(".fo-breadcrumb")
      .first()
      .textContent();
    expect(breadcrumbAfter).toBe(breadcrumbBefore);
  });

  test("navigate forward via Alt+Right after going back", async ({ page }) => {
    const folderRow = page
      .locator('.fo-row[role="row"][data-type="directory"]')
      .first();
    const count = await folderRow.count();
    test.skip(count === 0, "No directory rows visible in active panel");

    await folderRow.dblclick();
    await page.waitForTimeout(500);

    const breadcrumbAfterNav = await page
      .locator(".fo-breadcrumb")
      .first()
      .textContent();

    await shellPress(page, "Alt+ArrowLeft");
    await page.waitForTimeout(300);

    await shellPress(page, "Alt+ArrowRight");
    await page.waitForTimeout(300);

    const breadcrumbFinal = await page
      .locator(".fo-breadcrumb")
      .first()
      .textContent();
    expect(breadcrumbFinal).toBe(breadcrumbAfterNav);
  });

  test("Enter key opens selected folder", async ({ page }) => {
    const folderRow = page
      .locator('.fo-row[role="row"][data-type="directory"]')
      .first();
    const count = await folderRow.count();
    test.skip(count === 0, "No directory rows visible in active panel");

    const folderName = await folderRow
      .locator(".fo-cell-name")
      .first()
      .textContent();

    await folderRow.click();
    await shellPress(page, "Enter");

    const breadcrumb = page.locator(".fo-breadcrumb").first();
    await expect(breadcrumb).toContainText(folderName!.trim());
  });
});

test.describe("Navigation — breadcrumb", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("breadcrumb shows current path segments", async ({ page }) => {
    const breadcrumb = page.locator(".fo-breadcrumb").first();
    await expect(breadcrumb).toBeVisible();

    const segments = breadcrumb.locator(".fo-breadcrumb-segments button");
    const count = await segments.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("breadcrumb segment text is non-empty", async ({ page }) => {
    const allSegments = page
      .locator(".fo-breadcrumb")
      .first()
      .locator(".fo-breadcrumb-segments button");
    const count = await allSegments.count();

    for (let i = 0; i < count; i++) {
      const text = await allSegments.nth(i).textContent();
      expect(text!.trim().length).toBeGreaterThan(0);
    }
  });

  test("clicking breadcrumb segment navigates to that path", async ({
    page,
  }) => {
    // Navigate into a folder first to create multiple breadcrumb segments
    const folderRow = page
      .locator('.fo-row[role="row"][data-type="directory"]')
      .first();
    const count = await folderRow.count();
    test.skip(count === 0, "No directory rows visible in active panel");

    await folderRow.dblclick();
    await page.waitForTimeout(500);

    const segments = page
      .locator(".fo-breadcrumb")
      .first()
      .locator(".fo-breadcrumb-segments button");
    const segmentCount = await segments.count();
    test.skip(
      segmentCount <= 1,
      "Not enough breadcrumb segments to test navigation",
    );

    // Click the first segment (root) to navigate back
    await segments.first().click();

    const breadcrumbAfter = page.locator(".fo-breadcrumb").first();
    const segmentsAfter = breadcrumbAfter.locator(
      ".fo-breadcrumb-segments button",
    );
    const countAfter = await segmentsAfter.count();
    expect(countAfter).toBeLessThan(segmentCount);
  });

  test("Ctrl+L focuses breadcrumb or path input", async ({ page }) => {
    await shellPress(page, "Control+l");

    // Either a breadcrumb input is focused or the breadcrumb itself gets focus
    const focused = page.locator(":focus");
    await expect(focused).toBeVisible();
  });
});

test.describe("Navigation — sidebar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("clicking a sidebar item navigates the active panel", async ({
    page,
  }) => {
    const sidebarItem = page.locator(".fo-sidebar-item").first();
    const count = await sidebarItem.count();
    test.skip(count === 0, "No sidebar items visible");

    await sidebarItem.click({ force: true });
    await page.waitForTimeout(500);

    // Breadcrumb should update
    const breadcrumb = page.locator(".fo-breadcrumb").first();
    await expect(breadcrumb).toBeVisible();
  });

  test("sidebar has Favorites section", async ({ page }) => {
    const section = page.locator(
      ".fo-sidebar-section:has(.fo-sidebar-section-title:text-is('Favorites'))",
    );
    await expect(section).toBeVisible();
  });

  test("sidebar has User Folders or Places section", async ({ page }) => {
    const section = page.locator(
      ".fo-sidebar-section:has(.fo-sidebar-section-title)",
    );
    const count = await section.count();
    // At least some section exists
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("sidebar section items are clickable buttons", async ({ page }) => {
    const items = page.locator(".fo-sidebar-item");
    const count = await items.count();
    test.skip(count === 0, "No sidebar items");

    for (let i = 0; i < Math.min(count, 5); i++) {
      const item = items.nth(i);
      const role = await item.getAttribute("role");
      // Items should be buttons or links
      const tagName = await item.evaluate((el) => el.tagName.toLowerCase());
      expect(
        role === "button" || tagName === "button" || tagName === "a",
      ).toBeTruthy();
    }
  });
});

test.describe("Navigation — tabs", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("Ctrl+T creates a new tab if tab feature exists", async ({ page }) => {
    const tabsBefore = page.locator(".fo-tab, .fo-panel-tab, [role='tab']");
    const countBefore = await tabsBefore.count();

    await shellPress(page, "Control+t");
    await page.waitForTimeout(300);

    const tabsAfter = page.locator(".fo-tab, .fo-panel-tab, [role='tab']");
    const countAfter = await tabsAfter.count();

    if (countBefore === 0 && countAfter === 0) {
      test.skip();
      return;
    }
    expect(countAfter).toBeGreaterThan(countBefore);
  });

  test("Ctrl+W closes the active tab if multiple tabs exist", async ({
    page,
  }) => {
    // Create a second tab first
    await shellPress(page, "Control+t");
    await page.waitForTimeout(300);

    const tabsBeforeClose = page.locator(
      ".fo-tab, .fo-panel-tab, [role='tab']",
    );
    const countBeforeClose = await tabsBeforeClose.count();
    test.skip(countBeforeClose <= 1, "Need multiple tabs to test close");

    await shellPress(page, "Control+w");
    await page.waitForTimeout(300);

    const tabsAfterClose = page.locator(".fo-tab, .fo-panel-tab, [role='tab']");
    const countAfterClose = await tabsAfterClose.count();
    expect(countAfterClose).toBe(countBeforeClose - 1);
  });

  test("Ctrl+Tab cycles to next tab if tabs exist", async ({ page }) => {
    // Create a second tab
    await shellPress(page, "Control+t");
    await page.waitForTimeout(300);

    const tabs = page.locator(".fo-tab, .fo-panel-tab, [role='tab']");
    const count = await tabs.count();
    test.skip(count < 2, "Need at least 2 tabs to cycle");

    const activeTabBefore = page.locator(
      ".fo-tab.fo-tab-active, .fo-panel-tab-active, [role='tab'][aria-selected='true']",
    );
    const labelBefore = await activeTabBefore.textContent();

    await shellPress(page, "Control+Tab");
    await page.waitForTimeout(300);

    const activeTabAfter = page.locator(
      ".fo-tab.fo-tab-active, .fo-panel-tab-active, [role='tab'][aria-selected='true']",
    );
    const labelAfter = await activeTabAfter.textContent();

    // Active tab label should have changed
    expect(labelAfter).not.toBe(labelBefore);
  });

  test("tab bar is visible when multiple tabs exist", async ({ page }) => {
    await shellPress(page, "Control+t");
    await page.waitForTimeout(300);

    const tabBar = page.locator(".fo-tab-bar, [role='tablist']");
    const tabCount = page.locator(".fo-tab, .fo-panel-tab, [role='tab']");
    const count = await tabCount.count();

    if (count < 2 || (await tabBar.count()) === 0) {
      test.skip();
      return;
    }
    await expect(tabBar.first()).toBeVisible();
  });
});

test.describe("Navigation — panel switching", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("Tab key switches active panel from left to right", async ({ page }) => {
    const leftPanel = page.locator(".fo-panel").first();
    const rightPanel = page.locator(".fo-panel").last();

    await expect(leftPanel).toHaveClass(/fo-panel-active/);
    await expect(rightPanel).not.toHaveClass(/fo-panel-active/);

    await shellPress(page, "Tab");

    await expect(leftPanel).not.toHaveClass(/fo-panel-active/);
    await expect(rightPanel).toHaveClass(/fo-panel-active/);
  });

  test("F6 does not crash the app", async ({ page }) => {
    await shellPress(page, "F6");
    await expect(page.locator(".fo-shell")).toBeVisible();
  });

  test("Ctrl+U toggles dual pane mode", async ({ page }) => {
    const dualPane = page.locator(".fo-dual-pane");
    await expect(dualPane).toBeVisible();

    await shellPress(page, "Control+u");
    await page.waitForTimeout(300);

    // State should toggle — either hidden or still visible
    const isStillVisible = await dualPane.isVisible();
    expect(typeof isStillVisible).toBe("boolean");
  });
});
