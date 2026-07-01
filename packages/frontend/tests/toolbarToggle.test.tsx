import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  within,
  fireEvent,
} from "@testing-library/react";

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
const preferencesGet = vi.fn(async () => null);
const preferencesSet = vi.fn(async () => ({ ok: true }));

vi.mock("@fileoctopus/ts-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fileoctopus/ts-api")>();
  const { mockNetworkClient } = await import("./mockNetworkClient");
  const { mockTerminalClient } = await import("./mockTerminalClient");
  return {
    ...actual,
    createFileOctopusClient: () => ({
      getAppInfo: vi.fn(async () => ({
        name: "FileOctopus",
        version: "0.1.3",
      })),
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
        onJobStarted: subscribeJob,
        onJobProgress: subscribeJob,
        onJobCompleted: subscribeJob,
        onJobFailed: subscribeJob,
        onJobCancelled: subscribeJob,
        onJobPaused: subscribeJob,
        onJobResumed: subscribeJob,
      },
      jobs: { cancelJob },
      operationHistory: {
        listRecentOperations: vi.fn(async () => ({ operations: [] })),
        clearOperationHistory: vi.fn(async () => ({ ok: true })),
      },
      diagnostics: {
        appDataHealth: vi.fn(async () => ({ healthy: true, issues: [] })),
        exportBundle: vi.fn(async () => ({ exportedFiles: 1 })),
      },
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

function openViewMenu() {
  const triggers = screen.getAllByRole("menuitem");
  const viewTrigger = triggers.find(
    (el) => el.textContent && el.textContent.indexOf("View") !== -1,
  );
  if (!viewTrigger) throw new Error("View menu trigger not found");
  fireEvent.click(viewTrigger);
}

function findMenuItem(
  menu: HTMLElement,
  text: string,
): HTMLButtonElement | null {
  const items = [
    ...within(menu).queryAllByRole("menuitem"),
    ...within(menu).queryAllByRole("menuitemcheckbox"),
  ];
  const item = items.find(
    (el) => el.textContent && el.textContent.indexOf(text) !== -1,
  );
  return (item as HTMLButtonElement) ?? null;
}

describe("P0-4: Show Toolbar / Status Bar menu toggles are enabled", () => {
  beforeEach(() => {
    listStart.mockClear();
    standardLocations.mockClear();
    onDirectoryBatch.mockClear();
  });

  afterEach(cleanup);

  it("Show Toolbar menu item is enabled (not disabled)", () => {
    render(<FileOctopusShell />);
    openViewMenu();

    const menu = screen.getByRole("menu");
    const toolbarItem = findMenuItem(menu, "Toolbar");
    expect(toolbarItem).toBeTruthy();
    expect(toolbarItem!.disabled).toBe(false);
  });

  it("Show Status Bar menu item is enabled (not disabled)", () => {
    render(<FileOctopusShell />);
    openViewMenu();

    const menu = screen.getByRole("menu");
    const statusBarItem = findMenuItem(menu, "Status Bar");
    expect(statusBarItem).toBeTruthy();
    expect(statusBarItem!.disabled).toBe(false);
  });
});
