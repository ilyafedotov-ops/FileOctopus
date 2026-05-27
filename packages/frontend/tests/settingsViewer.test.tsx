import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { SettingsViewer } from "../src/components/settings/SettingsViewer";
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
    editorFontFamily: "monospace",
    editorFontSize: 14,
    editorTabSize: 4,
    editorWordWrap: true,
    editorAutoSave: false,
    editorSyntaxHighlighting: true,
    editorLineNumbers: true,
    viewerDefaultViewMode: "text",
    viewerImageZoom: "fit",
    viewerMediaAutoplay: false,
    viewerMaxPreviewSize: 10,
    ...overrides,
  };
}

afterEach(cleanup);

describe("SettingsViewer", () => {
  it("renders section heading", () => {
    render(<SettingsViewer preferences={makePrefs()} onChange={vi.fn()} />);
    expect(screen.getByText("Viewer")).toBeTruthy();
  });

  it("renders default view mode selector", () => {
    render(<SettingsViewer preferences={makePrefs()} onChange={vi.fn()} />);
    const select = screen.getByLabelText(
      "Default view mode",
    ) as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe("text");
  });

  it("calls onChange when default view mode changes", () => {
    const onChange = vi.fn();
    render(<SettingsViewer preferences={makePrefs()} onChange={onChange} />);
    const select = screen.getByLabelText(
      "Default view mode",
    ) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "hex" } });
    expect(onChange).toHaveBeenCalledWith("viewerDefaultViewMode", "hex");
  });

  it("renders image zoom selector", () => {
    render(<SettingsViewer preferences={makePrefs()} onChange={vi.fn()} />);
    const select = screen.getByLabelText(
      "Image zoom behavior",
    ) as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe("fit");
  });

  it("calls onChange when image zoom changes", () => {
    const onChange = vi.fn();
    render(<SettingsViewer preferences={makePrefs()} onChange={onChange} />);
    const select = screen.getByLabelText(
      "Image zoom behavior",
    ) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "actual" } });
    expect(onChange).toHaveBeenCalledWith("viewerImageZoom", "actual");
  });

  it("renders media autoplay checkbox unchecked", () => {
    render(<SettingsViewer preferences={makePrefs()} onChange={vi.fn()} />);
    const checkbox = screen.getByLabelText(
      "Media autoplay",
    ) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it("calls onChange when media autoplay toggled", () => {
    const onChange = vi.fn();
    render(<SettingsViewer preferences={makePrefs()} onChange={onChange} />);
    const checkbox = screen.getByLabelText(
      "Media autoplay",
    ) as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith("viewerMediaAutoplay", "true");
  });

  it("renders max preview size field", () => {
    render(<SettingsViewer preferences={makePrefs()} onChange={vi.fn()} />);
    const input = screen.getByLabelText(
      "Max preview file size in MB",
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe("10");
  });

  it("calls onChange when max preview size changes", () => {
    const onChange = vi.fn();
    render(<SettingsViewer preferences={makePrefs()} onChange={onChange} />);
    const input = screen.getByLabelText(
      "Max preview file size in MB",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "50" } });
    expect(onChange).toHaveBeenCalledWith("viewerMaxPreviewSize", "50");
  });
});
