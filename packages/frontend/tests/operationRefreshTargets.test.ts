import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FileOperationPlanDto } from "@fileoctopus/ts-api";
import { createInitialState } from "../src/panelStore";
import { useOperationRefreshTargets } from "../src/hooks/useOperationRefreshTargets";

afterEach(cleanup);

function plan(overrides: Partial<FileOperationPlanDto>): FileOperationPlanDto {
  return {
    operationId: "operation-1",
    kind: "copy",
    sources: ["local:///source/file.txt"],
    destination: "local:///target/file.txt",
    newName: null,
    conflictPolicy: "fail",
    items: [],
    conflicts: [],
    warnings: [],
    totalItems: 1,
    totalBytes: 10,
    ...overrides,
  };
}

describe("useOperationRefreshTargets", () => {
  it("tracks move operation source and destination parents until consumed", () => {
    const params = {
      state: createInitialState("local:///left", "local:///right"),
      refreshPanel: vi.fn(),
      refreshVisiblePanels: vi.fn(),
    };
    const { result } = renderHook(() => useOperationRefreshTargets(params));

    act(() => {
      result.current.registerOperationRefresh(
        "job-1",
        plan({
          kind: "move",
          sources: ["local:///source/a.txt"],
          destination: "local:///target/a.txt",
        }),
      );
    });

    expect(result.current.takeOperationRefreshTargets("job-1")).toEqual({
      folderUris: ["local:///source", "local:///target"],
      removedEntryUris: [],
    });
    expect(result.current.takeOperationRefreshTargets("job-1")).toBeNull();
  });

  it("tracks deleted entries and their parent folders", () => {
    const params = {
      state: createInitialState("local:///left", "local:///right"),
      refreshPanel: vi.fn(),
      refreshVisiblePanels: vi.fn(),
    };
    const { result } = renderHook(() => useOperationRefreshTargets(params));

    act(() => {
      result.current.registerOperationRefresh(
        "job-2",
        plan({
          kind: "deletePermanently",
          sources: ["local:///source/a.txt", "local:///source/nested/b.txt"],
          destination: null,
        }),
      );
    });

    expect(result.current.takeOperationRefreshTargets("job-2")).toEqual({
      folderUris: ["local:///source", "local:///source/nested"],
      removedEntryUris: [
        "local:///source/a.txt",
        "local:///source/nested/b.txt",
      ],
    });
  });

  it("refreshes matching visible panels and falls back to visible panel refresh", () => {
    const params = {
      state: createInitialState("local:///left", "local:///right"),
      refreshPanel: vi.fn(),
      refreshVisiblePanels: vi.fn(),
    };
    const { result } = renderHook(() => useOperationRefreshTargets(params));

    act(() => {
      result.current.refreshOperationTargets(["local:///left"], {
        fullReload: true,
      });
    });

    expect(params.refreshPanel).toHaveBeenCalledWith("left", {
      replace: true,
      softRefresh: false,
      backgroundRefresh: false,
    });
    expect(params.refreshVisiblePanels).not.toHaveBeenCalled();

    act(() => {
      result.current.refreshOperationTargets(["local:///elsewhere"]);
    });

    expect(params.refreshVisiblePanels).toHaveBeenCalledWith({
      replace: true,
      softRefresh: true,
      backgroundRefresh: true,
    });
  });
});
