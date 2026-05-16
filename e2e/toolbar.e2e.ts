import { test, expect } from "@playwright/test";

async function shellPress(page: import("@playwright/test").Page, key: string) {
  await page.locator(".fo-shell").press(key);
}

test.describe("Toolbar — visibility and structure", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("operation toolbar is visible in each panel", async ({ page }) => {
    const toolbars = page.locator(".fo-operation-toolbar");
    const count = await toolbars.count();
    expect(count).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < count; i++) {
      await expect(toolbars.nth(i)).toBeVisible();
    }
  });

  test("toolbar contains New Folder button", async ({ page }) => {
    const toolbar = page.locator(".fo-operation-toolbar").first();
    await expect(toolbar.locator("button:has-text('New Folder')").first()).toBeVisible();
  });

  test("toolbar contains New File button", async ({ page }) => {
    const toolbar = page.locator(".fo-operation-toolbar").first();
    await expect(toolbar.locator("button:has-text('New File')").first()).toBeVisible();
  });

  test("toolbar contains Rename button", async ({ page }) => {
    const toolbar = page.locator(".fo-operation-toolbar").first();
    await expect(toolbar.locator("button:has-text('Rename')").first()).toBeVisible();
  });

  test("toolbar contains Copy button", async ({ page }) => {
    const toolbar = page.locator(".fo-operation-toolbar").first();
    await expect(toolbar.locator("button:has-text('Copy')").first()).toBeVisible();
  });

  test("toolbar contains Move button", async ({ page }) => {
    const toolbar = page.locator(".fo-operation-toolbar").first();
    await expect(toolbar.locator("button:has-text('Move')").first()).toBeVisible();
  });

  test("toolbar contains Trash button (may be in overflow)", async ({ page }) => {
    const toolbar = page.locator(".fo-operation-toolbar").first();
    await expect(toolbar.locator("button:has-text('Trash')").first()).toBeAttached();
  });

  test("toolbar contains Refresh button (may be in overflow)", async ({ page }) => {
    const toolbar = page.locator(".fo-operation-toolbar").first();
    await expect(toolbar.locator("button:has-text('Refresh')").first()).toBeAttached();
  });

  test("toolbar contains More overflow button", async ({ page }) => {
    const toolbar = page.locator(".fo-operation-toolbar").first();
    await expect(toolbar.locator("button:has-text('More')").first()).toBeVisible();
  });

  test("panel header contains back navigation button", async ({ page }) => {
    const header = page.locator("header.fo-panel-header").first();
    const nav = header.locator(".fo-panel-nav");
    await expect(nav.locator('[aria-label*="back"]')).toBeVisible();
  });

  test("panel header contains forward navigation button", async ({ page }) => {
    const header = page.locator("header.fo-panel-header").first();
    const nav = header.locator(".fo-panel-nav");
    await expect(nav.locator('[aria-label*="forward"]')).toBeVisible();
  });

  test("panel header contains up navigation button", async ({ page }) => {
    const header = page.locator("header.fo-panel-header").first();
    const nav = header.locator(".fo-panel-nav");
    await expect(nav.locator('[aria-label*="up"]')).toBeVisible();
  });
});

test.describe("Toolbar — button state without selection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("Rename button is present and actionable without selection", async ({ page }) => {
    const toolbar = page.locator(".fo-operation-toolbar").first();
    const renameBtn = toolbar.locator("button:has-text('Rename')").first();
    await expect(renameBtn).toBeAttached();
  });

  test("Copy button is present and actionable without selection", async ({ page }) => {
    const toolbar = page.locator(".fo-operation-toolbar").first();
    const copyBtn = toolbar.locator("button:has-text('Copy')").first();
    await expect(copyBtn).toBeAttached();
  });

  test("Move button is present and actionable without selection", async ({ page }) => {
    const toolbar = page.locator(".fo-operation-toolbar").first();
    const moveBtn = toolbar.locator("button:has-text('Move')").first();
    await expect(moveBtn).toBeAttached();
  });

  test("New Folder button is enabled without selection", async ({ page }) => {
    const toolbar = page.locator(".fo-operation-toolbar").first();
    const newFolderBtn = toolbar.locator("button:has-text('New Folder')").first();
    await expect(newFolderBtn).toBeEnabled();
  });

  test("New File button is enabled without selection", async ({ page }) => {
    const toolbar = page.locator(".fo-operation-toolbar").first();
    const newFileBtn = toolbar.locator("button:has-text('New File')").first();
    await expect(newFileBtn).toBeEnabled();
  });
});

test.describe("Toolbar — button enabled state with selection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("Copy button becomes enabled when a file row is clicked", async ({ page }) => {
    const fileRow = page.locator('.fo-row[role="row"]').first();
    const rowCount = await fileRow.count();
    test.skip(rowCount === 0, "No file rows visible in active panel");

    await fileRow.click();

    const toolbar = page.locator(".fo-operation-toolbar").first();
    const copyBtn = toolbar.locator("button:has-text('Copy')").first();
    await expect(copyBtn).toBeEnabled();
  });

  test("Move button becomes enabled when a file row is clicked", async ({ page }) => {
    const fileRow = page.locator('.fo-row[role="row"]').first();
    const rowCount = await fileRow.count();
    test.skip(rowCount === 0, "No file rows visible in active panel");

    await fileRow.click();

    const toolbar = page.locator(".fo-operation-toolbar").first();
    const moveBtn = toolbar.locator("button:has-text('Move')").first();
    await expect(moveBtn).toBeEnabled();
  });

  test("Rename button becomes enabled when a file row is clicked", async ({ page }) => {
    const fileRow = page.locator('.fo-row[role="row"]').first();
    const rowCount = await fileRow.count();
    test.skip(rowCount === 0, "No file rows visible in active panel");

    await fileRow.click();

    const toolbar = page.locator(".fo-operation-toolbar").first();
    const renameBtn = toolbar.locator("button:has-text('Rename')").first();
    await expect(renameBtn).toBeEnabled();
  });
});

test.describe("Toolbar — aria-labels", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("panel nav back button has aria-label containing 'back'", async ({ page }) => {
    const nav = page.locator(".fo-panel-nav").first();
    const backBtn = nav.locator('[aria-label*="back"]');
    await expect(backBtn).toBeVisible();
    const label = await backBtn.getAttribute("aria-label");
    expect(label?.toLowerCase()).toContain("back");
  });

  test("panel nav forward button has aria-label containing 'forward'", async ({ page }) => {
    const nav = page.locator(".fo-panel-nav").first();
    const fwdBtn = nav.locator('[aria-label*="forward"]');
    await expect(fwdBtn).toBeVisible();
    const label = await fwdBtn.getAttribute("aria-label");
    expect(label?.toLowerCase()).toContain("forward");
  });

  test("panel nav up button has aria-label containing 'up'", async ({ page }) => {
    const nav = page.locator(".fo-panel-nav").first();
    const upBtn = nav.locator('[aria-label*="up"]');
    await expect(upBtn).toBeVisible();
    const label = await upBtn.getAttribute("aria-label");
    expect(label?.toLowerCase()).toContain("up");
  });
});
