import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DirectoryBatchEventDto,
  FileEntryDto,
  FileOperationRequestDto,
  JobCompletedEvent,
  JobProgressEvent,
  JobStartedEvent,
} from "@fileoctopus/ts-api";

let batchHandler: ((event: DirectoryBatchEventDto) => void) | null = null;
let jobStartedHandler: ((event: JobStartedEvent) => void) | null = null;
let jobProgressHandler: ((event: JobProgressEvent) => void) | null = null;
let jobCompletedHandler: ((event: JobCompletedEvent) => void) | null = null;
let sessionIndex = 0;
const listStart = vi.fn(async () => {
  sessionIndex += 1;
  return { sessionId: `session-${sessionIndex}` };
});
const onDirectoryBatch = vi.fn(
  async (handler: (event: DirectoryBatchEventDto) => void) => {
    batchHandler = handler;
    return () => undefined;
  },
);
const listRecentOperations = vi.fn(async () => ({ operations: [] }));
const planFileOperation = vi.fn(
  async ({ operation }: { operation: FileOperationRequestDto }) => ({
    plan: {
      operationId: "operation-1",
      kind: operation.kind,
      sources: operation.sources,
      destination: operation.destination ?? null,
      newName: operation.newName ?? null,
      conflictPolicy: operation.conflictPolicy ?? "fail",
      items:
        operation.sources.length > 0
          ? operation.sources.map((source) => ({
              source,
              destination: operation.destination ?? null,
              kind: "file",
              size: 12,
              recursive: false,
            }))
          : [
              {
                source: null,
                destination: operation.destination ?? null,
                kind: "directory",
                size: null,
                recursive: false,
              },
            ],
      conflicts:
        operation.kind === "copy"
          ? [
              {
                source: operation.sources[0] ?? "local:///tmp/source.txt",
                destination: `${operation.destination ?? "local:///tmp"}/source.txt`,
              },
            ]
          : [],
      warnings: [],
      totalItems: Math.max(1, operation.sources.length),
      totalBytes: operation.sources.length > 0 ? 12 : 0,
    },
  }),
);
const startFileOperation = vi.fn(async ({ plan }) => ({
  job: {
    jobId: "job-1",
    operationKind: plan.kind,
    status: "running",
    currentItem: null,
    completedItems: 0,
    totalItems: plan.totalItems,
    completedBytes: 0,
    totalBytes: plan.totalBytes,
    startedAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  },
}));
const onJobStarted = vi.fn(
  async (handler: (event: JobStartedEvent) => void) => {
    jobStartedHandler = handler;
    return () => {
      jobStartedHandler = null;
    };
  },
);
const onJobProgress = vi.fn(
  async (handler: (event: JobProgressEvent) => void) => {
    jobProgressHandler = handler;
    return () => {
      jobProgressHandler = null;
    };
  },
);
const onJobCompleted = vi.fn(
  async (handler: (event: JobCompletedEvent) => void) => {
    jobCompletedHandler = handler;
    return () => {
      jobCompletedHandler = null;
    };
  },
);
const subscribeJob = vi.fn(async () => () => undefined);
const cancelJob = vi.fn(async () => ({
  job: {
    jobId: "job-1",
    operationKind: "copy",
    status: "cancelled",
    completedItems: 0,
    totalItems: 1,
    completedBytes: 0,
    startedAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  },
}));

vi.mock("@fileoctopus/ts-api", () => ({
  createFileOctopusClient: () => ({
    fs: {
      listStart,
      onDirectoryBatch,
    },
    fileOperations: {
      planFileOperation,
      startFileOperation,
      onJobStarted,
      onJobProgress,
      onJobCompleted,
      onJobFailed: subscribeJob,
      onJobCancelled: subscribeJob,
    },
    jobs: {
      cancelJob,
    },
    operationHistory: {
      listRecentOperations,
    },
  }),
  normalizeIpcError: (error: unknown) =>
    error && typeof error === "object" && "message" in error
      ? {
          code: "unknown",
          message: String((error as { message: unknown }).message),
        }
      : { code: "unknown", message: "error" },
}));

import { FileOctopusShell } from "../src";

describe("FileOctopusShell", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    batchHandler = null;
    jobStartedHandler = null;
    jobProgressHandler = null;
    jobCompletedHandler = null;
    sessionIndex = 0;
    listStart.mockClear();
    onDirectoryBatch.mockClear();
    listRecentOperations.mockClear();
    subscribeJob.mockClear();
    planFileOperation.mockClear();
    startFileOperation.mockClear();
    onJobStarted.mockClear();
    onJobProgress.mockClear();
    onJobCompleted.mockClear();
    cancelJob.mockClear();
  });

  it("renders the two panel shell", async () => {
    render(<FileOctopusShell />);

    expect(await screen.findByText("Left")).toBeTruthy();
    expect(screen.getByText("Right")).toBeTruthy();
    expect(screen.getByLabelText("File panels")).toBeTruthy();
    expect(screen.getByLabelText("Job activity")).toBeTruthy();
  });

  it("renders a 100k entry batch without mounting every row", async () => {
    const { container } = render(<FileOctopusShell />);

    await waitFor(() => expect(batchHandler).toBeTruthy());

    await act(async () => {
      batchHandler?.({
        sessionId: "session-1",
        uri: "local:///tmp/100k",
        entries: Array.from({ length: 100_000 }, (_, index) => ({
          uri: `local:///tmp/100k/file-${index}.txt`,
          name: `file-${index}.txt`,
          kind: "file",
          size: 0,
          isHidden: false,
          isSymlink: false,
          providerId: "local",
          canRead: true,
          canList: false,
          canWrite: false,
          canDelete: false,
          canRename: false,
        })),
        batchIndex: 0,
        isComplete: true,
      });
    });

    expect(container.querySelectorAll(".fo-row").length).toBeLessThan(80);
  });

  it("validates and submits create-folder through the operation dialog", async () => {
    render(<FileOctopusShell />);
    await waitFor(() => expect(listStart).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getAllByText("New Folder")[0]);
    fireEvent.change(screen.getByLabelText("Folder name"), {
      target: { value: "bad/name" },
    });
    fireEvent.click(screen.getByText("Create"));

    expect(
      await screen.findByText("Enter a folder name without path separators."),
    ).toBeTruthy();
    expect(planFileOperation).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Folder name"), {
      target: { value: "Reports" },
    });
    fireEvent.click(screen.getByText("Create"));

    await waitFor(() => expect(startFileOperation).toHaveBeenCalledTimes(1));
    expect(planFileOperation.mock.calls[0][0].operation).toMatchObject({
      kind: "createDirectory",
      destination: "local:///Users/ilya/Reports",
    });
  });

  it("validates rename names and sends the backend rename request", async () => {
    render(<FileOctopusShell />);
    await applyLeftEntries([entry("alpha.txt")]);

    fireEvent.click(screen.getAllByText("Rename")[0]);
    fireEvent.change(screen.getByLabelText("New name"), {
      target: { value: "bad/name" },
    });
    fireEvent.click(screen.getAllByText("Rename").slice(-1)[0]);

    expect(
      await screen.findByText("Enter a name without path separators."),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("New name"), {
      target: { value: "beta.txt" },
    });
    fireEvent.click(screen.getAllByText("Rename").slice(-1)[0]);

    await waitFor(() => expect(startFileOperation).toHaveBeenCalledTimes(1));
    expect(planFileOperation.mock.calls[0][0].operation).toMatchObject({
      kind: "rename",
      sources: ["local:///tmp/alpha.txt"],
      newName: "beta.txt",
    });
  });

  it("requires explicit trash confirmation before starting delete-to-trash", async () => {
    render(<FileOctopusShell />);
    await applyLeftEntries([entry("alpha.txt")]);

    fireEvent.click(screen.getAllByText("Move to Trash")[0]);

    expect(screen.getByText("Move 1 item(s) to Trash")).toBeTruthy();
    expect(screen.getByText("alpha.txt")).toBeTruthy();

    fireEvent.click(screen.getAllByText("Move to Trash").slice(-1)[0]);

    await waitFor(() => expect(startFileOperation).toHaveBeenCalledTimes(1));
    expect(planFileOperation.mock.calls[0][0].operation).toMatchObject({
      kind: "deleteToTrash",
      sources: ["local:///tmp/alpha.txt"],
    });
  });

  it("plans copy conflicts before start and passes selected policy", async () => {
    render(<FileOctopusShell />);
    await applyLeftEntries([entry("alpha.txt")]);

    fireEvent.click(screen.getAllByText("Copy")[0]);
    expect(
      (screen.getByLabelText("Conflict policy") as HTMLSelectElement).value,
    ).toBe("fail");
    expect((screen.getByText("Start") as HTMLButtonElement).disabled).toBe(
      true,
    );

    fireEvent.click(screen.getByText("Plan"));
    expect(
      await screen.findByText("1 planned item(s), 1 conflict(s)"),
    ).toBeTruthy();
    expect(startFileOperation).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Conflict policy"), {
      target: { value: "skip" },
    });
    fireEvent.click(screen.getByText("Plan"));
    await screen.findByText("1 planned item(s), 1 conflict(s)");
    fireEvent.click(screen.getByText("Start"));

    await waitFor(() => expect(startFileOperation).toHaveBeenCalledTimes(1));
    expect(planFileOperation.mock.calls.at(-1)?.[0].operation).toMatchObject({
      kind: "copy",
      conflictPolicy: "skip",
    });
  });

  it("renders job progress and invokes cancellation", async () => {
    render(<FileOctopusShell />);
    await waitFor(() => expect(onJobProgress).toHaveBeenCalledTimes(1));

    act(() => {
      jobStartedHandler?.({
        jobId: "job-live",
        operationKind: "copy",
        totalItems: 2,
        totalBytes: 100,
        startedAt: new Date(0).toISOString(),
      });
      jobProgressHandler?.({
        jobId: "job-live",
        operationKind: "copy",
        currentItem: "alpha.txt",
        completedItems: 1,
        totalItems: 2,
        completedBytes: 50,
        totalBytes: 100,
        updatedAt: new Date(1).toISOString(),
      });
    });

    expect(screen.getByText("alpha.txt")).toBeTruthy();
    fireEvent.click(screen.getByText("Cancel"));
    expect(cancelJob).toHaveBeenCalledWith({ jobId: "job-live" });

    act(() => {
      jobCompletedHandler?.({
        jobId: "job-live",
        operationKind: "copy",
        completedItems: 2,
        completedBytes: 100,
        completedAt: new Date(2).toISOString(),
      });
    });

    expect(screen.getByText("copy completed")).toBeTruthy();
  });
});

function entry(name: string): FileEntryDto {
  return {
    uri: `local:///tmp/${name}`,
    name,
    kind: "file",
    size: 12,
    isHidden: false,
    isSymlink: false,
    providerId: "local",
    canRead: true,
    canList: false,
    canWrite: true,
    canDelete: true,
    canRename: true,
  };
}

async function applyLeftEntries(entries: FileEntryDto[]) {
  await waitFor(() => expect(listStart).toHaveBeenCalledTimes(2));

  await act(async () => {
    batchHandler?.({
      sessionId: "session-1",
      uri: "local:///Users/ilya",
      entries,
      batchIndex: 0,
      isComplete: true,
    });
  });
}
