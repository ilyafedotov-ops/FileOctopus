import { expect, test } from "@playwright/test";

async function shellPress(page: import("@playwright/test").Page, key: string) {
  await page.locator(".fo-shell").press(key);
}

test.describe("Status bar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-shell");
    await page.waitForSelector("footer.fo-status");
  });

  test("renders status bar at the bottom with .fo-status class", async ({
    page,
  }) => {
    const statusBar = page.locator("footer.fo-status");
    await expect(statusBar).toBeVisible();
    await expect(statusBar).toHaveAttribute("aria-label", "Application status");
  });

  test("has aria role=status for live region", async ({ page }) => {
    const liveRegion = page.locator("footer.fo-status [role='status']");
    await expect(liveRegion).toBeAttached();
    await expect(liveRegion).toHaveAttribute("aria-live", "polite");
  });

  test("status live region announces job state", async ({ page }) => {
    const liveRegion = page.locator("footer.fo-status [role='status']");
    const text = await liveRegion.textContent();
    expect(text).toBeTruthy();
    const valid =
      text!.includes("No active jobs") || text!.includes("active job");
    expect(valid).toBeTruthy();
  });

  test("renders multiple .fo-status-segment elements", async ({ page }) => {
    const segments = page.locator("footer.fo-status .fo-status-segment");
    const count = await segments.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("renders .fo-status-separator elements between segments", async ({
    page,
  }) => {
    const separators = page.locator("footer.fo-status .fo-status-separator");
    const count = await separators.count();
    expect(count).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < count; i++) {
      await expect(separators.nth(i)).toHaveAttribute("aria-hidden", "true");
    }
  });

  test("renders .fo-status-spacer element", async ({ page }) => {
    const spacer = page.locator("footer.fo-status .fo-status-spacer");
    await expect(spacer).toBeAttached();
  });

  test("renders .fo-status-button for activity panel", async ({ page }) => {
    const button = page.locator("footer.fo-status .fo-status-button").first();
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("type", "button");
  });

  test("status button shows job count", async ({ page }) => {
    const button = page.locator("footer.fo-status .fo-status-button").first();
    const text = await button.textContent();
    expect(text).toBeTruthy();
    expect(text!.toLowerCase()).toContain("active job");
  });

  test("status bar contains pane segment with path info", async ({ page }) => {
    const paneSegment = page.locator("footer.fo-status .fo-status-pane");
    await expect(paneSegment).toBeVisible();
    const text = await paneSegment.textContent();
    expect(text).toBeTruthy();
    const hasPaneLabel =
      text!.includes("Left pane") || text!.includes("Right pane");
    expect(hasPaneLabel).toBeTruthy();
  });

  test("shows selection count text (dynamic)", async ({ page }) => {
    const statusBar = page.locator("footer.fo-status");
    await expect(statusBar).toBeVisible();
    const text = await statusBar.textContent();
    expect(text).toBeTruthy();
    const lower = text!.toLowerCase();
    const hasSelection =
      lower.includes("selected") || lower.includes("no selection");
    expect(hasSelection).toBeTruthy();
  });

  test("shows total items count", async ({ page }) => {
    const statusBar = page.locator("footer.fo-status");
    const text = await statusBar.textContent();
    expect(text).toBeTruthy();
    const hasTotal =
      text!.includes("Total:") ||
      text!.includes("Empty") ||
      text!.includes("Loading");
    expect(hasTotal).toBeTruthy();
  });

  test("error indicator is absent when no error is present", async ({
    page,
  }) => {
    const errorButton = page.locator(
      "footer.fo-status .fo-status-button.fo-status-error",
    );
    await expect(errorButton).toHaveCount(0);
  });

  test("log path segment absent when diagnostics not open", async ({
    page,
  }) => {
    const logSegment = page.locator("footer.fo-status .fo-status-log");
    await expect(logSegment).toHaveCount(0);
  });

  test("status changes when selecting files via keyboard", async ({ page }) => {
    const statusBar = page.locator("footer.fo-status");
    const initialText = await statusBar.textContent();
    expect(initialText).toBeTruthy();
    const initiallyUnselected =
      initialText!.includes("No selection") ||
      initialText!.includes("Selected: 0");

    await shellPress(page, "Control+a");

    const afterSelectText = await statusBar.textContent();
    expect(afterSelectText).toBeTruthy();
    const hasSelection =
      afterSelectText!.includes("selected") ||
      afterSelectText!.includes("Selected:");
    expect(hasSelection).toBeTruthy();

    if (initiallyUnselected) {
      expect(afterSelectText).not.toBe(initialText);
    }
  });

  test("status bar is wrapped in .fo-shell-status-stack container", async ({
    page,
  }) => {
    const stack = page.locator(".fo-shell-status-stack");
    await expect(stack).toBeVisible();
    const footer = stack.locator("footer.fo-status");
    await expect(footer).toBeVisible();
  });
});
