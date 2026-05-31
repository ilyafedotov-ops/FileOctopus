import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useArchiveHandlers } from "../src/hooks/fileOps/useArchiveHandlers";
import { createInitialState } from "../src/panelStore";
import type { FileEntryDto } from "@fileoctopus/ts-api";

vi.mock("@fileoctopus/ts-api", () => ({
  normalizeIpcError: (err: unknown) => ({
    code: "UNKNOWN",
    message: err instanceof Error ? err.message : String(err),
  }),
}));

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
  const setJobs = vi.fn();
  const pushToast = vi.fn();
  const state = createInitialState();
  const entry = makeEntry();

  state.panels.left.tabs.main.selectedId = entry.uri;
  state.panels.left.tabs.main.selectedIds = [entry.uri];
  state.panels.left.tabs.main.orderedEntryIds = [entry.uri];
  state.panels.left.tabs.main.entriesById[entry.uri] = entry;

  const planOperation = vi.fn(async () => ({
    plan: { operationId: "op-1" },
  }));

  const client = {
    fileOperations: {
      startFileOperation: vi.fn(async () => ({
        job: { jobId: "job-1" },
      })),
    },
  };

  return {
    setJobs,
    pushToast,
    entry,
    state,
    deps: {
      client,
      state,
      dispatch: vi.fn(),
      setDialog: vi.fn(),
      setJobs,
      setOperationError: vi.fn(),
      pushToast,
      setSearch: vi.fn(),
      preferences: null,
      refreshPanel: vi.fn(),
      refreshVisiblePanels: vi.fn(),
      refreshNavigation: vi.fn(async () => undefined),
      navigatePanel: vi.fn(async () => undefined),
      ...overrides,
    },
    coreOverride: {
      planOperation,
      startOperation: vi.fn(async () => true),
      selectedEntries: vi.fn(() => []),
    },
  };
}

describe("useArchiveHandlers", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("handleCompress shows error toast when no entry selected", async () => {
    const { deps, coreOverride } = buildDeps();
    // No selectedId set
    deps.state.panels.left.tabs.main.selectedId = null;

    const { result } = renderHook(() => useArchiveHandlers(deps, coreOverride));

    await act(async () => {
      await result.current.handleCompress("left");
    });

    expect(deps.pushToast).toHaveBeenCalledWith({
      tone: "error",
      title: "Select files or folders to compress",
    });
  });

  it("handleCompress compresses a file entry successfully", async () => {
    const { deps, coreOverride, entry } = buildDeps();
    entry.name = "myfile.txt";

    const { result } = renderHook(() => useArchiveHandlers(deps, coreOverride));

    await act(async () => {
      await result.current.handleCompress("left");
    });

    expect(coreOverride.planOperation).toHaveBeenCalledWith(
      "createArchive",
      [entry.uri],
      expect.stringContaining("myfile.zip"),
    );
    expect(deps.setJobs).toHaveBeenCalled();
    expect(deps.pushToast).toHaveBeenCalledWith({
      tone: "info",
      title: "Compression started",
      detail: "myfile.zip",
    });
  });

  it("handleCompress handles file without extension", async () => {
    const { deps, coreOverride, entry } = buildDeps();
    entry.name = "README";

    const { result } = renderHook(() => useArchiveHandlers(deps, coreOverride));

    await act(async () => {
      await result.current.handleCompress("left");
    });

    expect(coreOverride.planOperation).toHaveBeenCalledWith(
      "createArchive",
      [entry.uri],
      expect.stringContaining("README.zip"),
    );
  });

  it("handleCompress handles errors", async () => {
    const { deps, coreOverride } = buildDeps();
    coreOverride.planOperation = vi.fn(async () => {
      throw new Error("disk full");
    });

    const { result } = renderHook(() => useArchiveHandlers(deps, coreOverride));

    await act(async () => {
      await result.current.handleCompress("left");
    });

    expect(deps.pushToast).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: "error",
        title: expect.stringContaining("Compress failed"),
      }),
    );
  });

  it("handleExtract shows error toast when no entry selected", async () => {
    const { deps, coreOverride } = buildDeps();
    deps.state.panels.left.tabs.main.selectedId = null;

    const { result } = renderHook(() => useArchiveHandlers(deps, coreOverride));

    await act(async () => {
      await result.current.handleExtract("left");
    });

    expect(deps.pushToast).toHaveBeenCalledWith({
      tone: "error",
      title: "Select an archive to extract",
    });
  });

  it("handleExtract shows error toast when a directory is selected", async () => {
    const { deps, coreOverride, entry } = buildDeps();
    entry.kind = "directory";

    const { result } = renderHook(() => useArchiveHandlers(deps, coreOverride));

    await act(async () => {
      await result.current.handleExtract("left");
    });

    expect(deps.pushToast).toHaveBeenCalledWith({
      tone: "error",
      title: "Select an archive to extract",
    });
  });

  it("handleExtract extracts a file archive successfully", async () => {
    const { deps, coreOverride, entry } = buildDeps();
    entry.name = "archive.tar.gz";
    entry.uri = "local:///home/user/archive.tar.gz";
    deps.state.panels.left.tabs.main.orderedEntryIds = [entry.uri];
    deps.state.panels.left.tabs.main.selectedId = entry.uri;
    deps.state.panels.left.tabs.main.entriesById[entry.uri] = entry;

    const { result } = renderHook(() => useArchiveHandlers(deps, coreOverride));

    await act(async () => {
      await result.current.handleExtract("left");
    });

    expect(coreOverride.planOperation).toHaveBeenCalledWith(
      "extractArchive",
      [entry.uri],
      expect.stringContaining("archive.tar"),
    );
    expect(deps.setJobs).toHaveBeenCalled();
    expect(deps.pushToast).toHaveBeenCalledWith({
      tone: "info",
      title: "Extraction started",
      detail: expect.any(String),
    });
  });

  it("handleExtract handles archive name without extension", async () => {
    const { deps, coreOverride, entry } = buildDeps();
    entry.name = "archive";
    entry.uri = "local:///home/user/archive";
    deps.state.panels.left.tabs.main.orderedEntryIds = [entry.uri];
    deps.state.panels.left.tabs.main.selectedId = entry.uri;
    deps.state.panels.left.tabs.main.entriesById[entry.uri] = entry;

    const { result } = renderHook(() => useArchiveHandlers(deps, coreOverride));

    await act(async () => {
      await result.current.handleExtract("left");
    });

    expect(coreOverride.planOperation).toHaveBeenCalledWith(
      "extractArchive",
      [entry.uri],
      expect.stringContaining("_extracted"),
    );
  });

  it("handleExtract handles errors", async () => {
    const { deps, coreOverride, entry } = buildDeps();
    entry.name = "broken.zip";
    coreOverride.planOperation = vi.fn(async () => {
      throw new Error("corrupt archive");
    });

    const { result } = renderHook(() => useArchiveHandlers(deps, coreOverride));

    await act(async () => {
      await result.current.handleExtract("left");
    });

    expect(deps.pushToast).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: "error",
        title: expect.stringContaining("Extract failed"),
      }),
    );
  });
});
