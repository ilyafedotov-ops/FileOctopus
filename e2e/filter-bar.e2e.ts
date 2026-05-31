import { test, expect } from "@playwright/test";

async function shellPress(page: import("@playwright/test").Page, key: string) {
  await page.locator(".fo-shell").press(key);
}

function activePanel(page: import("@playwright/test").Page) {
  return page.locator(".fo-panel.fo-panel-active");
}

function activeFilterInput(page: import("@playwright/test").Page) {
  return activePanel(page).locator(".fo-filter");
}

function activePaneStatus(page: import("@playwright/test").Page) {
  return activePanel(page).locator("footer.fo-pane-status");
}

test.describe("Filter bar — rendering and structure", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("filter bar renders with filter input in each panel", async ({
    page,
  }) => {
    const filterInputs = page.locator(".fo-panel-filter-row .fo-filter");
    const count = await filterInputs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("filter input has correct placeholder text", async ({ page }) => {
    const filterInput = activeFilterInput(page);
    await expect(filterInput).toBeVisible();
    await expect(filterInput).toHaveAttribute(
      "placeholder",
      "Filter current folder…",
    );
  });

  test("filter input is a search-type input element", async ({ page }) => {
    const filterInput = activeFilterInput(page);
    await expect(filterInput).toHaveAttribute("type", "search");
  });
});

test.describe("Filter bar — Ctrl+F focus shortcut", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("Ctrl+F focuses the filter input in the active panel", async ({
    page,
  }) => {
    await shellPress(page, "Control+f");
    const filterInput = activeFilterInput(page);
    await expect(filterInput).toBeFocused();
  });

  test("Ctrl+F in the right panel focuses the right filter input", async ({
    page,
  }) => {
    // Switch to right panel
    await shellPress(page, "Tab");
    await page.waitForTimeout(200);

    await shellPress(page, "Control+f");
    const rightFilter = page.locator(".fo-panel").last().locator(".fo-filter");
    await expect(rightFilter).toBeFocused();
  });
});

test.describe("Filter bar — typing and filtering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("typing in filter reduces visible file rows", async ({ page }) => {
    const fileRowsBefore = activePanel(page).locator(
      ".fo-row[role='row']:not(.fo-row-parent)",
    );
    const countBefore = await fileRowsBefore.count();
    test.skip(countBefore < 2, "Need at least 2 file rows to test filtering");

    await shellPress(page, "Control+f");
    const filterInput = activeFilterInput(page);
    await filterInput.fill("zzzznonexistent");
    await page.waitForTimeout(300);

    const fileRowsAfter = activePanel(page).locator(
      ".fo-row[role='row']:not(.fo-row-parent)",
    );
    const countAfter = await fileRowsAfter.count();
    expect(countAfter).toBeLessThan(countBefore);
  });

  test("filter is case-insensitive", async ({ page }) => {
    const fileRows = activePanel(page).locator(
      ".fo-row[role='row']:not(.fo-row-parent)",
    );
    const count = await fileRows.count();
    test.skip(count === 0, "No file rows visible to test filtering");

    // Get a filename from a row
    const firstName = await fileRows
      .first()
      .locator(".fo-cell-name")
      .textContent();
    test.skip(!firstName, "Could not read file name from row");

    // Filter with uppercase — should still match
    await shellPress(page, "Control+f");
    const filterInput = activeFilterInput(page);
    await filterInput.fill(firstName!.trim().toUpperCase());
    await page.waitForTimeout(300);

    const filteredRows = activePanel(page).locator(
      ".fo-row[role='row']:not(.fo-row-parent)",
    );
    const filteredCount = await filteredRows.count();
    expect(filteredCount).toBeGreaterThanOrEqual(1);
  });

  test("clearing filter restores all rows", async ({ page }) => {
    const fileRowsBefore = activePanel(page).locator(
      ".fo-row[role='row']:not(.fo-row-parent)",
    );
    const countBefore = await fileRowsBefore.count();
    test.skip(countBefore < 2, "Need rows to test restore");

    await shellPress(page, "Control+f");
    const filterInput = activeFilterInput(page);
    await filterInput.fill("zzzznonexistent");
    await page.waitForTimeout(300);

    await filterInput.clear();
    await page.waitForTimeout(300);

    const fileRowsAfter = activePanel(page).locator(
      ".fo-row[role='row']:not(.fo-row-parent)",
    );
    const countAfter = await fileRowsAfter.count();
    expect(countAfter).toBe(countBefore);
  });
});

test.describe("Filter bar — match count and status", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("pane status footer updates item count when filter is active", async ({
    page,
  }) => {
    const fileRows = activePanel(page).locator(
      ".fo-row[role='row']:not(.fo-row-parent)",
    );
    const count = await fileRows.count();
    test.skip(count === 0, "No file rows visible to test match count");

    // Read initial status text
    const statusBefore = await activePaneStatus(page).textContent();

    // Apply a filter
    await shellPress(page, "Control+f");
    const filterInput = activeFilterInput(page);
    await filterInput.fill("zzzznoexist");
    await page.waitForTimeout(300);

    const statusAfter = await activePaneStatus(page).textContent();
    // Status should show 0 items when nothing matches
    expect(statusAfter).toContain("0 items");
    expect(statusAfter).not.toBe(statusBefore);
  });

  test("status bar shows Filtered indicator when filter is active", async ({
    page,
  }) => {
    const statusPane = page.locator(".fo-status-pane").first();
    const textBefore = await statusPane.textContent();
    expect(textBefore).not.toContain("Filtered");

    await shellPress(page, "Control+f");
    const filterInput = activeFilterInput(page);
    await filterInput.fill("test-filter-text");
    await page.waitForTimeout(300);

    const textAfter = await statusPane.textContent();
    expect(textAfter).toContain("Filtered");
  });

  test("status bar Filtered indicator disappears when filter is cleared", async ({
    page,
  }) => {
    await shellPress(page, "Control+f");
    const filterInput = activeFilterInput(page);
    await filterInput.fill("test");
    await page.waitForTimeout(300);

    const statusPane = page.locator(".fo-status-pane").first();
    const textDuring = await statusPane.textContent();
    expect(textDuring).toContain("Filtered");

    await filterInput.clear();
    await page.waitForTimeout(300);

    const textAfter = await statusPane.textContent();
    expect(textAfter).not.toContain("Filtered");
  });
});

test.describe("Filter bar — Escape clears filter", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("Escape clears filter text when filter input is focused", async ({
    page,
  }) => {
    await shellPress(page, "Control+f");
    const filterInput = activeFilterInput(page);
    await filterInput.fill("to-be-cleared");
    await page.waitForTimeout(200);

    // Press Escape while filter is focused
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    const value = await filterInput.inputValue();
    expect(value).toBe("");
  });
});

test.describe("Filter bar — empty state", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("filter with no matches shows empty directory message", async ({
    page,
  }) => {
    await shellPress(page, "Control+f");
    const filterInput = activeFilterInput(page);
    await filterInput.fill("zzzzabsolutelynothingmatchesthis");
    await page.waitForTimeout(300);

    const emptyMessage = activePanel(page).locator(".fo-empty-directory");
    await expect(emptyMessage).toBeVisible();
    await expect(emptyMessage).toContainText("No matches for");
  });
});

test.describe("Filter bar — persistence across panel switches", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("filter text persists when switching away and back to a panel", async ({
    page,
  }) => {
    const leftFilter = page.locator(".fo-panel").first().locator(".fo-filter");

    // Type filter in left panel
    await shellPress(page, "Control+f");
    await activeFilterInput(page).fill("persistent-filter");
    await page.waitForTimeout(200);

    // Switch to right panel
    await shellPress(page, "Tab");
    await page.waitForTimeout(300);

    // Switch back to left panel
    await shellPress(page, "Tab");
    await page.waitForTimeout(300);

    // Left panel filter should still have the text
    const value = await leftFilter.inputValue();
    expect(value).toBe("persistent-filter");
  });
});
