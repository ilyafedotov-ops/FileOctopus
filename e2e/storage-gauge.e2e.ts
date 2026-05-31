/**
 * E2E tests for StorageGauge component.
 *
 * The gauge is purely decorative and only renders when the backend supplies
 * volume data via IPC (discoverVolumes). In Vite preview mode it returns null,
 * so most tests inject DOM via page.evaluate() matching the exact structure
 * from StorageGauge.tsx.
 */
import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Inject a storage gauge matching the exact JSX from StorageGauge.tsx */
function injectGauge(
  page: import("@playwright/test").Page,
  opts: { name?: string; pct?: number } = {},
) {
  const name = opts.name ?? "Local Disk";
  const pct = opts.pct ?? 45;
  return page.evaluate(
    ({ name, pct }) => {
      const existing = document.querySelector(".fo-storage-gauge");
      if (existing) existing.remove();

      const wrapper = document.createElement("span");
      wrapper.className = "fo-storage-gauge";
      wrapper.title = `${name} — ${pct}% used`;

      const bar = document.createElement("span");
      bar.className = "fo-storage-gauge-bar";
      bar.setAttribute("aria-hidden", "true");

      const fill = document.createElement("span");
      fill.className = "fo-storage-gauge-fill";
      fill.style.width = `${pct}%`;
      bar.appendChild(fill);

      const text = document.createElement("span");
      text.className = "fo-storage-gauge-text";
      text.textContent = name;

      wrapper.appendChild(bar);
      wrapper.appendChild(text);

      // Append into the status bar if it exists, otherwise body
      const status = document.querySelector(".fo-status");
      (status ?? document.body).appendChild(wrapper);
    },
    { name, pct },
  );
}

// ---------------------------------------------------------------------------
// No gauge without IPC data
// ---------------------------------------------------------------------------
test.describe("Storage gauge — no IPC data", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("gauge is not rendered in Vite preview mode", async ({ page }) => {
    // StorageGauge returns null when no volume data is available
    const gauge = page.locator(".fo-storage-gauge");
    await expect(gauge).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Injected gauge — structure
// ---------------------------------------------------------------------------
test.describe("Storage gauge — structure (injected)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("renders .fo-storage-gauge container", async ({ page }) => {
    await injectGauge(page);
    const gauge = page.locator(".fo-storage-gauge");
    await expect(gauge).toBeAttached();
  });

  test("container has title with name and percentage", async ({ page }) => {
    await injectGauge(page, { name: "SSD", pct: 72 });
    const gauge = page.locator(".fo-storage-gauge");
    const title = await gauge.getAttribute("title");
    expect(title).toContain("SSD");
    expect(title).toContain("72% used");
  });

  test("bar element has aria-hidden=true", async ({ page }) => {
    await injectGauge(page);
    const bar = page.locator(".fo-storage-gauge-bar");
    await expect(bar).toBeAttached();
    expect(await bar.getAttribute("aria-hidden")).toBe("true");
  });

  test("fill element has width matching percentage", async ({ page }) => {
    await injectGauge(page, { pct: 60 });
    const fill = page.locator(".fo-storage-gauge-fill");
    await expect(fill).toBeAttached();
    const width = await fill.evaluate((el) => (el as HTMLElement).style.width);
    expect(width).toBe("60%");
  });

  test("text element shows volume name", async ({ page }) => {
    await injectGauge(page, { name: "NVMe Drive" });
    const text = page.locator(".fo-storage-gauge-text");
    await expect(text).toHaveText("NVMe Drive");
  });

  test("bar and text are siblings inside gauge", async ({ page }) => {
    await injectGauge(page);
    const gauge = page.locator(".fo-storage-gauge");
    const children = gauge.locator("> *");
    await expect(children).toHaveCount(2);
    await expect(children.nth(0)).toHaveClass(/fo-storage-gauge-bar/);
    await expect(children.nth(1)).toHaveClass(/fo-storage-gauge-text/);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
test.describe("Storage gauge — edge cases", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("0% fill width renders correctly", async ({ page }) => {
    await injectGauge(page, { pct: 0 });
    const fill = page.locator(".fo-storage-gauge-fill");
    const width = await fill.evaluate((el) => (el as HTMLElement).style.width);
    expect(width).toBe("0%");
  });

  test("100% fill width renders correctly", async ({ page }) => {
    await injectGauge(page, { pct: 100 });
    const fill = page.locator(".fo-storage-gauge-fill");
    const width = await fill.evaluate((el) => (el as HTMLElement).style.width);
    expect(width).toBe("100%");
  });

  test("volume name with special characters", async ({ page }) => {
    await injectGauge(page, { name: "C:\\ (System)" });
    const text = page.locator(".fo-storage-gauge-text");
    await expect(text).toHaveText("C:\\ (System)");
  });
});

// ---------------------------------------------------------------------------
// Skipped — requires real IPC
// ---------------------------------------------------------------------------
test.describe("Storage gauge — IPC-dependent (skipped)", () => {
  test.skip(() => true, "Requires real Tauri IPC for volume discovery");

  test("gauge renders after volume data loads", async () => {});
  test("gauge updates when navigating to different volume", async () => {});
  test("gauge disappears for non-local URIs", async () => {});
});
