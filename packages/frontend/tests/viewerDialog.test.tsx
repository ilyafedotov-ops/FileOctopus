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
    stat: vi.fn().mockResolvedValue({
      entry: {
        ...textEntry,
        uri: "local:///tmp/picked.txt",
        name: "picked.txt",
      },
    }),
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
    openPathWithDefaultApp: vi.fn().mockResolvedValue({ ok: true }),
    revealPathInFileManager: vi.fn().mockResolvedValue({ ok: true }),
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

  it("renders viewer menus and disables replace in read-only mode", async () => {
    const fs = makeFs();
    render(
      <ViewerDialog
        open
        entry={textEntry}
        fs={fs as FsClient}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText(/hello/)).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(screen.getByRole("menuitem", { name: /^Find$/ })).toBeTruthy();
    expect(
      screen.getByRole("menuitem", { name: /^Replace$/ }) as HTMLButtonElement,
    ).toHaveProperty("disabled", true);
  });

  it("opens and reveals the current viewer entry from the File menu", async () => {
    const fs = makeFs();
    render(
      <ViewerDialog
        open
        entry={textEntry}
        fs={fs as FsClient}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText(/hello/)).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "File" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Open Externally/ }));
    await waitFor(() =>
      expect(
        fs.openPathWithDefaultApp as ReturnType<typeof vi.fn>,
      ).toHaveBeenCalledWith({ uri: textEntry.uri }),
    );

    fireEvent.click(screen.getByRole("button", { name: "File" }));
    fireEvent.click(
      screen.getByRole("menuitem", { name: /Reveal in File Manager/ }),
    );
    await waitFor(() =>
      expect(
        fs.revealPathInFileManager as ReturnType<typeof vi.fn>,
      ).toHaveBeenCalledWith({ uri: textEntry.uri }),
    );
  });

  it("opens a picked local file in the viewer", async () => {
    const fs = makeFs();
    const pickLocalPath = vi.fn().mockResolvedValue("/tmp/picked.txt");
    const onEntryChange = vi.fn();
    render(
      <ViewerDialog
        open
        entry={textEntry}
        fs={fs as FsClient}
        onClose={vi.fn()}
        onEntryChange={onEntryChange}
        pickLocalPath={pickLocalPath}
      />,
    );
    await waitFor(() => expect(screen.getByText(/hello/)).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "File" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Open\.\.\./ }));

    await waitFor(() =>
      expect(onEntryChange).toHaveBeenCalledWith(
        expect.objectContaining({ uri: "local:///tmp/picked.txt" }),
      ),
    );
  });
});
