import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { SettingsNetwork } from "../src/components/settings/SettingsNetwork";
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
    customShortcuts: "",
    fileTypeColorRules: "",
    layoutProfiles: "",
    columnPresets: "",
    tabSessions: "",
    logLevel: "warn",
    experimentalFeatures: false,
    cacheSizeLimit: 256,
    fileOperationThreads: 4,
    networkConnectionTimeout: 30,
    networkAutoReconnect: true,
    networkDefaultProtocol: "sftp",
    networkSshKeyPath: "",
    ...overrides,
  };
}

afterEach(cleanup);

describe("SettingsNetwork", () => {
  it("renders section heading", () => {
    render(<SettingsNetwork preferences={makePrefs()} onChange={vi.fn()} />);
    expect(screen.getByText("Network")).toBeTruthy();
  });

  it("renders connection timeout field with current value", () => {
    render(<SettingsNetwork preferences={makePrefs()} onChange={vi.fn()} />);
    const input = screen.getByLabelText(
      "Connection timeout in seconds",
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe("30");
  });

  it("calls onChange when connection timeout changes", () => {
    const onChange = vi.fn();
    render(<SettingsNetwork preferences={makePrefs()} onChange={onChange} />);
    const input = screen.getByLabelText(
      "Connection timeout in seconds",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "60" } });
    expect(onChange).toHaveBeenCalledWith("networkConnectionTimeout", "60");
  });

  it("renders auto-reconnect checkbox", () => {
    render(<SettingsNetwork preferences={makePrefs()} onChange={vi.fn()} />);
    const checkbox = screen.getByLabelText(
      "Auto-reconnect on disconnect",
    ) as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    expect(checkbox.checked).toBe(true);
  });

  it("calls onChange when auto-reconnect toggled", () => {
    const onChange = vi.fn();
    render(<SettingsNetwork preferences={makePrefs()} onChange={onChange} />);
    const checkbox = screen.getByLabelText(
      "Auto-reconnect on disconnect",
    ) as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith("networkAutoReconnect", "false");
  });

  it("renders default protocol selector", () => {
    render(<SettingsNetwork preferences={makePrefs()} onChange={vi.fn()} />);
    const select = screen.getByLabelText(
      "Default protocol",
    ) as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe("sftp");
  });

  it("calls onChange when default protocol changes", () => {
    const onChange = vi.fn();
    render(<SettingsNetwork preferences={makePrefs()} onChange={onChange} />);
    const select = screen.getByLabelText(
      "Default protocol",
    ) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "smb" } });
    expect(onChange).toHaveBeenCalledWith("networkDefaultProtocol", "smb");
  });

  it("renders SSH key path input", () => {
    render(
      <SettingsNetwork
        preferences={makePrefs({ networkSshKeyPath: "/home/user/.ssh/id_rsa" })}
        onChange={vi.fn()}
      />,
    );
    const input = screen.getByLabelText(
      "Default SSH key path",
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe("/home/user/.ssh/id_rsa");
  });

  it("calls onChange when SSH key path changes", () => {
    const onChange = vi.fn();
    render(<SettingsNetwork preferences={makePrefs()} onChange={onChange} />);
    const input = screen.getByLabelText(
      "Default SSH key path",
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: { value: "/home/user/.ssh/custom_key" },
    });
    expect(onChange).toHaveBeenCalledWith(
      "networkSshKeyPath",
      "/home/user/.ssh/custom_key",
    );
  });
});
