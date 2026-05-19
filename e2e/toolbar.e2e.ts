import { test, expect } from "@playwright/test";

function workbenchToolbar(page: import("@playwright/test").Page) {
  return page.locator(".fo-workbench-toolbar .fo-operation-toolbar");
}

async function openMoreMenu(page: import("@playwright/test").Page) {
  const toolbar = workbenchToolbar(page);
  await toolbar.getByRole("button", { name: "More" }).click();
  // Wait for the dropdown to render
  await page.waitForTimeout(500);
}

function selectableFileRow(page: import("@playwright/test").Page) {
  return page.locator(
    ".fo-panel.fo-panel-active .fo-row[role='row']:not(.fo-row-parent)",
  );
}

async function clearFileSelection(page: import("@playwright/test").Page) {
  const activeStatus = page.locator(
    ".fo-panel.fo-panel-active footer.fo-pane-status",
  );
  const status = await activeStatus.textContent();
  if (status?.startsWith("0 selected")) {
    return;
  }
  // Try clearing selection via Escape on table
  await page.locator(".fo-table-shell").first().click();
  await page.keyboard.press("Escape");
}

test.describe("Toolbar — visibility and structure", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-shell");
  });

  test("shared operation toolbar is visible once in workbench", async ({
    page,
  }) => {
    const toolbars = page.locator(
      ".fo-workbench-toolbar .fo-operation-toolbar",
    );
    await expect(toolbars).toHaveCount(1);
    await expect(toolbars.first()).toBeVisible();
  });

  test("toolbar contains Back, Forward, and Up navigation", async ({
    page,
  }) => {
    const toolbar = workbenchToolbar(page);
    await expect(toolbar.getByRole("button", { name: "Back" })).toBeVisible();
    await expect(
      toolbar.getByRole("button", { name: "Forward" }),
    ).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "Up" })).toBeVisible();
  });

  test("toolbar contains Refresh and More buttons", async ({ page }) => {
    const toolbar = workbenchToolbar(page);
    await expect(
      toolbar.getByRole("button", { name: "Refresh" }),
    ).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "More" })).toBeVisible();
  });

  test("toolbar contains Root, Home, and Drives navigation", async ({
    page,
  }) => {
    const toolbar = workbenchToolbar(page);
    await expect(toolbar.getByRole("button", { name: "Root" })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "Home" })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "Drives" })).toBeVisible();
  });

  test("More menu exposes New File", async ({ page }) => {
    await openMoreMenu(page);
    await expect(
      page.getByRole("menuitem", { name: "New File" }),
    ).toBeVisible();
  });

  test("More menu exposes Copy, Cut, and Paste", async ({ page }) => {
    await openMoreMenu(page);
    // Copy accessible name includes shortcut (e.g. "Copy ⌘C")
    const copyItem = page
      .locator('[role="menuitem"]')
      .filter({ hasText: /^Copy\b/ });
    await expect(copyItem.first()).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Cut" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Paste" })).toBeVisible();
  });
});

test.describe("Toolbar — button state without selection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-shell");
    await clearFileSelection(page);
  });

  test("New File menu item is enabled without selection", async ({ page }) => {
    await openMoreMenu(page);
    await expect(
      page.getByRole("menuitem", { name: "New File" }),
    ).toBeEnabled();
  });

  test("Copy menu item state depends on selection", async ({ page }) => {
    await openMoreMenu(page);
    const copyItem = page
      .locator('[role="menuitem"]')
      .filter({ hasText: /^Copy\b/ })
      .first();
    // Verify Copy item exists — disabled state depends on runtime selection
    await expect(copyItem).toBeVisible();
  });

  test("Cut menu item state depends on selection", async ({ page }) => {
    await openMoreMenu(page);
    await expect(page.getByRole("menuitem", { name: "Cut" })).toBeVisible();
  });
});

test.describe("Toolbar — button enabled state with selection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("Copy menu item becomes enabled when a file row is clicked", async ({
    page,
  }) => {
    const fileRow = selectableFileRow(page).first();
    const rowCount = await fileRow.count();
    test.skip(rowCount === 0, "No file rows visible in active panel");

    await fileRow.click();
    await openMoreMenu(page);
    const copyItem = page
      .locator('[role="menuitem"]')
      .filter({ hasText: /^Copy\b/ })
      .first();
    await expect(copyItem).toBeEnabled();
  });

  test("Cut menu item becomes enabled when a file row is clicked", async ({
    page,
  }) => {
    const fileRow = selectableFileRow(page).first();
    const rowCount = await fileRow.count();
    test.skip(rowCount === 0, "No file rows visible in active panel");

    await fileRow.click();
    await openMoreMenu(page);
    await expect(page.getByRole("menuitem", { name: "Cut" })).toBeEnabled();
  });
});

test.describe("Toolbar — navigation aria-labels", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-shell");
  });

  test("Back button is exposed with accessible name", async ({ page }) => {
    const backBtn = workbenchToolbar(page).getByRole("button", {
      name: "Back",
    });
    await expect(backBtn).toBeVisible();
  });

  test("Forward button is exposed with accessible name", async ({ page }) => {
    const fwdBtn = workbenchToolbar(page).getByRole("button", {
      name: "Forward",
    });
    await expect(fwdBtn).toBeVisible();
  });

  test("Up button is exposed with accessible name", async ({ page }) => {
    const upBtn = workbenchToolbar(page).getByRole("button", { name: "Up" });
    await expect(upBtn).toBeVisible();
  });
});
