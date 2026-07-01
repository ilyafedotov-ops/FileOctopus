import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AppInfoResponse,
  StandardLocationDto,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
import { createInitialState, documentsUri, homeUri } from "../src/panelStore";
import { useStartupInitialization } from "../src/hooks/useStartupInitialization";

const appInfo = {
  name: "FileOctopus",
  version: "0.1.3",
  tauriVersion: "2.0.0",
  platform: "linux",
  debug: false,
  networkEnabled: true,
  pluginRuntimeEnabled: false,
  configPath: "/tmp/config",
  dataPath: "/tmp/data",
  logPath: "/tmp/log",
  frontendDistPath: "/tmp/dist",
  appHealth: null,
} satisfies AppInfoResponse;

const homeLocation = {
  id: "home",
  name: "Home",
  uri: "local:///home/tester",
  section: "places",
} satisfies StandardLocationDto;

const documentsLocation = {
  id: "documents",
  name: "Documents",
  uri: "local:///home/tester/Documents",
  section: "places",
} satisfies StandardLocationDto;

const basePreferences = {
  theme: "system",
  density: "compact",
  defaultViewMode: "columns",
  showHiddenFiles: true,
  sidebarWidth: 240,
  splitRatio: 0.5,
  activityPanelVisible: true,
  activityPanelWidth: 320,
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

function createClient(
  preferences = basePreferences,
  options: { failLocations?: boolean; failPreferences?: boolean } = {},
) {
  return {
    getAppInfo: vi.fn(async () => appInfo),
    fs: {
      stat: vi.fn(async () => ({})),
      standardLocations: vi.fn(async () => {
        if (options.failLocations) {
          throw new Error("locations unavailable");
        }
        return { locations: [homeLocation, documentsLocation] };
      }),
    },
    preferences: {
      get: vi.fn(async () => {
        if (options.failPreferences) {
          throw new Error("preferences unavailable");
        }
        return { preferences };
      }),
      set: vi.fn(async () => ({ preferences })),
    },
  };
}

function createParams(
  client = createClient(),
  state = createInitialState(homeUri(), documentsUri()),
) {
  return {
    client: client as never,
    state,
    dispatch: vi.fn(),
    hasInitializedRef: { current: false },
    refreshHistory: vi.fn(async () => undefined),
    refreshLocations: vi.fn(async () => undefined),
    refreshNetworkProfiles: vi.fn(async () => undefined),
    refreshNetworkQuickEntries: vi.fn(async () => undefined),
    refreshNavigation: vi.fn(async () => undefined),
    refreshDiagnostics: vi.fn(),
    setLocations: vi.fn(),
    setAppInfo: vi.fn(),
    navigatePanel: vi.fn(async () => undefined),
    setPreferences: vi.fn(),
    setDensity: vi.fn(),
    setActivityCollapsed: vi.fn(),
  };
}

beforeEach(() => {
  localStorage.setItem("fileoctopus.defaultViewModeDetailsMigrated", "true");
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute("data-density");
  document.documentElement.removeAttribute("data-theme");
});

describe("useStartupInitialization", () => {
  it("hydrates app info, navigation, preferences, and initial panels", async () => {
    const client = createClient();
    const params = createParams(client);

    renderHook(() => useStartupInitialization(params));

    await waitFor(() => expect(params.navigatePanel).toHaveBeenCalledTimes(2));

    expect(params.setAppInfo).toHaveBeenCalledWith(appInfo);
    expect(params.refreshNetworkProfiles).toHaveBeenCalled();
    expect(params.refreshNetworkQuickEntries).toHaveBeenCalled();
    expect(params.setLocations).toHaveBeenCalledWith([
      homeLocation,
      documentsLocation,
    ]);
    expect(params.setPreferences).toHaveBeenCalledWith(basePreferences);
    expect(params.setDensity).toHaveBeenCalledWith("compact");
    expect(params.setActivityCollapsed).toHaveBeenCalledWith(false);
    expect(params.dispatch).toHaveBeenCalledWith({
      type: "hydratePreferences",
      showHidden: true,
      viewMode: "columns",
    });
    expect(params.navigatePanel).toHaveBeenCalledWith(
      "left",
      homeLocation.uri,
      {
        includeHidden: true,
      },
    );
    expect(params.navigatePanel).toHaveBeenCalledWith(
      "right",
      documentsLocation.uri,
      {
        includeHidden: true,
      },
    );
    expect(params.refreshLocations).toHaveBeenCalled();
    expect(params.refreshHistory).toHaveBeenCalled();
    expect(params.refreshDiagnostics).toHaveBeenCalled();
  });

  it("runs the startup workflow only once", async () => {
    const client = createClient();
    const params = createParams(client);
    const { rerender } = renderHook(() => useStartupInitialization(params));

    await waitFor(() => expect(client.getAppInfo).toHaveBeenCalledTimes(1));

    rerender();

    expect(client.getAppInfo).toHaveBeenCalledTimes(1);
  });

  it("keeps startup moving when locations and preferences are unavailable", async () => {
    const client = createClient(basePreferences, {
      failLocations: true,
      failPreferences: true,
    });
    const state = createInitialState("local:///left", "local:///right");
    const params = createParams(client, state);

    renderHook(() => useStartupInitialization(params));

    await waitFor(() => expect(params.navigatePanel).toHaveBeenCalledTimes(2));

    expect(params.setLocations).not.toHaveBeenCalled();
    expect(params.setPreferences).not.toHaveBeenCalled();
    expect(params.dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "hydratePreferences" }),
    );
    expect(params.navigatePanel).toHaveBeenCalledWith("left", "local:///left", {
      includeHidden: false,
    });
    expect(params.navigatePanel).toHaveBeenCalledWith(
      "right",
      "local:///right",
      {
        includeHidden: false,
      },
    );
    expect(params.refreshLocations).toHaveBeenCalledTimes(2);
    expect(params.refreshNavigation).toHaveBeenCalled();
    expect(params.refreshHistory).toHaveBeenCalled();
    expect(params.refreshDiagnostics).toHaveBeenCalled();
  });
});
