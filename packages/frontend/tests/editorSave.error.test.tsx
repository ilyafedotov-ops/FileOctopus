import { describe, expect, it, vi, afterEach } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { EditorDialog } from "../src/components/editor/EditorDialog";
import type { FileEntryDto, FsClient } from "@fileoctopus/ts-api";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const entry: FileEntryDto = {
  uri: "local:///tmp/file.txt",
  name: "file.txt",
  kind: "file",
} as FileEntryDto;

describe("EditorDialog save errors", () => {
  it("surfaces permission_denied from writeTextFile", async () => {
    const fs: Partial<FsClient> = {
      readTextFile: vi
        .fn()
        .mockResolvedValue({ content: "x", truncated: false, byteSize: 1 }),
      writeTextFile: vi
        .fn()
        .mockRejectedValue({ code: "permission_denied", message: "denied" }),
    };
    render(
      <EditorDialog
        open
        entry={entry}
        fs={fs as FsClient}
        onClose={() => undefined}
      />,
    );
    await waitFor(() => expect(screen.getByText("x")).toBeTruthy());
    fireEvent.keyDown(window, { key: "s", metaKey: true });
    await waitFor(() => expect(screen.getByText(/permission/i)).toBeTruthy());
  });
});
