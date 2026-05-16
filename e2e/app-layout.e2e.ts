import { test, expect } from "@playwright/test";

test.describe("FileOctopus main layout", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders the shell root element", async ({ page }) => {
    const shell = page.locator("main.fo-shell");
    await expect(shell).toBeVisible();
  });

  test("renders the top bar / title bar", async ({ page }) => {
    const topbar = page.locator("header.fo-topbar");
    await expect(topbar).toBeVisible();

    await expect(topbar.locator("h1")).toHaveText("FileOctopus");
    await expect(topbar.locator("text=Settings").first()).toBeVisible();
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

  test("left panel is identifiable", async ({ page }) => {
    const panels = page.locator(".fo-panel");
    const leftPanel = panels.first();
    await expect(leftPanel).toBeVisible();
    await expect(leftPanel.locator(".fo-pane-badge")).toHaveText("Left");
  });

  test("right panel is identifiable", async ({ page }) => {
    const panels = page.locator(".fo-panel");
    const rightPanel = panels.nth(1);
    await expect(rightPanel).toBeVisible();
    await expect(rightPanel.locator(".fo-pane-badge")).toHaveText("Right");
  });

  test("one panel is active on load", async ({ page }) => {
    const activePanel = page.locator(".fo-panel.fo-panel-active");
    await expect(activePanel).toHaveCount(1);
  });

  test("renders panel headers with navigation buttons", async ({ page }) => {
    const leftPanel = page.locator(".fo-panel").first();
    const header = leftPanel.locator("header.fo-panel-header");
    await expect(header).toBeVisible();

    const nav = header.locator(".fo-panel-nav");
    await expect(nav).toBeVisible();

    await expect(nav.locator(`[aria-label*="back"]`)).toBeVisible();
    await expect(nav.locator(`[aria-label*="forward"]`)).toBeVisible();
    await expect(nav.locator(`[aria-label*="up"]`)).toBeVisible();
  });

  test("renders breadcrumb path in panel header", async ({ page }) => {
    const breadcrumb = page.locator(".fo-breadcrumb").first();
    await expect(breadcrumb).toBeVisible();

    const segments = breadcrumb.locator(".fo-breadcrumb-segments button");
    const count = await segments.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("renders the operation toolbar in each panel", async ({ page }) => {
    const toolbars = page.locator(".fo-operation-toolbar");
    const count = await toolbars.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("toolbar contains key action buttons", async ({ page }) => {
    const toolbar = page.locator(".fo-operation-toolbar").first();
    await expect(toolbar).toBeVisible();

    await expect(
      toolbar.locator("button:has-text('New Folder')").first(),
    ).toBeVisible();
    await expect(
      toolbar.locator("button:has-text('New File')").first(),
    ).toBeVisible();
    await expect(
      toolbar.locator("button:has-text('Rename')").first(),
    ).toBeVisible();
    await expect(
      toolbar.locator("button:has-text('Copy')").first(),
    ).toBeVisible();
    await expect(
      toolbar.locator("button:has-text('Move')").first(),
    ).toBeVisible();
    await expect(
      toolbar.locator("button:has-text('Trash')").first(),
    ).toBeVisible();
    await expect(
      toolbar.locator("button:has-text('Refresh')").first(),
    ).toBeVisible();
    await expect(
      toolbar.locator("button:has-text('More')").first(),
    ).toBeVisible();
  });

  test("renders column headers in file table (details view)", async ({
    page,
  }) => {
    const tableHeader = page.locator(".fo-table-header[role='row']").first();
    await expect(tableHeader).toBeVisible();

    const expectedColumns = [
      "Name",
      "Size",
      "Modified",
      "Created",
      "Type",
      "Extension",
      "Permissions",
      "Owner",
    ];

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

  test("status bar shows readiness segment", async ({ page }) => {
    const readiness = page.locator(".fo-status-readiness").first();
    await expect(readiness).toBeVisible();
  });

  test("status bar shows pane info segment", async ({ page }) => {
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
      text!.includes("Unavailable");
    expect(hasRelevantInfo).toBeTruthy();
  });

  test("status bar shows selection info", async ({ page }) => {
    const statusBar = page.locator("footer.fo-status").first();
    const text = await statusBar.textContent();
    expect(text).toContain("No selection");
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

  test("renders view mode segmented control", async ({ page }) => {
    const segmented = page
      .locator("[aria-label='left view mode'], [aria-label='right view mode']")
      .first();
    await expect(segmented).toBeVisible();
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
