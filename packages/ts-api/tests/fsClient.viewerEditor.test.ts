import { describe, expect, it, vi } from "vitest";
import { FsClient } from "../src/clients/fs";
import type {
  IpcTransport,
  ReadFileAsDataUriResponse,
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

describe("FsClient.readFileAsDataUri", () => {
  it("routes to fs.read_file_as_data_uri with request payload", async () => {
    const transport = makeTransport();
    const expected: ReadFileAsDataUriResponse = {
      dataUri: "data:application/pdf;base64,JVBERi0xLjQK",
      byteSize: 1024,
      mimeType: "application/pdf",
    };
    transport.invoke.mockResolvedValueOnce(expected);

    const client = new FsClient(transport);
    const result = await client.readFileAsDataUri({
      uri: "local:///tmp/file.pdf",
      maxBytes: 2048,
    });

    expect(result).toEqual(expected);
    expect(transport.invoke).toHaveBeenCalledWith("fs.read_file_as_data_uri", {
      request: { uri: "local:///tmp/file.pdf", maxBytes: 2048 },
    });
  });
});

describe("FsClient.writeTextFile", () => {
  it("routes to fs.write_text_file and returns byteSize", async () => {
    const transport = makeTransport();
    const expected: WriteTextFileResponse = {
      byteSize: 12,
      job: {
        jobId: "job-1",
        operationKind: "writeTextFile",
        status: "completed",
        currentItem: "/tmp/file.txt",
        completedItems: 1,
        totalItems: 1,
        completedBytes: 12,
        totalBytes: 12,
        errorCode: null,
        message: null,
        startedAt: "2026-05-22T00:00:00Z",
        updatedAt: "2026-05-22T00:00:00Z",
      },
    };
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
