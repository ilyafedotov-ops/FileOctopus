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
    paneMode: "dual",
    jobDrawerBehavior: "manual",
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
    fireEvent.click(navButton("Appearance"));
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
    fireEvent.click(navButton("Appearance"));
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
    fireEvent.click(navButton("Files & Folders"));
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

  describe("Shortcuts tab", () => {
    it("shows Shortcuts nav button", () => {
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
      expect(navButton("Shortcuts")).toBeTruthy();
    });

    it("displays shortcut groups with headings when Shortcuts tab is active", () => {
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
      fireEvent.click(navButton("Shortcuts"));
      const content = screen.getByRole("region", {
        name: "Shortcuts settings",
      });
      expect(within(content).getByText("Navigation")).toBeTruthy();
      expect(within(content).getByText("View")).toBeTruthy();
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
      fireEvent.click(navButton("Shortcuts"));
      expect(screen.getByText("Switch active pane")).toBeTruthy();
      expect(screen.getByText("Copy")).toBeTruthy();
      expect(screen.getByText("Show Hidden Files")).toBeTruthy();
      const kbds = screen.getAllByRole("presentation");
      expect(kbds.length).toBeGreaterThan(0);
    });
  });
});
