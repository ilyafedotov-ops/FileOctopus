import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  AutostartStatusDto,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
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

describe("SettingsDialog", () => {
  it("fires onChange for accent color selection", () => {
    const onChange = vi.fn();
    render(
      <SettingsDialog
        open
        preferences={makePreferences()}
        autostart={null}
        onClose={() => {}}
        onChange={onChange}
        onSetAutostart={async () => {}}
      />,
    );
    fireEvent.click(navButton("Colors"));
    fireEvent.click(screen.getByRole("radio", { name: "Accent violet" }));
    expect(onChange).toHaveBeenCalledWith("accentColor", "violet");
  });

  it("fires onChange for font scale segmented buttons", () => {
    const onChange = vi.fn();
    render(
      <SettingsDialog
        open
        preferences={makePreferences()}
        autostart={null}
        onClose={() => {}}
        onChange={onChange}
        onSetAutostart={async () => {}}
      />,
    );
    fireEvent.click(navButton("Display"));
    const fontGroup = screen.getByRole("radiogroup", { name: "Font size" });
    fireEvent.click(within(fontGroup).getByText("Large"));
    expect(onChange).toHaveBeenCalledWith("fontScale", "large");
  });

  it("fires onChange for confirmOverwrite", () => {
    const onChange = vi.fn();
    render(
      <SettingsDialog
        open
        preferences={makePreferences()}
        autostart={null}
        onClose={() => {}}
        onChange={onChange}
        onSetAutostart={async () => {}}
      />,
    );
    fireEvent.click(navButton("Operations"));
    fireEvent.click(screen.getByLabelText("Confirm before overwrite"));
    expect(onChange).toHaveBeenCalledWith("confirmOverwrite", "false");
  });

  it("fires onChange for sidebarVisible", () => {
    const onChange = vi.fn();
    render(
      <SettingsDialog
        open
        preferences={makePreferences()}
        autostart={null}
        onClose={() => {}}
        onChange={onChange}
        onSetAutostart={async () => {}}
      />,
    );
    fireEvent.click(navButton("Layout"));
    fireEvent.click(screen.getByLabelText("Show sidebar"));
    expect(onChange).toHaveBeenCalledWith("sidebarVisible", "false");
  });

  it("fires onChange for pane mode and job drawer behavior", () => {
    const onChange = vi.fn();
    render(
      <SettingsDialog
        open
        preferences={makePreferences()}
        autostart={null}
        onClose={() => {}}
        onChange={onChange}
        onSetAutostart={async () => {}}
      />,
    );
    fireEvent.click(navButton("Layout"));
    fireEvent.change(screen.getByLabelText("Pane mode"), {
      target: { value: "single" },
    });
    fireEvent.change(screen.getByLabelText("Job drawer behavior"), {
      target: { value: "openOnError" },
    });
    expect(onChange).toHaveBeenCalledWith("paneMode", "single");
    expect(onChange).toHaveBeenCalledWith("jobDrawerBehavior", "openOnError");
  });

  it("fires onChange for terminal launch settings", () => {
    const onChange = vi.fn();
    render(
      <SettingsDialog
        open
        preferences={makePreferences()}
        autostart={null}
        onClose={() => {}}
        onChange={onChange}
        onSetAutostart={async () => {}}
      />,
    );
    fireEvent.click(navButton("Terminal"));
    fireEvent.change(screen.getByLabelText("Shell program"), {
      target: { value: "/bin/zsh" },
    });
    fireEvent.change(screen.getByLabelText("Launch arguments"), {
      target: { value: "-l\n--interactive" },
    });
    expect(onChange).toHaveBeenCalledWith("terminalShell", "/bin/zsh");
    expect(onChange).toHaveBeenCalledWith("terminalArgs", "-l\n--interactive");
  });

  it("opens toolbar customization from the layout section", () => {
    const onCustomizeToolbar = vi.fn();
    const onClose = vi.fn();
    render(
      <SettingsDialog
        open
        preferences={makePreferences()}
        autostart={null}
        onClose={onClose}
        onChange={vi.fn()}
        onSetAutostart={async () => {}}
        onCustomizeToolbar={onCustomizeToolbar}
      />,
    );
    fireEvent.click(navButton("Layout"));
    fireEvent.click(
      screen.getByRole("button", { name: "Customize button bar…" }),
    );
    expect(onCustomizeToolbar).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("disables autostart switch when platform is unsupported", () => {
    const unsupported: AutostartStatusDto = {
      enabled: false,
      supported: false,
    };
    render(
      <SettingsDialog
        open
        preferences={makePreferences()}
        autostart={unsupported}
        onClose={() => {}}
        onChange={() => {}}
        onSetAutostart={async () => {}}
      />,
    );
    fireEvent.click(navButton("General"));
    const toggle = screen.getByLabelText(
      "Start automatically at login",
    ) as HTMLInputElement;
    expect(toggle.disabled).toBe(true);
    expect(
      screen.getByText("Autostart is not supported on this platform."),
    ).toBeTruthy();
  });

  it("calls onSetAutostart when the user toggles the General switch", async () => {
    const onSetAutostart = vi.fn().mockResolvedValue(undefined);
    render(
      <SettingsDialog
        open
        preferences={makePreferences()}
        autostart={{ enabled: false, supported: true }}
        onClose={() => {}}
        onChange={() => {}}
        onSetAutostart={onSetAutostart}
      />,
    );
    fireEvent.click(navButton("General"));
    fireEvent.click(screen.getByLabelText("Start automatically at login"));
    expect(onSetAutostart).toHaveBeenCalledWith(true);
  });

  it("fires onChange for diagnostics export path", () => {
    const onChange = vi.fn();
    render(
      <SettingsDialog
        open
        preferences={makePreferences()}
        autostart={null}
        onClose={() => {}}
        onChange={onChange}
        onSetAutostart={async () => {}}
      />,
    );
    fireEvent.click(navButton("General"));
    fireEvent.change(screen.getByLabelText("Diagnostics export path"), {
      target: { value: "/home/user/diagnostics.zip" },
    });
    expect(onChange).toHaveBeenCalledWith(
      "diagnosticsExportPath",
      "/home/user/diagnostics.zip",
    );
  });

  it("uses a save picker for the diagnostics export path", async () => {
    const onChange = vi.fn();
    const pickLocalPath = vi
      .fn()
      .mockResolvedValue("/Users/ilya/Desktop/fileoctopus-diagnostics.zip");
    render(
      <SettingsDialog
        open
        preferences={makePreferences()}
        autostart={null}
        onClose={() => {}}
        onChange={onChange}
        onSetAutostart={async () => {}}
        pickLocalPath={pickLocalPath}
      />,
    );
    fireEvent.click(navButton("General"));
    fireEvent.click(
      screen.getByRole("button", { name: "Browse diagnostics export path" }),
    );
    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        "diagnosticsExportPath",
        "/Users/ilya/Desktop/fileoctopus-diagnostics.zip",
      );
    });
    expect(pickLocalPath).toHaveBeenCalledWith({
      kind: "save",
      currentPath: "/tmp/fileoctopus-diagnostics.zip",
      title: "Choose diagnostics export path",
    });
  });

  it("does not change diagnostics path when the save picker is cancelled", async () => {
    const onChange = vi.fn();
    render(
      <SettingsDialog
        open
        preferences={makePreferences()}
        autostart={null}
        onClose={() => {}}
        onChange={onChange}
        onSetAutostart={async () => {}}
        pickLocalPath={vi.fn().mockResolvedValue(null)}
      />,
    );
    fireEvent.click(navButton("General"));
    fireEvent.click(
      screen.getByRole("button", { name: "Browse diagnostics export path" }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("uses file pickers for terminal shell and default SSH key path", async () => {
    const onChange = vi.fn();
    const pickLocalPath = vi
      .fn()
      .mockResolvedValueOnce("/bin/zsh")
      .mockResolvedValueOnce("/Users/ilya/.ssh/id_ed25519");
    render(
      <SettingsDialog
        open
        preferences={makePreferences()}
        autostart={null}
        onClose={() => {}}
        onChange={onChange}
        onSetAutostart={async () => {}}
        pickLocalPath={pickLocalPath}
      />,
    );

    fireEvent.click(navButton("Terminal"));
    fireEvent.click(
      screen.getByRole("button", { name: "Browse shell program" }),
    );
    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("terminalShell", "/bin/zsh");
    });

    fireEvent.click(navButton("Network"));
    fireEvent.click(
      screen.getByRole("button", { name: "Browse default SSH key path" }),
    );
    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        "networkSshKeyPath",
        "/Users/ilya/.ssh/id_ed25519",
      );
    });
    expect(pickLocalPath).toHaveBeenNthCalledWith(1, {
      kind: "file",
      currentPath: "",
      title: "Choose shell program",
    });
    expect(pickLocalPath).toHaveBeenNthCalledWith(2, {
      kind: "file",
      currentPath: "",
      title: "Choose default SSH key",
      filters: [{ name: "SSH keys", extensions: ["pem", "key"] }],
    });
  });

  describe("Keyboard tab", () => {
    it("shows Keyboard nav button", () => {
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
      expect(navButton("Keyboard")).toBeTruthy();
    });

    it("displays shortcut groups with headings when Keyboard tab is active", () => {
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
      fireEvent.click(navButton("Keyboard"));
      const content = screen.getByRole("region", {
        name: "Keyboard settings",
      });
      expect(within(content).getByText("Navigation")).toBeTruthy();
      expect(
        within(content).getByRole("heading", { name: "View" }),
      ).toBeTruthy();
      expect(within(content).getByText("File operations")).toBeTruthy();
    });

    it("displays shortcut entries with labels and keyboard bindings", () => {
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
      fireEvent.click(navButton("Keyboard"));
      expect(screen.getByText("Switch Pane")).toBeTruthy();
      expect(screen.getByText("Copy")).toBeTruthy();
      expect(screen.getByText("Show Hidden Files")).toBeTruthy();
      const kbds = screen.getAllByRole("presentation");
      expect(kbds.length).toBeGreaterThan(0);
    });
  });

  describe("navigation polish", () => {
    function renderDialog(onChange = vi.fn()) {
      render(
        <SettingsDialog
          open
          preferences={makePreferences()}
          autostart={null}
          onClose={() => {}}
          onChange={onChange}
          onSetAutostart={async () => {}}
        />,
      );
    }

    it("highlights the matched substring in nav labels when searching", () => {
      renderDialog();
      fireEvent.change(screen.getByLabelText("Search settings"), {
        target: { value: "net" },
      });
      const nav = screen.getByRole("navigation", { name: "Settings sections" });
      const mark = nav.querySelector("mark.fo-settings-nav-match");
      expect(mark).not.toBeNull();
      expect(mark?.textContent?.toLowerCase()).toBe("net");
    });

    it("shows an empty state when no settings match the search", () => {
      renderDialog();
      fireEvent.change(screen.getByLabelText("Search settings"), {
        target: { value: "zzzzz-no-match" },
      });
      expect(screen.getByText("No matching settings.")).toBeTruthy();
    });

    it("renders a live appearance preview on the Display panel", () => {
      renderDialog();
      fireEvent.click(navButton("Display"));
      expect(
        screen.getByRole("img", {
          name: "Live preview of the current appearance settings",
        }),
      ).toBeTruthy();
    });
  });

  describe("keyboard reset confirmation", () => {
    it("requires confirmation before resetting all shortcuts", () => {
      const onChange = vi.fn();
      render(
        <SettingsDialog
          open
          preferences={makePreferences({ customShortcuts: '{"copy":"x"}' })}
          autostart={null}
          onClose={() => {}}
          onChange={onChange}
          onSetAutostart={async () => {}}
        />,
      );
      fireEvent.click(navButton("Keyboard"));
      fireEvent.click(
        screen.getByRole("button", { name: "Reset all to defaults" }),
      );

      // A confirmation dialog appears; nothing reset yet.
      expect(screen.getByText("Reset all shortcuts?")).toBeTruthy();
      expect(onChange).not.toHaveBeenCalledWith("customShortcuts", "");

      fireEvent.click(screen.getByRole("button", { name: "Reset all" }));
      expect(onChange).toHaveBeenCalledWith("customShortcuts", "");
    });
  });
});
