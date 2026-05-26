import { describe, it, expect } from "vitest";
import { mergePaused, mergeResumed } from "../src/dialogs/OperationDialogView";
import type { JobSnapshot } from "@fileoctopus/ts-api";

const BASE_JOB: JobSnapshot = {
  jobId: "job-123",
  operationKind: "copy",
  status: "running",
  currentItem: "file.txt",
  completedItems: 3,
  totalItems: 10,
  completedBytes: 300,
  totalBytes: 1000,
  errorCode: null,
  message: null,
  startedAt: "2026-05-26T00:00:00Z",
  updatedAt: "2026-05-26T00:00:01Z",
};

describe("mergePaused", () => {
  it("sets status to paused with updatedAt from event", () => {
    const result = mergePaused(
      { "job-123": BASE_JOB },
      {
        jobId: "job-123",
        operationKind: "copy",
        pausedAt: "2026-05-26T00:00:05Z",
      },
    );
    expect(result.status).toBe("paused");
    expect(result.updatedAt).toBe("2026-05-26T00:00:05Z");
  });

  it("preserves existing job fields", () => {
    const result = mergePaused(
      { "job-123": BASE_JOB },
      {
        jobId: "job-123",
        operationKind: "copy",
        pausedAt: "2026-05-26T00:00:05Z",
      },
    );
    expect(result.completedItems).toBe(3);
    expect(result.totalItems).toBe(10);
    expect(result.completedBytes).toBe(300);
    expect(result.currentItem).toBe("file.txt");
  });

  it("creates fallback snapshot when job not in current state", () => {
    const result = mergePaused(
      {},
      {
        jobId: "job-new",
        operationKind: "move",
        pausedAt: "2026-05-26T00:00:05Z",
      },
    );
    expect(result.status).toBe("paused");
    expect(result.operationKind).toBe("move");
    expect(result.updatedAt).toBe("2026-05-26T00:00:05Z");
  });
});

describe("mergeResumed", () => {
  it("sets status to running with updatedAt from event", () => {
    const pausedJob: JobSnapshot = { ...BASE_JOB, status: "paused" };
    const result = mergeResumed(
      { "job-123": pausedJob },
      {
        jobId: "job-123",
        operationKind: "copy",
        resumedAt: "2026-05-26T00:00:10Z",
      },
    );
    expect(result.status).toBe("running");
    expect(result.updatedAt).toBe("2026-05-26T00:00:10Z");
  });

  it("preserves existing job fields", () => {
    const pausedJob: JobSnapshot = { ...BASE_JOB, status: "paused" };
    const result = mergeResumed(
      { "job-123": pausedJob },
      {
        jobId: "job-123",
        operationKind: "copy",
        resumedAt: "2026-05-26T00:00:10Z",
      },
    );
    expect(result.completedItems).toBe(3);
    expect(result.totalItems).toBe(10);
    expect(result.completedBytes).toBe(300);
  });

  it("creates fallback snapshot when job not in current state", () => {
    const result = mergeResumed(
      {},
      {
        jobId: "job-new",
        operationKind: "delete",
        resumedAt: "2026-05-26T00:00:10Z",
      },
    );
    expect(result.status).toBe("running");
    expect(result.operationKind).toBe("delete");
    expect(result.updatedAt).toBe("2026-05-26T00:00:10Z");
  });
});
