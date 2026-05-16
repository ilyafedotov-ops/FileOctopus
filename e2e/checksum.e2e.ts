import { expect, test } from "@playwright/test";

const MENU_SELECTOR = ".fo-context-menu";
const ITEM_SELECTOR = '[role="menuitem"]';
const TOAST_SELECTOR = ".fo-toast";

/**
 * In Vite-only mode, Tauri IPC is unavailable, so checksum produces an error
 * toast instead of a success toast. We detect the mode from the first toast
 * result and adapt expectations accordingly.
 */

test.describe("Checksum", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  /**
   * Helper: find a file row (not a directory). Directories show "Folder" in
   * the type column. We look for a row whose text does NOT contain "Folder".
   */
  async function findFileRow(page: import("@playwright/test").Page) {
    const rows = page.locator('.fo-row[role="row"]');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).textContent();
      if (text && !text.includes("Folder")) {
        return rows.nth(i);
      }
    }
    return null;
  }

  /**
   * Helper: find a directory row. Directories have "Folder" in the type label.
   */
  async function findDirectoryRow(page: import("@playwright/test").Page) {
    const rows = page.locator('.fo-row[role="row"]');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).textContent();
      if (text && text.includes("Folder")) {
        return rows.nth(i);
      }
    }
    return null;
  }

  /**
   * Helper: open the "More" dropdown in the first panel's toolbar and return
   * the dropdown element.
   */
  async function openMoreDropdown(page: import("@playwright/test").Page) {
    const toolbar = page.locator(".fo-operation-toolbar").first();
    const moreBtn = toolbar.locator("button:has-text('More')").first();
    await moreBtn.click();

    // Wait for the dropdown menu to appear (it's portaled to body)
    const dropdown = page.locator(".fo-ui-dropdown-menu--portal").last();
    await expect(dropdown).toBeVisible();
    return dropdown;
  }

  /**
   * Helper: trigger checksum from context menu on a selected file row.
   */
  async function triggerChecksumViaContextMenu(
    page: import("@playwright/test").Page,
  ) {
    const fileRow = await findFileRow(page);
    if (!fileRow) return;
    await fileRow.click({ button: "right" });
    await expect(page.locator(MENU_SELECTOR)).toBeVisible();

    const checksumItem = page.locator(
      `${MENU_SELECTOR} > ${ITEM_SELECTOR}:has-text("Checksum…")`,
    );
    await checksumItem.click();
  }

  // ─── Context menu ──────────────────────────────────────────────

  test("context menu shows Checksum… option when right-clicking a file", async ({
    page,
  }) => {
    const fileRow = await findFileRow(page);
    test.skip(!fileRow, "No file rows visible in active panel");

    await fileRow!.click({ button: "right" });
    await expect(page.locator(MENU_SELECTOR)).toBeVisible();

    const texts = await page
      .locator(`${MENU_SELECTOR} > ${ITEM_SELECTOR}`)
      .allTextContents();
    const trimmed = texts.map((t) => t.trim());
    expect(trimmed).toContain("Checksum…");
  });

  test("context menu Checksum… item is enabled when file is selected", async ({
    page,
  }) => {
    const fileRow = await findFileRow(page);
    test.skip(!fileRow, "No file rows visible in active panel");

    await fileRow!.click({ button: "right" });
    await expect(page.locator(MENU_SELECTOR)).toBeVisible();

    const checksumItem = page.locator(
      `${MENU_SELECTOR} > ${ITEM_SELECTOR}:has-text("Checksum…")`,
    );
    await expect(checksumItem).toBeEnabled();
  });

  // ─── Toolbar ───────────────────────────────────────────────────

  test("toolbar More dropdown contains Checksum… item", async ({ page }) => {
    const dropdown = await openMoreDropdown(page);

    const checksumItem = dropdown.locator(
      'button[role="menuitem"]:has-text("Checksum…")',
    );
    await expect(checksumItem).toBeAttached();
  });

  test("toolbar Checksum… becomes enabled when a file is selected", async ({
    page,
  }) => {
    const fileRow = await findFileRow(page);
    test.skip(!fileRow, "No file rows visible in active panel");

    // Select the file first
    await fileRow!.click();

    const dropdown = await openMoreDropdown(page);

    const checksumItem = dropdown.locator(
      'button[role="menuitem"]:has-text("Checksum…")',
    );
    await expect(checksumItem).toBeEnabled();
  });

  // ─── Toast: checksum result ────────────────────────────────────

  test("triggering checksum on a file shows a toast notification", async ({
    page,
  }) => {
    const fileRow = await findFileRow(page);
    test.skip(!fileRow, "No file rows visible in active panel");

    await triggerChecksumViaContextMenu(page);

    const toast = page.locator(TOAST_SELECTOR).first();
    await expect(toast).toBeVisible();
    await expect(toast).toHaveAttribute("role", "status");

    const title = await toast.locator("strong").textContent();
    expect(title).toBeTruthy();
    // In Vite mode: "Checksum failed: …", in Tauri mode: "SHA-256: …"
    const isIpcAvailable = !title!.startsWith("Checksum failed:");
    if (isIpcAvailable) {
      expect(title).toMatch(/^SHA-256:/);
    } else {
      expect(title).toMatch(/^Checksum failed:/);
    }
  });

  test("checksum success toast has SHA-256: prefix when IPC is available", async ({
    page,
  }) => {
    const fileRow = await findFileRow(page);
    test.skip(!fileRow, "No file rows visible in active panel");

    await triggerChecksumViaContextMenu(page);

    const toast = page.locator(TOAST_SELECTOR).first();
    await expect(toast).toBeVisible();

    const title = await toast.locator("strong").textContent();
    // Skip in Vite-only mode where IPC is unavailable
    test.skip(
      title?.startsWith("Checksum failed:"),
      "Tauri IPC unavailable in browser preview — skipping success assertions",
    );

    expect(title).toMatch(/^SHA-256:/);
    await expect(toast).toHaveClass(/fo-toast-success/);
  });

  test("checksum result hash matches SHA-256 format (64 hex chars)", async ({
    page,
  }) => {
    const fileRow = await findFileRow(page);
    test.skip(!fileRow, "No file rows visible in active panel");

    await triggerChecksumViaContextMenu(page);

    const toast = page.locator(TOAST_SELECTOR).first();
    await expect(toast).toBeVisible();

    const title = await toast.locator("strong").textContent();
    test.skip(
      !title?.startsWith("SHA-256:"),
      "Tauri IPC unavailable in browser preview — skipping hash format check",
    );

    const hash = title!.replace("SHA-256: ", "");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  // ─── Error cases ───────────────────────────────────────────────

  test("checksum on directory shows error toast about selecting a file", async ({
    page,
  }) => {
    const dirRow = await findDirectoryRow(page);
    test.skip(!dirRow, "No directory rows visible in active panel");

    // Select the directory
    await dirRow!.click();

    // Open More menu and click Checksum…
    const dropdown = await openMoreDropdown(page);
    const checksumItem = dropdown.locator(
      'button[role="menuitem"]:has-text("Checksum…")',
    );
    await checksumItem.click();

    const toast = page.locator(TOAST_SELECTOR).first();
    await expect(toast).toBeVisible();
    await expect(toast).toHaveClass(/fo-toast-error/);
    const title = await toast.locator("strong").textContent();
    expect(title).toContain("Select a file");
  });

  test("checksum with no selection shows error toast", async ({ page }) => {
    // Click empty space in the table to clear any selection
    const tableShell = page.locator(".fo-table-shell").first();
    await tableShell.click();

    const dropdown = await openMoreDropdown(page);
    const checksumItem = dropdown.locator(
      'button[role="menuitem"]:has-text("Checksum…")',
    );
    await checksumItem.click();

    const toast = page.locator(TOAST_SELECTOR).first();
    await expect(toast).toBeVisible();
    await expect(toast).toHaveClass(/fo-toast-error/);
    const title = await toast.locator("strong").textContent();
    expect(title).toContain("Select a file");
  });

  test("toast element has role=status for accessibility", async ({ page }) => {
    const fileRow = await findFileRow(page);
    test.skip(!fileRow, "No file rows visible in active panel");

    await triggerChecksumViaContextMenu(page);

    const toast = page.locator(TOAST_SELECTOR).first();
    await expect(toast).toBeVisible();
    await expect(toast).toHaveAttribute("role", "status");
  });
});
