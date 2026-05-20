import { describe, expect, it, vi } from "vitest";
import { FsClient } from "../src/clients/fs";
import type {
  IpcTransport,
  ReadFileRangeResponse,
  WriteTextFileResponse,
} from "../src/types";

function makeTransport(): IpcTransport & { invoke: ReturnType<typeof vi.fn> } {
  return {
    invoke: vi.fn(),
  } as unknown as IpcTransport & { invoke: ReturnType<typeof vi.fn> };
}

describe("FsClient.readFileRange", () => {
  it("routes to fs.read_file_range with request payload", async () => {
    const transport = makeTransport();
    const expected: ReadFileRangeResponse = {
      bytesBase64: "aGVsbG8=",
      bytesRead: 5,
      byteSize: 5,
      eof: true,
    };
    transport.invoke.mockResolvedValueOnce(expected);

    const client = new FsClient(transport);
    const result = await client.readFileRange({
      uri: "local:///tmp/file.txt",
      offset: 0,
      length: 64,
    });

    expect(result).toEqual(expected);
    expect(transport.invoke).toHaveBeenCalledWith("fs.read_file_range", {
      request: { uri: "local:///tmp/file.txt", offset: 0, length: 64 },
    });
  });
});

describe("FsClient.writeTextFile", () => {
  it("routes to fs.write_text_file and returns byteSize", async () => {
    const transport = makeTransport();
    const expected: WriteTextFileResponse = { byteSize: 12 };
    transport.invoke.mockResolvedValueOnce(expected);

    const client = new FsClient(transport);
    const result = await client.writeTextFile({
      uri: "local:///tmp/file.txt",
      content: "hello world\n",
    });

    expect(result).toEqual(expected);
    expect(transport.invoke).toHaveBeenCalledWith("fs.write_text_file", {
      request: { uri: "local:///tmp/file.txt", content: "hello world\n" },
    });
  });
});
