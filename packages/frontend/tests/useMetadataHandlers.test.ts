import { describe, expect, it, vi } from "vitest";
import type { FileEntryDto } from "@fileoctopus/ts-api";
import { renderHook, act } from "@testing-library/react";
import {
  createInitialState,
  panelReducer,
  type FileOctopusState,
  type PanelAction,
} from "../src/panelStore";
import { useMetadataHandlers } from "../src/hooks/fileOps/useMetadataHandlers";

function makeEntry(overrides: Partial<FileEntryDto> = {}): FileEntryDto {
  return {
    name: "test.txt",
    uri: "local:///home/user/test.txt",
    kind: "file",
    size: 100,
    extension: ".txt",
    modifiedAt: "2026-01-01T00:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
    isHidden: false,
    isSymlink: false,
    providerId: "local",
    canRead: true,
    canList: true,
    canWrite: true,
    canDelete: true,
    canRename: true,
    ...overrides,
  };
}

function buildDeps(overrides: Record<string, unknown> = {}) {
  const setDialog = vi.fn();
  const state = createInitialState();
  const entries = [
    makeEntry({ uri: "local:///home/user/a.txt", name: "a.txt" }),
    makeEntry({ uri: "local:///home/user/b.txt", name: "b.txt" }),
    makeEntry({
      uri: "local:///home/user/folder",
      name: "folder",
      kind: "directory",
      size: 0,
      extension: null,
    }),
  ];

  state.panels.left.tabs.main.selectedIds = entries.map((entry) => entry.uri);
  for (const entry of entries) {
    state.panels.left.tabs.main.entriesById[entry.uri] = entry;
  }

  const client = {
    fs: {
      properties: vi.fn(),
      startFolderSizeJob: vi.fn(async () => ({
        job: { jobId: "job-1" },
      })),
      startContentSearchJob: vi.fn(),
    },
    jobs: {
      cancelJob: vi.fn(async () => ({ job: { jobId: "cancelled" } })),
    },
  };

  return {
    setDialog,
    entries,
    state,
    deps: {
      client,
      state,
      dispatch: vi.fn(),
      setSearch: vi.fn(),
      setDialog,
      setJobs: vi.fn(),
      setOperationError: vi.fn(),
      pushToast: vi.fn(),
      preferences: null,
      refreshPanel: vi.fn(),
      refreshVisiblePanels: vi.fn(),
      refreshNavigation: vi.fn(async () => undefined),
      navigatePanel: vi.fn(async () => undefined),
      ...overrides,
    },
  };
}

describe("useMetadataHandlers", () => {
  it("opens selection properties when multiple items are selected", async () => {
    const { deps, setDialog, entries } = buildDeps();
    const { result } = renderHook(() => useMetadataHandlers(deps));

    await act(async () => {
      await result.current.handleProperties("left", null);
    });

    expect(setDialog).toHaveBeenCalledWith({
      type: "selectionProperties",
      panelId: "left",
      entries,
      totalSize: null,
      calculatingSize: false,
      folderSizeJobIds: [],
      pendingFolderSizeJobs: 0,
      folderSizeBytes: 0,
      fileSizeBaseline: 200,
      error: null,
    });
  });

  it("shows properties before starting a folder size job", async () => {
    const directory = makeEntry({
      uri: "local:///home/user/folder",
      name: "folder",
      kind: "directory",
      size: 0,
      extension: null,
    });
    const { deps, setDialog, state } = buildDeps();
    deps.client.fs.properties = vi.fn(async () => ({
      properties: {
        uri: directory.uri,
        name: directory.name,
        kind: "directory",
        size: null,
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
    state.panels.left.tabs.main.selectedIds = [directory.uri];
    state.panels.left.tabs.main.entriesById = {
      [directory.uri]: directory,
    };

    const { result } = renderHook(() => useMetadataHandlers(deps));

    await act(async () => {
      await result.current.handleProperties("left", directory);
    });

    expect(setDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "properties",
        properties: expect.objectContaining({ name: "folder" }),
        loading: true,
        folderSizeJobId: null,
      }),
    );

    const applyJobId = setDialog.mock.calls
      .map((call) => call[0])
      .find((value) => typeof value === "function") as
      ((current: unknown) => unknown) | undefined;
    expect(applyJobId).toBeTypeOf("function");
    expect(
      applyJobId?.({
        type: "properties",
        panelId: "left",
        properties: { uri: directory.uri, name: "folder", kind: "directory" },
        loading: true,
        folderSizeJobId: null,
      }),
    ).toEqual(
      expect.objectContaining({
        type: "properties",
        folderSizeJobId: "job-1",
      }),
    );
  });

  it("starts folder size jobs for selected directories", async () => {
    const { deps, setDialog, entries } = buildDeps();
    const { result } = renderHook(() => useMetadataHandlers(deps));

    await act(async () => {
      await result.current.handleProperties("left", null);
    });

    const dialog = setDialog.mock.calls[0][0];
    await act(async () => {
      await result.current.calculateSelectionSize(dialog);
    });

    expect(deps.client.fs.startFolderSizeJob).toHaveBeenCalledWith({
      uri: entries[2].uri,
    });
    expect(setDialog).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "selectionProperties",
        calculatingSize: true,
        folderSizeJobIds: ["job-1"],
        pendingFolderSizeJobs: 1,
      }),
    );
  });

  it("cancels a stale overlapping start response without replacing the latest search", async () => {
    const first = deferred<{ job: { jobId: string } }>();
    const second = deferred<{ job: { jobId: string } }>();
    const built = buildDeps();
    let currentState = built.state;
    currentState.panels.left.tabs.main.contentSearchQuery = "first";
    built.deps.client.fs.startContentSearchJob = vi.fn((request) =>
      request.query === "first" ? first.promise : second.promise,
    );
    const dispatch = vi.fn((action: PanelAction) => {
      currentState = panelReducer(currentState, action);
    });
    const { result, rerender } = renderHook(
      ({ state }: { state: FileOctopusState }) =>
        useMetadataHandlers({ ...built.deps, state, dispatch }),
      { initialProps: { state: currentState } },
    );

    let firstRun!: Promise<void>;
    act(() => {
      firstRun = result.current.runContentSearch("left");
    });
    currentState = panelReducer(currentState, {
      type: "setContentSearchQuery",
      panelId: "left",
      tabId: "main",
      query: "second",
    });
    rerender({ state: currentState });
    let secondRun!: Promise<void>;
    act(() => {
      secondRun = result.current.runContentSearch("left");
    });

    await act(async () => {
      second.resolve({ job: { jobId: "job-second" } });
      await secondRun;
    });
    rerender({ state: currentState });
    await act(async () => {
      first.resolve({ job: { jobId: "job-first" } });
      await firstRun;
    });

    expect(currentState.panels.left.tabs.main.contentSearch?.query).toBe(
      "second",
    );
    expect(currentState.panels.left.tabs.main.contentSearch?.jobId).toBe(
      "job-second",
    );
    expect(built.deps.client.jobs.cancelJob).toHaveBeenCalledWith({
      jobId: "job-first",
    });
  });

  it("cancels the tab-owned content search and marks it terminal", async () => {
    const built = buildDeps();
    let currentState = built.state;
    currentState.panels.left.tabs.main.contentSearchQuery = "needle";
    built.deps.client.fs.startContentSearchJob = vi.fn(async () => ({
      job: { jobId: "job-content" },
    }));
    const dispatch = vi.fn((action: PanelAction) => {
      currentState = panelReducer(currentState, action);
    });
    const { result, rerender } = renderHook(
      ({ state }: { state: FileOctopusState }) =>
        useMetadataHandlers({ ...built.deps, state, dispatch }),
      { initialProps: { state: currentState } },
    );

    await act(async () => {
      await result.current.runContentSearch("left");
    });
    rerender({ state: currentState });
    await act(async () => {
      await result.current.cancelContentSearch("left", "main");
    });

    expect(built.deps.client.jobs.cancelJob).toHaveBeenCalledWith({
      jobId: "job-content",
    });
    expect(currentState.panels.left.tabs.main.contentSearch?.status).toBe(
      "cancelled",
    );
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
