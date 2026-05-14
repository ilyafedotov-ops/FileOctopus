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
