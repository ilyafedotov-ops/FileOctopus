import { describe, expect, it } from "vitest";
import { FileOctopusClient } from "./client";
import type { IpcTransport } from "./types";

describe("FileOctopusClient", () => {
  it("routes app info through the transport", async () => {
    const calls: string[] = [];
    const transport: IpcTransport = {
      async invoke<TResponse>(command: string) {
        calls.push(command);
        return { name: "FileOctopus", version: "0.1.0" } as TResponse;
      }
    };

    const client = new FileOctopusClient(transport);
    const response = await client.getAppInfo();

    expect(response.name).toBe("FileOctopus");
    expect(calls).toEqual(["app.get_info"]);
  });
});
