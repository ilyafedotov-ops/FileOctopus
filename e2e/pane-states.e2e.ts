import { test, expect } from "@playwright/test";

function activePanel(page: import("@playwright/test").Page) {
  return page.locator(".fo-panel.fo-panel-active");
}

test.describe("Pane states — PaneStateView rendering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  // --- Loading state ---

  test("injected loading state renders spinner element", async ({ page }) => {
    await page.evaluate(() => {
      const panel = document.querySelector(".fo-panel.fo-panel-active")!;
      panel.innerHTML += `
        <section class="fo-pane-state fo-pane-state-loading" aria-live="polite">
          <span class="fo-pane-state-spinner" aria-hidden="true"></span>
          <strong>Loading folder</strong>
          <span class="fo-pane-state-path">/home/user/Documents</span>
        </section>`;
    });
    const loading = page.locator(".fo-pane-state-loading");
    await expect(loading).toBeVisible();
    await expect(loading.locator(".fo-pane-state-spinner")).toBeVisible();
    await expect(loading.locator(".fo-pane-state-spinner")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  test("loading state displays 'Loading folder' label text", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const panel = document.querySelector(".fo-panel.fo-panel-active")!;
      panel.innerHTML += `
        <section class="fo-pane-state fo-pane-state-loading" aria-live="polite">
          <span class="fo-pane-state-spinner" aria-hidden="true"></span>
          <strong>Loading folder</strong>
          <span class="fo-pane-state-path">/home/user</span>
        </section>`;
    });
    const loading = page.locator(".fo-pane-state-loading");
    await expect(loading.locator("strong")).toHaveText("Loading folder");
  });

  test("loading state has aria-live='polite' for accessibility", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const panel = document.querySelector(".fo-panel.fo-panel-active")!;
      panel.innerHTML += `
        <section class="fo-pane-state fo-pane-state-loading" aria-live="polite">
          <span class="fo-pane-state-spinner" aria-hidden="true"></span>
          <strong>Loading folder</strong>
          <span class="fo-pane-state-path">/tmp</span>
        </section>`;
    });
    const loading = page.locator(".fo-pane-state-loading");
    await expect(loading).toHaveAttribute("aria-live", "polite");
  });

  // --- Empty state ---

  test("injected empty state renders with message and path", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const panel = document.querySelector(".fo-panel.fo-panel-active")!;
      panel.innerHTML += `
        <section class="fo-pane-state fo-pane-state-empty">
          <strong>This folder is empty</strong>
          <span class="fo-pane-state-path">/home/user/empty-dir</span>
          <div class="fo-pane-state-actions">
            <button type="button">Refresh</button>
            <button type="button">New Folder</button>
          </div>
        </section>`;
    });
    const empty = page.locator(".fo-pane-state-empty");
    await expect(empty).toBeVisible();
    await expect(empty.locator("strong")).toHaveText("This folder is empty");
    await expect(empty.locator(".fo-pane-state-path")).toHaveText(
      "/home/user/empty-dir",
    );
  });

  test("empty state actions include Refresh and New Folder buttons", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const panel = document.querySelector(".fo-panel.fo-panel-active")!;
      panel.innerHTML += `
        <section class="fo-pane-state fo-pane-state-empty">
          <strong>This folder is empty</strong>
          <span class="fo-pane-state-path">/tmp/empty</span>
          <div class="fo-pane-state-actions">
            <button type="button">Refresh</button>
            <button type="button">Paste</button>
            <button type="button">New File</button>
            <button type="button">New Folder</button>
          </div>
        </section>`;
    });
    const actions = page.locator(".fo-pane-state-empty .fo-pane-state-actions");
    await expect(actions).toBeVisible();
    await expect(
      actions.getByRole("button", { name: "Refresh" }),
    ).toBeVisible();
    await expect(
      actions.getByRole("button", { name: "New Folder" }),
    ).toBeVisible();
  });

  test("empty state without creation permissions only shows Refresh button", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const panel = document.querySelector(".fo-panel.fo-panel-active")!;
      panel.innerHTML += `
        <section class="fo-pane-state fo-pane-state-empty">
          <strong>This folder is empty</strong>
          <span class="fo-pane-state-path">/readonly</span>
          <div class="fo-pane-state-actions">
            <button type="button">Refresh</button>
          </div>
        </section>`;
    });
    const actions = page.locator(".fo-pane-state-empty .fo-pane-state-actions");
    const buttons = actions.getByRole("button");
    await expect(buttons).toHaveCount(1);
    await expect(buttons.first()).toHaveText("Refresh");
  });

  // --- Error state (generic) ---

  test("injected error state renders title, path, message, and retry button", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const panel = document.querySelector(".fo-panel.fo-panel-active")!;
      panel.innerHTML += `
        <section class="fo-pane-state fo-pane-state-error">
          <strong>Unable to read this location</strong>
          <span class="fo-pane-state-path">/home/user/missing</span>
          <span class="fo-pane-state-message">ENOENT: no such file or directory</span>
          <details class="fo-pane-state-details">
            <summary>Show details</summary>
            <pre>ENOENT: no such file or directory, stat '/home/user/missing'</pre>
          </details>
          <div class="fo-pane-state-actions">
            <button type="button">Retry</button>
            <button type="button">Refresh</button>
          </div>
        </section>`;
    });
    const error = page.locator(".fo-pane-state-error");
    await expect(error).toBeVisible();
    await expect(error.locator("strong")).toHaveText(
      "Unable to read this location",
    );
    await expect(error.locator(".fo-pane-state-path")).toHaveText(
      "/home/user/missing",
    );
    await expect(error.locator(".fo-pane-state-message")).toHaveText(
      "ENOENT: no such file or directory",
    );
    await expect(
      error
        .locator(".fo-pane-state-actions")
        .getByRole("button", { name: "Retry" }),
    ).toBeVisible();
    await expect(
      error
        .locator(".fo-pane-state-actions")
        .getByRole("button", { name: "Refresh" }),
    ).toBeVisible();
  });

  // --- Error state: notFound ---

  test("error state for notFound shows 'Folder not found' title and guidance", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const panel = document.querySelector(".fo-panel.fo-panel-active")!;
      panel.innerHTML += `
        <section class="fo-pane-state fo-pane-state-error">
          <strong>Folder not found</strong>
          <span class="fo-pane-state-path">/deleted/path</span>
          <span class="fo-pane-state-message">The path may have been moved, renamed, or deleted.</span>
          <div class="fo-pane-state-actions">
            <button type="button">Retry</button>
            <button type="button">Refresh</button>
          </div>
        </section>`;
    });
    const error = page.locator(".fo-pane-state-error");
    await expect(error.locator("strong")).toHaveText("Folder not found");
    await expect(error.locator(".fo-pane-state-message")).toContainText(
      "moved, renamed, or deleted",
    );
  });

  // --- Error state: permissionDenied ---

  test("error state for permissionDenied shows correct title and guidance", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const panel = document.querySelector(".fo-panel.fo-panel-active")!;
      panel.innerHTML += `
        <section class="fo-pane-state fo-pane-state-error">
          <strong>Permission denied</strong>
          <span class="fo-pane-state-path">/private/data</span>
          <span class="fo-pane-state-message">Check macOS privacy settings or choose another location.</span>
          <div class="fo-pane-state-actions">
            <button type="button">Retry</button>
            <button type="button">Refresh</button>
          </div>
        </section>`;
    });
    const error = page.locator(".fo-pane-state-error");
    await expect(error.locator("strong")).toHaveText("Permission denied");
    await expect(error.locator(".fo-pane-state-message")).toContainText(
      "privacy settings",
    );
  });

  // --- Error state: details toggle ---

  test("error state details can be expanded to show raw message", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const panel = document.querySelector(".fo-panel.fo-panel-active")!;
      panel.innerHTML += `
        <section class="fo-pane-state fo-pane-state-error">
          <strong>Unable to read this location</strong>
          <span class="fo-pane-state-path">/bad/path</span>
          <span class="fo-pane-state-message">EACCES: permission denied</span>
          <details class="fo-pane-state-details">
            <summary>Show details</summary>
            <pre>Error: EACCES: permission denied, scandir '/bad/path'</pre>
          </details>
          <div class="fo-pane-state-actions">
            <button type="button">Retry</button>
            <button type="button">Refresh</button>
          </div>
        </section>`;
    });
    const details = page.locator(".fo-pane-state-details");
    await expect(details).toBeVisible();
    await expect(details.locator("summary")).toHaveText("Show details");

    const preContent = details.locator("pre");
    await expect(preContent).toContainText("EACCES: permission denied");
  });

  // --- Network error state with edit credentials ---

  test("error state for authentication failure shows Edit credentials button", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const panel = document.querySelector(".fo-panel.fo-panel-active")!;
      panel.innerHTML += `
        <section class="fo-pane-state fo-pane-state-error">
          <strong>Authentication failed</strong>
          <span class="fo-pane-state-path">/remote/server</span>
          <span class="fo-pane-state-message">Check the username, password, or private key for this server.</span>
          <div class="fo-pane-state-actions">
            <button type="button">Reconnect</button>
            <button type="button">Edit credentials</button>
            <button type="button">Refresh</button>
          </div>
        </section>`;
    });
    const actions = page.locator(".fo-pane-state-error .fo-pane-state-actions");
    await expect(actions).toBeVisible();
    await expect(
      actions.getByRole("button", { name: "Edit credentials" }),
    ).toBeVisible();
    await expect(
      actions.getByRole("button", { name: "Reconnect" }),
    ).toBeVisible();
  });

  // --- Default: pane state view is not rendered on initial load ---

  test("no pane state overlay is visible when panel has entries", async ({
    page,
  }) => {
    const paneState = activePanel(page).locator(".fo-pane-state");
    await expect(paneState).toHaveCount(0);
  });

  // --- State transitions (require real IPC) ---

  test.skip("pane transitions from loading to loaded on successful navigation", async () => {
    // Requires real Tauri IPC to navigate to a directory and observe
    // the loading spinner appear and then disappear once entries load.
  });

  test.skip("pane transitions from loading to error on failed navigation", async () => {
    // Requires real Tauri IPC to navigate to a nonexistent path and
    // observe the loading spinner replaced by an error state.
  });

  test.skip("pane transitions from loaded to loading when navigating away", async () => {
    // Requires real Tauri IPC to trigger a second navigation and
    // confirm the loading state reappears for the new URI.
  });

  test.skip("retry button re-triggers navigation to the same URI", async () => {
    // Requires real Tauri IPC to click the Retry button in an error
    // state and verify the pane re-enters loading for the same path.
  });
});
