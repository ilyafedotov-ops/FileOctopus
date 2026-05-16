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
    activityPanelVisible: true,
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
});
