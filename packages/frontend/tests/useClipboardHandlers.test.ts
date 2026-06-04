import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useClipboardHandlers } from "../src/hooks/fileOps/useClipboardHandlers";
import { createInitialState } from "../src/panelStore";
import type { FileEntryDto } from "@fileoctopus/ts-api";

vi.mock("../../src/utils/paneUtils", () => ({
  localPathFromUri: (uri: string) => uri.replace("local://", "/"),
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
  const state = createInitialState();
  const entry1 = makeEntry({ uri: "local:///home/user/a.txt", name: "a.txt" });
  const entry2 = makeEntry({ uri: "local:///home/user/b.txt", name: "b.txt" });

  state.panels.left.tabs.main.selectedIds = [entry1.uri, entry2.uri];
  state.panels.left.tabs.main.entriesById[entry1.uri] = entry1;
  state.panels.left.tabs.main.entriesById[entry2.uri] = entry2;

  const setClipboard = vi.fn();
  const selectedEntries = vi.fn(() => [entry1, entry2]);
  const startOperation = vi.fn(async () => true);

  return {
    entry1,
    entry2,
    state,
    deps: {
      client: {},
      state,
      dispatch: vi.fn(),
      setDialog: vi.fn(),
      setJobs: vi.fn(),
      setOperationError: vi.fn(),
      pushToast: vi.fn(),
      setSearch: vi.fn(),
      preferences: null,
      refreshPanel: vi.fn(),
      refreshVisiblePanels: vi.fn(),
      refreshNavigation: vi.fn(async () => undefined),
      navigatePanel: vi.fn(async () => undefined),
      setClipboard,
      clipboard: null,
      ...overrides,
    },
    coreOverride: {
      selectedEntries,
      startOperation,
      planOperation: vi.fn(),
      startPlannedOperation: vi.fn(async () => true),
      reviewCopyMoveDialog: vi.fn(),
    },
  };
}

describe("useClipboardHandlers", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("copySelectionToFileClipboard sets clipboard with kind=copy", () => {
    const { deps, coreOverride } = buildDeps();

    const { result } = renderHook(() =>
      useClipboardHandlers(deps, coreOverride),
    );

    act(() => {
      result.current.copySelectionToFileClipboard("left", "copy");
    });

    expect(deps.setClipboard).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "copy",
        uris: ["local:///home/user/a.txt", "local:///home/user/b.txt"],
        entries: expect.arrayContaining([
          expect.objectContaining({ name: "a.txt" }),
          expect.objectContaining({ name: "b.txt" }),
        ]),
        providerId: "local",
      }),
    );
  });

  it("copySelectionToFileClipboard sets clipboard with kind=move", () => {
    const { deps, coreOverride } = buildDeps();

    const { result } = renderHook(() =>
      useClipboardHandlers(deps, coreOverride),
    );

    act(() => {
      result.current.copySelectionToFileClipboard("left", "move");
    });

    expect(deps.setClipboard).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "move",
      }),
    );
  });

  it("copySelectionToFileClipboard does nothing when no entries selected", () => {
    const { deps, coreOverride } = buildDeps();
    coreOverride.selectedEntries = vi.fn(() => []);

    const { result } = renderHook(() =>
      useClipboardHandlers(deps, coreOverride),
    );

    act(() => {
      result.current.copySelectionToFileClipboard("left", "copy");
    });

    expect(deps.setClipboard).not.toHaveBeenCalled();
  });

  it("pasteClipboard does nothing when clipboard is null", async () => {
    const { deps, coreOverride } = buildDeps({ clipboard: null });

    const { result } = renderHook(() =>
      useClipboardHandlers(deps, coreOverride),
    );

    await act(async () => {
      await result.current.pasteClipboard("left");
    });

    expect(coreOverride.startOperation).not.toHaveBeenCalled();
  });

  it("pasteClipboard plans and starts a copy operation without conflicts", async () => {
    const plan = {
      operationId: "op-1",
      totalItems: 1,
      conflicts: [],
      warnings: [],
    };
    const { deps, coreOverride } = buildDeps({
      clipboard: {
        kind: "copy",
        uris: ["local:///home/user/a.txt"],
        entries: [makeEntry({ uri: "local:///home/user/a.txt" })],
        providerId: "local",
        timestamp: Date.now(),
      },
    });
    coreOverride.planOperation = vi.fn(async () => ({ plan }));

    const { result } = renderHook(() =>
      useClipboardHandlers(deps, coreOverride),
    );

    await act(async () => {
      await result.current.pasteClipboard("left");
    });

    expect(coreOverride.planOperation).toHaveBeenCalledWith(
      "copy",
      ["local:///home/user/a.txt"],
      expect.any(String),
      undefined,
      "renameNew",
    );
    expect(coreOverride.startPlannedOperation).toHaveBeenCalledWith(plan);
    expect(deps.setClipboard).not.toHaveBeenCalled();
  });

  it("pasteClipboard opens conflict resolution when planning finds conflicts", async () => {
    const clipboardEntry = makeEntry({
      uri: "local:///home/user/a.txt",
      name: "a.txt",
    });
    const plan = {
      operationId: "op-1",
      totalItems: 1,
      conflicts: [
        {
          source: "local:///home/user/a.txt",
          destination: "local:///home/user/dest/a.txt",
        },
      ],
      warnings: [],
    };
    const { deps, coreOverride } = buildDeps({
      clipboard: {
        kind: "copy",
        uris: ["local:///home/user/a.txt"],
        entries: [clipboardEntry],
        providerId: "local",
        timestamp: Date.now(),
      },
    });
    coreOverride.planOperation = vi.fn(async () => ({ plan }));

    const { result } = renderHook(() =>
      useClipboardHandlers(deps, coreOverride),
    );

    await act(async () => {
      await result.current.pasteClipboard("left");
    });

    expect(coreOverride.startPlannedOperation).not.toHaveBeenCalled();
    expect(deps.setDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "copyMove",
        entries: [clipboardEntry],
        plan,
        step: "confirm-overwrite",
      }),
    );
  });

  it("pasteClipboard clears clipboard after a move operation", async () => {
    const plan = {
      operationId: "op-1",
      totalItems: 1,
      conflicts: [],
      warnings: [],
    };
    const { deps, coreOverride } = buildDeps({
      clipboard: {
        kind: "move",
        uris: ["local:///home/user/a.txt"],
        entries: [makeEntry({ uri: "local:///home/user/a.txt" })],
        providerId: "local",
        timestamp: Date.now(),
      },
    });
    coreOverride.planOperation = vi.fn(async () => ({ plan }));

    const { result } = renderHook(() =>
      useClipboardHandlers(deps, coreOverride),
    );

    await act(async () => {
      await result.current.pasteClipboard("left");
    });

    expect(deps.setClipboard).toHaveBeenCalledWith(null);
  });

  it("copyTextFromSelection copies URIs in 'uri' mode", async () => {
    const { deps, coreOverride } = buildDeps();
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });

    const { result } = renderHook(() =>
      useClipboardHandlers(deps, coreOverride),
    );

    await act(async () => {
      await result.current.copyTextFromSelection("left", "uri");
    });

    expect(writeText).toHaveBeenCalledWith(
      "local:///home/user/a.txt\nlocal:///home/user/b.txt",
    );
  });

  it("copyTextFromSelection copies names in 'name' mode", async () => {
    const { deps, coreOverride } = buildDeps();
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });

    const { result } = renderHook(() =>
      useClipboardHandlers(deps, coreOverride),
    );

    await act(async () => {
      await result.current.copyTextFromSelection("left", "name");
    });

    expect(writeText).toHaveBeenCalledWith("a.txt\nb.txt");
  });

  it("copyTextFromSelection does nothing when no entries selected", async () => {
    const { deps, coreOverride } = buildDeps();
    coreOverride.selectedEntries = vi.fn(() => []);
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });

    const { result } = renderHook(() =>
      useClipboardHandlers(deps, coreOverride),
    );

    await act(async () => {
      await result.current.copyTextFromSelection("left", "uri");
    });

    expect(writeText).not.toHaveBeenCalled();
  });
});
