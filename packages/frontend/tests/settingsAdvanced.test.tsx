import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { SettingsAdvanced } from "../src/components/settings/SettingsAdvanced";
import type { UserPreferencesDto } from "@fileoctopus/ts-api";

function makePrefs(
  overrides: Partial<UserPreferencesDto> = {},
): UserPreferencesDto {
  return {
    theme: "system",
    density: "comfortable",
    defaultViewMode: "details",
    showHiddenFiles: false,
    sidebarWidth: 280,
    splitRatio: 0.5,
    activityPanelVisible: false,
    activityPanelWidth: 320,
    confirmDelete: true,
    confirmPermanentDelete: false,
    useTrashByDefault: true,
    defaultConflictPolicy: "ask",
    accentColor: "blue",
    fontScale: "1",
    iconScale: "1",
    confirmOverwrite: true,
    sidebarVisible: true,
    statusBarVisible: true,
    toolbarVisible: true,
    toolbarEntries: "[]",
    paneMode: "dual",
    paneDirection: "horizontal",
    jobDrawerBehavior: "auto",
    showAdvancedCopyOptions: false,
    paneTerminalHeightLeft: 200,
    paneTerminalHeightRight: 200,
    paneTerminalDefaultOpen: false,
    terminalCdOnNavigate: true,
    confirmClosePaneWithTerminal: true,
    terminalShell: "",
    terminalArgs: "",
    rememberLastUsedPanes: false,
    diagnosticsExportPath: "/tmp/fileoctopus-diagnostics.zip",
    customShortcuts: "{}",
    fileTypeColorRules: "[]",
    layoutProfiles: "[]",
    columnPresets: "[]",
    tabSessions: "[]",
    logLevel: "warn",
    experimentalFeatures: false,
    cacheSizeLimit: 256,
    fileOperationThreads: 4,
    ...overrides,
  } as UserPreferencesDto;
}

afterEach(cleanup);

describe("SettingsAdvanced", () => {
  it("renders the Advanced section heading", () => {
    const onChange = vi.fn();
    render(<SettingsAdvanced preferences={makePrefs()} onChange={onChange} />);
    expect(screen.getByText("Advanced")).toBeTruthy();
  });

  it("renders log level select with current value", () => {
    const onChange = vi.fn();
    render(
      <SettingsAdvanced
        preferences={makePrefs({ logLevel: "debug" })}
        onChange={onChange}
      />,
    );
    const select = document.querySelector("select") as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe("debug");
  });

  it("calls onChange when log level changes", () => {
    const onChange = vi.fn();
    render(<SettingsAdvanced preferences={makePrefs()} onChange={onChange} />);
    const select = document.querySelector("select") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "error" } });
    expect(onChange).toHaveBeenCalledWith("logLevel", "error");
  });

  it("renders experimental features checkbox", () => {
    const onChange = vi.fn();
    render(
      <SettingsAdvanced
        preferences={makePrefs({ experimentalFeatures: true })}
        onChange={onChange}
      />,
    );
    const checkbox = document.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    expect(checkbox.checked).toBe(true);
  });

  it("calls onChange when experimental features toggled", () => {
    const onChange = vi.fn();
    render(<SettingsAdvanced preferences={makePrefs()} onChange={onChange} />);
    const checkbox = document.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith("experimentalFeatures", "true");
  });

  it("renders cache size limit input", () => {
    const onChange = vi.fn();
    render(
      <SettingsAdvanced
        preferences={makePrefs({ cacheSizeLimit: 512 })}
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText(/cache size/i) as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe("512");
  });

  it("calls onChange when cache size changes", () => {
    const onChange = vi.fn();
    render(<SettingsAdvanced preferences={makePrefs()} onChange={onChange} />);
    const input = screen.getByLabelText(/cache size/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1024" } });
    expect(onChange).toHaveBeenCalledWith("cacheSizeLimit", "1024");
  });

  it("renders file operation threads input", () => {
    const onChange = vi.fn();
    render(
      <SettingsAdvanced
        preferences={makePrefs({ fileOperationThreads: 8 })}
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText(/thread/i) as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe("8");
  });

  it("calls onChange when thread count changes", () => {
    const onChange = vi.fn();
    render(<SettingsAdvanced preferences={makePrefs()} onChange={onChange} />);
    const input = screen.getByLabelText(/thread/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2" } });
    expect(onChange).toHaveBeenCalledWith("fileOperationThreads", "2");
  });
});
