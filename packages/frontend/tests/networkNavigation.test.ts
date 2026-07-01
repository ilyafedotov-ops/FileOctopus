import { describe, expect, it, vi } from "vitest";
import { createNavigationController } from "../src/navigation/navigationController";
import type { NavigationControllerDeps } from "../src/navigation/navigationController";
import {
  createInitialState,
  panelReducer,
  terminalLaunchUri,
} from "../src/panelStore";
import type { PanelAction } from "../src/panelStore";

function createClientMock() {
  return {
    fs: {
      listStart: vi.fn().mockResolvedValue({
        sessionId: "s1",
        requestId: "r1",
      }),
      standardLocations: vi.fn(),
    },
    network: {
      connect: vi.fn().mockResolvedValue({ ok: true }),
      discoverNeighborhood: vi.fn().mockResolvedValue({
        uri: "network:///",
        entries: [
          {
            uri: "network:///cloud",
            name: "Cloud Storage",
            kind: "directory",
            providerId: "network",
            canRead: false,
            canList: true,
            canWrite: false,
            canDelete: false,
            canRename: false,
            virtualKind: "group",
            description: "Google Drive, OneDrive, and iCloud Drive",
          },
        ],
      }),
      listProfiles: vi.fn().mockResolvedValue({ profiles: [] }),
      connectionStatus: vi.fn().mockResolvedValue({ statuses: [] }),
    },
    navigation: {
      recordVisit: vi.fn().mockResolvedValue(undefined),
      listFavorites: vi.fn().mockResolvedValue({ favorites: [] }),
      listRecent: vi.fn().mockResolvedValue({ entries: [] }),
      listStarred: vi.fn().mockResolvedValue({ entries: [] }),
    },
    operationHistory: {
      listRecentOperations: vi.fn(),
      clearOperationHistory: vi.fn(),
    },
    diagnostics: { appDataHealth: vi.fn(), exportBundle: vi.fn() },
    getAppInfo: vi.fn(),
  } as unknown as NavigationControllerDeps["client"];
}

describe("navigation controller remote navigation", () => {
  it("does not call client.network.connect before listing a remote URI", async () => {
    const client = createClientMock();
    let state = createInitialState();
    const dispatch = (action: PanelAction) => {
      state = panelReducer(state, action);
    };

    const controller = createNavigationController({
      client,
      state,
      dispatch,
      setSearch: vi.fn(),
      setFavorites: vi.fn(),
      setRecentToday: vi.fn(),
      setRecentWeek: vi.fn(),
      setStarred: vi.fn(),
      setOperationError: vi.fn(),
    });

    await controller.navigatePanel(
      "left",
      "sftp://550e8400-e29b-41d4-a716-446655440000/",
    );

    expect(client.network.connect).not.toHaveBeenCalled();
    expect(client.fs.listStart).toHaveBeenCalledTimes(1);
  });

  it("lists network neighborhood entries without calling fs.listStart", async () => {
    const client = createClientMock();
    let state = createInitialState();
    const dispatch = (action: PanelAction) => {
      state = panelReducer(state, action);
    };

    const controller = createNavigationController({
      client,
      state,
      dispatch,
      setSearch: vi.fn(),
      setFavorites: vi.fn(),
      setRecentToday: vi.fn(),
      setRecentWeek: vi.fn(),
      setStarred: vi.fn(),
      setOperationError: vi.fn(),
    });

    await controller.navigatePanel("left", "network:///");

    expect(client.network.discoverNeighborhood).toHaveBeenCalledWith({
      uri: "network:///",
    });
    expect(client.fs.listStart).not.toHaveBeenCalled();
    expect(
      state.panels.left.tabs.main.entriesById["network:///cloud"]?.name,
    ).toBe("Cloud Storage");
  });

  it("activating an addConnection entry opens the wizard with no prefill", () => {
    const client = createClientMock();
    let state = createInitialState();
    const dispatch = (action: PanelAction) => {
      state = panelReducer(state, action);
    };
    const onOpenConnectionWizard = vi.fn();

    const controller = createNavigationController({
      client,
      state,
      dispatch,
      setSearch: vi.fn(),
      setFavorites: vi.fn(),
      setRecentToday: vi.fn(),
      setRecentWeek: vi.fn(),
      setStarred: vi.fn(),
      setOperationError: vi.fn(),
      onOpenConnectionWizard,
    });

    controller.activateEntry("left", {
      uri: "network:///add",
      name: "Add Connection",
      kind: "virtual",
      providerId: "network",
      canRead: false,
      canList: false,
      canWrite: false,
      canDelete: false,
      canRename: false,
      virtualKind: "addConnection",
    } as never);

    expect(onOpenConnectionWizard).toHaveBeenCalledTimes(1);
    expect(onOpenConnectionWizard).toHaveBeenCalledWith();
    expect(client.network.discoverNeighborhood).not.toHaveBeenCalled();
  });

  it("activating a credentialsRequired entry opens the wizard with prefill", () => {
    const client = createClientMock();
    let state = createInitialState();
    const dispatch = (action: PanelAction) => {
      state = panelReducer(state, action);
    };
    const onOpenConnectionWizard = vi.fn();

    const controller = createNavigationController({
      client,
      state,
      dispatch,
      setSearch: vi.fn(),
      setFavorites: vi.fn(),
      setRecentToday: vi.fn(),
      setRecentWeek: vi.fn(),
      setStarred: vi.fn(),
      setOperationError: vi.fn(),
      onOpenConnectionWizard,
    });

    controller.activateEntry("left", {
      uri: "network:///lan/smb/fileserver",
      name: "fileserver.local",
      kind: "directory",
      providerId: "network",
      canRead: false,
      canList: true,
      canWrite: false,
      canDelete: false,
      canRename: false,
      virtualKind: "discoveredService",
      protocol: "smb",
      status: "credentialsRequired",
    } as never);

    expect(onOpenConnectionWizard).toHaveBeenCalledTimes(1);
    expect(onOpenConnectionWizard).toHaveBeenCalledWith({
      scheme: "smb",
      host: "fileserver.local",
      label: "fileserver.local",
      defaultPath: "/",
    });
  });

  it("activating a directory entry with targetUri navigates to the target", async () => {
    const client = createClientMock();
    let state = createInitialState();
    const dispatch = (action: PanelAction) => {
      state = panelReducer(state, action);
    };

    const controller = createNavigationController({
      client,
      state,
      dispatch,
      setSearch: vi.fn(),
      setFavorites: vi.fn(),
      setRecentToday: vi.fn(),
      setRecentWeek: vi.fn(),
      setStarred: vi.fn(),
      setOperationError: vi.fn(),
    });

    controller.activateEntry("left", {
      uri: "network:///cloud/icloud",
      name: "iCloud Drive",
      kind: "directory",
      providerId: "network",
      canRead: true,
      canList: true,
      canWrite: false,
      canDelete: false,
      canRename: false,
      virtualKind: "cloudDrive",
      targetUri: "local:///Users/me/iCloud",
      status: "available",
    } as never);

    // Allow the dispatched navigatePanel promise to flush.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(client.fs.listStart).toHaveBeenCalled();
    const firstCall = (client.fs.listStart as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(firstCall.uri).toBe("local:///Users/me/iCloud");
  });

  it("does not propagate terminal cwd sync when navigating to a network:/// uri", async () => {
    const client = createClientMock();
    let state = createInitialState();
    const dispatch = (action: PanelAction) => {
      state = panelReducer(state, action);
    };
    const syncTerminalCwd = vi.fn();

    const controller = createNavigationController({
      client,
      state,
      dispatch,
      setSearch: vi.fn(),
      setFavorites: vi.fn(),
      setRecentToday: vi.fn(),
      setRecentWeek: vi.fn(),
      setStarred: vi.fn(),
      setOperationError: vi.fn(),
      syncTerminalCwd,
    });

    await controller.navigatePanel("left", "network:///");

    expect(syncTerminalCwd).not.toHaveBeenCalled();
  });

  it("opens terminals from network virtual locations in the resolved home folder", () => {
    localStorage.removeItem("fileoctopus.homeUri");

    expect(terminalLaunchUri("network:///", "local:///Users/tester")).toBe(
      "local:///Users/tester",
    );
    expect(
      terminalLaunchUri(
        "network:///lan/smb/fileserver",
        "local:///Users/tester",
      ),
    ).toBe("local:///Users/tester");
    expect(terminalLaunchUri("local:///tmp", "local:///Users/tester")).toBe(
      "local:///tmp",
    );
    expect(
      terminalLaunchUri(
        "sftp://550e8400-e29b-41d4-a716-446655440000/",
        "local:///Users/tester",
      ),
    ).toBe("sftp://550e8400-e29b-41d4-a716-446655440000/");
  });

  it("falls back to stored home for network virtual terminal locations", () => {
    localStorage.setItem("fileoctopus.homeUri", "local:///Users/ilya");

    expect(terminalLaunchUri("network:///")).toBe("local:///Users/ilya");
    expect(terminalLaunchUri("network:///lan/smb/fileserver")).toBe(
      "local:///Users/ilya",
    );

    localStorage.removeItem("fileoctopus.homeUri");
  });
});
