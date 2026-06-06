import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { JobSnapshot } from "@fileoctopus/ts-api";
import { useCancelActiveJob } from "../src/hooks/useCancelActiveJob";

afterEach(cleanup);

const baseJob = {
  jobId: "job-1",
  operationKind: "copy",
  status: "running",
  currentItem: "file.txt",
  completedItems: 1,
  totalItems: 2,
  completedBytes: 100,
  totalBytes: 200,
  errorCode: null,
  message: null,
  startedAt: "2026-05-26T00:00:00Z",
  updatedAt: "2026-05-26T00:00:01Z",
} satisfies JobSnapshot;

function createParams(
  cancelJob = vi.fn(async () => undefined),
  initialJobs: Record<string, JobSnapshot> = { "job-1": baseJob },
) {
  let jobs = initialJobs;
  const setJobs = vi.fn((updater) => {
    jobs = typeof updater === "function" ? updater(jobs) : updater;
  });
  return {
    params: {
      client: { jobs: { cancelJob } } as never,
      setJobs,
      setOperationError: vi.fn(),
    },
    getJobs: () => jobs,
  };
}

describe("useCancelActiveJob", () => {
  it("cancels a running job and marks the snapshot cancelled", async () => {
    const cancelJob = vi.fn(async () => undefined);
    const { params, getJobs } = createParams(cancelJob);
    const { result } = renderHook(() => useCancelActiveJob(params));

    act(() => {
      result.current("job-1");
    });

    await waitFor(() =>
      expect(cancelJob).toHaveBeenCalledWith({ jobId: "job-1" }),
    );
    await waitFor(() => expect(getJobs()["job-1"].status).toBe("cancelled"));
    expect(params.setOperationError).toHaveBeenCalledWith(null);
  });

  it("removes stale local job state when the backend no longer has the job", async () => {
    const cancelJob = vi.fn(async () => {
      throw { code: "not_found", message: "missing" };
    });
    const { params, getJobs } = createParams(cancelJob);
    const { result } = renderHook(() => useCancelActiveJob(params));

    act(() => {
      result.current("job-1");
    });

    await waitFor(() => expect(getJobs()["job-1"]).toBeUndefined());
  });

  it("reports mapped operation errors for failed cancellation", async () => {
    const cancelJob = vi.fn(async () => {
      throw { code: "permission_denied", message: "denied" };
    });
    const { params } = createParams(cancelJob);
    const { result } = renderHook(() => useCancelActiveJob(params));

    act(() => {
      result.current("job-1");
    });

    await waitFor(() =>
      expect(params.setOperationError).toHaveBeenCalledWith(
        "Permission denied for this operation.",
      ),
    );
  });
});
