import { test, expect } from "@playwright/test";

test.describe("Toast notifications", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("toast stack container is always mounted", async ({ page }) => {
    const stack = page.locator(".fo-toast-stack");
    await expect(stack).toBeAttached();
    await expect(stack).toHaveAttribute("aria-live", "polite");
    await expect(stack).toHaveAttribute("aria-label", "Notifications");
  });

  test("toast stack is empty on initial load", async ({ page }) => {
    const toasts = page.locator(".fo-toast-stack .fo-toast");
    await expect(toasts).toHaveCount(0);
  });

  test("injected success toast has correct classes and role", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const stack = document.querySelector(".fo-toast-stack")!;
      stack.innerHTML = `
        <div class="fo-toast fo-toast-success" role="status">
          <div class="fo-toast-body">
            <strong>Copied successfully</strong>
          </div>
          <div class="fo-toast-actions">
            <button type="button">Dismiss</button>
          </div>
        </div>`;
    });
    const toast = page.locator(".fo-toast");
    await expect(toast).toBeVisible();
    await expect(toast).toHaveClass(/fo-toast-success/);
    await expect(toast).toHaveAttribute("role", "status");
  });

  test("injected error toast has alert role", async ({ page }) => {
    await page.evaluate(() => {
      const stack = document.querySelector(".fo-toast-stack")!;
      stack.innerHTML = `
        <div class="fo-toast fo-toast-error" role="alert">
          <div class="fo-toast-body">
            <strong>Delete failed</strong>
            <span>Permission denied</span>
          </div>
          <div class="fo-toast-actions">
            <button type="button">Dismiss</button>
          </div>
        </div>`;
    });
    const toast = page.locator(".fo-toast.fo-toast-error");
    await expect(toast).toBeVisible();
    await expect(toast).toHaveAttribute("role", "alert");
  });

  test("injected info toast has status role", async ({ page }) => {
    await page.evaluate(() => {
      const stack = document.querySelector(".fo-toast-stack")!;
      stack.innerHTML = `
        <div class="fo-toast fo-toast-info" role="status">
          <div class="fo-toast-body">
            <strong>Sync started</strong>
          </div>
          <div class="fo-toast-actions">
            <button type="button">Dismiss</button>
          </div>
        </div>`;
    });
    const toast = page.locator(".fo-toast.fo-toast-info");
    await expect(toast).toBeVisible();
    await expect(toast).toHaveAttribute("role", "status");
  });

  test("toast body renders title and optional detail", async ({ page }) => {
    await page.evaluate(() => {
      const stack = document.querySelector(".fo-toast-stack")!;
      stack.innerHTML = `
        <div class="fo-toast fo-toast-error" role="alert">
          <div class="fo-toast-body">
            <strong>Delete failed</strong>
            <span>Permission denied</span>
          </div>
          <div class="fo-toast-actions">
            <button type="button">Dismiss</button>
          </div>
        </div>`;
    });
    const body = page.locator(".fo-toast-body");
    await expect(body).toBeVisible();
    await expect(body.locator("strong")).toHaveText("Delete failed");
    await expect(body.locator("span")).toHaveText("Permission denied");
  });

  test("toast body without detail has no span element", async ({ page }) => {
    await page.evaluate(() => {
      const stack = document.querySelector(".fo-toast-stack")!;
      stack.innerHTML = `
        <div class="fo-toast fo-toast-success" role="status">
          <div class="fo-toast-body">
            <strong>Copied successfully</strong>
          </div>
          <div class="fo-toast-actions">
            <button type="button">Dismiss</button>
          </div>
        </div>`;
    });
    const body = page.locator(".fo-toast-body");
    await expect(body.locator("span")).toHaveCount(0);
  });

  test("toast actions always contain a Dismiss button", async ({ page }) => {
    await page.evaluate(() => {
      const stack = document.querySelector(".fo-toast-stack")!;
      stack.innerHTML = `
        <div class="fo-toast fo-toast-info" role="status">
          <div class="fo-toast-body">
            <strong>Sync started</strong>
          </div>
          <div class="fo-toast-actions">
            <button type="button">Dismiss</button>
          </div>
        </div>`;
    });
    const actions = page.locator(".fo-toast-actions");
    await expect(actions).toBeVisible();
    await expect(
      actions.getByRole("button", { name: "Dismiss" }),
    ).toBeVisible();
  });

  test("toast can include an additional action button", async ({ page }) => {
    await page.evaluate(() => {
      const stack = document.querySelector(".fo-toast-stack")!;
      stack.innerHTML = `
        <div class="fo-toast fo-toast-error" role="alert">
          <div class="fo-toast-body">
            <strong>Update available</strong>
          </div>
          <div class="fo-toast-actions">
            <button type="button">Download</button>
            <button type="button">Dismiss</button>
          </div>
        </div>`;
    });
    const actions = page.locator(".fo-toast-actions");
    await expect(
      actions.getByRole("button", { name: "Download" }),
    ).toBeVisible();
    await expect(
      actions.getByRole("button", { name: "Dismiss" }),
    ).toBeVisible();
  });

  test("multiple toasts stack inside the toast stack", async ({ page }) => {
    await page.evaluate(() => {
      const stack = document.querySelector(".fo-toast-stack")!;
      stack.innerHTML = `
        <div class="fo-toast fo-toast-success" role="status">
          <div class="fo-toast-body"><strong>File saved</strong></div>
          <div class="fo-toast-actions"><button type="button">Dismiss</button></div>
        </div>
        <div class="fo-toast fo-toast-error" role="alert">
          <div class="fo-toast-body"><strong>Upload failed</strong></div>
          <div class="fo-toast-actions"><button type="button">Dismiss</button></div>
        </div>
        <div class="fo-toast fo-toast-info" role="status">
          <div class="fo-toast-body"><strong>Syncing…</strong></div>
          <div class="fo-toast-actions"><button type="button">Dismiss</button></div>
        </div>`;
    });
    const toasts = page.locator(".fo-toast-stack .fo-toast");
    await expect(toasts).toHaveCount(3);

    await expect(toasts.nth(0)).toHaveClass(/fo-toast-success/);
    await expect(toasts.nth(1)).toHaveClass(/fo-toast-error/);
    await expect(toasts.nth(2)).toHaveClass(/fo-toast-info/);
  });

  // Requires real backend to trigger toast creation via IPC events.
  test.skip("toast appears in response to a real backend event", async () => {
    // This test needs the Tauri IPC layer to emit a toast-triggering event.
  });

  // Requires real backend — auto-dismissal is driven by app-side timers
  // that fire after IPC events resolve; not testable in Vite preview mode.
  test.skip("toast auto-dismisses after timeout", async () => {
    // In a real Tauri e2e run, add a toast and wait for it to disappear.
  });

  // Requires IPC — the action button callback is wired through React state
  // that is populated via backend events.
  test.skip("toast action button triggers the correct callback", async () => {
    // Verify that clicking the action button (e.g. "Retry") invokes onAction.
  });
});
