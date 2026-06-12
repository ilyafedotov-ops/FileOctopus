import { describe, expect, it } from "vitest";
import {
  jobIdValue,
  joinLocalUri,
  isValidName,
  operationErrorMessage,
  operationWarningMessage,
  snapshotFromStarted,
  mergeProgress,
  mergeCompleted,
  mergeFailed,
  mergeCancelled,
  mergePaused,
  mergeResumed,
} from "../src/dialogs/OperationDialogView";

describe("joinLocalUri", () => {
  it("joins parent and name with a slash", () => {
    expect(joinLocalUri("local:///home/user", "file.txt")).toBe(
      "local:///home/user/file.txt",
    );
  });

  it("strips trailing slash from parent", () => {
    expect(joinLocalUri("local:///home/user/", "file.txt")).toBe(
      "local:///home/user/file.txt",
    );
  });
});

describe("isValidName", () => {
  it("accepts a simple name", () => {
    expect(isValidName("folder")).toBe(true);
  });

  it("accepts a name with extension", () => {
    expect(isValidName("file.txt")).toBe(true);
  });

  it("rejects empty name", () => {
    expect(isValidName("")).toBe(false);
  });

  it("rejects whitespace-only name", () => {
    expect(isValidName("   ")).toBe(false);
  });

  it("rejects name with forward slash", () => {
    expect(isValidName("bad/name")).toBe(false);
  });

  it("rejects name with backslash", () => {
    expect(isValidName("bad\\name")).toBe(false);
  });

  it("rejects name with null byte", () => {
    expect(isValidName("bad\0name")).toBe(false);
  });
});

describe("operationErrorMessage", () => {
  it("returns a friendly message for known codes", () => {
    expect(operationErrorMessage("permission_denied", "fallback")).toBe(
      "Permission denied for this operation.",
    );
  });

  it("returns fallback for unknown codes", () => {
    expect(operationErrorMessage("UNKNOWN_CODE", "my fallback")).toBe(
      "my fallback",
    );
  });

  it("returns a friendly message for cloud_unavailable", () => {
    expect(operationErrorMessage("cloud_unavailable", "fallback")).toBe(
      "Couldn't download this file from its cloud provider. Make sure the cloud storage app (OneDrive, iCloud, ...) is running and online, then try again.",
    );
  });
});

describe("operationWarningMessage", () => {
  it("returns a friendly message for known warning codes", () => {
    expect(operationWarningMessage("metadata_failed", "fallback warning")).toBe(
      "Some items could not be inspected and were skipped during planning.",
    );
  });

  it("returns fallback for unknown warning codes", () => {
    expect(operationWarningMessage("UNKNOWN", "fallback")).toBe("fallback");
  });
});

describe("jobIdValue", () => {
  it("returns the jobId string", () => {
    expect(jobIdValue("abc-123")).toBe("abc-123");
  });
});

describe("snapshotFromStarted", () => {
  it("creates a running snapshot from a started event", () => {
    const event = {
      jobId: "j-1",
      operationKind: "copy",
      totalItems: 10,
      totalBytes: 1024,
      startedAt: "2026-01-01T00:00:00Z",
    };

    const snap = snapshotFromStarted(event);

    expect(snap).toEqual({
      jobId: "j-1",
      operationKind: "copy",
      status: "running",
      currentItem: null,
      completedItems: 0,
      totalItems: 10,
      completedBytes: 0,
      totalBytes: 1024,
      errorCode: null,
      message: null,
      startedAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
  });
});

describe("mergeProgress", () => {
  it("merges progress event into snapshot", () => {
    const current: Record<string, ReturnType<typeof snapshotFromStarted>> = {
      "j-1": {
        ...snapshotFromStarted({
          jobId: "j-1",
          operationKind: "copy",
          totalItems: 10,
          totalBytes: 1024,
          startedAt: "2026-01-01T00:00:00Z",
        }),
      },
    };

    const result = mergeProgress(current, {
      jobId: "j-1",
      operationKind: "copy",
      currentItem: "file.txt",
      completedItems: 5,
      totalItems: 10,
      completedBytes: 512,
      totalBytes: 1024,
      updatedAt: "2026-01-01T00:01:00Z",
    });

    expect(result.status).toBe("running");
    expect(result.completedItems).toBe(5);
    expect(result.currentItem).toBe("file.txt");
  });

  it("creates snapshot from scratch if not in current map", () => {
    const result = mergeProgress(
      {},
      {
        jobId: "j-new",
        operationKind: "move",
        currentItem: null,
        completedItems: 0,
        totalItems: 3,
        completedBytes: 0,
        totalBytes: 100,
        updatedAt: "2026-01-01T00:00:00Z",
      },
    );

    expect(result.status).toBe("running");
    expect(result.jobId).toBe("j-new");
  });
});

describe("mergeCompleted", () => {
  it("marks snapshot as completed", () => {
    const result = mergeCompleted(
      {},
      {
        jobId: "j-1",
        operationKind: "copy",
        completedItems: 10,
        completedBytes: 1024,
        completedAt: "2026-01-01T00:05:00Z",
      },
    );

    expect(result.status).toBe("completed");
    expect(result.completedItems).toBe(10);
  });
});

describe("mergeFailed", () => {
  it("marks snapshot as failed with error code and message", () => {
    const result = mergeFailed(
      {},
      {
        jobId: "j-1",
        operationKind: "copy",
        errorCode: "PERMISSION_DENIED",
        message: "Access denied",
        failedAt: "2026-01-01T00:02:00Z",
      },
    );

    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("PERMISSION_DENIED");
    expect(result.message).toBe("Access denied");
  });
});

describe("mergeCancelled", () => {
  it("marks snapshot as cancelled", () => {
    const result = mergeCancelled(
      {},
      {
        jobId: "j-1",
        operationKind: "copy",
        cancelledAt: "2026-01-01T00:03:00Z",
      },
    );

    expect(result.status).toBe("cancelled");
  });
});

describe("mergePaused", () => {
  it("marks snapshot as paused", () => {
    const result = mergePaused(
      {},
      {
        jobId: "j-1",
        operationKind: "copy",
        pausedAt: "2026-01-01T00:04:00Z",
      },
    );

    expect(result.status).toBe("paused");
  });
});

describe("mergeResumed", () => {
  it("marks snapshot as running after resume", () => {
    const result = mergeResumed(
      {},
      {
        jobId: "j-1",
        operationKind: "copy",
        resumedAt: "2026-01-01T00:05:00Z",
      },
    );

    expect(result.status).toBe("running");
  });
});
