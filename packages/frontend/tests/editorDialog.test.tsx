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

function makeFs(): Partial<FsClient> {
  return {
    readTextFile: vi.fn().mockResolvedValue({
      content: "hello",
      truncated: false,
      byteSize: 5,
    }),
    writeTextFile: vi.fn().mockResolvedValue({ byteSize: 11 }),
  };
}

const entry: FileEntryDto = {
  uri: "local:///tmp/file.txt",
  name: "file.txt",
  kind: "file",
} as FileEntryDto;

describe("EditorDialog", () => {
  it("loads file content and saves", async () => {
    const fs = makeFs();
    const onSaved = vi.fn();
    render(
      <EditorDialog
        open
        entry={entry}
        fs={fs as FsClient}
        onClose={() => undefined}
        onSaved={onSaved}
      />,
    );

    await waitFor(() => expect(screen.getByText("hello")).toBeTruthy());
    fireEvent.keyDown(window, { key: "s", metaKey: true });
    await waitFor(() =>
      expect(fs.writeTextFile as ReturnType<typeof vi.fn>).toHaveBeenCalled(),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it("closes without confirm when not dirty", async () => {
    const onClose = vi.fn();
    const fs = makeFs();
    render(
      <EditorDialog open entry={entry} fs={fs as FsClient} onClose={onClose} />,
    );
    await waitFor(() => expect(screen.getByText("hello")).toBeTruthy());
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("disables save for remote entries", async () => {
    const remote: FileEntryDto = {
      ...entry,
      uri: "sftp://550e8400-e29b-41d4-a716-446655440000/home/file.txt",
    } as FileEntryDto;
    render(
      <EditorDialog
        open
        entry={remote}
        fs={makeFs() as FsClient}
        onClose={() => undefined}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText("read-only (remote)")).toBeTruthy(),
    );
    expect((screen.getByText("Save") as HTMLButtonElement).disabled).toBe(true);
  });
});
