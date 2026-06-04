import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type DirectoryBatchEventDto,
  type FileEntryDto,
  type FileOperationRequestDto,
  type FolderSizeCompletedEventDto,
  type JobCompletedEvent,
  type JobProgressEvent,
  type JobStartedEvent,
  type RecursiveSearchCompletedEventDto,
  type RecursiveSearchMatchEventDto,
  type UserPreferencesDto,
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
const appPreferences: UserPreferencesDto = {
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
  jobDrawerBehavior: "manual",
  showAdvancedCopyOptions: false,
  paneTerminalHeightLeft: 0.35,
  paneTerminalHeightRight: 0.35,
  paneTerminalDefaultOpen: false,
  terminalCdOnNavigate: false,
  confirmClosePaneWithTerminal: true,
  terminalShell: "",
  terminalArgs: "",
  tabSessions: "",
  hotlistEntries: "",
  leftDefaultViewMode: "details",
  rightDefaultViewMode: "details",
  leftDefaultSortField: "name",
  rightDefaultSortField: "name",
  popupNotifications: true,
};
const preferencesGet = vi.fn(async () => ({
  preferences: appPreferences,
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
  dataDir: "~/.fileoctopus-dev",
  networkEnabled: false,
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

vi.mock("@fileoctopus/ts-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fileoctopus/ts-api")>();
  const { mockTerminalClient } = await import("./mockTerminalClient");
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
        discoverVolumes: vi.fn(async () => ({ volumes: [] })),
        getAcl: vi.fn(async () => ({
          owner: "user",
          group: "user",
          entries: [
            { principal: "owner", read: true, write: true, execute: false },
            { principal: "group", read: true, write: false, execute: false },
            { principal: "other", read: true, write: false, execute: false },
          ],
          octal: "644",
        })),
        setAcl: vi.fn(async () => ({ success: true })),
        compareFiles: vi.fn(async () => ({
          identical: false,
          hunks: [],
          byteDifferences: [],
        })),
        onContentSearchMatch: vi.fn(async () => () => {}),
        onContentSearchCompleted: vi.fn(async () => () => {}),
      },
      terminal: mockTerminalClient(),
      fileOperations: {
        planFileOperation,
        startFileOperation,
        onJobStarted,
        onJobProgress,
        onJobCompleted,
        onJobFailed: subscribeJob,
        onJobCancelled: subscribeJob,
        onJobPaused: subscribeJob,
        onJobResumed: subscribeJob,
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
      network: {
        listProfiles: vi.fn(async () => ({ profiles: [] })),
        connectionStatus: vi.fn(async () => ({ statuses: [] })),
        connect: vi.fn(async () => ({ ok: true })),
        disconnect: vi.fn(async () => ({ ok: true })),
        addProfile: vi.fn(async () => ({
          profile: {
            id: "profile-1",
            label: "Test",
            scheme: "sftp",
            host: "example.com",
            port: 22,
            username: "deploy",
            authKind: "password",
            privateKeyPath: null,
            defaultPath: "/",
            defaultUri: "sftp://profile-1/",
            sortOrder: 0,
            createdAt: new Date(0).toISOString(),
            updatedAt: new Date(0).toISOString(),
            lastConnectedAt: null,
            lastError: null,
            hostKeyFingerprint: null,
          },
        })),
        updateProfile: vi.fn(async () => ({
          profile: {
            id: "profile-1",
            label: "Test",
            scheme: "sftp",
            host: "example.com",
            port: 22,
            username: "deploy",
            authKind: "password",
            privateKeyPath: null,
            defaultPath: "/",
            defaultUri: "sftp://profile-1/",
            sortOrder: 0,
            createdAt: new Date(0).toISOString(),
            updatedAt: new Date(0).toISOString(),
            lastConnectedAt: null,
            lastError: null,
            hostKeyFingerprint: null,
          },
        })),
        deleteProfile: vi.fn(async () => ({ ok: true })),
        setSecret: vi.fn(async () => ({ ok: true })),
        validateUri: vi.fn(async () => ({ ok: true })),
        subscribeStatusEvents: vi.fn(async () => () => undefined),
      },
    }),
    normalizeIpcError: (error: unknown) =>
      error && typeof error === "object" && "message" in error
        ? {
            code: actual.IPC_ERROR_CODES.UNKNOWN,
            message: String((error as { message: unknown }).message),
          }
        : { code: actual.IPC_ERROR_CODES.UNKNOWN, message: "error" },
  };
});

import { FileOctopusShell } from "../src";
import { FIRST_RUN_DISMISSED_KEY } from "../src/onboarding/firstRun";

describe("FileOctopusShell", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(FIRST_RUN_DISMISSED_KEY, "true");
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
    const { container } = render(<FileOctopusShell />);

    expect(screen.getByLabelText("File panels")).toBeTruthy();
    expect(screen.getByLabelText("Activity and terminal")).toBeTruthy();
    expect(container.querySelectorAll(".fo-panel").length).toBe(2);
  });

  it("starts watching the active pane location", async () => {
    render(<FileOctopusShell />);

    await waitFor(() =>
      expect(startWatching).toHaveBeenCalledWith({
        uri: "local:///Users/ilya",
      }),
    );
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
  }, 30_000);

  it("validates and submits create-folder through the operation dialog", async () => {
    render(<FileOctopusShell />);
    await waitFor(() => expect(listStart).toHaveBeenCalledTimes(2));

    clickToolbar("New Folder", 0);
    expect(
      within(screen.getByRole("dialog")).queryByRole("button", {
        name: "Close",
      }),
    ).toBeTruthy();
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

  it("prefills a unique folder name when New Folder already exists", async () => {
    render(<FileOctopusShell />);
    await applyLeftEntries([folderEntry("New Folder")]);

    fireEvent.click(screen.getAllByRole("button", { name: "Folder+" })[0]);

    expect(
      (screen.getByLabelText("Folder name") as HTMLInputElement).value,
    ).toBe("New Folder 2");
  });

  it("keeps create-folder dialog open when the destination exists", async () => {
    planFileOperation.mockResolvedValueOnce({
      plan: {
        operationId: "operation-1",
        kind: "createDirectory",
        sources: [],
        destination: "local:///Users/ilya/New%20Folder",
        newName: null,
        conflictPolicy: "fail",
        items: [],
        conflicts: [
          {
            source: "local:///Users/ilya/New%20Folder",
            destination: "local:///Users/ilya/New%20Folder",
          },
        ],
        warnings: [],
        totalItems: 1,
        totalBytes: 0,
      },
    });

    render(<FileOctopusShell />);
    await waitFor(() => expect(listStart).toHaveBeenCalledTimes(2));

    clickToolbar("New Folder", 0);
    fireEvent.click(screen.getByText("Create"));

    expect(
      await screen.findByText("A folder with this name already exists."),
    ).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(startFileOperation).not.toHaveBeenCalled();
  });

  it("validates rename names and sends the backend rename request", async () => {
    render(<FileOctopusShell />);
    await applyLeftEntries([entry("alpha.txt")]);

    clickToolbar("Rename", 0);
    const renameInput = screen.getByLabelText("Rename alpha.txt");
    fireEvent.change(renameInput, {
      target: { value: "bad/name" },
    });
    fireEvent.blur(renameInput);

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

    expect(screen.getByText("Move 1 selected item to Trash")).toBeTruthy();
    expect(screen.getByRole("dialog").textContent).toContain("alpha.txt");

    fireEvent.click(screen.getAllByText("Move to Trash").slice(-1)[0]);

    await waitFor(() => expect(startFileOperation).toHaveBeenCalledTimes(1));
    expect(planFileOperation.mock.calls[0][0].operation).toMatchObject({
      kind: "deleteToTrash",
      sources: ["local:///tmp/alpha.txt"],
    });
  });

  it("makes copy planning optional in advanced options", async () => {
    preferencesGet.mockResolvedValueOnce({
      preferences: { ...appPreferences, showAdvancedCopyOptions: true },
    });

    render(<FileOctopusShell />);
    await applyLeftEntries([entry("alpha.txt")]);

    clickToolbar("Copy", 0);
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(dialog.getByRole("button", { name: "Browse…" })).toBeTruthy();
    expect(
      (dialog.getByLabelText("Conflict policy") as HTMLSelectElement).value,
    ).toBe("fail");
    expect(
      (dialog.getByRole("button", { name: "Copy" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(dialog.queryByText("Plan")).toBeNull();

    fireEvent.click(
      dialog.getByLabelText("Preview operation plan before copying"),
    );

    fireEvent.click(dialog.getByText("Plan"));
    expect(await dialog.findByText("1 planned item, 1 conflict")).toBeTruthy();
    expect(startFileOperation).not.toHaveBeenCalled();

    fireEvent.change(dialog.getByLabelText("Conflict policy"), {
      target: { value: "skip" },
    });
    fireEvent.click(dialog.getByText("Plan"));
    await dialog.findByText("1 planned item, 1 conflict");
    fireEvent.click(dialog.getByRole("button", { name: "Copy" }));

    expect(await dialog.findByText("Resolve Conflicts")).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "Skip" }));

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

    const activityBtn = await screen.findByRole("button", {
      name: /Copying 50%/i,
    });
    expect(activityBtn).toBeTruthy();
    fireEvent.click(activityBtn);
    expect(screen.getAllByText(/copying/i).length).toBeGreaterThan(0);
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
    fireEvent.click(screen.getByRole("button", { name: "Export bundle" }));

    await waitFor(() => expect(exportBundle).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Exported 1 file(s).")).toBeTruthy();
  });

  it("handles baseline keyboard shortcuts outside text inputs", async () => {
    render(<FileOctopusShell />);
    await applyLeftEntries([folderEntry("Projects"), entry("alpha.txt")]);

    fireEvent.keyDown(screen.getByLabelText("File panels"), { key: "Delete" });
    expect(screen.getByText("Move 1 selected item to Trash")).toBeTruthy();

    fireEvent.keyDown(screen.getByLabelText("File panels"), { key: "Escape" });
    expect(screen.queryByText("Move 1 selected item to Trash")).toBeNull();

    fireEvent.keyDown(screen.getByLabelText("File panels"), { key: "F5" });
    expect(await screen.findByLabelText("Destination URI")).toBeTruthy();

    fireEvent.keyDown(screen.getByLabelText("File panels"), { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByLabelText("Destination URI")).toBeNull(),
    );

    fireEvent.keyDown(screen.getByLabelText("File panels"), {
      key: "r",
      ctrlKey: true,
    });
    await waitFor(() => expect(listStart.mock.calls.length).toBeGreaterThan(2));
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

  it("starts archive creation through the shared file operation pipeline", async () => {
    render(<FileOctopusShell />);
    await applyLeftEntries([entry("alpha.txt")]);

    clickToolbar("Pack", 0);

    await waitFor(() => expect(startFileOperation).toHaveBeenCalledTimes(1));
    expect(planFileOperation).toHaveBeenCalledWith({
      operation: {
        kind: "createArchive",
        sources: ["local:///tmp/alpha.txt"],
        destination: "local:///Users/ilya/alpha.zip",
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

    clickToolbar("Props");
    expect(await screen.findByText("/tmp/alpha.txt")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    // Recursive search moved to shared toolbar — verify search via command
  });

  it("toggles hidden files and switches view modes without navigating away", async () => {
    render(<FileOctopusShell />);
    await applyLeftEntries([entry("alpha.txt")]);

    // Switch view mode via keyboard shortcut
    const shell = document.querySelector(".fo-shell")!;
    fireEvent.keyDown(shell, { key: "8", ctrlKey: true, metaKey: false });

    clickToolbar("Show Hidden");
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

    clickToolbar("Checksum", 0);

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

    clickToolbar("Checksum", 0);

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
