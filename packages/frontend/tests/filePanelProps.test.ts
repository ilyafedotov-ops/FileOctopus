import { describe, expect, it, vi } from "vitest";
import type { FileEntryDto, NetworkProfileDto } from "@fileoctopus/ts-api";
import { createInitialState } from "../src/panelStore";
import { buildFilePanelProps } from "../src/app/filePanelProps";

function entry(overrides: Partial<FileEntryDto> = {}): FileEntryDto {
  return {
    uri: "local:///source/file.txt",
    name: "file.txt",
    kind: "file",
    size: 12,
    modifiedAt: "2026-01-01T00:00:00Z",
    isHidden: false,
    isSymlink: false,
    providerId: "local",
    canRead: true,
    canWrite: true,
    canDelete: true,
    canRename: true,
    canList: false,
    ...overrides,
  };
}

function networkProfile(
  overrides: Partial<NetworkProfileDto> = {},
): NetworkProfileDto {
  return {
    id: "profile-1",
    label: "Server",
    scheme: "sftp",
    host: "example.com",
    port: 22,
    username: "user",
    authKind: "password",
    keyPath: "",
    defaultUri: "sftp://profile-1/",
    hasPassword: false,
    hasPrivateKeyPassphrase: false,
    hostKeyFingerprint: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function baseArgs() {
  const state = createInitialState("local:///source", "local:///dest");
  const file = entry();
  state.panels.left.tabs.main.entriesById[file.uri] = file;
  state.panels.left.tabs.main.orderedEntryIds = [file.uri];
  return {
    state,
    locations: [],
    networkProfiles: [],
    networkStatuses: [],
    favorites: [],
    starred: [],
    recentEntries: [],
    clipboard: null,
    pathFocusToken: 0,
    renameFocusToken: 0,
    filterFocusToken: 0,
    recursiveSearchFocusToken: 0,
    rowHeight: 28,
    search: null,
    preferences: null,
    dispatch: vi.fn(),
    navigatePanel: vi.fn(),
    handleCommandSelect: vi.fn(),
    revealEntry: vi.fn(),
    activateEntry: vi.fn(),
    runRecursiveSearch: vi.fn(),
    runContentSearch: vi.fn(),
    cancelContentSearch: vi.fn(),
    setContextMenu: vi.fn(),
    setDialog: vi.fn(),
    submitInlineRename: vi.fn(),
  };
}

describe("buildFilePanelProps", () => {
  it("builds copy/move drop dialogs from the source panel entries", () => {
    const args = baseArgs();
    const props = buildFilePanelProps("right", args);

    props.onDropFiles?.(
      ["local:///source/file.txt"],
      "left",
      "local:///dest",
      "copy",
    );

    expect(args.setDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "copyMove",
        panelId: "left",
        destination: "local:///dest",
        entries: [
          args.state.panels.left.tabs.main.entriesById[
            "local:///source/file.txt"
          ],
        ],
      }),
    );
  });

  it("opens network credentials for the profile backing the current remote URI", () => {
    const args = baseArgs();
    args.state.panels.left.tabs.main.uri = "sftp://profile-1/projects";
    args.networkProfiles = [networkProfile()];

    const props = buildFilePanelProps("left", args);
    props.onEditNetworkCredentials?.();

    expect(args.handleCommandSelect).toHaveBeenCalledWith(
      "nav.connectServer",
      "left",
      {
        networkProfile: args.networkProfiles[0],
      },
    );
  });

  it("opens a new directory tab from a content tab at the containing folder", () => {
    const args = baseArgs();
    const file = entry();
    args.state.panels.left.tabs.main = {
      ...args.state.panels.left.tabs.main,
      tabKind: "preview",
      uri: file.uri,
      previewEntry: file,
      loadState: "loaded",
    };

    const props = buildFilePanelProps("left", args);
    props.onOpenTab("left");

    expect(args.dispatch).toHaveBeenCalledWith({
      type: "openTab",
      panelId: "left",
      uri: "local:///source",
    });
  });

  it("routes content search input and execution to the active tab", () => {
    const args = baseArgs();
    const props = buildFilePanelProps("left", args);

    props.onContentSearchQuery("needle");
    props.onContentSearch();
    props.onCancelContentSearch();

    expect(args.dispatch).toHaveBeenCalledWith({
      type: "setContentSearchQuery",
      panelId: "left",
      tabId: "main",
      query: "needle",
    });
    expect(args.runContentSearch).toHaveBeenCalledWith("left");
    expect(args.cancelContentSearch).toHaveBeenCalledWith("left", "main");
  });
});
