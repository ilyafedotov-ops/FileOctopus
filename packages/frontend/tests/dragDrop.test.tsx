import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";

const listStart = vi.fn(async () => ({ requestId: "r1", sessionId: "s1" }));
const onDirectoryBatch = vi.fn(async () => () => undefined);
const standardLocations = vi.fn(async () => ({ locations: [] }));
const startWatching = vi.fn(async () => undefined);
const stopWatching = vi.fn(async () => undefined);
const onWatchChanged = vi.fn(async () => () => undefined);
const openPathWithDefaultApp = vi.fn(async () => undefined);
const revealPathInFileManager = vi.fn(async () => undefined);
const properties = vi.fn(async () => ({
  exists: true,
  name: "test.txt",
  uri: "local:///tmp/test.txt",
  kind: "file",
  size: 12,
  modifiedAt: null,
  createdAt: null,
  accessedAt: null,
  permissions: null,
  owner: null,
  canRead: true,
  canWrite: true,
  canDelete: true,
  canRename: true,
  isHidden: false,
  isSymlink: false,
}));
const recursiveSearch = vi.fn(async () => ({ matches: [], incomplete: false }));
const startFolderSizeJob = vi.fn(async () => ({
  job: {
    jobId: "j1",
    status: "running",
    completedItems: 0,
    totalItems: 0,
    completedBytes: 0,
    totalBytes: 0,
    startedAt: "",
    updatedAt: "",
  },
}));
const startRecursiveSearchJob = vi.fn(async () => ({
  job: {
    jobId: "j1",
    status: "running",
    completedItems: 0,
    totalItems: 0,
    completedBytes: 0,
    totalBytes: 0,
    startedAt: "",
    updatedAt: "",
  },
}));
const onFolderSizeCompleted = vi.fn(async () => () => undefined);
const onRecursiveSearchMatch = vi.fn(async () => () => undefined);
const onRecursiveSearchCompleted = vi.fn(async () => () => undefined);
const computeHash = vi.fn(async () => ({ hash: "abc123", fileSize: 12 }));
const openTerminal = vi.fn(async () => ({ success: true }));
const planFileOperation = vi.fn(async () => ({
  operationId: "operation-1",
  plan: {
    kind: "copy",
    sources: [],
    destination: null,
    newName: null,
    conflictPolicy: "fail",
    items: [],
    conflicts: [],
    warnings: [],
    totalItems: 0,
    totalBytes: 0,
  },
}));
const startFileOperation = vi.fn(async () => ({
  job: {
    jobId: "job-1",
    operationKind: "copy",
    status: "running",
    currentItem: null,
    completedItems: 0,
    totalItems: 0,
    completedBytes: 0,
    totalBytes: 12,
    startedAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  },
}));
const onJobStarted = vi.fn(async () => () => undefined);
const onJobProgress = vi.fn(async () => () => undefined);
const onJobCompleted = vi.fn(async () => () => undefined);
const subscribeJob = vi.fn(async () => () => undefined);
const cancelJob = vi.fn(async () => ({
  job: {
    jobId: "job-1",
    operationKind: "copy",
    status: "cancelled",
    completedItems: 0,
    totalItems: 1,
    completedBytes: 0,
    startedAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  },
}));
const listRecentOperations = vi.fn(async () => ({ operations: [] }));
const clearOperationHistory = vi.fn(async () => ({ ok: true }));
const getAppInfo = vi.fn(async () => ({
  name: "FileOctopus",
  version: "0.1.0",
}));
const appDataHealth = vi.fn(async () => ({ healthy: true, issues: [] }));
const exportBundle = vi.fn(async () => ({ exportedFiles: 1 }));
const preferencesGet = vi.fn(async () => null);
const preferencesSet = vi.fn(async () => ({ ok: true }));

vi.mock("@fileoctopus/ts-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fileoctopus/ts-api")>();
  const { mockNetworkClient } = await import("./mockNetworkClient");
  return {
    ...actual,
    createFileOctopusClient: () => ({
      getAppInfo,
      fs: {
        listStart,
        onDirectoryBatch,
        standardLocations,
        startWatching,
        stopWatching,
        onWatchChanged,
        openPathWithDefaultApp,
        revealPathInFileManager,
        properties,
        recursiveSearch,
        startFolderSizeJob,
        startRecursiveSearchJob,
        onFolderSizeCompleted,
        onRecursiveSearchMatch,
        onRecursiveSearchCompleted,
        computeHash,
        openTerminal,
      },
      fileOperations: {
        planFileOperation,
        startFileOperation,
        onJobStarted,
        onJobProgress,
        onJobCompleted,
        onJobFailed: subscribeJob,
        onJobCancelled: subscribeJob,
      },
      jobs: { cancelJob },
      operationHistory: { listRecentOperations, clearOperationHistory },
      diagnostics: { appDataHealth, exportBundle },
      preferences: { get: preferencesGet, set: preferencesSet },
      navigation: {
        recordVisit: vi.fn(async () => ({ ok: true })),
        listRecent: vi.fn(async () => ({ entries: [] })),
        listStarred: vi.fn(async () => ({ entries: [] })),
        addFavorite: vi.fn(async () => ({ ok: true })),
        removeFavorite: vi.fn(async () => ({ ok: true })),
        renameFavorite: vi.fn(async () => ({ ok: true })),
        getFavorites: vi.fn(async () => ({ favorites: [] })),
      },
      search: {
        startFolderSizeJob,
        onFolderSizeCompleted,
      },
      network: mockNetworkClient,
    }),
    normalizeIpcError: (e: unknown) => ({
      code: actual.IPC_ERROR_CODES.UNKNOWN,
      message: String(e),
    }),
    isTauriRuntime: () => false,
  };
});

import { FilePanel, type FilePanelProps } from "../src/pane/FilePanel";
import type { PanelTabState, PanelState } from "../src/panelStore";

function makeTab(overrides: Partial<PanelTabState> = {}): PanelTabState {
  return {
    uri: "local:///home/user",
    entriesById: {},
    orderedEntryIds: [],
    selectedIds: [],
    selectedId: null,
    focusedId: null,
    anchorId: null,
    sessionId: null,
    loadState: "loaded",
    error: null,
    filter: "",
    sort: { field: "name" as const, direction: "asc" as const },
    showHidden: false,
    viewMode: "details" as const,
    hashMap: {},
    ...overrides,
  } as PanelTabState;
}

const defaultTab = makeTab();

function makePanel(panelId: "left" | "right" = "right"): PanelState {
  return {
    id: panelId,
    activeTabId: "default",
    tabs: { default: defaultTab },
  };
}

function makeProps(overrides: Partial<FilePanelProps> = {}): FilePanelProps {
  return {
    panelId: "right",
    title: "Right",
    tab: defaultTab,
    active: true,
    onActivate: vi.fn(),
    onNavigate: vi.fn(),
    onSelect: vi.fn(),
    onEntrySelect: vi.fn(),
    onMove: vi.fn(),
    onSort: vi.fn(),
    onFilter: vi.fn(),
    onRecursiveQuery: vi.fn(),
    onRecursiveSearch: vi.fn(),
    onEntryActivate: vi.fn(),
    onCreateFolder: vi.fn(),
    onCreateFile: vi.fn(),
    onPaste: vi.fn(),
    onProperties: vi.fn(),
    onReveal: vi.fn(),
    onRefresh: vi.fn(),
    canPaste: false,
    pathFocusToken: 0,
    renameFocusToken: 0,
    filterFocusToken: 0,
    recursiveSearchFocusToken: 0,
    rowHeight: 20,
    search: null,
    onContextMenu: vi.fn(),
    panel: makePanel(),
    onSwitchTab: vi.fn(),
    onCloseTab: vi.fn(),
    onOpenTab: vi.fn(),
    ...overrides,
  };
}

function createDropEvent(
  uris: string[],
  options: { panelId?: string; dropEffect?: string } = {},
) {
  const data: Record<string, string> = {
    "application/x-fileoctopus-uri": uris[0] ?? "",
  };
  if (uris.length > 1) {
    data["application/x-fileoctopus-selected-uris"] = JSON.stringify(uris);
  }
  if (options.panelId) {
    data["application/x-fileoctopus-panel-id"] = options.panelId;
  }

  const event = new Event("drop", {
    bubbles: true,
  }) as React.DragEvent<HTMLDivElement> & {
    dataTransfer: {
      getData: (mime: string) => string;
      dropEffect: string;
      types: string[];
    };
    preventDefault: ReturnType<typeof vi.fn>;
  };
  event.dataTransfer = {
    types: Object.keys(data),
    getData: (mime: string): string => data[mime] ?? "",
    dropEffect: options.dropEffect ?? "move",
  };
  event.preventDefault = vi.fn();
  return event;
}

function createDragEnterEvent(uris: string[], panelId?: string) {
  const data: Record<string, string> = {
    "application/x-fileoctopus-uri": uris[0] ?? "",
  };
  if (panelId) {
    data["application/x-fileoctopus-panel-id"] = panelId;
  }

  const event = new Event("dragenter", {
    bubbles: true,
  }) as React.DragEvent<HTMLDivElement> & {
    dataTransfer: { getData: (mime: string) => string; types: string[] };
    preventDefault: ReturnType<typeof vi.fn>;
  };
  event.dataTransfer = {
    types: Object.keys(data),
    getData: (mime: string): string => data[mime] ?? "",
  };
  event.preventDefault = vi.fn();
  return event;
}

afterEach(cleanup);

describe("FilePanel drag & drop", () => {
  it("shows drag-over state when a FileOctopus URI is dragged over the panel body", () => {
    const props = makeProps();
    render(<FilePanel {...props} />);

    const body = document.querySelector(".fo-panel-body");
    expect(body).toBeTruthy();

    fireEvent(
      body!,
      createDragEnterEvent(["local:///home/user/file.txt"], "left"),
    );

    const overlay = document.querySelector(".fo-panel-drop-overlay");
    expect(overlay).toBeTruthy();
  });

  it("calls onDropFiles instead of onNavigate when files are dropped on panel body", () => {
    const onNavigate = vi.fn();
    const onDropFiles = vi.fn();
    const props = makeProps({ onNavigate, onDropFiles });
    render(<FilePanel {...props} />);

    const body = document.querySelector(".fo-panel-body");
    fireEvent(
      body!,
      createDragEnterEvent(["local:///home/user/file.txt"], "left"),
    );
    fireEvent(
      body!,
      createDropEvent(["local:///home/user/file.txt"], { panelId: "left" }),
    );

    expect(onDropFiles).toHaveBeenCalledWith(
      ["local:///home/user/file.txt"],
      "left",
      "local:///home/user",
      "move",
    );
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("detects copy operation when dropEffect is copy", () => {
    const onDropFiles = vi.fn();
    const props = makeProps({ onDropFiles });
    render(<FilePanel {...props} />);

    const body = document.querySelector(".fo-panel-body");
    fireEvent(
      body!,
      createDropEvent(["local:///home/user/file.txt"], {
        panelId: "left",
        dropEffect: "copy",
      }),
    );

    expect(onDropFiles).toHaveBeenCalledWith(
      ["local:///home/user/file.txt"],
      "left",
      "local:///home/user",
      "copy",
    );
  });

  it("passes multiple selected URIs when multi-selection drag data is present", () => {
    const onDropFiles = vi.fn();
    const props = makeProps({ onDropFiles });
    render(<FilePanel {...props} />);

    const uris = [
      "local:///home/user/file1.txt",
      "local:///home/user/file2.txt",
    ];
    const body = document.querySelector(".fo-panel-body");
    fireEvent(body!, createDropEvent(uris, { panelId: "left" }));

    expect(onDropFiles).toHaveBeenCalledWith(
      uris,
      "left",
      "local:///home/user",
      "move",
    );
  });

  it("removes drag-over overlay after drop", () => {
    const onDropFiles = vi.fn();
    const props = makeProps({ onDropFiles });
    render(<FilePanel {...props} />);

    const body = document.querySelector(".fo-panel-body");
    fireEvent(
      body!,
      createDragEnterEvent(["local:///home/user/file.txt"], "left"),
    );
    expect(document.querySelector(".fo-panel-drop-overlay")).toBeTruthy();

    fireEvent(
      body!,
      createDropEvent(["local:///home/user/file.txt"], { panelId: "left" }),
    );
    expect(document.querySelector(".fo-panel-drop-overlay")).toBeFalsy();
  });

  it("falls back to single URI when selected-uris is not in dataTransfer", () => {
    const onDropFiles = vi.fn();
    const props = makeProps({ onDropFiles });
    render(<FilePanel {...props} />);

    const body = document.querySelector(".fo-panel-body");
    fireEvent(
      body!,
      createDropEvent(["local:///home/user/file.txt"], { panelId: "left" }),
    );

    expect(onDropFiles).toHaveBeenCalledWith(
      ["local:///home/user/file.txt"],
      "left",
      "local:///home/user",
      "move",
    );
  });
});
