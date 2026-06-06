import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserPreferencesDto } from "@fileoctopus/ts-api";
import { migrateStartupPreferences } from "../src/hooks/startupPreferences";

const basePrefs = {
  theme: "system",
  density: "comfortable",
  defaultViewMode: "icons",
  showHiddenFiles: false,
  sidebarWidth: 240,
  splitRatio: 0.5,
  activityPanelVisible: false,
  activityPanelWidth: 320,
  confirmDelete: true,
  confirmPermanentDelete: true,
  useTrashByDefault: true,
  defaultConflictPolicy: "fail",
  accentColor: "blue",
  fontScale: "1",
  iconScale: "1",
  confirmOverwrite: true,
  sidebarVisible: true,
  statusBarVisible: true,
  toolbarVisible: true,
  toolbarEntries: "",
  paneMode: "dual",
  paneDirection: "horizontal",
  jobDrawerBehavior: "auto",
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
  hotlistEntries: "",
  leftDefaultViewMode: "details",
  rightDefaultViewMode: "details",
  leftDefaultSortField: "name",
  rightDefaultSortField: "name",
  logLevel: "info",
  experimentalFeatures: false,
  cacheSizeLimit: 100,
  fileOperationThreads: 4,
  networkConnectionTimeout: 30,
  networkAutoReconnect: false,
  networkDefaultProtocol: "sftp",
  networkSshKeyPath: "",
  editorFontFamily: "monospace",
  editorFontSize: 14,
  editorTabSize: 4,
  editorWordWrap: false,
  editorAutoSave: false,
  editorSyntaxHighlighting: true,
  editorLineNumbers: true,
  viewerDefaultViewMode: "details",
  viewerImageZoom: "fit",
  viewerMediaAutoplay: false,
  viewerMaxPreviewSize: 10,
} satisfies UserPreferencesDto;

function makePrefs(
  overrides: Partial<UserPreferencesDto> = {},
): UserPreferencesDto {
  return { ...basePrefs, ...overrides } as UserPreferencesDto;
}

function createClient(preferences = makePrefs({ defaultViewMode: "details" })) {
  return {
    preferences: {
      set: vi.fn(async () => ({ preferences })),
    },
  };
}

describe("migrateStartupPreferences", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("persists details as the startup default view mode when not migrated", async () => {
    const client = createClient();

    const result = await migrateStartupPreferences(
      client as never,
      makePrefs(),
    );

    expect(client.preferences.set).toHaveBeenCalledWith({
      key: "defaultViewMode",
      value: "details",
    });
    expect(result.defaultViewMode).toBe("details");
    expect(
      localStorage.getItem("fileoctopus.defaultViewModeDetailsMigrated"),
    ).toBe("true");
  });

  it("uses a local fallback when default view mode persistence fails", async () => {
    const client = {
      preferences: {
        set: vi.fn(async () => {
          throw new Error("offline");
        }),
      },
    };

    const result = await migrateStartupPreferences(
      client as never,
      makePrefs(),
    );

    expect(result.defaultViewMode).toBe("details");
  });

  it("does not persist default view mode again after migration is marked", async () => {
    localStorage.setItem("fileoctopus.defaultViewModeDetailsMigrated", "true");
    const client = createClient();

    const result = await migrateStartupPreferences(
      client as never,
      makePrefs(),
    );

    expect(client.preferences.set).not.toHaveBeenCalled();
    expect(result.defaultViewMode).toBe("icons");
  });
});
