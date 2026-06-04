const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const themes = ["dark", "light", "commander-blue"];
  const densities = ["compact", "comfortable", "spacious"];

  for (const theme of themes) {
    for (const density of densities) {
      await page.goto("http://localhost:1420");
      await page.waitForTimeout(1500);

      // Close first-run dialog if present
      const closeBtn = page.locator("button[aria-label='Close'], .fo-dialog-close, button:has-text('Close'), button:has-text('Skip')");
      if (await closeBtn.count() > 0) {
        try { await closeBtn.first().click(); } catch(e) {}
        await page.waitForTimeout(500);
      }

      // Dismiss any overlay/modal
      try { await page.keyboard.press("Escape"); } catch(e) {}
      await page.waitForTimeout(300);

      // Set theme and density
      await page.evaluate(([t, d]) => {
        document.documentElement.setAttribute("data-theme", t);
        document.documentElement.setAttribute("data-density", d);
      }, [theme, density]);

      await page.waitForTimeout(1200);

      const filename = `/tmp/fo-contrast-audit/${theme}-${density}.png`;
      await page.screenshot({ path: filename, fullPage: false });
      console.log(`OK: ${theme}-${density}`);
    }
  }

  await browser.close();
  console.log("DONE");
})();
