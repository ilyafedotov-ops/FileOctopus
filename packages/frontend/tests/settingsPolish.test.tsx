import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UserPreferencesDto } from "@fileoctopus/ts-api";
import { SettingsDialog } from "../src/components/SettingsDialog";

function makePreferences(
  overrides: Partial<UserPreferencesDto> = {},
): UserPreferencesDto {
  return {
    theme: "system",
    density: "comfortable",
    defaultViewMode: "details",
    showHiddenFiles: false,
    sidebarWidth: 240,
    splitRatio: 0.5,
    activityPanelVisible: false,
    activityPanelWidth: 288,
    confirmDelete: true,
    confirmPermanentDelete: true,
    useTrashByDefault: true,
    defaultConflictPolicy: "fail",
    accentColor: "blue",
    fontScale: "medium",
    iconScale: "medium",
    confirmOverwrite: true,
    sidebarVisible: true,
    statusBarVisible: true,
    toolbarVisible: true,
    toolbarEntries: "",
    paneMode: "dual",
    jobDrawerBehavior: "manual",
    showAdvancedCopyOptions: false,
    paneTerminalHeightLeft: 0.35,
    paneTerminalHeightRight: 0.35,
    paneTerminalDefaultOpen: false,
    terminalCdOnNavigate: false,
    confirmClosePaneWithTerminal: true,
    terminalShell: "",
    terminalArgs: "",
    rememberLastUsedPanes: true,
    diagnosticsExportPath: "/tmp/fileoctopus-diagnostics.zip",
    tabSessions: "",
    hotlistEntries: "",
    customShortcuts: "",
    columnPresets: "",
    paneDirection: "horizontal",
    logLevel: "warn",
    experimentalFeatures: false,
    cacheSizeLimit: 512,
    fileOperationThreads: 4,
    networkConnectionTimeout: 30,
    networkAutoReconnect: true,
    networkDefaultProtocol: "sftp",
    networkSshKeyPath: "",
    editorFontFamily: "",
    editorFontSize: 14,
    editorTabSize: 4,
    editorWordWrap: true,
    editorAutoSave: false,
    editorSyntaxHighlighting: true,
    editorLineNumbers: true,
    viewerDefaultViewMode: "text",
    viewerImageZoom: "fit",
    viewerMediaAutoplay: false,
    viewerMaxPreviewSize: 50,
    layoutProfiles: "",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function navButton(name: string) {
  const nav = screen.getByRole("navigation", { name: "Settings sections" });
  return within(nav).getByRole("button", { name });
}

function navButtons() {
  const nav = screen.getByRole("navigation", { name: "Settings sections" });
  return within(nav).queryAllByRole("button");
}

describe("Settings Dialog Polish", () => {
  describe("Search/filter bar", () => {
    it("renders a search input with placeholder text", () => {
      render(
        <SettingsDialog
          open
          preferences={makePreferences()}
          autostart={null}
          onClose={() => {}}
          onChange={() => {}}
          onSetAutostart={async () => {}}
        />,
      );
      const searchInput = screen.getByPlaceholderText("Search settings…");
      expect(searchInput).toBeTruthy();
    });

    it("filters visible nav items when typing in the search bar", () => {
      render(
        <SettingsDialog
          open
          preferences={makePreferences()}
          autostart={null}
          onClose={() => {}}
          onChange={() => {}}
          onSetAutostart={async () => {}}
        />,
      );
      const allButtons = navButtons();
      expect(allButtons.length).toBe(14);

      const searchInput = screen.getByPlaceholderText("Search settings…");
      fireEvent.change(searchInput, { target: { value: "term" } });

      const filteredButtons = navButtons();
      expect(filteredButtons.length).toBe(1);
      expect(filteredButtons[0].textContent).toBe("Terminal");
    });

    it("shows all nav items when search is cleared", () => {
      render(
        <SettingsDialog
          open
          preferences={makePreferences()}
          autostart={null}
          onClose={() => {}}
          onChange={() => {}}
          onSetAutostart={async () => {}}
        />,
      );
      const searchInput = screen.getByPlaceholderText("Search settings…");
      fireEvent.change(searchInput, { target: { value: "xyz" } });
      expect(navButtons().length).toBe(0);

      fireEvent.change(searchInput, { target: { value: "" } });
      expect(navButtons().length).toBe(14);
    });
  });

  describe("Section descriptions", () => {
    const tabs: Array<{ nav: string; label: string }> = [
      { nav: "General", label: "General settings" },
      { nav: "Display", label: "Display settings" },
      { nav: "Colors", label: "Colors settings" },
      { nav: "Layout", label: "Layout settings" },
      { nav: "File List", label: "File List settings" },
      { nav: "Operations", label: "Operations settings" },
      { nav: "Terminal", label: "Terminal settings" },
      { nav: "Keyboard", label: "Keyboard settings" },
      { nav: "Advanced", label: "Advanced settings" },
      { nav: "Network", label: "Network settings" },
      { nav: "Editor", label: "Editor settings" },
      { nav: "Viewer", label: "Viewer settings" },
    ];

    it.each(tabs)(
      "has a description paragraph in $nav tab",
      ({ nav, label }) => {
        render(
          <SettingsDialog
            open
            preferences={makePreferences()}
            autostart={null}
            onClose={() => {}}
            onChange={() => {}}
            onSetAutostart={async () => {}}
          />,
        );
        fireEvent.click(navButton(nav));
        const section = screen.getByRole("region", { name: label });
        const desc = section.querySelector(".fo-settings-description");
        expect(desc).toBeTruthy();
        expect(desc!.textContent!.length).toBeGreaterThan(0);
      },
    );
  });

  describe("Consistent region accessibility", () => {
    const tabs: Array<{ nav: string; label: string }> = [
      { nav: "General", label: "General settings" },
      { nav: "Display", label: "Display settings" },
      { nav: "Colors", label: "Colors settings" },
      { nav: "Layout", label: "Layout settings" },
      { nav: "File List", label: "File List settings" },
      { nav: "Operations", label: "Operations settings" },
      { nav: "Terminal", label: "Terminal settings" },
      { nav: "Keyboard", label: "Keyboard settings" },
      { nav: "Advanced", label: "Advanced settings" },
      { nav: "Network", label: "Network settings" },
      { nav: "Editor", label: "Editor settings" },
      { nav: "Viewer", label: "Viewer settings" },
    ];

    it.each(tabs)(
      "$nav section has role=region with aria-label",
      ({ nav, label }) => {
        render(
          <SettingsDialog
            open
            preferences={makePreferences()}
            autostart={null}
            onClose={() => {}}
            onChange={() => {}}
            onSetAutostart={async () => {}}
          />,
        );
        fireEvent.click(navButton(nav));
        const region = screen.getByRole("region", { name: label });
        expect(region).toBeTruthy();
      },
    );
  });

  describe("Consistent CSS class usage", () => {
    function renderDialog() {
      render(
        <SettingsDialog
          open
          preferences={makePreferences()}
          autostart={null}
          onClose={() => {}}
          onChange={() => {}}
          onSetAutostart={async () => {}}
        />,
      );
    }

    function clickGeneralTab() {
      fireEvent.click(navButton("General"));
    }

    it("settings panels have consistent fo-settings-section class", () => {
      renderDialog();
      clickGeneralTab();
      const sections = document.querySelectorAll(".fo-settings-section");
      expect(sections.length).toBeGreaterThan(0);
      sections.forEach((section) => {
        expect(section.className).toContain("fo-settings-section");
      });
    });

    it("settings controls use consistent fo-settings-field layout", () => {
      renderDialog();
      clickGeneralTab();
      const fields = document.querySelectorAll(".fo-settings-field");
      expect(fields.length).toBeGreaterThan(0);
    });

    it("settings checkboxes use fo-settings-checkbox class", () => {
      renderDialog();
      clickGeneralTab();
      const checkboxes = document.querySelectorAll(".fo-settings-checkbox");
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it("settings dialog has fo-settings-dialog wrapper", () => {
      renderDialog();
      const dialog = document.querySelector(".fo-settings-dialog");
      expect(dialog).toBeTruthy();
    });

    it("settings layout uses fo-settings-layout grid", () => {
      renderDialog();
      const layout = document.querySelector(".fo-settings-layout");
      expect(layout).toBeTruthy();
    });

    it("settings nav uses fo-settings-nav class", () => {
      renderDialog();
      const nav = document.querySelector(".fo-settings-nav");
      expect(nav).toBeTruthy();
    });

    it("active nav button has data-active attribute", () => {
      renderDialog();
      const activeBtn = document.querySelector(
        ".fo-settings-nav button[data-active='true']",
      );
      expect(activeBtn).toBeTruthy();
      expect(activeBtn?.textContent).toBe("General");
    });

    it("non-active nav buttons do not have data-active=true", () => {
      renderDialog();
      const allNavBtns = document.querySelectorAll(".fo-settings-nav button");
      const activeBtns = document.querySelectorAll(
        ".fo-settings-nav button[data-active='true']",
      );
      expect(allNavBtns.length).toBeGreaterThan(activeBtns.length);
    });

    it("active nav button changes when clicking a different tab", () => {
      renderDialog();
      fireEvent.click(navButton("Display"));
      const activeBtn = document.querySelector(
        ".fo-settings-nav button[data-active='true']",
      );
      expect(activeBtn?.textContent).toBe("Display");
    });

    it("each section has an fo-settings-description paragraph", () => {
      renderDialog();
      fireEvent.click(navButton("General"));
      const section = screen.getByRole("region", {
        name: "General settings",
      });
      const desc = section.querySelector(".fo-settings-description");
      expect(desc).toBeTruthy();
      expect(desc!.textContent!.length).toBeGreaterThan(0);
    });

    it("plugins section uses fo-settings-section wrapper", () => {
      const pluginClient = {
        list: vi.fn().mockResolvedValue({ plugins: [] }),
        uninstall: vi.fn(),
        toggle: vi.fn(),
      };
      render(
        <SettingsDialog
          open
          preferences={makePreferences()}
          autostart={null}
          onClose={() => {}}
          onChange={() => {}}
          onSetAutostart={async () => {}}
          pluginClient={pluginClient}
        />,
      );
      fireEvent.click(navButton("Plugins"));
      const sections = document.querySelectorAll(".fo-settings-section");
      const pluginSection = Array.from(sections).find(
        (s) => s.querySelector("h3")?.textContent === "Plugins",
      );
      expect(pluginSection).toBeTruthy();
    });
  });
});
