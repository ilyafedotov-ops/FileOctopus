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
});
