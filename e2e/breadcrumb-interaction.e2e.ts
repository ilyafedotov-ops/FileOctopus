import { test, expect } from "@playwright/test";

async function shellPress(page: import("@playwright/test").Page, key: string) {
  await page.locator(".fo-shell").press(key);
}

test.describe("Breadcrumb — rendering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("breadcrumb renders in the left panel", async ({ page }) => {
    const leftPanel = page.locator(".fo-panel").first();
    const breadcrumb = leftPanel.locator(".fo-breadcrumb");
    await expect(breadcrumb).toBeVisible();
  });

  test("breadcrumb renders in the right panel", async ({ page }) => {
    const rightPanel = page.locator(".fo-panel").last();
    const breadcrumb = rightPanel.locator(".fo-breadcrumb");
    await expect(breadcrumb).toBeVisible();
  });

  test("breadcrumb has at least one segment", async ({ page }) => {
    const breadcrumb = page.locator(".fo-breadcrumb").first();
    const segments = breadcrumb.locator(".fo-breadcrumb-segments button");
    const count = await segments.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("every segment button has non-empty text", async ({ page }) => {
    const segments = page
      .locator(".fo-breadcrumb")
      .first()
      .locator(".fo-breadcrumb-segments button");
    const count = await segments.count();
    expect(count).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < count; i++) {
      const text = await segments.nth(i).textContent();
      expect(text!.trim().length).toBeGreaterThan(0);
    }
  });

  test("last visible segment has the fo-breadcrumb-current class", async ({
    page,
  }) => {
    const currentSegment = page
      .locator(".fo-breadcrumb")
      .first()
      .locator(".fo-breadcrumb-current");
    await expect(currentSegment).toBeVisible();
  });

  test("fo-breadcrumb-current segment text is non-empty", async ({ page }) => {
    const currentSegment = page
      .locator(".fo-breadcrumb")
      .first()
      .locator(".fo-breadcrumb-current");
    const text = await currentSegment.textContent();
    expect(text!.trim().length).toBeGreaterThan(0);
  });
});

test.describe("Breadcrumb — edit mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("edit button (.fo-breadcrumb-edit) is visible", async ({ page }) => {
    const editButton = page.locator(".fo-breadcrumb-edit").first();
    await expect(editButton).toBeVisible();
  });

  test("clicking the edit button switches to path input", async ({ page }) => {
    const editButton = page.locator(".fo-breadcrumb-edit").first();
    await editButton.click();

    const pathInput = page
      .locator('input.fo-path[aria-label="Current path"]')
      .first();
    await expect(pathInput).toBeVisible();
  });

  test("double-clicking the breadcrumb switches to path input", async ({
    page,
  }) => {
    const breadcrumb = page.locator(".fo-breadcrumb").first();
    await breadcrumb.dblclick();

    const pathInput = page
      .locator('input.fo-path[aria-label="Current path"]')
      .first();
    await expect(pathInput).toBeVisible();
  });

  test("Ctrl+L activates edit mode via focusToken", async ({ page }) => {
    await shellPress(page, "Control+l");

    const pathInput = page
      .locator('input.fo-path[aria-label="Current path"]')
      .first();
    await expect(pathInput).toBeVisible();
  });

  test("edit mode input has aria-label Current path", async ({ page }) => {
    await page.locator(".fo-breadcrumb-edit").first().click();

    const pathInput = page.locator('input[aria-label="Current path"]').first();
    await expect(pathInput).toBeVisible();
  });

  test("Escape cancels edit mode and restores breadcrumb view", async ({
    page,
  }) => {
    await page.locator(".fo-breadcrumb-edit").first().click();

    const pathInput = page
      .locator('input.fo-path[aria-label="Current path"]')
      .first();
    await expect(pathInput).toBeVisible();

    await pathInput.press("Escape");

    // Breadcrumb should reappear
    const breadcrumb = page.locator(".fo-breadcrumb").first();
    await expect(breadcrumb).toBeVisible();

    // Input should be gone
    await expect(
      page.locator('input.fo-path[aria-label="Current path"]').first(),
    ).toHaveCount(0);
  });

  test("Enter confirms edit and calls onSubmit (requires IPC)", async ({
    page,
  }) => {
    test.skip(
      true,
      "Enter confirmation invokes onSubmit → needs Tauri IPC backend",
    );

    await page.locator(".fo-breadcrumb-edit").first().click();

    const pathInput = page
      .locator('input.fo-path[aria-label="Current path"]')
      .first();
    await pathInput.fill("/tmp");
    await pathInput.press("Enter");

    // After Enter, edit mode should close and breadcrumb should reflect new path
    const breadcrumb = page.locator(".fo-breadcrumb").first();
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb).toContainText("tmp");
  });
});

test.describe("Breadcrumb — navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("clicking a non-current segment navigates to that path (requires IPC)", async ({
    page,
  }) => {
    // Navigate into a subfolder to get at least 2 segments
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

    // Click first segment to navigate up
    await segments.first().click();

    // Breadcrumb segment count should decrease (navigated to parent)
    const breadcrumbAfter = page.locator(".fo-breadcrumb").first();
    const segmentsAfter = breadcrumbAfter.locator(
      ".fo-breadcrumb-segments button",
    );
    const countAfter = await segmentsAfter.count();
    expect(countAfter).toBeLessThan(segmentCount);
  });
});

test.describe("Breadcrumb — overflow & remote indicators", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("overflow dropdown appears for paths exceeding maxVisible segments", async ({
    page,
  }) => {
    // maxVisible is 4 in PanePathBar — we need >4 segments by navigating deep.
    // Navigate into nested folders until we have enough segments.
    let segments = page
      .locator(".fo-breadcrumb")
      .first()
      .locator(".fo-breadcrumb-segments button");
    let segmentCount = await segments.count();

    for (let attempt = 0; attempt < 6 && segmentCount <= 4; attempt++) {
      const folderRow = page
        .locator('.fo-row[role="row"][data-type="directory"]')
        .first();
      const rowCount = await folderRow.count();
      test.skip(
        rowCount === 0,
        "Not enough nested directories to trigger overflow",
      );
      await folderRow.dblclick();
      await page.waitForTimeout(500);
      segments = page
        .locator(".fo-breadcrumb")
        .first()
        .locator(".fo-breadcrumb-segments button");
      segmentCount = await segments.count();
    }

    test.skip(
      segmentCount <= 4,
      "Could not create enough breadcrumb segments for overflow",
    );

    // Overflow trigger should now be visible
    const overflowTrigger = page
      .locator(".fo-breadcrumb")
      .first()
      .locator(".fo-breadcrumb-overflow");
    await expect(overflowTrigger).toBeVisible();
  });

  test("local paths do not show remote indicator", async ({ page }) => {
    const remoteIndicator = page
      .locator(".fo-breadcrumb")
      .first()
      .locator(".fo-breadcrumb-remote");
    await expect(remoteIndicator).toHaveCount(0);
  });

  test("remote indicator shows scheme label for non-local URIs (requires IPC)", async ({
    page,
  }) => {
    test.skip(
      true,
      "Remote breadcrumb indicator requires navigating to sftp:// or similar remote URI via Tauri IPC",
    );

    // Placeholder assertion — would verify .fo-breadcrumb-remote is visible
    // and contains the scheme label (e.g. "SFTP") when viewing a remote path.
    const remoteIndicator = page.locator(".fo-breadcrumb-remote").first();
    await expect(remoteIndicator).toBeVisible();
  });
});
