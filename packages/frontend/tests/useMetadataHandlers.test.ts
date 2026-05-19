import { describe, expect, it, vi } from "vitest";
import type { FileEntryDto } from "@fileoctopus/ts-api";
import { renderHook, act } from "@testing-library/react";
import { createInitialState } from "../src/panelStore";
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
    },
  };

  return {
    setDialog,
    entries,
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
});
