import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMutationHandlers } from "../src/hooks/fileOps/useMutationHandlers";
import { createInitialState } from "../src/panelStore";
import type { FileEntryDto } from "@fileoctopus/ts-api";

vi.mock("@fileoctopus/ts-api", () => ({
  isRemoteUri: (uri: string) => uri.startsWith("sftp://"),
  normalizeIpcError: (err: unknown) => ({
    code: "UNKNOWN",
    message: err instanceof Error ? err.message : String(err),
  }),
  IPC_ERROR_CODES: {
    INVALID_URI: "invalid_uri",
    UNSUPPORTED_PROVIDER: "unsupported_provider",
    DUPLICATE_PROVIDER: "duplicate_provider",
    PERMISSION_DENIED: "permission_denied",
    NOT_FOUND: "not_found",
    DESTINATION_CONFLICT: "destination_conflict",
    INVALID_NAME: "invalid_name",
    CANCELLED: "cancelled",
    UNKNOWN: "unknown",
    UNSUPPORTED_TRANSPORT: "unsupported_transport",
    ALREADY_EXISTS: "already_exists",
    IS_DIRECTORY: "is_directory",
    NOT_DIRECTORY: "not_directory",
    NOT_EMPTY: "not_empty",
    READ_ONLY: "read_only",
    OUT_OF_SPACE: "out_of_space",
    INTERRUPTED: "interrupted",
  },
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
  const setDialog = vi.fn();
  const setJobs = vi.fn();
  const setOperationError = vi.fn();
  const refreshVisiblePanels = vi.fn();
  const refreshNavigation = vi.fn(async () => undefined);
  const startOperation = vi.fn(async () => true);
  const startPlannedOperation = vi.fn(async () => true);
  const planOperation = vi.fn();
  const selectedEntries = vi.fn(() => []);

  const state = createInitialState();
  const entry = makeEntry();

  state.panels.left.tabs.main.selectedIds = [entry.uri];
  state.panels.left.tabs.main.entriesById[entry.uri] = entry;

  const client = {
    fileOperations: {
      startFileOperation: vi.fn(async () => ({
        job: { jobId: "job-1" },
      })),
    },
    navigation: {
      toggleStarred: vi.fn(async () => {}),
    },
  };

  return {
    setDialog,
    setJobs,
    setOperationError,
    refreshVisiblePanels,
    refreshNavigation,
    startOperation,
    entry,
    state,
    deps: {
      client,
      state,
      dispatch: vi.fn(),
      setDialog,
      setJobs,
      setOperationError,
      pushToast: vi.fn(),
      setSearch: vi.fn(),
      preferences: null,
      refreshPanel: vi.fn(),
      refreshVisiblePanels,
      refreshNavigation,
      navigatePanel: vi.fn(async () => undefined),
      ...overrides,
    },
    coreOverride: {
      planOperation,
      startOperation,
      startPlannedOperation,
      selectedEntries,
    },
  };
}

describe("useMutationHandlers", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("handleCreateFolder sets a createFolder dialog", () => {
    const { deps, coreOverride } = buildDeps();
    const { result } = renderHook(() =>
      useMutationHandlers(deps, coreOverride),
    );

    act(() => {
      result.current.handleCreateFolder("left");
    });

    expect(deps.setDialog).toHaveBeenCalledWith({
      type: "createFolder",
      panelId: "left",
      name: "New Folder",
      error: null,
    });
  });

  it("handleCreateFile sets a createFile dialog", () => {
    const { deps, coreOverride } = buildDeps();
    const { result } = renderHook(() =>
      useMutationHandlers(deps, coreOverride),
    );

    act(() => {
      result.current.handleCreateFile("left");
    });

    expect(deps.setDialog).toHaveBeenCalledWith({
      type: "createFile",
      panelId: "left",
      name: "New File.txt",
      error: null,
    });
  });

  it("handleRename sets a rename dialog for the selected entry", () => {
    const { deps, coreOverride, entry } = buildDeps();
    coreOverride.selectedEntries = vi.fn(() => [entry]);

    const { result } = renderHook(() =>
      useMutationHandlers(deps, coreOverride),
    );

    act(() => {
      result.current.handleRename("left");
    });

    expect(deps.setDialog).toHaveBeenCalledWith({
      type: "rename",
      panelId: "left",
      entry,
      name: entry.name,
      error: null,
    });
  });

  it("handleRename does nothing when no entries selected", () => {
    const { deps, coreOverride } = buildDeps();
    coreOverride.selectedEntries = vi.fn(() => []);

    const { result } = renderHook(() =>
      useMutationHandlers(deps, coreOverride),
    );

    act(() => {
      result.current.handleRename("left");
    });

    expect(deps.setDialog).not.toHaveBeenCalled();
  });

  it("handleRename does nothing when multiple entries selected", () => {
    const { deps, coreOverride, entry } = buildDeps();
    coreOverride.selectedEntries = vi.fn(() => [entry, entry]);

    const { result } = renderHook(() =>
      useMutationHandlers(deps, coreOverride),
    );

    act(() => {
      result.current.handleRename("left");
    });

    expect(deps.setDialog).not.toHaveBeenCalled();
  });

  it("handleTrash sets a trash dialog for selected entries", () => {
    const { deps, coreOverride, entry } = buildDeps();
    coreOverride.selectedEntries = vi.fn(() => [entry]);

    const { result } = renderHook(() =>
      useMutationHandlers(deps, coreOverride),
    );

    act(() => {
      result.current.handleTrash("left");
    });

    expect(deps.setDialog).toHaveBeenCalledWith({
      type: "trash",
      panelId: "left",
      entries: [entry],
      dontAskAgain: false,
      error: null,
    });
  });

  it("handleTrash skips dialog when skip-trash is set in sessionStorage", () => {
    const { deps, coreOverride, entry } = buildDeps();
    coreOverride.selectedEntries = vi.fn(() => [entry]);
    coreOverride.startOperation = vi.fn(async () => true);

    const originalGetItem = sessionStorage.getItem.bind(sessionStorage);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation((key) => {
      if (key === "fileoctopus.skipTrashConfirm") return "true";
      return originalGetItem(key);
    });

    const { result } = renderHook(() =>
      useMutationHandlers(deps, coreOverride),
    );

    act(() => {
      result.current.handleTrash("left");
    });

    // Should have started the operation directly instead of showing dialog
    expect(coreOverride.startOperation).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("handleTrash does nothing when no entries selected", () => {
    const { deps, coreOverride } = buildDeps();
    coreOverride.selectedEntries = vi.fn(() => []);

    const { result } = renderHook(() =>
      useMutationHandlers(deps, coreOverride),
    );

    act(() => {
      result.current.handleTrash("left");
    });

    expect(deps.setDialog).not.toHaveBeenCalled();
  });

  it("handlePermanentDelete sets a permanentDelete dialog", () => {
    const { deps, coreOverride, entry } = buildDeps();
    coreOverride.selectedEntries = vi.fn(() => [entry]);

    const { result } = renderHook(() =>
      useMutationHandlers(deps, coreOverride),
    );

    act(() => {
      result.current.handlePermanentDelete("left");
    });

    expect(deps.setDialog).toHaveBeenCalledWith({
      type: "permanentDelete",
      panelId: "left",
      entries: [entry],
      error: null,
    });
  });

  it("handleTrash skips dialog and executes when confirmDelete is false", () => {
    const { deps, coreOverride, entry } = buildDeps({
      preferences: { confirmDelete: false },
    });
    coreOverride.selectedEntries = vi.fn(() => [entry]);
    coreOverride.startOperation = vi.fn(async () => true);

    const { result } = renderHook(() =>
      useMutationHandlers(deps, coreOverride),
    );

    act(() => {
      result.current.handleTrash("left");
    });

    expect(coreOverride.startOperation).toHaveBeenCalled();
    expect(deps.setDialog).not.toHaveBeenCalled();
  });

  it("handlePermanentDelete skips dialog and executes when confirmPermanentDelete is false", () => {
    const { deps, coreOverride, entry } = buildDeps({
      preferences: { confirmPermanentDelete: false },
    });
    coreOverride.selectedEntries = vi.fn(() => [entry]);
    coreOverride.startOperation = vi.fn(async () => true);

    const { result } = renderHook(() =>
      useMutationHandlers(deps, coreOverride),
    );

    act(() => {
      result.current.handlePermanentDelete("left");
    });

    expect(coreOverride.startOperation).toHaveBeenCalledWith(
      "deletePermanently",
      [entry.uri],
    );
    expect(deps.setDialog).not.toHaveBeenCalled();
  });

  it("handleDelete opens permanentDelete dialog when useTrashByDefault is false", () => {
    const { deps, coreOverride, entry } = buildDeps({
      preferences: { useTrashByDefault: false },
    });
    coreOverride.selectedEntries = vi.fn(() => [entry]);

    const { result } = renderHook(() =>
      useMutationHandlers(deps, coreOverride),
    );

    act(() => {
      result.current.handleDelete("left");
    });

    expect(deps.setDialog).toHaveBeenCalledWith({
      type: "permanentDelete",
      panelId: "left",
      entries: [entry],
      error: null,
    });
  });

  it("handleDelete opens permanentDelete dialog when preferences are missing", () => {
    const { deps, coreOverride, entry } = buildDeps();
    coreOverride.selectedEntries = vi.fn(() => [entry]);

    const { result } = renderHook(() =>
      useMutationHandlers(deps, coreOverride),
    );

    act(() => {
      result.current.handleDelete("left");
    });

    expect(deps.setDialog).toHaveBeenCalledWith({
      type: "permanentDelete",
      panelId: "left",
      entries: [entry],
      error: null,
    });
  });

  it("handleDelete opens trash dialog when useTrashByDefault is true", () => {
    const { deps, coreOverride, entry } = buildDeps({
      preferences: { useTrashByDefault: true },
    });
    coreOverride.selectedEntries = vi.fn(() => [entry]);

    const { result } = renderHook(() =>
      useMutationHandlers(deps, coreOverride),
    );

    act(() => {
      result.current.handleDelete("left");
    });

    expect(deps.setDialog).toHaveBeenCalledWith({
      type: "trash",
      panelId: "left",
      entries: [entry],
      dontAskAgain: false,
      error: null,
    });
  });

  it("submitCreateFolder validates name and clears dialog on success", async () => {
    const { deps, coreOverride } = buildDeps();
    const plan = {
      operationId: "op-1",
      totalItems: 1,
      conflicts: [],
      warnings: [],
    };
    coreOverride.planOperation = vi.fn(async () => ({ plan }));
    coreOverride.startPlannedOperation = vi.fn(async () => true);

    const { result } = renderHook(() =>
      useMutationHandlers(deps, coreOverride),
    );

    const dialog = {
      type: "createFolder" as const,
      panelId: "left" as const,
      name: "MyFolder",
      error: null as string | null,
    };

    await act(async () => {
      await result.current.submitCreateFolder(dialog);
    });

    expect(coreOverride.planOperation).toHaveBeenCalledWith(
      "createDirectory",
      [],
      "local:///MyFolder",
    );
    expect(coreOverride.startPlannedOperation).toHaveBeenCalledWith(plan);
    expect(deps.setDialog).toHaveBeenCalledWith(null);
    expect(deps.refreshVisiblePanels).not.toHaveBeenCalled();
  });

  it("submitCreateFolder shows error for invalid name", async () => {
    const { deps, coreOverride } = buildDeps();

    const { result } = renderHook(() =>
      useMutationHandlers(deps, coreOverride),
    );

    const dialog = {
      type: "createFolder" as const,
      panelId: "left" as const,
      name: "bad/name",
      error: null as string | null,
    };

    await act(async () => {
      await result.current.submitCreateFolder(dialog);
    });

    expect(deps.setDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Enter a folder name without path separators.",
      }),
    );
  });

  it("submitRename validates name and clears dialog on success", async () => {
    const { deps, coreOverride, entry } = buildDeps();
    coreOverride.startOperation = vi.fn(async () => true);

    const { result } = renderHook(() =>
      useMutationHandlers(deps, coreOverride),
    );

    const dialog = {
      type: "rename" as const,
      panelId: "left" as const,
      entry,
      name: "renamed.txt",
      error: null as string | null,
    };

    await act(async () => {
      await result.current.submitRename(dialog);
    });

    expect(coreOverride.startOperation).toHaveBeenCalledWith(
      "rename",
      [entry.uri],
      undefined,
      "renamed.txt",
    );
    expect(deps.dispatch).toHaveBeenCalledWith({
      type: "renameEntry",
      oldUri: entry.uri,
      newUri: "local:///renamed.txt",
      name: "renamed.txt",
    });
    expect(deps.setDialog).toHaveBeenCalledWith(null);
    expect(deps.refreshVisiblePanels).not.toHaveBeenCalled();
  });

  it("submitRename shows error for invalid name", async () => {
    const { deps, coreOverride, entry } = buildDeps();

    const { result } = renderHook(() =>
      useMutationHandlers(deps, coreOverride),
    );

    const dialog = {
      type: "rename" as const,
      panelId: "left" as const,
      entry,
      name: "bad\\name",
      error: null as string | null,
    };

    await act(async () => {
      await result.current.submitRename(dialog);
    });

    expect(deps.setDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Enter a name without path separators.",
      }),
    );
  });

  it("submitTrash executes trash and clears dialog", async () => {
    const { deps, coreOverride, entry } = buildDeps();
    coreOverride.startOperation = vi.fn(async () => true);

    const { result } = renderHook(() =>
      useMutationHandlers(deps, coreOverride),
    );

    const dialog = {
      type: "trash" as const,
      panelId: "left" as const,
      entries: [entry],
      dontAskAgain: false,
      error: null as string | null,
    };

    await act(async () => {
      await result.current.submitTrash(dialog);
    });

    expect(coreOverride.startOperation).toHaveBeenCalled();
    expect(deps.setDialog).toHaveBeenCalledWith(null);
  });

  it("submitTrash sets skip-trash when dontAskAgain is true", async () => {
    const { deps, coreOverride, entry } = buildDeps();
    coreOverride.startOperation = vi.fn(async () => true);

    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    const { result } = renderHook(() =>
      useMutationHandlers(deps, coreOverride),
    );

    const dialog = {
      type: "trash" as const,
      panelId: "left" as const,
      entries: [entry],
      dontAskAgain: true,
      error: null as string | null,
    };

    await act(async () => {
      await result.current.submitTrash(dialog);
    });

    expect(setItemSpy).toHaveBeenCalledWith(
      "fileoctopus.skipTrashConfirm",
      "true",
    );
    setItemSpy.mockRestore();
  });

  it("submitCreateFile handles errors", async () => {
    const { deps, coreOverride } = buildDeps();
    coreOverride.planOperation = vi.fn(async () => {
      throw new Error("disk full");
    });

    const { result } = renderHook(() =>
      useMutationHandlers(deps, coreOverride),
    );

    const dialog = {
      type: "createFile" as const,
      panelId: "left" as const,
      name: "newfile.txt",
      error: null as string | null,
    };

    await act(async () => {
      await result.current.submitCreateFile(dialog);
    });

    expect(deps.setDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(String),
      }),
    );
  });

  it("submitPermanentDelete handles errors", async () => {
    const { deps, coreOverride, entry } = buildDeps();
    coreOverride.planOperation = vi.fn(async () => {
      throw new Error("permission denied");
    });

    const { result } = renderHook(() =>
      useMutationHandlers(deps, coreOverride),
    );

    const dialog = {
      type: "permanentDelete" as const,
      panelId: "left" as const,
      entries: [entry],
      error: null as string | null,
    };

    await act(async () => {
      await result.current.submitPermanentDelete(dialog);
    });

    expect(deps.setDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(String),
      }),
    );
  });

  it("toggleStarredForEntry calls client and refreshes navigation", async () => {
    const { deps, coreOverride, entry } = buildDeps();

    const { result } = renderHook(() =>
      useMutationHandlers(deps, coreOverride),
    );

    await act(async () => {
      await result.current.toggleStarredForEntry(entry);
    });

    expect(deps.client.navigation.toggleStarred).toHaveBeenCalledWith({
      uri: entry.uri,
      label: entry.name,
    });
    expect(deps.refreshNavigation).toHaveBeenCalled();
  });

  it("toggleStarredForEntry sets operation error on failure", async () => {
    const { deps, coreOverride, entry } = buildDeps();
    deps.client.navigation.toggleStarred = vi.fn(async () => {
      throw new Error("network error");
    });

    const { result } = renderHook(() =>
      useMutationHandlers(deps, coreOverride),
    );

    await act(async () => {
      await result.current.toggleStarredForEntry(entry);
    });

    expect(deps.setOperationError).toHaveBeenCalledWith(expect.any(String));
  });

  it("submitInlineRename validates and starts rename", async () => {
    const { deps, coreOverride, entry } = buildDeps();
    coreOverride.startOperation = vi.fn(async () => true);

    const { result } = renderHook(() =>
      useMutationHandlers(deps, coreOverride),
    );

    await act(async () => {
      await result.current.submitInlineRename("left", entry, "renamed.txt");
    });

    expect(coreOverride.startOperation).toHaveBeenCalledWith(
      "rename",
      [entry.uri],
      undefined,
      "renamed.txt",
    );
    expect(deps.dispatch).toHaveBeenCalledWith({
      type: "renameEntry",
      oldUri: entry.uri,
      newUri: "local:///renamed.txt",
      name: "renamed.txt",
    });
    expect(deps.refreshVisiblePanels).not.toHaveBeenCalled();
  });

  it("submitInlineRename skips when name unchanged", async () => {
    const { deps, coreOverride, entry } = buildDeps();
    coreOverride.startOperation = vi.fn(async () => true);

    const { result } = renderHook(() =>
      useMutationHandlers(deps, coreOverride),
    );

    await act(async () => {
      await result.current.submitInlineRename("left", entry, entry.name);
    });

    expect(coreOverride.startOperation).not.toHaveBeenCalled();
  });

  it("submitInlineRename shows error for invalid name", async () => {
    const { deps, coreOverride, entry } = buildDeps();

    const { result } = renderHook(() =>
      useMutationHandlers(deps, coreOverride),
    );

    await act(async () => {
      await result.current.submitInlineRename("left", entry, "bad/name");
    });

    expect(deps.setDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "rename",
        error: "Enter a name without path separators.",
      }),
    );
  });
});
