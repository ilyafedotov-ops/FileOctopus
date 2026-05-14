import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DirectoryBatchEventDto } from "@fileoctopus/ts-api";

let batchHandler: ((event: DirectoryBatchEventDto) => void) | null = null;
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

vi.mock("@fileoctopus/ts-api", () => ({
  createFileOctopusClient: () => ({
    fs: {
      listStart,
      onDirectoryBatch,
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
  beforeEach(() => {
    batchHandler = null;
    sessionIndex = 0;
    listStart.mockClear();
    onDirectoryBatch.mockClear();
  });

  it("renders the two panel shell", async () => {
    render(<FileOctopusShell />);

    expect(await screen.findByText("Left")).toBeTruthy();
    expect(screen.getByText("Right")).toBeTruthy();
    expect(screen.getByLabelText("File panels")).toBeTruthy();
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
});
