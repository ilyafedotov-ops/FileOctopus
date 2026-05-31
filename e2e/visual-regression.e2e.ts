import { test, expect } from "@playwright/test";

const SNAPSHOT_OPTS = { maxDiffPixelRatio: 0.15 };

test.describe("Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-shell");
    await page.waitForSelector("aside.fo-sidebar", { timeout: 15_000 });
  });

  test("main shell — full page screenshot", async ({ page }) => {
    await expect(page).toHaveScreenshot("main-shell.png", SNAPSHOT_OPTS);
  });

  test("sidebar region", async ({ page }) => {
    const sidebar = page.locator("aside.fo-sidebar");
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toHaveScreenshot("sidebar.png", SNAPSHOT_OPTS);
  });

  test("toolbar region", async ({ page }) => {
    const toolbar = page.locator(".fo-operation-toolbar").first();
    await expect(toolbar).toBeVisible();
    await expect(toolbar).toHaveScreenshot("toolbar.png", SNAPSHOT_OPTS);
  });

  test("file table region", async ({ page }) => {
    const table = page.locator(".fo-table-shell").first();
    await expect(table).toBeVisible();
    await expect(table).toHaveScreenshot("file-table.png", SNAPSHOT_OPTS);
  });

  test("status bar region", async ({ page }) => {
    const statusBar = page.locator("footer.fo-status");
    await expect(statusBar).toBeVisible();
    await expect(statusBar).toHaveScreenshot("status-bar.png", SNAPSHOT_OPTS);
  });

  test("context menu open on file row", async ({ page }) => {
    const fileRow = page.locator('.fo-row[role="row"]').first();
    const rowCount = await fileRow.count();

    if (rowCount > 0) {
      await fileRow.click({ button: "right" });
    } else {
      const tableShell = page.locator(".fo-table-shell").first();
      await tableShell.click({ button: "right" });
    }

    const menu = page.locator(".fo-context-menu");
    await expect(menu).toBeVisible();
    await expect(menu).toHaveScreenshot("context-menu-file.png", SNAPSHOT_OPTS);
  });

  test("context menu open on empty space", async ({ page }) => {
    const tableShell = page.locator(".fo-table-shell").first();
    await tableShell.click({ button: "right" });

    const menu = page.locator(".fo-context-menu");
    await expect(menu).toBeVisible();
    await expect(menu).toHaveScreenshot(
      "context-menu-empty.png",
      SNAPSHOT_OPTS,
    );
  });

  test("settings dialog open (Ctrl+,)", async ({ page }) => {
    await page.locator(".fo-shell").press("Control+,");

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveScreenshot("settings-dialog.png", SNAPSHOT_OPTS);
  });

  test("shortcuts dialog open (Ctrl+/)", async ({ page }) => {
    await page.locator(".fo-shell").press("Control+/");

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveScreenshot(
      "shortcuts-dialog.png",
      SNAPSHOT_OPTS,
    );
  });

  test("command palette open (Ctrl+P)", async ({ page }) => {
    await page.locator(".fo-shell").press("Control+p");

    const palette = page.locator(".fo-command-palette");
    await expect(palette).toBeVisible();
    await expect(palette).toHaveScreenshot(
      "command-palette.png",
      SNAPSHOT_OPTS,
    );
  });

  test("light theme (default)", async ({ page }) => {
    const shell = page.locator(".fo-shell");
    await expect(shell).toBeVisible();
    await expect(shell).toHaveScreenshot("light-theme.png", SNAPSHOT_OPTS);
  });

  test("dark theme (View menu)", async ({ page }) => {
    await page.getByRole("menuitem", { name: /View/i }).click();
    await page.getByRole("menuitem", { name: "Theme: Dark" }).click();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator(".fo-shell")).toHaveScreenshot(
      "dark-theme.png",
      SNAPSHOT_OPTS,
    );
  });
});

// ---------------------------------------------------------------------------
// Helper: apply theme + density via data attributes on <html>
// ---------------------------------------------------------------------------
async function applyThemeAndDensity(
  page: import("@playwright/test").Page,
  theme: string,
  density: string,
) {
  await page.evaluate(
    (opts) => {
      document.documentElement.dataset.theme = opts.theme;
      document.documentElement.dataset.density = opts.density;
    },
    { theme, density },
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect(page.locator("html")).toHaveAttribute("data-density", density);
}

// ---------------------------------------------------------------------------
// Commander-blue theme — full shell screenshot
// ---------------------------------------------------------------------------
test.describe("Commander-blue theme", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-shell");
    await page.waitForSelector("aside.fo-sidebar", { timeout: 15_000 });
    await applyThemeAndDensity(page, "commander-blue", "comfortable");
  });

  test("commander-blue theme — shell", async ({ page }) => {
    await expect(page.locator(".fo-shell")).toHaveScreenshot(
      "shell-commander-blue-comfortable.png",
      SNAPSHOT_OPTS,
    );
  });
});

// ---------------------------------------------------------------------------
// Theme × Density matrix — key surfaces
// ---------------------------------------------------------------------------
const THEMES = ["light", "dark", "commander-blue"] as const;
const DENSITIES = ["compact", "comfortable", "spacious"] as const;

type SurfaceDef = {
  name: string;
  selector: string;
  screenshot: (theme: string, density: string) => string;
};

const SURFACES: SurfaceDef[] = [
  {
    name: "shell",
    selector: ".fo-shell",
    screenshot: (t, d) => `shell-${t}-${d}.png`,
  },
  {
    name: "sidebar",
    selector: "aside.fo-sidebar",
    screenshot: (t, d) => `sidebar-${t}-${d}.png`,
  },
  {
    name: "toolbar",
    selector: ".fo-operation-toolbar",
    screenshot: (t, d) => `toolbar-${t}-${d}.png`,
  },
  {
    name: "file table",
    selector: ".fo-table-shell",
    screenshot: (t, d) => `file-table-${t}-${d}.png`,
  },
  {
    name: "status bar",
    selector: "footer.fo-status",
    screenshot: (t, d) => `status-bar-${t}-${d}.png`,
  },
];

for (const theme of THEMES) {
  for (const density of DENSITIES) {
    test.describe(`${theme} theme × ${density} density`, () => {
      test.beforeEach(async ({ page }) => {
        await page.goto("/");
        await page.waitForSelector(".fo-shell");
        await page.waitForSelector("aside.fo-sidebar", {
          timeout: 15_000,
        });
        await applyThemeAndDensity(page, theme, density);
      });

      test(`key surfaces`, async ({ page }) => {
        for (const surface of SURFACES) {
          await test.step(`${surface.name} — ${theme}/${density}`, async () => {
            const loc = page.locator(surface.selector).first();
            await expect(loc).toBeVisible();
            await expect(loc).toHaveScreenshot(
              surface.screenshot(theme, density),
              SNAPSHOT_OPTS,
            );
          });
        }
      });
    });
  }
}
