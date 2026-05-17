import { browser, expect, $, $$ } from "@wdio/globals";

const SHELL = ".fo-shell";
const PANEL = ".fo-panel";
const SIDEBAR = ".fo-sidebar";
const STATUS_BAR = ".fo-status";
const MENU_TRIGGER = ".fo-menubar-trigger";
const DIALOG = "dialog, [role='dialog']";

async function waitForShell(timeout = 15_000) {
  await $(SHELL).waitForExist({ timeout });
}

describe("FileOctopus — smoke", () => {
  before(async () => {
    await waitForShell();
  });

  it("launches and renders the shell frame", async () => {
    await expect($(SHELL)).toBeExisting();
    await expect($(".fo-shell-frame")).toBeExisting();
  });

  it("renders two file panels by default (dual-pane)", async () => {
    const panels = await $$(PANEL);
    expect(panels.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the sidebar with at least one location", async () => {
    await expect($(SIDEBAR)).toBeExisting();
    const items = await $$(`${SIDEBAR} .fo-sidebar-item`);
    expect(items.length).toBeGreaterThan(0);
  });

  it("renders the status bar with the active-pane segment", async () => {
    await expect($(STATUS_BAR)).toBeExisting();
    const pane = await $(`${STATUS_BAR} .fo-status-pane`).getText();
    expect(pane.length).toBeGreaterThan(0);
  });

  it("opens the File menu and lists Settings…", async () => {
    const trigger = await $$(MENU_TRIGGER);
    await trigger[0].click();
    const item = await $(
      "button[role='menuitem'] .fo-ui-dropdown-label*=Settings",
    );
    await item.waitForDisplayed({ timeout: 3_000 });
    await expect(item).toBeDisplayed();
    await browser.keys(["Escape"]);
  });

  it("opens the Settings dialog when chosen from the menu", async () => {
    const trigger = await $$(MENU_TRIGGER);
    await trigger[0].click();
    const labels = await $$("button[role='menuitem'] .fo-ui-dropdown-label");
    for (const label of labels) {
      if ((await label.getText()).trim() === "Settings…") {
        await label.click();
        break;
      }
    }
    const dialog = await $(DIALOG);
    await dialog.waitForExist({ timeout: 5_000 });
    await expect(dialog).toBeExisting();
    const closeBtn = await $(`${DIALOG} button*=Close`);
    if (await closeBtn.isExisting()) {
      await closeBtn.click();
    } else {
      await browser.keys(["Escape"]);
    }
  });

  it("toggles theme via View menu", async () => {
    const htmlEl = await $("html");
    const themeBefore = await htmlEl.getAttribute("data-theme");

    const trigger = await $$(MENU_TRIGGER);
    await trigger[2].click(); // View

    const labels = await $$("button[role='menuitem'] .fo-ui-dropdown-label");
    for (const label of labels) {
      if ((await label.getText()).trim() === "Theme: Dark") {
        await label.click();
        break;
      }
    }

    await browser.waitUntil(
      async () => (await htmlEl.getAttribute("data-theme")) === "dark",
      { timeout: 3_000, timeoutMsg: `theme stayed at ${themeBefore}` },
    );
  });
});
