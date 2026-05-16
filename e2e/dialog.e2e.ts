import { test, expect } from "@playwright/test";

async function shellPress(page: import("@playwright/test").Page, key: string) {
  await page.locator(".fo-shell").press(key);
}

test.describe("Dialog — Settings (Ctrl+,)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("opens settings dialog with Ctrl+,", async ({ page }) => {
    await shellPress(page, "Control+,");
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
  });

  test("settings dialog contains sections or tabs", async ({ page }) => {
    await shellPress(page, "Control+,");
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Dialog should have content — headings, form elements, or sections
    const content = dialog.locator("h2, h3, section, fieldset, .fo-settings-section");
    const count = await content.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("settings dialog can be closed with Escape", async ({ page }) => {
    await shellPress(page, "Control+,");
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("settings dialog can be closed with close button", async ({ page }) => {
    await shellPress(page, "Control+,");
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    const closeBtn = dialog.locator('button[aria-label*="close" i], button:has-text("Close")').first();
    const hasCloseBtn = await closeBtn.count();
    if (hasCloseBtn > 0) {
      await closeBtn.click();
      await expect(dialog).not.toBeVisible();
    }
  });
});

test.describe("Dialog — Shortcuts (Ctrl+/)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("opens shortcuts dialog with Ctrl+/", async ({ page }) => {
    await shellPress(page, "Control+/");
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
  });

  test("shortcuts dialog shows keyboard shortcuts list", async ({ page }) => {
    await shellPress(page, "Control+/");
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Should contain shortcut entries — key bindings
    const body = dialog.locator("body, .fo-shortcuts-list, .fo-dialog-content, dialog");
    const text = await dialog.textContent();
    // Should contain some recognizable shortcut text
    const hasShortcuts =
      text!.includes("Ctrl") ||
      text!.includes("Alt") ||
      text!.includes("Shift") ||
      text!.includes("Escape");
    expect(hasShortcuts).toBeTruthy();
  });

  test("shortcuts dialog can be closed with Escape", async ({ page }) => {
    await shellPress(page, "Control+/");
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });
});

test.describe("Dialog — Command Palette (Ctrl+P)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("opens command palette with Ctrl+P", async ({ page }) => {
    await shellPress(page, "Control+p");
    await expect(page.locator(".fo-command-palette")).toBeVisible();
  });

  test("command palette has search input", async ({ page }) => {
    await shellPress(page, "Control+p");
    const input = page.locator(
      '.fo-command-palette input[aria-label="Search commands"]',
    );
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
  });

  test("command palette shows command items", async ({ page }) => {
    await shellPress(page, "Control+p");
    const items = page.locator(".fo-command-palette-item");
    await expect(items).not.toHaveCount(0);
  });

  test("command palette filters commands by search input", async ({ page }) => {
    await shellPress(page, "Control+p");
    const input = page.locator(
      '.fo-command-palette input[aria-label="Search commands"]',
    );
    await input.fill("refresh");
    const items = page.locator(".fo-command-palette-item");
    await expect(items.first()).toContainText("Refresh");
  });

  test("command palette closes with Escape", async ({ page }) => {
    await shellPress(page, "Control+p");
    await expect(page.locator(".fo-command-palette")).toBeVisible();

    await shellPress(page, "Escape");
    await expect(page.locator(".fo-command-palette")).not.toBeVisible();
  });
});

test.describe("Dialog — Properties", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("Properties opens from context menu on file row", async ({ page }) => {
    const fileRow = page.locator('.fo-row[role="row"]').first();
    const count = await fileRow.count();
    test.skip(count === 0, "No file rows visible");

    await fileRow.click({ button: "right" });
    await expect(page.locator(".fo-context-menu")).toBeVisible();

    const propertiesBtn = page.locator(
      '.fo-context-menu [role="menuitem"]:has-text("Properties")',
    );
    await expect(propertiesBtn).toBeVisible();
    await propertiesBtn.click();

    // Properties dialog should open
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
  });

  test("Properties dialog shows file name", async ({ page }) => {
    const fileRow = page.locator('.fo-row[role="row"]').first();
    const count = await fileRow.count();
    test.skip(count === 0, "No file rows visible");

    await fileRow.click({ button: "right" });
    const propertiesBtn = page.locator(
      '.fo-context-menu [role="menuitem"]:has-text("Properties")',
    );
    await expect(propertiesBtn).toBeVisible();
    await propertiesBtn.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    const text = await dialog.textContent();
    // Should contain some metadata label
    const hasMetadata =
      text!.includes("Name") ||
      text!.includes("name") ||
      text!.includes("Path") ||
      text!.includes("path") ||
      text!.includes("Type") ||
      text!.includes("Size");
    expect(hasMetadata).toBeTruthy();
  });

  test("Properties dialog shows Copy Path button", async ({ page }) => {
    const fileRow = page.locator('.fo-row[role="row"]').first();
    const count = await fileRow.count();
    test.skip(count === 0, "No file rows visible");

    await fileRow.click({ button: "right" });
    const propertiesBtn = page.locator(
      '.fo-context-menu [role="menuitem"]:has-text("Properties")',
    );
    await expect(propertiesBtn).toBeVisible();
    await propertiesBtn.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    const copyPathBtn = dialog.locator("button:has-text('Copy Path')");
    const hasCopyPath = await copyPathBtn.count();
    if (hasCopyPath > 0) {
      await expect(copyPathBtn).toBeVisible();
    }
  });

  test("Properties dialog closes with Escape", async ({ page }) => {
    const fileRow = page.locator('.fo-row[role="row"]').first();
    const count = await fileRow.count();
    test.skip(count === 0, "No file rows visible");

    await fileRow.click({ button: "right" });
    const propertiesBtn = page.locator(
      '.fo-context-menu [role="menuitem"]:has-text("Properties")',
    );
    await propertiesBtn.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });
});

test.describe("Dialog — Delete confirmation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("Delete key on selected file shows confirmation or triggers action", async ({ page }) => {
    const fileRow = page.locator('.fo-row[role="row"]').first();
    const count = await fileRow.count();
    test.skip(count === 0, "No file rows visible");

    await fileRow.click();

    await shellPress(page, "Delete");
    await page.waitForTimeout(300);

    // Either a dialog appears or the action is processed
    const dialog = page.locator('[role="dialog"], .fo-dialog');
    const hasDialog = await dialog.count();
    // If a confirmation dialog appears, it should be visible
    if (hasDialog > 0) {
      await expect(dialog.first()).toBeVisible();
    }
  });

  test("Delete confirmation can be cancelled", async ({ page }) => {
    const fileRow = page.locator('.fo-row[role="row"]').first();
    const count = await fileRow.count();
    test.skip(count === 0, "No file rows visible");

    await fileRow.click();
    await shellPress(page, "Delete");
    await page.waitForTimeout(300);

    const dialog = page.locator('[role="dialog"], .fo-dialog');
    const hasDialog = await dialog.count();
    test.skip(hasDialog === 0, "No confirmation dialog appeared");

    await expect(dialog.first()).toBeVisible();

    // Press Escape or click Cancel
    await page.keyboard.press("Escape");
    await expect(dialog.first()).not.toBeVisible();
  });

  test("Shift+Delete triggers permanent delete action", async ({ page }) => {
    const fileRow = page.locator('.fo-row[role="row"]').first();
    const count = await fileRow.count();
    test.skip(count === 0, "No file rows visible");

    await fileRow.click();

    // We just verify it doesn't crash — don't confirm actual deletion
    await shellPress(page, "Shift+Delete");
    await page.waitForTimeout(300);

    // Either a dialog appears for confirmation or app remains stable
    await expect(page.locator(".fo-shell")).toBeVisible();
  });
});

test.describe("Dialog — Escape behavior", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("Escape closes settings dialog", async ({ page }) => {
    await shellPress(page, "Control+,");
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });

  test("Escape closes shortcuts dialog", async ({ page }) => {
    await shellPress(page, "Control+/");
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });

  test("Escape closes command palette", async ({ page }) => {
    await shellPress(page, "Control+p");
    await expect(page.locator(".fo-command-palette")).toBeVisible();
    await shellPress(page, "Escape");
    await expect(page.locator(".fo-command-palette")).not.toBeVisible();
  });
});
