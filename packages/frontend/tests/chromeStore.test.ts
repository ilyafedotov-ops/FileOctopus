import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { migrateLegacyChromePreferences } from "../src/state/chromeStore";
import type { UserPreferencesDto } from "@fileoctopus/ts-api";

const basePrefs = {
  theme: "system",
  density: "comfortable",
  defaultViewMode: "details",
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

function createMockClient() {
  const setCalls: Array<{ key: string; value: string }> = [];
  const client = {
    preferences: {
      set: vi.fn(async (args: { key: string; value: string }) => {
        setCalls.push(args);
        const boolVal = args.value === "true";
        return { preferences: makePrefs({ [args.key]: boolVal }) };
      }),
    },
  };
  return { client, setCalls };
}

describe("migrateLegacyChromePreferences", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns preferences unchanged when no legacy keys exist", async () => {
    const { client, setCalls } = createMockClient();
    const prefs = makePrefs();
    const result = await migrateLegacyChromePreferences(client as never, prefs);
    expect(result).toBe(prefs);
    expect(setCalls.length).toBe(0);
  });

  it("migrates statusBarVisible from localStorage", async () => {
    localStorage.setItem("fileoctopus.statusBarVisible", "false");
    const { client, setCalls } = createMockClient();
    const prefs = makePrefs({ statusBarVisible: true });
    await migrateLegacyChromePreferences(client as never, prefs);
    expect(setCalls.length).toBe(1);
    expect(setCalls[0].key).toBe("statusBarVisible");
    expect(setCalls[0].value).toBe("false");
    expect(localStorage.getItem("fileoctopus.statusBarVisible")).toBeNull();
  });

  it("migrates toolbarVisible from localStorage", async () => {
    localStorage.setItem("fileoctopus.toolbarVisible", "false");
    const { client, setCalls } = createMockClient();
    const prefs = makePrefs({ toolbarVisible: true });
    await migrateLegacyChromePreferences(client as never, prefs);
    expect(setCalls.length).toBe(1);
    expect(setCalls[0].key).toBe("toolbarVisible");
    expect(localStorage.getItem("fileoctopus.toolbarVisible")).toBeNull();
  });

  it("migrates both when both legacy keys exist", async () => {
    localStorage.setItem("fileoctopus.statusBarVisible", "false");
    localStorage.setItem("fileoctopus.toolbarVisible", "false");
    const { client, setCalls } = createMockClient();
    await migrateLegacyChromePreferences(
      client as never,
      makePrefs({ statusBarVisible: true, toolbarVisible: true }),
    );
    expect(setCalls.length).toBe(2);
  });

  it("does not set preference if legacy value matches current", async () => {
    localStorage.setItem("fileoctopus.statusBarVisible", "true");
    const { client, setCalls } = createMockClient();
    await migrateLegacyChromePreferences(
      client as never,
      makePrefs({ statusBarVisible: true }),
    );
    const statusBarCalls = setCalls.filter((c) => c.key === "statusBarVisible");
    expect(statusBarCalls.length).toBe(0);
    expect(localStorage.getItem("fileoctopus.statusBarVisible")).toBeNull();
  });

  it("clears legacy keys even when values match", async () => {
    localStorage.setItem("fileoctopus.statusBarVisible", "true");
    localStorage.setItem("fileoctopus.toolbarVisible", "true");
    const { client } = createMockClient();
    await migrateLegacyChromePreferences(client as never, makePrefs());
    expect(localStorage.getItem("fileoctopus.statusBarVisible")).toBeNull();
    expect(localStorage.getItem("fileoctopus.toolbarVisible")).toBeNull();
  });
});
