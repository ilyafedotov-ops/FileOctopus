import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  TerminalProfileDto,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
import { SettingsTerminal } from "../src/components/settings/SettingsTerminal";

const profile: TerminalProfileDto = {
  id: "profile-1",
  name: "Dev Shell",
  scope: "local",
  shell: "/bin/zsh",
  args: "-l",
  env: "RUST_LOG=debug",
  workingDirectoryMode: "currentPane",
  customCwdUri: "",
  networkProfileId: null,
  remoteCwd: "",
  initialCommand: "pwd",
  fontFamily: "JetBrains Mono",
  fontSize: 15,
  lineHeight: 1.25,
  cursorStyle: "bar",
  cursorBlink: true,
  scrollback: 10000,
  themeId: "dark",
  themeOverrides: "",
  copyOnSelect: true,
  rightClickAction: "paste",
  pasteConfirmation: true,
  linkHandling: "openExternal",
  sortOrder: 0,
  isDefault: true,
  createdAt: "2026-06-01T00:00:00Z",
  updatedAt: "2026-06-01T00:00:00Z",
};

function makePrefs(): UserPreferencesDto {
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
    diagnosticsExportPath: "",
    customShortcuts: "",
    fileTypeColorRules: "",
    layoutProfiles: "",
    columnPresets: "",
    tabSessions: "",
    hotlistEntries: "",
    leftDefaultViewMode: "details",
    rightDefaultViewMode: "details",
    leftDefaultSortField: "name",
    rightDefaultSortField: "name",
    logLevel: "warn",
    experimentalFeatures: false,
    cacheSizeLimit: 256,
    fileOperationThreads: 4,
    operationIdleTimeoutSecs: 300,
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
  };
}

describe("SettingsTerminal", () => {
  it("loads and saves terminal profile customization", async () => {
    const updateProfile = vi.fn(async () => ({ profile }));
    render(
      <SettingsTerminal
        preferences={makePrefs()}
        onChange={vi.fn()}
        terminalClient={
          {
            capabilities: vi.fn(async () => ({
              defaultShell: "/bin/bash",
              defaultArgs: ["-l"],
              discoveredShells: ["/bin/bash", "/bin/zsh"],
              supportsSsh: true,
              cursorStyles: ["block", "bar", "underline"],
              themeIds: ["system", "dark", "light"],
            })),
            listProfiles: vi.fn(async () => ({
              profiles: [profile],
              defaultProfileId: profile.id,
            })),
            updateProfile,
          } as never
        }
      />,
    );

    expect(await screen.findByDisplayValue("Dev Shell")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Profile name"), {
      target: { value: "Work Shell" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(updateProfile).toHaveBeenCalledOnce());
    expect(updateProfile.mock.calls[0][0].profile.name).toBe("Work Shell");
  });
});
