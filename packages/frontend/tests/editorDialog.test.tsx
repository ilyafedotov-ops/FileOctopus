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
    stat: vi.fn().mockResolvedValue({
      entry: {
        ...entry,
        uri: "local:///tmp/picked.txt",
        name: "picked.txt",
      },
    }),
    openPathWithDefaultApp: vi.fn().mockResolvedValue({ ok: true }),
    revealPathInFileManager: vi.fn().mockResolvedValue({ ok: true }),
    writeTextFile: vi.fn().mockResolvedValue({ byteSize: 11 }),
  };
}

const entry: FileEntryDto = {
  uri: "local:///tmp/file.txt",
  name: "file.txt",
  kind: "file",
} as FileEntryDto;

describe("EditorDialog", () => {
  it("loads file content and saves without refreshing the parent listing", async () => {
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
    expect(onSaved).not.toHaveBeenCalled();
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

  it("renders document menus with editor actions", async () => {
    const fs = makeFs();
    render(
      <EditorDialog open entry={entry} fs={fs as FsClient} onClose={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByText("hello")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "File" }));

    expect(screen.getByRole("menuitem", { name: /Open\.\.\./ })).toBeTruthy();
    expect(
      screen.getByRole("menuitem", { name: /Save As\.\.\./ }),
    ).toBeTruthy();
    expect(
      screen.getByRole("menuitem", { name: /Open Externally/ }),
    ).toBeTruthy();
  });

  it("saves as a picked local file and switches the editor entry", async () => {
    const fs = makeFs();
    const pickLocalPath = vi.fn().mockResolvedValue("/tmp/picked.txt");
    const onEntryChange = vi.fn();
    const onSaved = vi.fn();
    render(
      <EditorDialog
        open
        entry={entry}
        fs={fs as FsClient}
        onClose={vi.fn()}
        onSaved={onSaved}
        onEntryChange={onEntryChange}
        pickLocalPath={pickLocalPath}
      />,
    );
    await waitFor(() => expect(screen.getByText("hello")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "File" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Save As\.\.\./ }));

    await waitFor(() =>
      expect(fs.writeTextFile as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
        { uri: "local:///tmp/picked.txt", content: "hello" },
      ),
    );
    expect(fs.stat as ReturnType<typeof vi.fn>).toHaveBeenCalledWith({
      uri: "local:///tmp/picked.txt",
    });
    expect(onEntryChange).toHaveBeenCalledWith(
      expect.objectContaining({ uri: "local:///tmp/picked.txt" }),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it("opens a picked local file in the editor", async () => {
    const fs = makeFs();
    const pickLocalPath = vi.fn().mockResolvedValue("/tmp/picked.txt");
    const onEntryChange = vi.fn();
    render(
      <EditorDialog
        open
        entry={entry}
        fs={fs as FsClient}
        onClose={vi.fn()}
        onEntryChange={onEntryChange}
        pickLocalPath={pickLocalPath}
      />,
    );
    await waitFor(() => expect(screen.getByText("hello")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "File" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Open\.\.\./ }));

    await waitFor(() =>
      expect(onEntryChange).toHaveBeenCalledWith(
        expect.objectContaining({ uri: "local:///tmp/picked.txt" }),
      ),
    );
  });
});
