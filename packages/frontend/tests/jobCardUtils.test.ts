import { describe, it, expect } from "vitest";
import {
  progressPercent,
  formatJobBytes,
  operationVerb,
  jobTitle,
  jobProgressMeta,
} from "../src/jobs/jobCardUtils";
import type { JobSnapshot } from "@fileoctopus/ts-api";

function makeJob(overrides: Partial<JobSnapshot> = {}): JobSnapshot {
  return {
    operationKind: "copy",
    status: "running",
    totalBytes: 0,
    completedBytes: 0,
    totalItems: 0,
    completedItems: 0,
    currentItem: null,
    ...overrides,
  } as JobSnapshot;
}

describe("progressPercent", () => {
  it("returns 0 when all values are 0", () => {
    expect(progressPercent(makeJob())).toBe(0);
  });

  it("calculates percentage from bytes", () => {
    expect(
      progressPercent(makeJob({ totalBytes: 1000, completedBytes: 500 })),
    ).toBe(50);
  });

  it("calculates percentage from items when no bytes", () => {
    expect(
      progressPercent(makeJob({ totalItems: 10, completedItems: 3 })),
    ).toBe(30);
  });

  it("prefers bytes over items", () => {
    expect(
      progressPercent(
        makeJob({
          totalBytes: 200,
          completedBytes: 100,
          totalItems: 10,
          completedItems: 0,
        }),
      ),
    ).toBe(50);
  });

  it("caps at 100 from bytes", () => {
    expect(
      progressPercent(makeJob({ totalBytes: 100, completedBytes: 200 })),
    ).toBe(100);
  });

  it("caps at 100 from items", () => {
    expect(
      progressPercent(makeJob({ totalItems: 5, completedItems: 10 })),
    ).toBe(100);
  });

  it("rounds fractional byte percentage", () => {
    expect(progressPercent(makeJob({ totalBytes: 3, completedBytes: 1 }))).toBe(
      33,
    );
  });

  it("returns 0 when totalBytes is negative", () => {
    expect(
      progressPercent(makeJob({ totalBytes: -1, completedBytes: 5 })),
    ).toBe(0);
  });

  it("returns 0 when totalItems is 0 and no bytes", () => {
    expect(progressPercent(makeJob({ totalItems: 0, completedItems: 5 }))).toBe(
      0,
    );
  });
});

describe("formatJobBytes", () => {
  it("formats 0 bytes", () => {
    expect(formatJobBytes(0)).toBe("0 B");
  });

  it("formats bytes", () => {
    expect(formatJobBytes(500)).toBe("500 B");
  });

  it("formats 1023 as bytes", () => {
    expect(formatJobBytes(1023)).toBe("1023 B");
  });

  it("formats kilobytes", () => {
    expect(formatJobBytes(1024)).toBe("1.0 KB");
  });

  it("formats kilobytes with decimal", () => {
    expect(formatJobBytes(1536)).toBe("1.5 KB");
  });

  it("formats megabytes", () => {
    expect(formatJobBytes(1048576)).toBe("1.0 MB");
  });

  it("formats large megabytes", () => {
    expect(formatJobBytes(5242880)).toBe("5.0 MB");
  });

  it("formats gigabytes as MB (no GB case)", () => {
    const result = formatJobBytes(1073741824);
    expect(result).toBe("1024.0 MB");
  });
});

describe("operationVerb", () => {
  it("returns Copying for copy", () => {
    expect(operationVerb("copy")).toBe("Copying");
  });

  it("returns Moving for move", () => {
    expect(operationVerb("move")).toBe("Moving");
  });

  it("returns Moving to Trash for deleteToTrash", () => {
    expect(operationVerb("deleteToTrash")).toBe("Moving to Trash");
  });

  it("returns Renaming for rename", () => {
    expect(operationVerb("rename")).toBe("Renaming");
  });

  it("returns Renaming for batch rename", () => {
    expect(operationVerb("batchRename")).toBe("Renaming");
  });

  it("returns Saving for writeTextFile", () => {
    expect(operationVerb("writeTextFile")).toBe("Saving");
  });

  it("returns Searching contents for contentSearch", () => {
    expect(operationVerb("contentSearch")).toBe("Searching contents");
  });

  it("returns Searching for recursiveSearch", () => {
    expect(operationVerb("recursiveSearch")).toBe("Searching");
  });

  it("returns Calculating size for folderSize", () => {
    expect(operationVerb("folderSize")).toBe("Calculating size");
  });

  it("returns Processing for unknown kind", () => {
    expect(operationVerb("unknown" as unknown as Record<string, unknown>)).toBe(
      "Processing",
    );
  });
});

describe("jobTitle", () => {
  it("returns verb + basename for running job with currentItem", () => {
    expect(
      jobTitle(
        makeJob({ operationKind: "copy", currentItem: "/home/user/docs" }),
      ),
    ).toBe("Copying docs");
  });

  it("uses past tense for completed status", () => {
    expect(
      jobTitle(
        makeJob({
          operationKind: "copy",
          status: "completed",
          currentItem: "/a/b.txt",
        }),
      ),
    ).toBe("Copied b.txt");
  });

  it("uses past tense for failed status", () => {
    expect(
      jobTitle(
        makeJob({
          operationKind: "move",
          status: "failed",
          currentItem: "/a/c",
        }),
      ),
    ).toBe("Moved c");
  });

  it("uses past tense for cancelled status", () => {
    expect(
      jobTitle(
        makeJob({
          operationKind: "deleteToTrash",
          status: "cancelled",
          currentItem: "/tmp/x",
        }),
      ),
    ).toBe("Moved to Trash x");
  });

  it("shows item count when totalItems > 1", () => {
    expect(jobTitle(makeJob({ operationKind: "move", totalItems: 5 }))).toBe(
      "Moving 5 items",
    );
  });

  it("shows item count with past tense for completed", () => {
    expect(
      jobTitle(
        makeJob({
          operationKind: "rename",
          status: "completed",
          totalItems: 3,
        }),
      ),
    ).toBe("Renamed 3 items");
  });

  it("returns verb only when totalItems <= 1 and no currentItem", () => {
    expect(jobTitle(makeJob({ operationKind: "writeTextFile" }))).toBe(
      "Saving",
    );
  });

  it("returns past tense verb only for completed with no items or path", () => {
    expect(
      jobTitle(
        makeJob({ operationKind: "writeTextFile", status: "completed" }),
      ),
    ).toBe("Saved");
  });

  it("uses content search wording for completed jobs", () => {
    expect(
      jobTitle(
        makeJob({ operationKind: "contentSearch", status: "completed" }),
      ),
    ).toBe("Searched contents");
  });

  it("prefers totalItems > 1 over currentItem", () => {
    expect(
      jobTitle(
        makeJob({
          operationKind: "copy",
          totalItems: 5,
          currentItem: "/a/b.txt",
        }),
      ),
    ).toBe("Copying 5 items");
  });

  it("handles trailing slash in currentItem", () => {
    expect(
      jobTitle(makeJob({ operationKind: "copy", currentItem: "/tmp/" })),
    ).toBe("Copying tmp");
  });
});

describe("jobProgressMeta", () => {
  it("returns bytes format when totalBytes > 0", () => {
    expect(
      jobProgressMeta(makeJob({ totalBytes: 2000, completedBytes: 500 })),
    ).toBe("500 B / 2.0 KB");
  });

  it("returns items format when no bytes and totalItems > 0", () => {
    expect(
      jobProgressMeta(makeJob({ totalItems: 10, completedItems: 3 })),
    ).toBe("3/10 items");
  });

  it("returns empty string when no bytes and no items", () => {
    expect(jobProgressMeta(makeJob())).toBe("");
  });

  it("appends speed and eta from metrics", () => {
    expect(
      jobProgressMeta(makeJob({ totalBytes: 1000, completedBytes: 500 }), {
        speedLabel: "1.0 MB/s",
        etaLabel: "2s",
      }),
    ).toBe("500 B / 1000 B · 1.0 MB/s · 2s");
  });

  it("appends only speed when eta is null", () => {
    expect(
      jobProgressMeta(makeJob({ totalBytes: 1000, completedBytes: 500 }), {
        speedLabel: "500 B/s",
        etaLabel: null,
      }),
    ).toBe("500 B / 1000 B · 500 B/s");
  });

  it("appends only eta when speed is null", () => {
    expect(
      jobProgressMeta(makeJob({ totalBytes: 1000, completedBytes: 500 }), {
        speedLabel: null,
        etaLabel: "5s",
      }),
    ).toBe("500 B / 1000 B · 5s");
  });

  it("skips metrics when both are null", () => {
    expect(
      jobProgressMeta(makeJob({ totalBytes: 1000, completedBytes: 500 }), {
        speedLabel: null,
        etaLabel: null,
      }),
    ).toBe("500 B / 1000 B");
  });

  it("prefers bytes over items when both present", () => {
    expect(
      jobProgressMeta(
        makeJob({
          totalBytes: 2048,
          completedBytes: 1024,
          totalItems: 5,
          completedItems: 2,
        }),
      ),
    ).toBe("1.0 KB / 2.0 KB");
  });
});
