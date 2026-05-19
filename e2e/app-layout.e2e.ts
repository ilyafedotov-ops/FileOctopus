import { test, expect } from "@playwright/test";

test.describe("FileOctopus main layout", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-shell");
    await page.waitForSelector("aside.fo-sidebar");
  });

  test("renders the shell root element", async ({ page }) => {
    const shell = page.locator("main.fo-shell");
    await expect(shell).toBeVisible();
  });

  test("shell has tabIndex for keyboard event routing", async ({ page }) => {
    const shell = page.locator("main.fo-shell");
    await expect(shell).toHaveAttribute("tabIndex", "-1");
  });

  test("renders the top bar / title bar", async ({ page }) => {
    const topbar = page.locator("header.fo-topbar");
    await expect(topbar).toBeVisible();

    await expect(topbar.locator("h1")).not.toBeEmpty();
    await expect(topbar.locator("text=Settings").first()).toBeVisible();
    await expect(topbar.getByRole("menubar")).toBeVisible();
  });

  test("renders the sidebar", async ({ page }) => {
    const sidebar = page.locator("aside.fo-sidebar");
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toHaveAttribute("aria-label", "Standard locations");
  });

  test("renders sidebar sections", async ({ page }) => {
    const sidebar = page.locator("aside.fo-sidebar");
    const sections = sidebar.locator(".fo-sidebar-section");
    await expect(sections.first()).toBeVisible();
  });

  test("renders the dual-pane area", async ({ page }) => {
    const dualPane = page.locator(".fo-dual-pane");
    await expect(dualPane).toBeVisible();
    await expect(dualPane).toHaveAttribute("aria-label", "File panels");
  });

  test("renders both file panels (left and right)", async ({ page }) => {
    const panels = page.locator(".fo-panel");
    const count = await panels.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("left and right panels are distinguishable by order", async ({
    page,
  }) => {
    const panels = page.locator(".fo-panel");
    await expect(panels.first()).toBeVisible();
    await expect(panels.nth(1)).toBeVisible();
  });

  test("one panel is active on load", async ({ page }) => {
    const activePanel = page.locator(".fo-panel.fo-panel-active");
    await expect(activePanel).toHaveCount(1);
  });

  test("renders workbench toolbar with navigation buttons", async ({
    page,
  }) => {
    const toolbar = page.locator(".fo-workbench-toolbar .fo-operation-toolbar");
    await expect(toolbar).toBeVisible();

    await expect(toolbar.getByRole("button", { name: "Back" })).toBeVisible();
    await expect(
      toolbar.getByRole("button", { name: "Forward" }),
    ).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "Up" })).toBeVisible();
  });

  test("renders breadcrumb path in panel header", async ({ page }) => {
    const breadcrumb = page.locator(".fo-breadcrumb").first();
    await expect(breadcrumb).toBeVisible();

    const segments = breadcrumb.locator(".fo-breadcrumb-segments button");
    const count = await segments.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("renders the shared operation toolbar", async ({ page }) => {
    const toolbars = page.locator(
      ".fo-workbench-toolbar .fo-operation-toolbar",
    );
    await expect(toolbars).toHaveCount(1);
  });

  test("toolbar contains navigation and overflow actions", async ({ page }) => {
    const toolbar = page.locator(".fo-operation-toolbar").first();
    await expect(toolbar).toBeVisible();

    await expect(toolbar.getByRole("button", { name: "Back" })).toBeVisible();
    await expect(
      toolbar.getByRole("button", { name: "Refresh" }),
    ).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "More" })).toBeVisible();

    await toolbar.getByRole("button", { name: "More" }).click();
    await page.waitForTimeout(500);
    // More dropdown has Copy, Paste, etc. (New Folder is now a primary button)
    await expect(page.getByRole("menuitem", { name: "Paste" })).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "New File" }),
    ).toBeVisible();
  });

  test("renders column headers in file table (details view)", async ({
    page,
  }) => {
    const tableHeader = page.locator(".fo-table-header[role='row']").first();
    await expect(tableHeader).toBeVisible();

    const expectedColumns = ["Name", "size", "kind", "modified"];

    for (const col of expectedColumns) {
      await expect(
        tableHeader.locator(`.fo-column-label:text-is('${col}')`),
      ).toBeVisible();
    }
  });

  test("renders file table shell", async ({ page }) => {
    const tableShell = page.locator(".fo-table-shell").first();
    await expect(tableShell).toBeVisible();
  });

  test("renders file table viewport", async ({ page }) => {
    const viewport = page.locator(".fo-table-viewport").first();
    await expect(viewport).toBeVisible();
  });

  test("renders the status bar at the bottom", async ({ page }) => {
    const statusBar = page.locator("footer.fo-status");
    await expect(statusBar).toBeVisible();
    await expect(statusBar).toHaveAttribute("aria-label", "Application status");
  });

  test("status bar shows pane segment", async ({ page }) => {
    const paneInfo = page.locator(".fo-status-pane").first();
    await expect(paneInfo).toBeVisible();
  });

  test("status bar shows item count or loading state", async ({ page }) => {
    const statusBar = page.locator("footer.fo-status").first();
    const text = await statusBar.textContent();
    expect(text).toBeTruthy();
    const hasRelevantInfo =
      text!.includes("item") ||
      text!.includes("Loading") ||
      text!.includes("Empty") ||
      text!.includes("Unavailable") ||
      text!.includes("Selected") ||
      text!.includes("Total");
    expect(hasRelevantInfo).toBeTruthy();
  });

  test("status bar shows selection info", async ({ page }) => {
    const statusBar = page.locator("footer.fo-status").first();
    const text = await statusBar.textContent();
    expect(text).toMatch(/Selected:|Total:/);
  });

  test("renders panel filter row", async ({ page }) => {
    const filterRow = page.locator(".fo-panel-filter-row").first();
    await expect(filterRow).toBeVisible();

    const filterInput = filterRow.locator(".fo-filter").first();
    await expect(filterInput).toBeVisible();
    await expect(filterInput).toHaveAttribute(
      "placeholder",
      "Filter current folder…",
    );
  });

  test("renders view mode control in toolbar", async ({ page }) => {
    const viewButton = page
      .locator(".fo-operation-toolbar")
      .getByRole("button", { name: /View/i })
      .first();
    await expect(viewButton).toBeVisible();
  });

  test("renders the workspace section", async ({ page }) => {
    const workspace = page.locator("section.fo-workspace");
    await expect(workspace).toBeVisible();
    await expect(workspace).toHaveAttribute("aria-label", "File workspace");
  });

  test("renders pane status footer in each panel", async ({ page }) => {
    const paneStatuses = page.locator("footer.fo-pane-status");
    const count = await paneStatuses.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});
