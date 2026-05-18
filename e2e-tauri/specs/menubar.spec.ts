import { browser, expect, $, $$ } from "@wdio/globals";

const SHELL = ".fo-shell";
const MENU_TRIGGER = ".fo-menubar-trigger";
const DIALOG = "dialog, [role='dialog']";

async function waitForShell(timeout = 15_000) {
  await $(SHELL).waitForExist({ timeout });
}

async function openMenu(index: number) {
  const trigger = await $$(MENU_TRIGGER);
  await trigger[index].click();
}

async function clickMenuItem(label: string) {
  const labels = await $$("button[role='menuitem'] .fo-ui-dropdown-label");
  for (const item of labels) {
    if ((await item.getText()).trim() === label) {
      await item.click();
      return true;
    }
  }
  return false;
}

describe("FileOctopus — menubar actions", () => {
  before(async () => {
    await waitForShell();
  });

  it("opens Go to Location dialog from Go menu", async () => {
    await openMenu(3);
    const clicked = await clickMenuItem("Location…");
    expect(clicked).toBe(true);

    const dialog = await $(DIALOG);
    await dialog.waitForExist({ timeout: 5_000 });
    await expect(dialog).toBeExisting();

    await browser.keys(["Escape"]);
  });

  it("opens About dialog from Help menu", async () => {
    await openMenu(6);
    const clicked = await clickMenuItem("About FileOctopus…");
    expect(clicked).toBe(true);

    const dialog = await $(DIALOG);
    await dialog.waitForExist({ timeout: 5_000 });
    await expect(dialog).toBeExisting();

    await browser.keys(["Escape"]);
  });

  it("focuses recursive search input from Tools menu", async () => {
    await openMenu(4);
    const clicked = await clickMenuItem("Search Recursively…");
    expect(clicked).toBe(true);

    const input = await $("input[placeholder='Search recursively…']");
    await input.waitForExist({ timeout: 3_000 });
    await browser.waitUntil(
      async () => (await input.getProperty("focused")) === true,
      { timeout: 3_000, timeoutMsg: "recursive search input was not focused" },
    );
  });

  it("focuses filter input from Tools menu", async () => {
    await openMenu(4);
    const clicked = await clickMenuItem("Filter Current Folder");
    expect(clicked).toBe(true);

    const input = await $("input[placeholder='Filter current folder…']");
    await input.waitForExist({ timeout: 3_000 });
    await browser.waitUntil(
      async () => (await input.getProperty("focused")) === true,
      { timeout: 3_000, timeoutMsg: "filter input was not focused" },
    );
  });

  it("lists Compress and Open Terminal menu items", async () => {
    await openMenu(0);
    const fileLabels = await $$(
      "button[role='menuitem'] .fo-ui-dropdown-label",
    );
    const fileTexts = await Promise.all(
      fileLabels.map((label) => label.getText()),
    );
    expect(fileTexts.some((text) => text.includes("Compress"))).toBe(true);

    await browser.keys(["Escape"]);

    await openMenu(4);
    const toolLabels = await $$(
      "button[role='menuitem'] .fo-ui-dropdown-label",
    );
    const toolTexts = await Promise.all(
      toolLabels.map((label) => label.getText()),
    );
    expect(toolTexts.some((text) => text.includes("Open Terminal"))).toBe(true);
  });
});
