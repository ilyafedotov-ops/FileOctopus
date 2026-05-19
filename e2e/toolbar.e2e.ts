import { test, expect } from "@playwright/test";

function workbenchToolbar(page: import("@playwright/test").Page) {
  return page.locator(".fo-workbench-toolbar .fo-operation-toolbar");
}

async function openMoreMenu(page: import("@playwright/test").Page) {
  const toolbar = workbenchToolbar(page);
  await toolbar.getByRole("button", { name: "More" }).click();
  await expect(moreMenu(page)).toBeVisible();
}

function moreMenu(page: import("@playwright/test").Page) {
  return page.getByRole("menu").filter({
    has: page.locator(".fo-ui-dropdown-label", {
      hasText: "New Folder",
      exact: true,
    }),
  });
}

function moreMenuItem(page: import("@playwright/test").Page, label: string) {
  if (label === "Copy") {
    return moreMenu(page).getByRole("menuitem", { name: /^Copy [⌘Ctrl]/ });
  }
  return moreMenu(page).getByRole("menuitem", { name: label });
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
  await page.getByRole("menubar").getByRole("button", { name: "Edit" }).click();
  await page.getByRole("menuitem", { name: /Clear Selection/i }).click();
  await expect(activeStatus).toHaveText(/^0 selected/);
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

  test("toolbar contains View and Tools dropdowns", async ({ page }) => {
    const toolbar = workbenchToolbar(page);
    await expect(toolbar.getByRole("button", { name: "View" })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "Tools" })).toBeVisible();
  });

  test("More menu exposes New Folder and New File", async ({ page }) => {
    await openMoreMenu(page);
    await expect(
      page.getByRole("menuitem", { name: "New Folder" }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "New File" }),
    ).toBeVisible();
  });

  test("More menu exposes Copy, Move, Rename, and Trash", async ({ page }) => {
    await openMoreMenu(page);
    await expect(moreMenuItem(page, "Copy")).toBeVisible();
    await expect(moreMenuItem(page, "Rename")).toBeVisible();
    await expect(moreMenuItem(page, "Move To…")).toBeVisible();
    await expect(moreMenuItem(page, "Trash")).toBeVisible();
  });

  test("command palette search field is visible", async ({ page }) => {
    const toolbar = workbenchToolbar(page);
    await expect(
      toolbar.getByRole("searchbox", { name: "Open command palette" }),
    ).toBeVisible();
  });
});

test.describe("Toolbar — button state without selection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-shell");
    await clearFileSelection(page);
  });

  test("New Folder menu item is enabled without selection", async ({
    page,
  }) => {
    await openMoreMenu(page);
    await expect(moreMenuItem(page, "New Folder")).toBeEnabled();
  });

  test("New File menu item is enabled without selection", async ({ page }) => {
    await openMoreMenu(page);
    await expect(moreMenuItem(page, "New File")).toBeEnabled();
  });

  test("Copy menu item is disabled without selection", async ({ page }) => {
    await openMoreMenu(page);
    await expect(moreMenuItem(page, "Copy")).toBeDisabled();
  });

  test("Rename menu item is disabled without selection", async ({ page }) => {
    await openMoreMenu(page);
    await expect(moreMenuItem(page, "Rename")).toBeDisabled();
  });

  test("Move To menu item is disabled without selection", async ({ page }) => {
    await openMoreMenu(page);
    await expect(moreMenuItem(page, "Move To…")).toBeDisabled();
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
    await expect(moreMenuItem(page, "Copy")).toBeEnabled();
  });

  test("Move To menu item becomes enabled when a file row is clicked", async ({
    page,
  }) => {
    const fileRow = selectableFileRow(page).first();
    const rowCount = await fileRow.count();
    test.skip(rowCount === 0, "No file rows visible in active panel");

    await fileRow.click();
    await openMoreMenu(page);
    await expect(moreMenuItem(page, "Move To…")).toBeEnabled();
  });

  test("Rename menu item becomes enabled when a file row is clicked", async ({
    page,
  }) => {
    const fileRow = selectableFileRow(page).first();
    const rowCount = await fileRow.count();
    test.skip(rowCount === 0, "No file rows visible in active panel");

    await fileRow.click();
    await openMoreMenu(page);
    await expect(moreMenuItem(page, "Rename")).toBeEnabled();
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
