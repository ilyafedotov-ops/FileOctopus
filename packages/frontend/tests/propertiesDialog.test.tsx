import { describe, expect, it, vi, afterEach } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { PropertiesDialog } from "../src/components/dialogs/PropertiesDialog";
import type {
  FileEntryDto,
  FsClient,
  PathPropertiesDto,
} from "@fileoctopus/ts-api";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeFs(overrides?: Partial<FsClient>): Partial<FsClient> {
  return {
    computeHash: vi.fn().mockResolvedValue({ hash: "abc123", fileSize: 42 }),
    getAcl: vi.fn().mockResolvedValue({
      owner: "user",
      group: "user",
      entries: [
        { principal: "owner", read: true, write: true, execute: false },
        { principal: "group", read: true, write: false, execute: false },
        { principal: "other", read: true, write: false, execute: false },
      ],
      octal: "644",
    }),
    setAcl: vi.fn().mockResolvedValue({ success: true }),
    ...overrides,
  };
}

const fileEntry: FileEntryDto = {
  uri: "local:///tmp/file.txt",
  name: "file.txt",
  kind: "file",
} as FileEntryDto;

const dirEntry: FileEntryDto = {
  uri: "local:///tmp/folder",
  name: "folder",
  kind: "directory",
} as FileEntryDto;

const fileProperties: PathPropertiesDto = {
  uri: "local:///tmp/file.txt",
  name: "file.txt",
  kind: "file",
  size: 42,
  isHidden: false,
  isSymlink: false,
  readonly: false,
  warnings: [],
} as PathPropertiesDto;

const dirProperties: PathPropertiesDto = {
  uri: "local:///tmp/folder",
  name: "folder",
  kind: "directory",
  isHidden: false,
  isSymlink: false,
  readonly: false,
  warnings: [],
} as PathPropertiesDto;

function renderDialog(
  fs: Partial<FsClient>,
  entry: FileEntryDto | null,
  properties: PathPropertiesDto | null,
) {
  return render(
    <PropertiesDialog
      open
      state={{
        panelId: "left",
        entry,
        properties,
        loading: false,
        error: null,
      }}
      fs={fs as FsClient}
      onCopyPath={() => undefined}
      onReveal={() => undefined}
    />,
  );
}

describe("PropertiesDialog checksum section", () => {
  it("does not render checksum section for directories", () => {
    renderDialog(makeFs(), dirEntry, dirProperties);
    expect(screen.queryByText(/SHA-256/i)).toBeNull();
  });

  it("renders checksum section for files and calls computeHash", async () => {
    const fs = makeFs();
    renderDialog(fs, fileEntry, fileProperties);
    await waitFor(() =>
      expect(fs.computeHash as ReturnType<typeof vi.fn>).toHaveBeenCalledWith({
        uri: "local:///tmp/file.txt",
        algorithm: "sha256",
      }),
    );
    await waitFor(() => expect(screen.getByText(/SHA-256/i)).toBeTruthy());
  });

  it("displays computed hash", async () => {
    const fs = makeFs();
    renderDialog(fs, fileEntry, fileProperties);
    await waitFor(() => expect(screen.getByText("abc123")).toBeTruthy());
  });

  it("shows Match when expected hash equals computed hash", async () => {
    const fs = makeFs();
    renderDialog(fs, fileEntry, fileProperties);
    await waitFor(() => expect(screen.getByText("abc123")).toBeTruthy());

    const input = screen.getByPlaceholderText(/Paste expected SHA-256/i);
    fireEvent.change(input, { target: { value: "abc123" } });
    await waitFor(() => expect(screen.getByText(/Match/i)).toBeTruthy());
  });

  it("shows Mismatch when expected hash differs", async () => {
    const fs = makeFs();
    renderDialog(fs, fileEntry, fileProperties);
    await waitFor(() => expect(screen.getByText("abc123")).toBeTruthy());

    const input = screen.getByPlaceholderText(/Paste expected SHA-256/i);
    fireEvent.change(input, { target: { value: "wronghash" } });
    await waitFor(() => expect(screen.getByText(/Mismatch/i)).toBeTruthy());
  });

  it("shows error when computeHash fails", async () => {
    const fs = makeFs({
      computeHash: vi.fn().mockRejectedValue(new Error("fail")),
    });
    renderDialog(fs, fileEntry, fileProperties);
    await waitFor(() =>
      expect(screen.getByText(/Failed to compute hash/i)).toBeTruthy(),
    );
  });
});
