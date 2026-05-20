import { describe, expect, it, vi, afterEach } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ViewerDialog } from "../src/components/viewer/ViewerDialog";
import type { FileEntryDto, FsClient } from "@fileoctopus/ts-api";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeFs(): Partial<FsClient> {
  return {
    readFileRange: vi.fn().mockResolvedValue({
      bytesBase64: btoa("hello"),
      bytesRead: 5,
      byteSize: 5,
      eof: true,
    }),
    readImageAsDataUri: vi.fn().mockResolvedValue({
      dataUri: "data:image/png;base64,AAAA",
      byteSize: 4,
      mimeType: "image/png",
    }),
  };
}

const textEntry: FileEntryDto = {
  uri: "local:///tmp/file.txt",
  name: "file.txt",
  kind: "file",
} as FileEntryDto;

describe("ViewerDialog", () => {
  it("renders text content from readFileRange", async () => {
    const fs = makeFs();
    render(
      <ViewerDialog
        open
        entry={textEntry}
        fs={fs as FsClient}
        onClose={() => undefined}
      />,
    );

    await waitFor(() => expect(screen.getByText(/hello/)).toBeTruthy());
    expect(fs.readFileRange as ReturnType<typeof vi.fn>).toHaveBeenCalled();
  });

  it("switches to hex mode and re-reads bytes", async () => {
    const fs = makeFs();
    render(
      <ViewerDialog
        open
        entry={textEntry}
        fs={fs as FsClient}
        onClose={() => undefined}
      />,
    );
    await waitFor(() => expect(screen.getByText(/hello/)).toBeTruthy());
    fireEvent.click(screen.getByRole("tab", { name: "Hex" }));
    await waitFor(() =>
      expect(
        (fs.readFileRange as ReturnType<typeof vi.fn>).mock.calls.length,
      ).toBeGreaterThan(1),
    );
  });

  it("calls onClose on Escape", async () => {
    const onClose = vi.fn();
    render(
      <ViewerDialog
        open
        entry={textEntry}
        fs={makeFs() as FsClient}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
