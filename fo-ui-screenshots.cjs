const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const OUT = "/tmp/fo-ui-shots";
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  console.log("Loading app...");
  await page.goto("http://localhost:1420", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  // Dismiss first-run dialog if present
  try {
    const dialog = page.locator('[role="dialog"]');
    if (await dialog.isVisible().catch(() => false)) {
      console.log("Dismissing first-run dialog...");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }
  } catch (e) {}

  // === 01: Main dual-pane layout ===
  console.log("01: Main layout");
  await page.screenshot({ path: path.join(OUT, "01-main-layout.png") });

  // === 02: File table hover ===
  console.log("02: File table hover");
  const rows = page.locator("[role='row']").filter({ has: page.locator("td, [role='gridcell']") });
  const rowCount = await rows.count();
  console.log(`  Found ${rowCount} data rows`);
  if (rowCount > 3) {
    await rows.nth(3).hover();
    await page.waitForTimeout(300);
    const leftPanel = page.locator(".fo-panel").first();
    if (await leftPanel.isVisible().catch(() => false)) {
      await leftPanel.screenshot({ path: path.join(OUT, "02-file-table-hover.png") });
    }
  } else {
    // No rows — screenshot empty pane state (PaneStateView)
    console.log("  No data rows, capturing empty pane");
    const leftPanel = page.locator(".fo-panel").first();
    if (await leftPanel.isVisible().catch(() => false)) {
      await leftPanel.screenshot({ path: path.join(OUT, "02-empty-pane.png") });
    }
  }

  // === 03: Context menu ===
  console.log("03: Context menu");
  // Right-click in file table area
  const tableArea = page.locator(".fo-table-shell").first();
  if (await tableArea.isVisible().catch(() => false)) {
    await tableArea.click({ button: "right" });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, "03-context-menu.png") });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  // === 04: Command palette ===
  console.log("04: Command palette");
  const shell = page.locator(".fo-shell");
  await shell.press("Control+p");
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "04-command-palette.png") });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // === 05: Settings dialog ===
  console.log("05: Settings dialog");
  await shell.press("Control+,");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, "05-settings-dialog.png") });

  // Navigate settings nav items (inside dialog, scoped)
  const dialog = page.locator('[role="dialog"]');
  const navItems = dialog.locator('[role="tab"], [role="treeitem"], nav button, nav [role="button"]');
  const navCount = await navItems.count();
  console.log(`  Settings nav items: ${navCount}`);
  for (let i = 0; i < Math.min(navCount, 8); i++) {
    const text = await navItems.nth(i).textContent().catch(() => `nav-${i}`);
    const safeName = text.trim().replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase().replace(/^-|-$/g, "");
    console.log(`  Nav ${i}: ${text.trim()}`);
    try {
      await navItems.nth(i).click({ force: true });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT, `06-settings-${safeName}.png`) });
    } catch (e) {
      console.log(`    Click failed: ${e.message.split('\n')[0]}`);
    }
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  // === 06: Properties dialog ===
  console.log("07: Properties dialog");
  // Need a row selected first
  if (rowCount > 3) {
    await rows.nth(3).click();
    await page.waitForTimeout(300);
  }
  await shell.press("Control+i");
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "07-properties-dialog.png") });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // === 07: Shortcuts dialog ===
  console.log("08: Shortcuts dialog");
  await shell.press("Control+/");
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "08-shortcuts-dialog.png") });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // === 08: Toolbar ===
  console.log("09: Toolbar");
  const toolbar = page.locator(".fo-operation-toolbar").first();
  if (await toolbar.isVisible().catch(() => false)) {
    await toolbar.screenshot({ path: path.join(OUT, "09-toolbar.png") });
  }

  // === 09: Status bar ===
  console.log("10: Status bar");
  const statusBar = page.locator("footer.fo-status").first();
  if (await statusBar.isVisible().catch(() => false)) {
    await statusBar.screenshot({ path: path.join(OUT, "10-status-bar.png") });
  }

  // === 10: Sidebar ===
  console.log("11: Sidebar");
  const sidebar = page.locator("aside.fo-sidebar").first();
  if (await sidebar.isVisible().catch(() => false)) {
    await sidebar.screenshot({ path: path.join(OUT, "11-sidebar.png") });
  }

  // === 11: Title bar ===
  console.log("12: Title bar");
  const titleBar = page.locator("header.fo-topbar").first();
  if (await titleBar.isVisible().catch(() => false)) {
    await titleBar.screenshot({ path: path.join(OUT, "12-titlebar.png") });
  }

  // === 12: Right panel (preview pane if visible) ===
  console.log("13: Right panel");
  const rightPanel = page.locator(".fo-panel").nth(1);
  if (await rightPanel.isVisible().catch(() => false)) {
    await rightPanel.screenshot({ path: path.join(OUT, "13-right-panel.png") });
  }

  // === 13: Menu bar ===
  console.log("14: Menu bar open");
  const menuButtons = page.locator("button[aria-haspopup='menu'], .fo-menubar button").filter({ hasText: /File|Go|View|Help/i });
  const mbCount = await menuButtons.count();
  console.log(`  Menu buttons found: ${mbCount}`);
  if (mbCount > 0) {
    await menuButtons.first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, "14-menu-bar.png") });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  if (errors.length > 0) {
    console.log(`\nConsole errors (${errors.length}):`);
    errors.slice(0, 10).forEach((e) => console.log(`  - ${e.substring(0, 120)}`));
  }

  const files = fs.readdirSync(OUT).filter(f => f.endsWith(".png")).sort();
  console.log(`\nDone! ${files.length} screenshots in ${OUT}:`);
  files.forEach(f => {
    const stat = fs.statSync(path.join(OUT, f));
    console.log(`  ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
  });

  await browser.close();
})();
