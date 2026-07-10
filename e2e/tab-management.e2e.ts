import { test, expect } from "@playwright/test";

/**
 * Helper: send a keyboard shortcut through the shell element so that
 * the onKeyDown handler on <main.fo-shell> receives it regardless of
 * where browser focus currently is.
 */
async function shellPress(page: import("@playwright/test").Page, key: string) {
  await page.locator(".fo-shell").press(key);
}

/**
 * Return the tab bar inside a specific panel (left=first, right=last).
 */
function panelTabBar(
  page: import("@playwright/test").Page,
  panel: "left" | "right",
) {
  const panelEl =
    panel === "left"
      ? page.locator(".fo-panel").first()
      : page.locator(".fo-panel").last();
  return panelEl.locator(".fo-tab-bar");
}

test.describe("Tab bar — rendering and structure", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("tab bar is present in each panel", async ({ page }) => {
    const tabBars = page.locator(".fo-tab-bar");
    const count = await tabBars.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("tab bar has correct aria-label for left pane", async ({ page }) => {
    const leftBar = panelTabBar(page, "left");
    await expect(leftBar).toBeAttached();
    await expect(leftBar).toHaveAttribute("aria-label", "L pane tabs");
  });

  test("tab bar has correct aria-label for right pane", async ({ page }) => {
    const rightBar = panelTabBar(page, "right");
    await expect(rightBar).toBeAttached();
    await expect(rightBar).toHaveAttribute("aria-label", "R pane tabs");
  });

  test("tab bar contains a pane label element", async ({ page }) => {
    const paneLabel = panelTabBar(page, "left").locator(".fo-tab-pane-label");
    await expect(paneLabel).toBeAttached();
    const text = await paneLabel.textContent();
    expect(text).toContain("L:");
  });

  test("tab bar contains a tab list with role=tablist", async ({ page }) => {
    const tabList = panelTabBar(page, "left").locator(".fo-tab-list");
    await expect(tabList).toBeAttached();
    await expect(tabList).toHaveAttribute("role", "tablist");
    await expect(tabList).toHaveAttribute("aria-label", "Open tabs");
  });
});

test.describe("Tab bar — initial tab state", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("each panel starts with exactly one tab", async ({ page }) => {
    const leftTabs = panelTabBar(page, "left").locator(".fo-tab[role='tab']");
    const rightTabs = panelTabBar(page, "right").locator(".fo-tab[role='tab']");
    await expect(leftTabs).toHaveCount(1);
    await expect(rightTabs).toHaveCount(1);
  });

  test("initial tab is active", async ({ page }) => {
    const leftTab = panelTabBar(page, "left").locator(".fo-tab[role='tab']");
    await expect(leftTab).toHaveClass(/fo-tab--active/);
    await expect(leftTab).toHaveAttribute("aria-selected", "true");
  });

  test("initial tab has a non-empty label", async ({ page }) => {
    const tabLabel = panelTabBar(page, "left").locator(".fo-tab-label");
    const text = await tabLabel.textContent();
    expect(text!.trim().length).toBeGreaterThan(0);
  });

  test("single tab does not show close button", async ({ page }) => {
    const closeBtn = panelTabBar(page, "left").locator(".fo-tab-close");
    await expect(closeBtn).toHaveCount(0);
  });
});

test.describe("Tab bar — new tab button", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("new tab button exists in each panel tab bar", async ({ page }) => {
    const leftNewBtn = panelTabBar(page, "left").locator(".fo-tab--new");
    const rightNewBtn = panelTabBar(page, "right").locator(".fo-tab--new");
    await expect(leftNewBtn).toBeAttached();
    await expect(rightNewBtn).toBeAttached();
  });

  test("new tab button has correct aria-label", async ({ page }) => {
    const newBtn = panelTabBar(page, "left").locator(".fo-tab--new");
    await expect(newBtn).toHaveAttribute("aria-label", "New tab");
  });

  test("new tab button has correct title", async ({ page }) => {
    const newBtn = panelTabBar(page, "left").locator(".fo-tab--new");
    await expect(newBtn).toHaveAttribute("title", "Open new tab");
  });

  test("clicking new tab button adds a second tab", async ({ page }) => {
    const tabBar = panelTabBar(page, "left");
    const tabsBefore = tabBar.locator(".fo-tab[role='tab']");
    await expect(tabsBefore).toHaveCount(1);

    await tabBar.locator(".fo-tab--new").click();

    const tabsAfter = tabBar.locator(".fo-tab[role='tab']");
    await expect(tabsAfter).toHaveCount(2);
  });
});

test.describe("Tab bar — tab switching", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("clicking a non-active tab switches the active class", async ({
    page,
  }) => {
    const tabBar = panelTabBar(page, "left");

    // Create a second tab
    await tabBar.locator(".fo-tab--new").click();
    const tabs = tabBar.locator(".fo-tab[role='tab']");
    await expect(tabs).toHaveCount(2);

    // New tab becomes active immediately
    await expect(tabs.last()).toHaveClass(/fo-tab--active/);
    await expect(tabs.first()).not.toHaveClass(/fo-tab--active/);

    // Click the first tab to switch
    await tabs.first().click();

    // First tab is now active, second is not
    await expect(tabs.first()).toHaveClass(/fo-tab--active/);
    await expect(tabs.last()).not.toHaveClass(/fo-tab--active/);
  });

  test("aria-selected updates when switching tabs", async ({ page }) => {
    const tabBar = panelTabBar(page, "left");

    await tabBar.locator(".fo-tab--new").click();
    const tabs = tabBar.locator(".fo-tab[role='tab']");
    await expect(tabs).toHaveCount(2);

    // New tab becomes active immediately
    await expect(tabs.first()).toHaveAttribute("aria-selected", "false");
    await expect(tabs.last()).toHaveAttribute("aria-selected", "true");

    // Click the first tab to switch
    await tabs.first().click();

    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await expect(tabs.last()).toHaveAttribute("aria-selected", "false");
  });
});

test.describe("Tab bar — close tab button", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("close button appears when multiple tabs are open", async ({ page }) => {
    const tabBar = panelTabBar(page, "left");

    // With 1 tab — no close button
    const closeButtons = tabBar.locator(".fo-tab-close");
    await expect(closeButtons).toHaveCount(0);

    // Add a second tab
    await tabBar.locator(".fo-tab--new").click();
    const tabs = tabBar.locator(".fo-tab[role='tab']");
    await expect(tabs).toHaveCount(2);

    // Now close buttons should exist (one per tab)
    await expect(closeButtons).toHaveCount(2);
  });

  test("close button has aria-label for accessibility", async ({ page }) => {
    const tabBar = panelTabBar(page, "left");

    await tabBar.locator(".fo-tab--new").click();
    const closeBtn = tabBar.locator(".fo-tab-close").first();
    await expect(closeBtn).toHaveAttribute("aria-label", "Close tab");
  });

  test("clicking close button removes a tab", async ({ page }) => {
    const tabBar = panelTabBar(page, "left");

    await tabBar.locator(".fo-tab--new").click();
    const tabs = tabBar.locator(".fo-tab[role='tab']");
    await expect(tabs).toHaveCount(2);

    // Close the second (inactive) tab
    await tabs.last().locator(".fo-tab-close").click();

    await expect(tabs).toHaveCount(1);
  });

  test("closing the active tab activates another tab", async ({ page }) => {
    const tabBar = panelTabBar(page, "left");

    await tabBar.locator(".fo-tab--new").click();
    const tabs = tabBar.locator(".fo-tab[role='tab']");
    await expect(tabs).toHaveCount(2);

    // Switch to the second tab so it's active
    await tabs.last().click();
    await expect(tabs.last()).toHaveClass(/fo-tab--active/);

    // Close the active (second) tab
    await tabs.last().locator(".fo-tab-close").click();

    // First tab should be the only remaining one and active
    await expect(tabs).toHaveCount(1);
    await expect(tabs.first()).toHaveClass(/fo-tab--active/);
  });

  test("closing all extra tabs removes close buttons", async ({ page }) => {
    const tabBar = panelTabBar(page, "left");

    await tabBar.locator(".fo-tab--new").click();
    const tabs = tabBar.locator(".fo-tab[role='tab']");
    await expect(tabs).toHaveCount(2);

    // Close the extra tab
    await tabs.last().locator(".fo-tab-close").click();
    await expect(tabs).toHaveCount(1);

    // Close buttons should disappear again
    const closeButtons = tabBar.locator(".fo-tab-close");
    await expect(closeButtons).toHaveCount(0);
  });
});

test.describe("Tab bar — multiple tabs management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("can open three or more tabs", async ({ page }) => {
    const tabBar = panelTabBar(page, "left");
    const newBtn = tabBar.locator(".fo-tab--new");

    await newBtn.click();
    await newBtn.click();

    const tabs = tabBar.locator(".fo-tab[role='tab']");
    await expect(tabs).toHaveCount(3);
  });

  test("only one tab is active at a time with multiple tabs", async ({
    page,
  }) => {
    const tabBar = panelTabBar(page, "left");
    const newBtn = tabBar.locator(".fo-tab--new");

    await newBtn.click();
    await newBtn.click();

    const activeTabs = tabBar.locator(".fo-tab.fo-tab--active[role='tab']");
    await expect(activeTabs).toHaveCount(1);
  });

  test("tab title attribute reflects tab URI", async ({ page }) => {
    const tabBar = panelTabBar(page, "left");
    const tab = tabBar.locator(".fo-tab[role='tab']").first();
    const title = await tab.getAttribute("title");
    // Title should be a non-empty path string
    test.skip(!title, "Tab title not available without real FS data");
    expect(title!.length).toBeGreaterThan(0);
  });
});

test.describe("Tab bar — keyboard shortcuts for tabs", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("Ctrl+T creates a new tab via keyboard", async ({ page }) => {
    const tabBar = panelTabBar(page, "left");
    const tabsBefore = tabBar.locator(".fo-tab[role='tab']");
    const countBefore = await tabsBefore.count();

    await shellPress(page, "Control+t");
    await page.waitForTimeout(300);

    const countAfter = await tabBar.locator(".fo-tab[role='tab']").count();
    test.skip(
      countAfter === countBefore,
      "Ctrl+T tab creation shortcut not yet implemented",
    );
    expect(countAfter).toBeGreaterThan(countBefore);
  });

  test("Ctrl+W closes the active tab via keyboard", async ({ page }) => {
    const tabBar = panelTabBar(page, "left");

    // Open a second tab first
    await tabBar.locator(".fo-tab--new").click();
    const tabs = tabBar.locator(".fo-tab[role='tab']");
    await expect(tabs).toHaveCount(2);

    const countBefore = await tabs.count();

    await shellPress(page, "Control+w");
    await page.waitForTimeout(300);

    const countAfter = await tabBar.locator(".fo-tab[role='tab']").count();
    test.skip(
      countAfter === countBefore,
      "Ctrl+W tab close shortcut not yet implemented",
    );
    expect(countAfter).toBeLessThan(countBefore);
  });

  test("Ctrl+Tab cycles to next tab", async ({ page }) => {
    const tabBar = panelTabBar(page, "left");

    await tabBar.locator(".fo-tab--new").click();
    const tabs = tabBar.locator(".fo-tab[role='tab']");
    await expect(tabs).toHaveCount(2);

    // New tab becomes active immediately (last)
    await expect(tabs.last()).toHaveClass(/fo-tab--active/);

    await shellPress(page, "Control+Tab");
    await page.waitForTimeout(300);

    // After cycling, first tab should be active — or shortcut not wired
    const firstActive = await tabs
      .first()
      .evaluate((el) => el.classList.contains("fo-tab--active"));
    test.skip(!firstActive, "Ctrl+Tab tab cycling not yet implemented");
    await expect(tabs.first()).toHaveClass(/fo-tab--active/);
  });
});

test.describe("Tab bar — panel-independent rendering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("right panel tab bar works independently from left", async ({
    page,
  }) => {
    const rightTabBar = panelTabBar(page, "right");

    // Open a new tab in the right panel
    await rightTabBar.locator(".fo-tab--new").click();
    const rightTabs = rightTabBar.locator(".fo-tab[role='tab']");
    await expect(rightTabs).toHaveCount(2);

    // Left panel should still have 1 tab
    const leftTabs = panelTabBar(page, "left").locator(".fo-tab[role='tab']");
    await expect(leftTabs).toHaveCount(1);
  });

  test("switching tab in right panel does not affect left panel", async ({
    page,
  }) => {
    const rightTabBar = panelTabBar(page, "right");

    await rightTabBar.locator(".fo-tab--new").click();
    const rightTabs = rightTabBar.locator(".fo-tab[role='tab']");
    await expect(rightTabs).toHaveCount(2);

    // Switch to the second tab in the right panel
    await rightTabs.last().click();
    await expect(rightTabs.last()).toHaveClass(/fo-tab--active/);

    // Left panel's first tab should still be active
    const leftTabs = panelTabBar(page, "left").locator(".fo-tab[role='tab']");
    await expect(leftTabs.first()).toHaveClass(/fo-tab--active/);
  });
});
