import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DirectoryBatchEventDto,
  FileEntryDto,
  FileOperationRequestDto,
  FolderSizeCompletedEventDto,
  JobCompletedEvent,
  JobProgressEvent,
  JobStartedEvent,
  RecursiveSearchCompletedEventDto,
  RecursiveSearchMatchEventDto,
} from "@fileoctopus/ts-api";

let batchHandler: ((event: DirectoryBatchEventDto) => void) | null = null;
let jobStartedHandler: ((event: JobStartedEvent) => void) | null = null;
let jobProgressHandler: ((event: JobProgressEvent) => void) | null = null;
let jobCompletedHandler: ((event: JobCompletedEvent) => void) | null = null;
let folderSizeCompletedHandler:
  | ((event: FolderSizeCompletedEventDto) => void)
  | null = null;
let recursiveSearchMatchHandler:
  | ((event: RecursiveSearchMatchEventDto) => void)
  | null = null;
let recursiveSearchCompletedHandler:
  | ((event: RecursiveSearchCompletedEventDto) => void)
  | null = null;
let sessionIndex = 0;
const panelSessions: Partial<
  Record<"left" | "right", { sessionId: string; requestId: string }>
> = {};
const listStart = vi.fn(
  async (request: { requestId?: string; panelId?: string }) => {
    sessionIndex += 1;
    const sessionId = `session-${sessionIndex}`;
    const requestId = request.requestId ?? `request-${sessionIndex}`;
    const panelId =
      request.panelId === "left" || request.panelId === "right"
        ? request.panelId
        : sessionIndex % 2 === 1
          ? "left"
          : "right";

    panelSessions[panelId] = { sessionId, requestId };

    return { sessionId, requestId };
  },
);
const preferencesGet = vi.fn(async () => ({
  preferences: {
    theme: "system",
    density: "comfortable",
    defaultViewMode: "details",
    showHiddenFiles: false,
    sidebarWidth: 240,
    splitRatio: 0.5,
    activityPanelVisible: true,
    activityPanelWidth: 288,
  },
}));
const preferencesSet = vi.fn(async () => preferencesGet());
const standardLocations = vi.fn(async () => ({
  locations: [
    {
      id: "home",
      name: "Home",
      uri: "local:///Users/ilya",
      section: "Favorites",
    },
    {
      id: "documents",
      name: "Documents",
      uri: "local:///Users/ilya/Documents",
      section: "User folders",
    },
  ],
}));
const startWatching = vi.fn(async () => ({ ok: true }));
const stopWatching = vi.fn(async () => ({ ok: true }));
const onWatchChanged = vi.fn(async () => () => undefined);
const openPathWithDefaultApp = vi.fn(async () => ({ ok: true }));
const revealPathInFileManager = vi.fn(async () => ({ ok: true }));
const deletePermanently = vi.fn(async () => ({ ok: true }));
const createFile = vi.fn(async ({ uri }: { uri: string }) => ({
  entry: {
    uri,
    name: uri.split("/").slice(-1)[0],
    kind: "file",
    size: 0,
    isHidden: false,
    isSymlink: false,
    providerId: "local",
    canRead: true,
    canList: false,
    canWrite: true,
    canDelete: true,
    canRename: true,
  },
}));
const properties = vi.fn(async ({ uri }: { uri: string }) => ({
  properties: {
    uri,
    name: uri.split("/").slice(-1)[0],
    kind: "file",
    size: 12,
    totalSize: null,
    itemCount: null,
    fileCount: null,
    directoryCount: null,
    modifiedAt: null,
    createdAt: null,
    accessedAt: null,
    isHidden: false,
    isSymlink: false,
    symlinkTarget: null,
    readonly: false,
    warnings: [],
  },
}));
const recursiveSearch = vi.fn(async () => ({
  result: {
    matches: [
      {
        uri: "local:///tmp/needle.txt",
        parentUri: "local:///tmp",
        name: "needle.txt",
        kind: "file",
        size: 4,
        modifiedAt: null,
      },
    ],
    warnings: [],
    incomplete: false,
  },
}));
const startFolderSizeJob = vi.fn(async () => {
  globalThis.setTimeout(() => {
    folderSizeCompletedHandler?.({
      jobId: "folder-size-job",
      uri: "local:///tmp",
      summary: {
        totalSize: 12,
        itemCount: 1,
        fileCount: 1,
        directoryCount: 0,
        warnings: [],
        incomplete: false,
      },
    });
  }, 0);

  return {
    job: {
      jobId: "folder-size-job",
      operationKind: "folderSize",
      status: "running",
      completedItems: 0,
      totalItems: 0,
      completedBytes: 0,
      startedAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    },
  };
});
const startRecursiveSearchJob = vi.fn(async () => {
  globalThis.setTimeout(() => {
    recursiveSearchMatchHandler?.({
      jobId: "search-job",
      uri: "local:///tmp",
      query: "needle",
      item: {
        uri: "local:///tmp/needle.txt",
        parentUri: "local:///tmp",
        name: "needle.txt",
        kind: "file",
        size: 4,
        modifiedAt: null,
      },
    });
    recursiveSearchCompletedHandler?.({
      jobId: "search-job",
      uri: "local:///tmp",
      query: "needle",
      result: {
        matches: [
          {
            uri: "local:///tmp/needle.txt",
            parentUri: "local:///tmp",
            name: "needle.txt",
            kind: "file",
            size: 4,
            modifiedAt: null,
          },
        ],
        warnings: [],
        incomplete: false,
      },
    });
  }, 0);

  return {
    job: {
      jobId: "search-job",
      operationKind: "recursiveSearch",
      status: "running",
      completedItems: 0,
      totalItems: 0,
      completedBytes: 0,
      startedAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    },
  };
});
const onFolderSizeCompleted = vi.fn(
  async (handler: (event: FolderSizeCompletedEventDto) => void) => {
    folderSizeCompletedHandler = handler;
    return () => {
      folderSizeCompletedHandler = null;
    };
  },
);
const onRecursiveSearchMatch = vi.fn(
  async (handler: (event: RecursiveSearchMatchEventDto) => void) => {
    recursiveSearchMatchHandler = handler;
    return () => {
      recursiveSearchMatchHandler = null;
    };
  },
);
const onRecursiveSearchCompleted = vi.fn(
  async (handler: (event: RecursiveSearchCompletedEventDto) => void) => {
    recursiveSearchCompletedHandler = handler;
    return () => {
      recursiveSearchCompletedHandler = null;
    };
  },
);
const computeHash = vi.fn(async () => ({
  hash: "abc123def456",
  algorithm: "sha256",
  byteSize: 1024,
}));
const openTerminal = vi.fn(async () => ({ success: true }));
const onDirectoryBatch = vi.fn(
  async (handler: (event: DirectoryBatchEventDto) => void) => {
    batchHandler = handler;
    return () => undefined;
  },
);
const listRecentOperations = vi.fn(async () => ({ operations: [] }));
const clearOperationHistory = vi.fn(async () => ({ deletedCount: 0 }));
const getAppInfo = vi.fn(async () => ({
  name: "FileOctopus",
  version: "0.1.0",
  buildProfile: "debug",
  commitSha: null,
  targetOs: "linux",
}));
const appDataHealth = vi.fn(async () => ({
  configDir: "~/.fileoctopus/config",
  dataDir: "~/.fileoctopus",
  logDir: "~/.fileoctopus/logs",
  databasePath: "~/.fileoctopus/operation-history.sqlite",
  databaseExists: true,
  schemaVersion: 1,
  missingDirectories: [],
  startupRecoveryCount: 0,
}));
const exportBundle = vi.fn(async () => ({
  path: "/tmp/fileoctopus-diagnostics.zip",
  files: ["app-info.json"],
}));
const planFileOperation = vi.fn(
  async ({ operation }: { operation: FileOperationRequestDto }) => ({
    plan: {
      operationId: "operation-1",
      kind: operation.kind,
      sources: operation.sources,
      destination: operation.destination ?? null,
      newName: operation.newName ?? null,
      conflictPolicy: operation.conflictPolicy ?? "fail",
      items:
        operation.sources.length > 0
          ? operation.sources.map((source) => ({
              source,
              destination: operation.destination ?? null,
              kind: "file",
              size: 12,
              recursive: false,
            }))
          : [
              {
                source: null,
                destination: operation.destination ?? null,
                kind: "directory",
                size: null,
                recursive: false,
              },
            ],
      conflicts:
        operation.kind === "copy"
          ? [
              {
                source: operation.sources[0] ?? "local:///tmp/source.txt",
                destination: `${operation.destination ?? "local:///tmp"}/source.txt`,
              },
            ]
          : [],
      warnings: [],
      totalItems: Math.max(1, operation.sources.length),
      totalBytes: operation.sources.length > 0 ? 12 : 0,
    },
  }),
);
const startFileOperation = vi.fn(async ({ operationId }) => ({
  job: {
    jobId: "job-1",
    operationKind: "copy",
    status: "running",
    currentItem: null,
    completedItems: 0,
    totalItems: operationId ? 1 : 0,
    completedBytes: 0,
    totalBytes: 12,
    startedAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  },
}));
const onJobStarted = vi.fn(
  async (handler: (event: JobStartedEvent) => void) => {
    jobStartedHandler = handler;
    return () => {
      jobStartedHandler = null;
    };
  },
);
const onJobProgress = vi.fn(
  async (handler: (event: JobProgressEvent) => void) => {
    jobProgressHandler = handler;
    return () => {
      jobProgressHandler = null;
    };
  },
);
const onJobCompleted = vi.fn(
  async (handler: (event: JobCompletedEvent) => void) => {
    jobCompletedHandler = handler;
    return () => {
      jobCompletedHandler = null;
    };
  },
);
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

vi.mock("@fileoctopus/ts-api", () => ({
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
      deletePermanently,
      createFile,
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
    jobs: {
      cancelJob,
    },
    operationHistory: {
      listRecentOperations,
      clearOperationHistory,
    },
    diagnostics: {
      appDataHealth,
      exportBundle,
    },
    preferences: {
      get: preferencesGet,
      set: preferencesSet,
    },
    navigation: {
      recordVisit: vi.fn(async () => ({ ok: true })),
      listFavorites: vi.fn(async () => ({ favorites: [] })),
      addFavorite: vi.fn(async () => ({
        favorite: { id: 1, uri: "local:///test", label: "test" },
      })),
      removeFavorite: vi.fn(async () => ({ ok: true })),
      renameFavorite: vi.fn(async () => ({
        favorite: { id: 1, uri: "local:///test", label: "test" },
      })),
      listRecent: vi.fn(async () => ({ entries: [] })),
      listStarred: vi.fn(async () => ({ entries: [] })),
      toggleStarred: vi.fn(async () => ({ starred: true })),
      isStarred: vi.fn(async () => ({ starred: false })),
    },
  }),
  normalizeIpcError: (error: unknown) =>
    error && typeof error === "object" && "message" in error
      ? {
          code: "unknown",
          message: String((error as { message: unknown }).message),
        }
      : { code: "unknown", message: "error" },
}));

import { FileOctopusShell } from "../src";

describe("FileOctopusShell", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    batchHandler = null;
    jobStartedHandler = null;
    jobProgressHandler = null;
    jobCompletedHandler = null;
    folderSizeCompletedHandler = null;
    recursiveSearchMatchHandler = null;
    recursiveSearchCompletedHandler = null;
    sessionIndex = 0;
    listStart.mockClear();
    standardLocations.mockClear();
    startWatching.mockClear();
    stopWatching.mockClear();
    onWatchChanged.mockClear();
    openPathWithDefaultApp.mockClear();
    revealPathInFileManager.mockClear();
    deletePermanently.mockClear();
    createFile.mockClear();
    properties.mockClear();
    recursiveSearch.mockClear();
    startFolderSizeJob.mockClear();
    startRecursiveSearchJob.mockClear();
    onFolderSizeCompleted.mockClear();
    onRecursiveSearchMatch.mockClear();
    onRecursiveSearchCompleted.mockClear();
    onDirectoryBatch.mockClear();
    computeHash.mockClear();
    openTerminal.mockClear();
    listRecentOperations.mockClear();
    clearOperationHistory.mockClear();
    getAppInfo.mockClear();
    appDataHealth.mockClear();
    exportBundle.mockClear();
    subscribeJob.mockClear();
    planFileOperation.mockClear();
    startFileOperation.mockClear();
    onJobStarted.mockClear();
    onJobProgress.mockClear();
    onJobCompleted.mockClear();
    cancelJob.mockClear();
  });

  it("renders the two panel shell", async () => {
    render(<FileOctopusShell />);

    expect(await screen.findByText("Left")).toBeTruthy();
    expect(screen.getByText("Right")).toBeTruthy();
    expect(screen.getByLabelText("File panels")).toBeTruthy();
    expect(screen.getByLabelText("Job activity")).toBeTruthy();
  });

  it("renders a 100k entry batch without mounting every row", async () => {
    const { container } = render(<FileOctopusShell />);

    await waitFor(() => expect(batchHandler).toBeTruthy());

    await act(async () => {
      batchHandler?.({
        sessionId: panelSessions.left?.sessionId ?? "session-1",
        requestId: panelSessions.left?.requestId ?? "request-1",
        uri: "local:///tmp/100k",
        entries: Array.from({ length: 100_000 }, (_, index) => ({
          uri: `local:///tmp/100k/file-${index}.txt`,
          name: `file-${index}.txt`,
          kind: "file",
          size: 0,
          isHidden: false,
          isSymlink: false,
          providerId: "local",
          canRead: true,
          canList: false,
          canWrite: false,
          canDelete: false,
          canRename: false,
        })),
        batchIndex: 0,
        isComplete: true,
      });
    });

    expect(container.querySelectorAll(".fo-row").length).toBeLessThan(80);
  });

  it("validates and submits create-folder through the operation dialog", async () => {
    render(<FileOctopusShell />);
    await waitFor(() => expect(listStart).toHaveBeenCalledTimes(2));

    clickToolbar("New Folder", 0);
    fireEvent.change(screen.getByLabelText("Folder name"), {
      target: { value: "bad/name" },
    });
    fireEvent.click(screen.getByText("Create"));

    expect(
      await screen.findByText("Enter a folder name without path separators."),
    ).toBeTruthy();
    expect(planFileOperation).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Folder name"), {
      target: { value: "Reports" },
    });
    fireEvent.click(screen.getByText("Create"));

    await waitFor(() => expect(startFileOperation).toHaveBeenCalledTimes(1));
    expect(planFileOperation.mock.calls[0][0].operation).toMatchObject({
      kind: "createDirectory",
      destination: "local:///Users/ilya/Reports",
    });
  });

  it("validates rename names and sends the backend rename request", async () => {
    render(<FileOctopusShell />);
    await applyLeftEntries([entry("alpha.txt")]);

    clickToolbar("Rename", 0);
    fireEvent.change(screen.getByLabelText("New name"), {
      target: { value: "bad/name" },
    });
    fireEvent.click(screen.getAllByText("Rename").slice(-1)[0]);

    expect(
      await screen.findByText("Enter a name without path separators."),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("New name"), {
      target: { value: "beta.txt" },
    });
    fireEvent.click(screen.getAllByText("Rename").slice(-1)[0]);

    await waitFor(() => expect(startFileOperation).toHaveBeenCalledTimes(1));
    expect(planFileOperation.mock.calls[0][0].operation).toMatchObject({
      kind: "rename",
      sources: ["local:///tmp/alpha.txt"],
      newName: "beta.txt",
    });
  });

  it("requires explicit trash confirmation before starting delete-to-trash", async () => {
    render(<FileOctopusShell />);
    await applyLeftEntries([entry("alpha.txt")]);

    clickToolbar("Trash", 0);

    expect(screen.getByText("Move 1 item(s) to Trash")).toBeTruthy();
    expect(screen.getByRole("dialog").textContent).toContain("alpha.txt");

    fireEvent.click(screen.getAllByText("Move to Trash").slice(-1)[0]);

    await waitFor(() => expect(startFileOperation).toHaveBeenCalledTimes(1));
    expect(planFileOperation.mock.calls[0][0].operation).toMatchObject({
      kind: "deleteToTrash",
      sources: ["local:///tmp/alpha.txt"],
    });
  });

  it("plans copy conflicts before start and passes selected policy", async () => {
    render(<FileOctopusShell />);
    await applyLeftEntries([entry("alpha.txt")]);

    clickToolbar("Copy To…", 0);
    expect(
      (screen.getByLabelText("Conflict policy") as HTMLSelectElement).value,
    ).toBe("fail");
    expect((screen.getByText("Start") as HTMLButtonElement).disabled).toBe(
      true,
    );

    fireEvent.click(screen.getByText("Plan"));
    expect(
      await screen.findByText("1 planned item(s), 1 conflict(s)"),
    ).toBeTruthy();
    expect(startFileOperation).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Conflict policy"), {
      target: { value: "skip" },
    });
    fireEvent.click(screen.getByText("Plan"));
    await screen.findByText("1 planned item(s), 1 conflict(s)");
    fireEvent.click(screen.getByText("Start"));

    await waitFor(() => expect(startFileOperation).toHaveBeenCalledTimes(1));
    expect(planFileOperation.mock.calls.at(-1)?.[0].operation).toMatchObject({
      kind: "copy",
      conflictPolicy: "skip",
    });
  });

  it("renders job progress and invokes cancellation", async () => {
    render(<FileOctopusShell />);
    await waitFor(() => expect(onJobProgress).toHaveBeenCalledTimes(1));

    act(() => {
      jobStartedHandler?.({
        jobId: "job-live",
        operationKind: "copy",
        totalItems: 2,
        totalBytes: 100,
        startedAt: new Date(0).toISOString(),
      });
      jobProgressHandler?.({
        jobId: "job-live",
        operationKind: "copy",
        currentItem: "alpha.txt",
        completedItems: 1,
        totalItems: 2,
        completedBytes: 50,
        totalBytes: 100,
        updatedAt: new Date(1).toISOString(),
      });
    });

    expect(screen.getByText(/copying/i)).toBeTruthy();
    fireEvent.click(screen.getAllByText("Cancel")[0]);
    expect(cancelJob).toHaveBeenCalledWith({ jobId: "job-live" });

    act(() => {
      jobCompletedHandler?.({
        jobId: "job-live",
        operationKind: "copy",
        completedItems: 2,
        completedBytes: 100,
        completedAt: new Date(2).toISOString(),
      });
    });

    expect(screen.getByText(/copied/i)).toBeTruthy();
    expect(screen.getByText("Operation completed")).toBeTruthy();
  });

  it("shows app diagnostics and exports a bundle", async () => {
    render(<FileOctopusShell />);

    const helpTrigger = screen
      .getAllByRole("menuitem")
      .find((el) => el.textContent?.includes("Help"));
    fireEvent.click(helpTrigger!);
    fireEvent.click(await screen.findByText("Diagnostics…"));
    expect(await screen.findByText("0.1.0")).toBeTruthy();
    fireEvent.click(screen.getByText("Export bundle"));

    await waitFor(() => expect(exportBundle).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Exported 1 file(s).")).toBeTruthy();
  });

  it("handles baseline keyboard shortcuts outside text inputs", async () => {
    render(<FileOctopusShell />);
    await applyLeftEntries([folderEntry("Projects"), entry("alpha.txt")]);

    fireEvent.keyDown(screen.getByLabelText("File panels"), { key: "Delete" });
    expect(screen.getByText("Move 1 item(s) to Trash")).toBeTruthy();

    fireEvent.keyDown(screen.getByLabelText("File panels"), { key: "Escape" });
    expect(screen.queryByText("Move 1 item(s) to Trash")).toBeNull();

    fireEvent.keyDown(screen.getByLabelText("File panels"), { key: "F5" });
    await waitFor(() => expect(listStart).toHaveBeenCalledTimes(3));
  });

  it("creates empty files and refreshes the current panel", async () => {
    render(<FileOctopusShell />);
    await waitFor(() => expect(listStart).toHaveBeenCalledTimes(2));

    clickToolbar("New File", 0);
    fireEvent.change(screen.getByLabelText("File name"), {
      target: { value: "notes.txt" },
    });
    fireEvent.click(screen.getByText("Create"));

    await waitFor(() => expect(startFileOperation).toHaveBeenCalledTimes(1));
    expect(planFileOperation).toHaveBeenCalledWith({
      operation: {
        kind: "createFile",
        sources: [],
        destination: "local:///Users/ilya/notes.txt",
        newName: undefined,
        conflictPolicy: "fail",
      },
    });
    expect(startFileOperation).toHaveBeenCalledWith({
      operationId: "operation-1",
    });
  });

  it("opens files externally while folders navigate internally", async () => {
    render(<FileOctopusShell />);
    await applyLeftEntries([folderEntry("Projects"), entry("alpha.txt")]);

    fireEvent.doubleClick(screen.getByText(/alpha.txt/));
    await waitFor(() =>
      expect(openPathWithDefaultApp).toHaveBeenCalledWith({
        uri: "local:///tmp/alpha.txt",
      }),
    );

    fireEvent.doubleClick(screen.getByText(/Projects/));
    await waitFor(() =>
      expect(
        listStart.mock.calls[listStart.mock.calls.length - 1]?.[0],
      ).toMatchObject({
        uri: "local:///tmp/Projects",
      }),
    );
  });

  it("shows properties and recursive search result actions", async () => {
    render(<FileOctopusShell />);
    await applyLeftEntries([entry("alpha.txt")]);

    clickToolbar("Properties", 0);
    expect(await screen.findByText("/tmp/alpha.txt")).toBeTruthy();

    fireEvent.click(screen.getByText("Close"));
    fireEvent.change(screen.getByLabelText("left recursive search"), {
      target: { value: "needle" },
    });
    fireEvent.click(screen.getAllByText("Search")[0]);

    expect(await screen.findByText(/needle\.txt/)).toBeTruthy();
    fireEvent.click(screen.getAllByText("Reveal")[0]);
    await waitFor(() =>
      expect(revealPathInFileManager).toHaveBeenCalledWith({
        uri: "local:///tmp/needle.txt",
      }),
    );
  });

  it("toggles hidden files and switches view modes without navigating away", async () => {
    render(<FileOctopusShell />);
    await applyLeftEntries([entry("alpha.txt")]);

    const viewModeGroup = screen.getByRole("group", { name: "left view mode" });
    fireEvent.click(
      viewModeGroup.querySelector(
        "button.fo-ui-segmented-item:nth-child(3)",
      ) as HTMLButtonElement,
    );
    expect(document.querySelector(".fo-view-icons")).toBeTruthy();

    clickToolbar("Show Hidden", 0);
    await waitFor(() =>
      expect(
        listStart.mock.calls[listStart.mock.calls.length - 1]?.[0],
      ).toMatchObject({
        uri: "local:///Users/ilya",
        includeHidden: true,
      }),
    );
  });

  it("computes checksum via IPC when Checksum toolbar action clicked", async () => {
    render(<FileOctopusShell />);
    await applyLeftEntries([entry("test.txt")]);

    // Clear any computeHash calls from the hash column useEffect
    computeHash.mockClear();

    clickToolbar("Checksum…", 0);

    await waitFor(() =>
      expect(computeHash).toHaveBeenCalledWith({
        uri: "local:///tmp/test.txt",
        algorithm: "sha256",
      }),
    );
  });

  it("shows error toast when checksum called without file selected", async () => {
    render(<FileOctopusShell />);
    await applyLeftEntries([folderEntry("mydir")]);

    clickToolbar("Checksum…", 0);

    // Should not call computeHash for a directory
    await waitFor(() => {
      expect(computeHash).not.toHaveBeenCalled();
    });
  });
});

function entry(name: string): FileEntryDto {
  return {
    uri: `local:///tmp/${name}`,
    name,
    kind: "file",
    size: 12,
    isHidden: false,
    isSymlink: false,
    providerId: "local",
    canRead: true,
    canList: false,
    canWrite: true,
    canDelete: true,
    canRename: true,
  };
}

function folderEntry(name: string): FileEntryDto {
  return {
    ...entry(name),
    uri: `local:///tmp/${name}`,
    kind: "directory",
    canList: true,
  };
}

function openToolbarOverflow(panelIndex = 0) {
  fireEvent.click(screen.getAllByText("More")[panelIndex]);
}

function clickToolbar(label: string, panelIndex = 0) {
  const matches = screen.queryAllByText(label);

  if (matches[panelIndex]) {
    fireEvent.click(matches[panelIndex]);
    return;
  }

  openToolbarOverflow(panelIndex);
  fireEvent.click(screen.getAllByText(label)[0]);
}

async function applyLeftEntries(entries: FileEntryDto[]) {
  await waitFor(() => expect(listStart).toHaveBeenCalledTimes(2));

  await act(async () => {
    batchHandler?.({
      sessionId: panelSessions.left?.sessionId ?? "session-1",
      requestId: panelSessions.left?.requestId ?? "request-1",
      uri: "local:///Users/ilya",
      entries,
      batchIndex: 0,
      isComplete: true,
    });
  });
}
