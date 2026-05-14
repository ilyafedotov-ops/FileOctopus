import { describe, expect, it } from "vitest";
import {
  DIRECTORY_BATCH_EVENT,
  FileOctopusClient,
  normalizeIpcError,
} from "../src/client";
import type { IpcTransport } from "../src/types";

describe("FileOctopusClient", () => {
  it("routes app info through the transport", async () => {
    const calls: string[] = [];
    const transport: IpcTransport = {
      async invoke<TResponse>(command: string) {
        calls.push(command);
        return { name: "FileOctopus", version: "0.1.0" } as TResponse;
      },
    };

    const client = new FileOctopusClient(transport);
    const response = await client.getAppInfo();

    expect(response.name).toBe("FileOctopus");
    expect(calls).toEqual(["app.get_info"]);
  });

  it("routes filesystem stat and list start through the fs client", async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> =
      [];
    const transport: IpcTransport = {
      async invoke<TResponse>(command: string, args?: Record<string, unknown>) {
        calls.push({ command, args });

        if (command === "fs.stat") {
          return {
            entry: { uri: "local:///tmp", name: "tmp", kind: "directory" },
          } as TResponse;
        }

        return { sessionId: "session-1" } as TResponse;
      },
    };

    const client = new FileOctopusClient(transport);

    await client.fs.stat({ uri: "local:///tmp" });
    const list = await client.fs.listStart({
      uri: "local:///tmp",
      batchSize: 128,
    });

    expect(list.sessionId).toBe("session-1");
    expect(calls.map((call) => call.command)).toEqual([
      "fs.stat",
      "fs.list_start",
    ]);
  });

  it("subscribes to directory batch events", async () => {
    let subscribedEvent = "";
    const transport: IpcTransport = {
      async invoke<TResponse>() {
        return {} as TResponse;
      },
      async listen(event, handler) {
        subscribedEvent = event;
        handler({
          sessionId: "session-1",
          uri: "local:///tmp",
          entries: [],
          batchIndex: 0,
          isComplete: true,
        });
        return () => undefined;
      },
    };
    const client = new FileOctopusClient(transport);
    const events: string[] = [];

    await client.fs.onDirectoryBatch((event) => events.push(event.sessionId));

    expect(subscribedEvent).toBe(DIRECTORY_BATCH_EVENT);
    expect(events).toEqual(["session-1"]);
  });

  it("routes file operation and job commands through typed clients", async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> =
      [];
    const transport: IpcTransport = {
      async invoke<TResponse>(command: string, args?: Record<string, unknown>) {
        calls.push({ command, args });

        if (command === "fileOperation.plan") {
          return {
            plan: {
              operationId: "op-1",
              kind: "copy",
              sources: ["local:///tmp/a.txt"],
              destination: "local:///tmp/dest",
              conflictPolicy: "fail",
              items: [],
              conflicts: [],
              warnings: [],
              totalItems: 0,
            },
          } as TResponse;
        }

        if (command === "operationHistory.listRecent") {
          return { operations: [] } as TResponse;
        }

        return {
          job: {
            jobId: "job-1",
            operationKind: "copy",
            status: "running",
            completedItems: 0,
            totalItems: 1,
            completedBytes: 0,
            startedAt: new Date(0).toISOString(),
            updatedAt: new Date(0).toISOString(),
          },
        } as TResponse;
      },
      async listen(event, handler) {
        handler({
          jobId: "job-1",
          operationKind: "copy",
          completedItems: 0,
          totalItems: 1,
          completedBytes: 0,
          updatedAt: new Date(0).toISOString(),
        });
        return () => undefined;
      },
    };
    const client = new FileOctopusClient(transport);
    const events: string[] = [];

    await client.fileOperations.planFileOperation({
      operation: {
        kind: "copy",
        sources: ["local:///tmp/a.txt"],
        destination: "local:///tmp/dest",
      },
    });
    await client.fileOperations.startFileOperation({
      plan: {
        operationId: "op-1",
        kind: "copy",
        sources: ["local:///tmp/a.txt"],
        destination: "local:///tmp/dest",
        conflictPolicy: "fail",
        items: [],
        conflicts: [],
        warnings: [],
        totalItems: 0,
      },
    });
    await client.jobs.cancelJob({ jobId: "job-1" });
    await client.jobs.getJobStatus({ jobId: "job-1" });
    await client.operationHistory.listRecentOperations({ limit: 10 });
    await client.fileOperations.onJobProgress((event) =>
      events.push(String(event.jobId)),
    );

    expect(calls.map((call) => call.command)).toEqual([
      "fileOperation.plan",
      "fileOperation.start",
      "job.cancel",
      "job.status",
      "operationHistory.listRecent",
    ]);
    expect(events).toEqual(["job-1"]);
  });

  it("normalizes frontend-safe ipc errors", () => {
    expect(
      normalizeIpcError({ code: "not_found", message: "missing" }),
    ).toEqual({
      code: "not_found",
      message: "missing",
    });
    expect(normalizeIpcError("boom")).toEqual({
      code: "unknown",
      message: "boom",
    });
  });
});
