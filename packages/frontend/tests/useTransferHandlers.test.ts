import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTransferHandlers } from "../src/hooks/fileOps/useTransferHandlers";
import { createInitialState } from "../src/panelStore";
import type { FileEntryDto } from "@fileoctopus/ts-api";

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
  const entry = makeEntry();

  state.panels.left.tabs.main.selectedIds = [entry.uri];
  state.panels.left.tabs.main.entriesById[entry.uri] = entry;
  // Set right panel URI as destination
  state.panels.right.tabs.main.uri = "local:///home/user/dest";

  const startPlannedOperation = vi.fn(async () => true);
  const reviewCopyMoveDialog = vi.fn(async () => null);
  const selectedEntries = vi.fn(() => [entry]);

  return {
    setDialog,
    entry,
    state,
    deps: {
      client: {},
      state,
      dispatch: vi.fn(),
      setDialog,
      setJobs: vi.fn(),
      setOperationError: vi.fn(),
      pushToast: vi.fn(),
      setSearch: vi.fn(),
      preferences: null,
      refreshPanel: vi.fn(),
      refreshVisiblePanels: vi.fn(),
      refreshNavigation: vi.fn(async () => undefined),
      navigatePanel: vi.fn(async () => undefined),
      ...overrides,
    },
    coreOverride: {
      startPlannedOperation,
      reviewCopyMoveDialog,
      selectedEntries,
      planOperation: vi.fn(),
      startOperation: vi.fn(async () => true),
    },
  };
}

describe("useTransferHandlers", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("handleCopyOrMove opens a copy dialog for the left panel", () => {
    const { deps, coreOverride, entry } = buildDeps();
    coreOverride.selectedEntries = vi.fn(() => [entry]);

    const { result } = renderHook(() =>
      useTransferHandlers(deps, coreOverride),
    );

    act(() => {
      result.current.handleCopyOrMove("left", "copy");
    });

    expect(deps.setDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "copyMove",
        kind: "copy",
        panelId: "left",
        entries: [entry],
        destination: "local:///home/user/dest",
      }),
    );
  });

  it("handleCopyOrMove opens a move dialog", () => {
    const { deps, coreOverride, entry } = buildDeps();
    coreOverride.selectedEntries = vi.fn(() => [entry]);

    const { result } = renderHook(() =>
      useTransferHandlers(deps, coreOverride),
    );

    act(() => {
      result.current.handleCopyOrMove("left", "move");
    });

    expect(deps.setDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "move",
      }),
    );
  });

  it("handleCopyOrMove does nothing when no entries selected", () => {
    const { deps, coreOverride } = buildDeps();
    coreOverride.selectedEntries = vi.fn(() => []);

    const { result } = renderHook(() =>
      useTransferHandlers(deps, coreOverride),
    );

    act(() => {
      result.current.handleCopyOrMove("left", "copy");
    });

    expect(deps.setDialog).not.toHaveBeenCalled();
  });

  it("handleCopyOrMove resolves to right panel for left panelId", () => {
    const { deps, coreOverride, entry, state } = buildDeps();
    state.panels.right.tabs.main.uri = "local:///target/dir";
    coreOverride.selectedEntries = vi.fn(() => [entry]);

    const { result } = renderHook(() =>
      useTransferHandlers(deps, coreOverride),
    );

    act(() => {
      result.current.handleCopyOrMove("left", "copy");
    });

    expect(deps.setDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: "local:///target/dir",
      }),
    );
  });

  it("handleCopyOrMove resolves to left panel for right panelId", () => {
    const { deps, coreOverride, entry, state } = buildDeps();
    state.panels.left.tabs.main.uri = "local:///source/dir";
    coreOverride.selectedEntries = vi.fn(() => [entry]);

    const { result } = renderHook(() =>
      useTransferHandlers(deps, coreOverride),
    );

    act(() => {
      result.current.handleCopyOrMove("right", "copy");
    });

    expect(deps.setDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: "local:///source/dir",
      }),
    );
  });

  it("handleCopyOrMove uses advanced options from preferences", () => {
    const { deps, coreOverride, entry } = buildDeps({
      preferences: {
        showAdvancedCopyOptions: true,
        defaultConflictPolicy: "overwrite",
      },
    });
    coreOverride.selectedEntries = vi.fn(() => [entry]);

    const { result } = renderHook(() =>
      useTransferHandlers(deps, coreOverride),
    );

    act(() => {
      result.current.handleCopyOrMove("left", "copy");
    });

    expect(deps.setDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        advancedOptions: true,
        conflictPolicy: "overwrite",
      }),
    );
  });

  it("handleCopyOrMove defaults conflictPolicy to 'fail' without advanced options", () => {
    const { deps, coreOverride, entry } = buildDeps();
    coreOverride.selectedEntries = vi.fn(() => [entry]);

    const { result } = renderHook(() =>
      useTransferHandlers(deps, coreOverride),
    );

    act(() => {
      result.current.handleCopyOrMove("left", "copy");
    });

    expect(deps.setDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        conflictPolicy: "fail",
        advancedOptions: false,
      }),
    );
  });

  it("submitCopyMove shows error when destination is empty", async () => {
    const { deps, coreOverride } = buildDeps();

    const { result } = renderHook(() =>
      useTransferHandlers(deps, coreOverride),
    );

    const dialog = {
      type: "copyMove" as const,
      panelId: "left" as const,
      kind: "copy" as const,
      entries: [makeEntry()],
      destination: "  ",
      conflictPolicy: "fail" as const,
      advancedOptions: false,
      planningEnabled: false,
      plan: null,
      planning: false,
      step: "review" as const,
      error: null as string | null,
    };

    await act(async () => {
      await result.current.submitCopyMove(dialog);
    });

    expect(deps.setDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Enter a destination local URI.",
      }),
    );
  });

  it("submitCopyMove reviews and starts when plan is null", async () => {
    const { deps, coreOverride } = buildDeps();
    const plan = {
      operationId: "op-1",
      totalItems: 1,
      conflicts: [],
      warnings: [],
    };
    coreOverride.reviewCopyMoveDialog = vi.fn(async () => plan);
    coreOverride.startPlannedOperation = vi.fn(async () => true);

    const { result } = renderHook(() =>
      useTransferHandlers(deps, coreOverride),
    );

    const dialog = {
      type: "copyMove" as const,
      panelId: "left" as const,
      kind: "copy" as const,
      entries: [makeEntry()],
      destination: "local:///dest",
      conflictPolicy: "fail" as const,
      advancedOptions: false,
      planningEnabled: false,
      plan: null,
      planning: false,
      step: "review" as const,
      error: null as string | null,
    };

    await act(async () => {
      await result.current.submitCopyMove(dialog);
    });

    expect(coreOverride.reviewCopyMoveDialog).toHaveBeenCalledWith(dialog);
    expect(coreOverride.startPlannedOperation).toHaveBeenCalledWith(plan);
    expect(deps.setDialog).toHaveBeenCalledWith(null);
  });

  it("submitCopyMove returns early when plan review returns null and planningEnabled", async () => {
    const { deps, coreOverride } = buildDeps();
    coreOverride.reviewCopyMoveDialog = vi.fn(async () => null);

    const { result } = renderHook(() =>
      useTransferHandlers(deps, coreOverride),
    );

    const dialog = {
      type: "copyMove" as const,
      panelId: "left" as const,
      kind: "copy" as const,
      entries: [makeEntry()],
      destination: "local:///dest",
      conflictPolicy: "fail" as const,
      advancedOptions: false,
      planningEnabled: true,
      plan: null,
      planning: false,
      step: "review" as const,
      error: null as string | null,
    };

    await act(async () => {
      await result.current.submitCopyMove(dialog);
    });

    expect(coreOverride.startPlannedOperation).not.toHaveBeenCalled();
  });

  it("submitCopyMove shows confirm-overwrite step when confirmOverwrite is enabled and there are conflicts", async () => {
    const { deps, coreOverride } = buildDeps({
      preferences: { confirmOverwrite: true },
    });
    const plan = {
      operationId: "op-1",
      totalItems: 1,
      conflicts: [{ source: "a", destination: "b" }],
      warnings: [],
    };
    coreOverride.reviewCopyMoveDialog = vi.fn(async () => plan);

    const { result } = renderHook(() =>
      useTransferHandlers(deps, coreOverride),
    );

    const dialog = {
      type: "copyMove" as const,
      panelId: "left" as const,
      kind: "copy" as const,
      entries: [makeEntry()],
      destination: "local:///dest",
      conflictPolicy: "overwrite" as const,
      advancedOptions: false,
      planningEnabled: false,
      plan: null,
      planning: false,
      step: "review" as const,
      error: null as string | null,
    };

    await act(async () => {
      await result.current.submitCopyMove(dialog);
    });

    expect(deps.setDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        step: "confirm-overwrite",
      }),
    );
  });

  it("submitCopyMove uses existing plan directly", async () => {
    const { deps, coreOverride } = buildDeps();
    coreOverride.startPlannedOperation = vi.fn(async () => true);

    const { result } = renderHook(() =>
      useTransferHandlers(deps, coreOverride),
    );

    const plan = {
      operationId: "op-1",
      totalItems: 1,
      conflicts: [],
      warnings: [],
    };

    const dialog = {
      type: "copyMove" as const,
      panelId: "left" as const,
      kind: "copy" as const,
      entries: [makeEntry()],
      destination: "local:///dest",
      conflictPolicy: "fail" as const,
      advancedOptions: false,
      planningEnabled: false,
      plan,
      planning: false,
      step: "review" as const,
      error: null as string | null,
    };

    await act(async () => {
      await result.current.submitCopyMove(dialog);
    });

    expect(coreOverride.startPlannedOperation).toHaveBeenCalledWith(plan);
    expect(deps.setDialog).toHaveBeenCalledWith(null);
  });
});
