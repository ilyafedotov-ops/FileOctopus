import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  act,
} from "@testing-library/react";
import type { FileEntryDto } from "@fileoctopus/ts-api";

const listStart = vi.fn(async (request: { requestId: string }) => ({
  requestId: request.requestId,
  sessionId: `s-${request.requestId}`,
}));
const onDirectoryBatch = vi.fn(async () => () => undefined);
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
  version: "0.1.3",
}));
const appDataHealth = vi.fn(async () => ({ healthy: true, issues: [] }));
const exportBundle = vi.fn(async () => ({ exportedFiles: 1 }));
const preferencesGet = vi.fn(async () => null);
const preferencesSet = vi.fn(async () => ({ ok: true }));

vi.mock("@fileoctopus/ts-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fileoctopus/ts-api")>();
  const { mockNetworkClient } = await import("./mockNetworkClient");
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
      jobs: { cancelJob },
      operationHistory: { listRecentOperations, clearOperationHistory },
      diagnostics: { appDataHealth, exportBundle },
      preferences: { get: preferencesGet, set: preferencesSet },
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
      network: mockNetworkClient,
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

describe("Filter Input wiring", () => {
  let batchHandler: ((event: Record<string, unknown>) => void) | null = null;

  beforeEach(() => {
    batchHandler = null;
    listStart.mockClear();
    standardLocations.mockClear();
    onDirectoryBatch.mockImplementation(
      async (handler: (event: Record<string, unknown>) => void) => {
        batchHandler = handler;
        return () => {
          batchHandler = null;
        };
      },
    );
  });

  afterEach(cleanup);

  it("renders a filter input inside the file panel", async () => {
    render(<FileOctopusShell />);
    await waitFor(() => expect(listStart).toHaveBeenCalledTimes(2));

    const filterInputs = screen.queryAllByPlaceholderText(
      "Filter current folder…",
    );
    expect(filterInputs.length).toBeGreaterThanOrEqual(1);
  });

  it("dispatches setFilter when typing in the filter input", async () => {
    render(<FileOctopusShell />);
    await waitFor(() => expect(listStart).toHaveBeenCalledTimes(2));

    const requestId = listStart.mock.calls[0]?.[0]?.requestId;
    expect(requestId).toBeTruthy();

    await act(async () => {
      batchHandler?.({
        sessionId: `s-${requestId}`,
        requestId,
        uri: "local:///Users/ilya",
        entries: [entry("alpha.txt"), entry("beta.txt"), entry("gamma.txt")],
        batchIndex: 0,
        isComplete: true,
      });
    });

    const filterInput = screen.queryAllByPlaceholderText(
      "Filter current folder…",
    )[0];
    expect(filterInput).toBeTruthy();

    fireEvent.change(filterInput, { target: { value: "alpha" } });

    await waitFor(() => {
      const activePanel = document.querySelector(
        '.fo-panel[data-active="true"]',
      );
      const rows = activePanel?.querySelectorAll(".fo-row") ?? [];
      expect(rows.length).toBe(2);
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
