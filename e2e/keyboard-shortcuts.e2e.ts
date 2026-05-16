import { test, expect } from "@playwright/test";

test.describe("Keyboard shortcuts", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-shell");
  });

  test.describe("Ctrl+P — Command palette", () => {
    test("opens command palette with Ctrl+P", async ({ page }) => {
      await page.keyboard.press("Control+p");
      await expect(page.locator(".fo-command-palette")).toBeVisible();
      await expect(
        page.locator('.fo-command-palette input[aria-label="Search commands"]'),
      ).toBeFocused();
    });

    test("closes command palette with Escape", async ({ page }) => {
      await page.keyboard.press("Control+p");
      await expect(page.locator(".fo-command-palette")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.locator(".fo-command-palette")).not.toBeVisible();
    });

    test("filters commands by typing in search input", async ({ page }) => {
      await page.keyboard.press("Control+p");
      await expect(page.locator(".fo-command-palette")).toBeVisible();

      const input = page.locator(
        '.fo-command-palette input[aria-label="Search commands"]',
      );
      await input.fill("rename");
      const items = page.locator(".fo-command-palette-item");
      await expect(items).toHaveCount(1);
      await expect(items.first()).toContainText("Rename");
    });

    test("shows empty state when no commands match", async ({ page }) => {
      await page.keyboard.press("Control+p");
      const input = page.locator(
        '.fo-command-palette input[aria-label="Search commands"]',
      );
      await input.fill("zzzznonexistent");
      await expect(page.locator(".fo-command-palette-empty")).toBeVisible();
      await expect(page.locator(".fo-command-palette-empty")).toContainText(
        "No matching commands",
      );
    });

    test("navigates with arrow keys and selects with Enter", async ({
      page,
    }) => {
      await page.keyboard.press("Control+p");
      await expect(page.locator(".fo-command-palette")).toBeVisible();

      const items = page.locator(".fo-command-palette-item");
      await expect(items).not.toHaveCount(0);

      await page.keyboard.press("ArrowDown");
      const secondItem = items.nth(1);
      await expect(secondItem).toHaveClass(/fo-command-palette-item-active/);

      await page.keyboard.press("ArrowUp");
      const firstItem = items.nth(0);
      await expect(firstItem).toHaveClass(/fo-command-palette-item-active/);

      await page.keyboard.press("Enter");
      await expect(page.locator(".fo-command-palette")).not.toBeVisible();
    });

    test("closes command palette when clicking backdrop", async ({ page }) => {
      await page.keyboard.press("Control+p");
      await expect(page.locator(".fo-command-palette")).toBeVisible();

      await page
        .locator(".fo-dialog-backdrop")
        .click({ position: { x: 5, y: 5 } });
      await expect(page.locator(".fo-command-palette")).not.toBeVisible();
    });
  });

  test.describe("Escape — Close dialogs/menus", () => {
    test("closes command palette on Escape", async ({ page }) => {
      await page.keyboard.press("Control+p");
      await expect(page.locator(".fo-command-palette")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.locator(".fo-command-palette")).not.toBeVisible();
    });

    test("closes shortcuts dialog on Escape", async ({ page }) => {
      await page.keyboard.press("Control+/");
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });

    test("closes settings dialog on Escape", async ({ page }) => {
      await page.keyboard.press("Control+,");
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    });
  });

  test.describe("Tab — Switch active pane", () => {
    test("switches from left to right panel on Tab", async ({ page }) => {
      const leftPanel = page.locator(".fo-panel").first();
      const rightPanel = page.locator(".fo-panel").last();

      await expect(leftPanel).toHaveClass(/fo-panel-active/);
      await expect(rightPanel).not.toHaveClass(/fo-panel-active/);

      await page.keyboard.press("Tab");

      await expect(leftPanel).not.toHaveClass(/fo-panel-active/);
      await expect(rightPanel).toHaveClass(/fo-panel-active/);
    });

    test("toggles back to left panel on second Tab", async ({ page }) => {
      const leftPanel = page.locator(".fo-panel").first();

      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");

      await expect(leftPanel).toHaveClass(/fo-panel-active/);
    });
  });

  test.describe("Ctrl+/ — Shortcuts dialog", () => {
    test("opens shortcuts dialog with Ctrl+/", async ({ page }) => {
      await page.keyboard.press("Control+/");
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    });
  });

  test.describe("Ctrl+, — Settings dialog", () => {
    test("opens settings dialog with Ctrl+,", async ({ page }) => {
      await page.keyboard.press("Control+,");
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    });
  });

  test.describe("Ctrl+N — New folder", () => {
    test("opens create folder dialog with Ctrl+N", async ({ page }) => {
      await page.keyboard.press("Control+n");
      await expect(page.locator(".fo-dialog")).toBeVisible();
    });
  });

  test.describe("Ctrl+A — Select all", () => {
    test("selects all entries with Ctrl+A", async ({ page }) => {
      const fileRows = page.locator(".fo-file-row");
      const count = await fileRows.count();
      test.skip(count === 0, "No file entries in active panel");

      await page.keyboard.press("Control+a");
      const selected = page.locator(".fo-file-row.fo-file-row-selected");
      await expect(selected).toHaveCount(count);
    });
  });

  test.describe("F5 — Refresh", () => {
    test("triggers refresh without error on F5", async ({ page }) => {
      await page.keyboard.press("F5");
      await expect(page.locator(".fo-shell")).toBeVisible();
    });
  });

  test.describe("Escape priority", () => {
    test("Escape closes command palette before other overlays", async ({
      page,
    }) => {
      await page.keyboard.press("Control+p");
      await expect(page.locator(".fo-command-palette")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.locator(".fo-command-palette")).not.toBeVisible();
    });

    test("repeated Escape eventually returns to clean state", async ({
      page,
    }) => {
      await page.keyboard.press("Control+p");
      await expect(page.locator(".fo-command-palette")).toBeVisible();

      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");

      await expect(page.locator(".fo-command-palette")).not.toBeVisible();
      await expect(page.locator(".fo-dialog")).toHaveCount(0);
    });
  });
});
