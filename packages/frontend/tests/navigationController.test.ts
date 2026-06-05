import { describe, expect, it, vi } from "vitest";
import { createNavigationController } from "../src/shell/../navigation/navigationController";
import type { NavigationControllerDeps } from "../src/navigation/navigationController";
import { createInitialState } from "../src/panelStore";
import type { FileEntryDto } from "@fileoctopus/ts-api";

function makeFileEntry(overrides: Partial<FileEntryDto> = {}): FileEntryDto {
  return {
    uri: "local:///tmp/file.txt",
    name: "file.txt",
    kind: "file",
    size: 100,
    isHidden: false,
    isSymlink: false,
    providerId: "local",
    canRead: true,
    canList: false,
    canWrite: true,
    canDelete: true,
    canRename: true,
    ...overrides,
  };
}

function makeDeps(
  overrides: Partial<NavigationControllerDeps> = {},
): NavigationControllerDeps {
  const state = createInitialState();
  return {
    client: {
      fs: {
        openPathWithDefaultApp: vi.fn().mockResolvedValue({}),
        listStart: vi.fn().mockResolvedValue({
          sessionId: "sess-1",
          requestId: "req-1",
        }),
        listArchive: vi.fn().mockResolvedValue({ entries: [] }),
      },
      network: {
        discoverNeighborhood: vi.fn().mockResolvedValue({
          uri: "network:///",
          entries: [],
        }),
      },
      navigation: {
        listFavorites: vi.fn().mockResolvedValue({ favorites: [] }),
        listRecent: vi.fn().mockResolvedValue({ entries: [] }),
        listStarred: vi.fn().mockResolvedValue({ entries: [] }),
        recordVisit: vi.fn().mockResolvedValue(undefined),
      },
    } as unknown as NavigationControllerDeps["client"],
    state,
    dispatch: vi.fn(),
    setSearch: vi.fn(),
    setFavorites: vi.fn(),
    setRecentToday: vi.fn(),
    setRecentWeek: vi.fn(),
    setStarred: vi.fn(),
    setOperationError: vi.fn(),
    openPreviewInOppositePane: vi.fn(),
    ...overrides,
  };
}

describe("createNavigationController", () => {
  it("navigatePanel dispatches navigate for a valid local URI", async () => {
    const deps = makeDeps();
    const ctrl = createNavigationController(deps);
    await ctrl.navigatePanel("left", "/tmp");
    expect(deps.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "navigate", panelId: "left" }),
    );
  });

  it("navigatePanel sets error for unsupported URI", async () => {
    const deps = makeDeps();
    const ctrl = createNavigationController(deps);
    await ctrl.navigatePanel("left", "ftp://bad");
    expect(deps.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "setPaneError",
        errorCode: "invalid_uri",
      }),
    );
  });

  it("navigatePanel calls startListing for local URI", async () => {
    const deps = makeDeps();
    const ctrl = createNavigationController(deps);
    await ctrl.navigatePanel("left", "/tmp");
    expect(deps.client.fs.listStart).toHaveBeenCalled();
  });

  it("navigatePanel calls discoverNeighborhood for network URI", async () => {
    const deps = makeDeps();
    const ctrl = createNavigationController(deps);
    await ctrl.navigatePanel("left", "network:///");
    expect(deps.client.network.discoverNeighborhood).toHaveBeenCalledWith({
      uri: "network:///",
    });
  });

  it("navigatePanel calls syncTerminalCwd for local URI", async () => {
    const syncTerminalCwd = vi.fn();
    const deps = makeDeps({ syncTerminalCwd });
    const ctrl = createNavigationController(deps);
    await ctrl.navigatePanel("left", "/tmp");
    expect(syncTerminalCwd).toHaveBeenCalledWith("left", "local:///tmp");
  });

  it("navigatePanel does not call syncTerminalCwd for network URI", async () => {
    const syncTerminalCwd = vi.fn();
    const deps = makeDeps({ syncTerminalCwd });
    const ctrl = createNavigationController(deps);
    await ctrl.navigatePanel("left", "network:///");
    expect(syncTerminalCwd).not.toHaveBeenCalled();
  });

  it("navigatePanel records visit and refreshes navigation", async () => {
    const deps = makeDeps();
    const ctrl = createNavigationController(deps);
    await ctrl.navigatePanel("left", "/tmp");
    expect(deps.client.navigation.recordVisit).toHaveBeenCalled();
  });

  it("navigatePanel with softRefresh skips search reset and visit recording", async () => {
    const deps = makeDeps();
    const ctrl = createNavigationController(deps);
    await ctrl.navigatePanel("left", "/tmp", { softRefresh: true });
    expect(deps.setSearch).not.toHaveBeenCalled();
    expect(deps.client.navigation.recordVisit).not.toHaveBeenCalled();
  });

  it("navigatePanel with replace option passes replace flag", async () => {
    const deps = makeDeps();
    const ctrl = createNavigationController(deps);
    await ctrl.navigatePanel("left", "/tmp", { replace: true });
    expect(deps.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ replace: true }),
    );
  });

  it("startListing dispatches startRequest and startSession on success", async () => {
    const deps = makeDeps();
    const ctrl = createNavigationController(deps);
    await ctrl.startListing("left", "local:///tmp", false);
    expect(deps.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "startRequest", panelId: "left" }),
    );
    expect(deps.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "startSession", panelId: "left" }),
    );
  });

  it("startListing dispatches setPaneError on failure", async () => {
    const deps = makeDeps();
    vi.mocked(deps.client.fs.listStart).mockRejectedValueOnce(
      new Error("fail"),
    );
    const ctrl = createNavigationController(deps);
    await ctrl.startListing("left", "local:///tmp", false);
    expect(deps.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "setPaneError", panelId: "left" }),
    );
  });

  it("goHistory does nothing when back stack is empty", async () => {
    const deps = makeDeps();
    const ctrl = createNavigationController(deps);
    await ctrl.goHistory("left", "back");
    expect(deps.client.fs.listStart).not.toHaveBeenCalled();
  });

  it("goHistory navigates back to previous URI", async () => {
    const deps = makeDeps();
    const state = createInitialState();
    const tab = state.panels.left.tabs.main;
    tab.backStack = ["local:///home"];
    deps.state = state;
    const ctrl = createNavigationController(deps);
    await ctrl.goHistory("left", "back");
    expect(deps.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "goBack", panelId: "left" }),
    );
    expect(deps.client.fs.listStart).toHaveBeenCalled();
  });

  it("goHistory navigates forward", async () => {
    const deps = makeDeps();
    const state = createInitialState();
    const tab = state.panels.left.tabs.main;
    tab.forwardStack = ["local:///tmp"];
    deps.state = state;
    const ctrl = createNavigationController(deps);
    await ctrl.goHistory("left", "forward");
    expect(deps.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "goForward", panelId: "left" }),
    );
  });

  it("refreshPanel navigates to current URI with replace", async () => {
    const deps = makeDeps();
    const ctrl = createNavigationController(deps);
    ctrl.refreshPanel("left");
    await new Promise((r) => setTimeout(r, 10));
    expect(deps.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "navigate", replace: true }),
    );
  });

  it("refreshPanel does not navigate editor content tabs", async () => {
    const deps = makeDeps();
    const state = createInitialState();
    state.panels.left.tabs.main = {
      ...state.panels.left.tabs.main,
      tabKind: "editor",
      uri: "local:///tmp/file.txt",
      editorEntry: makeFileEntry(),
      loadState: "loaded",
    };
    deps.state = state;
    const ctrl = createNavigationController(deps);

    ctrl.refreshPanel("left");
    await new Promise((r) => setTimeout(r, 10));

    expect(deps.dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "navigate", panelId: "left" }),
    );
    expect(deps.client.fs.listStart).not.toHaveBeenCalled();
  });

  it("refreshVisiblePanels refreshes both panels", async () => {
    const deps = makeDeps();
    const ctrl = createNavigationController(deps);
    ctrl.refreshVisiblePanels({ softRefresh: true, backgroundRefresh: true });
    await new Promise((r) => setTimeout(r, 10));
    expect(deps.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        panelId: "left",
        softRefresh: true,
        backgroundRefresh: true,
      }),
    );
    expect(deps.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        panelId: "right",
        softRefresh: true,
        backgroundRefresh: true,
      }),
    );
  });

  it("refreshNavigation fetches favorites, recent, starred", async () => {
    const deps = makeDeps();
    const ctrl = createNavigationController(deps);
    await ctrl.refreshNavigation();
    expect(deps.client.navigation.listFavorites).toHaveBeenCalled();
    expect(deps.client.navigation.listRecent).toHaveBeenCalledWith({
      bucket: "today",
    });
    expect(deps.client.navigation.listRecent).toHaveBeenCalledWith({
      bucket: "thisWeek",
    });
    expect(deps.client.navigation.listStarred).toHaveBeenCalled();
  });

  it("refreshNavigation sets operation error on failure", async () => {
    const deps = makeDeps();
    vi.mocked(deps.client.navigation.listFavorites).mockRejectedValueOnce(
      new Error("net fail"),
    );
    const ctrl = createNavigationController(deps);
    await ctrl.refreshNavigation();
    expect(deps.setOperationError).toHaveBeenCalledWith(expect.any(String));
  });

  it("activateEntry with null does nothing", () => {
    const deps = makeDeps();
    const ctrl = createNavigationController(deps);
    ctrl.activateEntry("left", null);
    expect(deps.dispatch).not.toHaveBeenCalled();
  });

  it("activateEntry with addConnection virtualKind calls onOpenConnectionWizard", () => {
    const onOpenConnectionWizard = vi.fn();
    const deps = makeDeps({ onOpenConnectionWizard });
    const ctrl = createNavigationController(deps);
    ctrl.activateEntry("left", makeFileEntry({ virtualKind: "addConnection" }));
    expect(onOpenConnectionWizard).toHaveBeenCalled();
  });

  it("activateEntry with credentialsRequired calls onOpenConnectionWizard with draft", () => {
    const onOpenConnectionWizard = vi.fn();
    const deps = makeDeps({ onOpenConnectionWizard });
    const ctrl = createNavigationController(deps);
    ctrl.activateEntry(
      "left",
      makeFileEntry({
        status: "credentialsRequired",
        protocol: "sftp",
        name: "myserver",
      }),
    );
    expect(onOpenConnectionWizard).toHaveBeenCalledWith({
      scheme: "sftp",
      host: "myserver",
      label: "myserver",
      defaultPath: "/",
    });
  });

  it("activateEntry for directory navigates into it", () => {
    const deps = makeDeps();
    const ctrl = createNavigationController(deps);
    ctrl.activateEntry(
      "left",
      makeFileEntry({
        kind: "directory",
        uri: "local:///tmp/docs",
      }),
    );
    expect(deps.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "navigate", uri: "local:///tmp/docs" }),
    );
  });

  it("activateEntry for archive file navigates into archive", () => {
    const deps = makeDeps();
    const ctrl = createNavigationController(deps);
    ctrl.activateEntry(
      "left",
      makeFileEntry({
        kind: "file",
        name: "archive.zip",
        uri: "local:///tmp/archive.zip",
      }),
    );
    expect(deps.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "navigate",
        uri: "local:///tmp/archive.zip",
      }),
    );
  });

  it("activateEntry for regular file opens a preview tab in the opposite pane", () => {
    const deps = makeDeps();
    const ctrl = createNavigationController(deps);
    const entry = makeFileEntry({
      kind: "file",
      name: "readme.txt",
      uri: "local:///tmp/readme.txt",
    });
    ctrl.activateEntry("left", entry);
    expect(deps.openPreviewInOppositePane).toHaveBeenCalledWith("left", entry);
    expect(deps.client.fs.openPathWithDefaultApp).not.toHaveBeenCalled();
  });

  it("activateEntry uses targetUri when available", () => {
    const deps = makeDeps();
    const ctrl = createNavigationController(deps);
    ctrl.activateEntry(
      "left",
      makeFileEntry({
        kind: "directory",
        targetUri: "local:///actual",
        uri: "local:///display",
      }),
    );
    expect(deps.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ uri: "local:///actual" }),
    );
  });

  it("openExternal clears error then opens", async () => {
    const deps = makeDeps();
    const ctrl = createNavigationController(deps);
    const entry = makeFileEntry({ name: "file.txt" });
    await ctrl.openExternal(entry);
    expect(deps.setOperationError).toHaveBeenCalledWith(null);
    expect(deps.client.fs.openPathWithDefaultApp).toHaveBeenCalled();
  });

  it("openExternal sets error on failure", async () => {
    const deps = makeDeps();
    vi.mocked(deps.client.fs.openPathWithDefaultApp).mockRejectedValueOnce(
      new Error("no app"),
    );
    const ctrl = createNavigationController(deps);
    await ctrl.openExternal(makeFileEntry());
    expect(deps.setOperationError).toHaveBeenCalledWith(expect.any(String));
  });
});
