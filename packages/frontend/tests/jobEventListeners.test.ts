import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  JobCompletedEvent,
  JobFailedEvent,
  JobProgressEvent,
  JobStartedEvent,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";
import { useRef } from "react";
import { useJobEventListeners } from "../src/hooks/useJobEventListeners";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const preferences = {
  jobDrawerBehavior: "openOnError",
  activityPanelVisible: false,
} as UserPreferencesDto;

function createClient() {
  const unlisteners = Array.from({ length: 7 }, () => vi.fn());
  const handlers: {
    started?: (event: JobStartedEvent) => void;
    progress?: (event: JobProgressEvent) => void;
    completed?: (event: JobCompletedEvent) => void;
    failed?: (event: JobFailedEvent) => void;
    cancelled?: (event: never) => void;
    paused?: (event: never) => void;
    resumed?: (event: never) => void;
  } = {};
  const client = {
    fileOperations: {
      onJobStarted: vi.fn(async (handler) => {
        handlers.started = handler;
        return unlisteners[0];
      }),
      onJobProgress: vi.fn(async (handler) => {
        handlers.progress = handler;
        return unlisteners[1];
      }),
      onJobCompleted: vi.fn(async (handler) => {
        handlers.completed = handler;
        return unlisteners[2];
      }),
      onJobFailed: vi.fn(async (handler) => {
        handlers.failed = handler;
        return unlisteners[3];
      }),
      onJobCancelled: vi.fn(async (handler) => {
        handlers.cancelled = handler;
        return unlisteners[4];
      }),
      onJobPaused: vi.fn(async (handler) => {
        handlers.paused = handler;
        return unlisteners[5];
      }),
      onJobResumed: vi.fn(async (handler) => {
        handlers.resumed = handler;
        return unlisteners[6];
      }),
    },
  };

  return { client, handlers, unlisteners };
}

function renderJobListeners(overrides = {}) {
  const { client, handlers, unlisteners } = createClient();
  const setJobs = vi.fn();
  const setJobMetrics = vi.fn();
  const setActivityCollapsed = vi.fn();
  const updatePreference = vi.fn(async () => undefined);
  const pushToast = vi.fn();
  const takeOperationRefreshTargets = vi.fn(() => ({
    folderUris: ["local:///target"],
    removedEntryUris: ["local:///target/old.txt"],
  }));
  const dispatch = vi.fn();
  const refreshOperationTargets = vi.fn();
  const refreshHistory = vi.fn(async () => undefined);
  const setOperationError = vi.fn();
  const setSearch = vi.fn();
  const setDialog = vi.fn();

  const result = renderHook(() => {
    const preferencesRef = useRef<UserPreferencesDto | null>(preferences);
    useJobEventListeners({
      client: client as never,
      preferencesRef,
      setJobs,
      setJobMetrics,
      setActivityCollapsed,
      updatePreference,
      pushToast,
      takeOperationRefreshTargets,
      dispatch,
      refreshOperationTargets,
      refreshHistory,
      setOperationError,
      setSearch,
      setDialog,
      ...overrides,
    });
  });

  return {
    ...result,
    client,
    handlers,
    unlisteners,
    setJobs,
    setJobMetrics,
    setActivityCollapsed,
    updatePreference,
    pushToast,
    takeOperationRefreshTargets,
    dispatch,
    refreshOperationTargets,
    refreshHistory,
    setOperationError,
    setSearch,
    setDialog,
  };
}

describe("useJobEventListeners", () => {
  it("registers all job event listeners and cleans them up", async () => {
    const { client, unlisteners, unmount } = renderJobListeners();

    await waitFor(() =>
      expect(client.fileOperations.onJobResumed).toHaveBeenCalled(),
    );
    unmount();

    for (const unlisten of unlisteners) {
      expect(unlisten).toHaveBeenCalled();
    }
  });

  it("updates job progress and derives speed and eta metrics", async () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(1_000).mockReturnValueOnce(2_000);
    const { handlers, setJobs, setJobMetrics } = renderJobListeners();

    await waitFor(() => expect(handlers.progress).toBeDefined());
    handlers.progress?.({
      jobId: "job-1",
      operationKind: "copy",
      currentItem: "alpha.txt",
      completedItems: 1,
      totalItems: 4,
      completedBytes: 100,
      totalBytes: 400,
      updatedAt: "2026-06-06T00:00:00Z",
    });
    handlers.progress?.({
      jobId: "job-1",
      operationKind: "copy",
      currentItem: "beta.txt",
      completedItems: 2,
      totalItems: 4,
      completedBytes: 200,
      totalBytes: 400,
      updatedAt: "2026-06-06T00:00:01Z",
    });

    const progressUpdater = setJobs.mock.calls.at(-1)?.[0];
    expect(progressUpdater({})["job-1"].completedBytes).toBe(200);

    const firstMetricUpdater = setJobMetrics.mock.calls[0][0];
    const firstMetrics = firstMetricUpdater({});
    const secondMetricUpdater = setJobMetrics.mock.calls[1][0];
    expect(secondMetricUpdater(firstMetrics)["job-1"]).toMatchObject({
      speedLabel: "100 B/s",
      etaLabel: "00:02 left",
      lastBytes: 200,
      lastAt: 2000,
    });
  });

  it("handles completed jobs with toast, refresh, removal, and history updates", async () => {
    const {
      handlers,
      pushToast,
      dispatch,
      refreshOperationTargets,
      refreshHistory,
    } = renderJobListeners();

    await waitFor(() => expect(handlers.completed).toBeDefined());
    handlers.completed?.({
      jobId: "job-2",
      operationKind: "deletePermanently",
      completedItems: 1,
      completedBytes: 1,
      completedAt: "2026-06-06T00:00:00Z",
    });

    expect(pushToast).toHaveBeenCalledWith({
      tone: "success",
      title: "Operation completed",
      detail: "deletePermanently",
      popup: false,
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "removeEntries",
      uris: ["local:///target/old.txt"],
    });
    expect(refreshOperationTargets).toHaveBeenCalledWith(["local:///target"], {
      fullReload: true,
    });
    expect(refreshHistory).toHaveBeenCalled();
  });

  it("opens the activity panel and records failures when error policy requests it", async () => {
    const {
      handlers,
      setActivityCollapsed,
      updatePreference,
      setOperationError,
      pushToast,
      setSearch,
      refreshOperationTargets,
      refreshHistory,
    } = renderJobListeners();

    await waitFor(() => expect(handlers.failed).toBeDefined());
    handlers.failed?.({
      jobId: "job-3",
      operationKind: "copy",
      errorCode: "permission_denied",
      message: "Denied",
      failedAt: "2026-06-06T00:00:00Z",
    });

    expect(setActivityCollapsed).toHaveBeenCalledWith(false);
    expect(updatePreference).toHaveBeenCalledWith(
      "activityPanelVisible",
      "true",
    );
    expect(pushToast).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: "error",
        title: "Operation failed",
        detail: "Denied",
      }),
    );
    pushToast.mock.calls[0][0].onAction();
    expect(setOperationError).toHaveBeenCalledWith("Denied");
    expect(setSearch).toHaveBeenCalled();
    expect(refreshOperationTargets).toHaveBeenCalledWith(["local:///target"]);
    expect(refreshHistory).toHaveBeenCalled();
  });

  it("routes content-search failures to the tab-scoped reducer", async () => {
    const { handlers, dispatch } = renderJobListeners();

    await waitFor(() => expect(handlers.failed).toBeDefined());
    handlers.failed?.({
      jobId: "content-job",
      operationKind: "contentSearch",
      errorCode: "io_error",
      message: "Search failed",
      failedAt: "2026-06-06T00:00:00Z",
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "terminateContentSearchJob",
      jobId: "content-job",
      status: "failed",
      error: "Search failed",
    });
  });
});
