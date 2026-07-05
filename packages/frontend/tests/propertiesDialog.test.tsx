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

describe("PropertiesDialog permissions section", () => {
  it("renders the ACL editor expanded by default", async () => {
    const fs = makeFs();
    renderDialog(fs, fileEntry, fileProperties);

    await waitFor(() =>
      expect(fs.getAcl as ReturnType<typeof vi.fn>).toHaveBeenCalledWith({
        uri: "local:///tmp/file.txt",
      }),
    );
    // The octal input is part of the AclEditor and only rendered once the
    // Permissions section is open and the ACL has loaded.
    await waitFor(() =>
      expect(screen.getByLabelText(/Permission octal notation/i)).toBeTruthy(),
    );
    expect(
      (screen.getByLabelText(/Permission octal notation/i) as HTMLInputElement)
        .value,
    ).toBe("644");
  });
});

describe("PropertiesDialog hero thumbnail", () => {
  const imageEntry: FileEntryDto = {
    uri: "local:///tmp/pic.png",
    name: "pic.png",
    kind: "file",
  } as FileEntryDto;

  const imageProperties: PathPropertiesDto = {
    uri: "local:///tmp/pic.png",
    name: "pic.png",
    kind: "file",
    size: 1024,
    isHidden: false,
    isSymlink: false,
    readonly: false,
    warnings: [],
  } as PathPropertiesDto;

  it("renders an image thumbnail for previewable images", async () => {
    const readFileAsDataUri = vi.fn().mockResolvedValue({
      dataUri: "data:image/png;base64,iVBORw0KGgo=",
      byteSize: 1024,
    });
    const fs = makeFs({ readFileAsDataUri });
    renderDialog(fs, imageEntry, imageProperties);

    await waitFor(() =>
      expect(readFileAsDataUri).toHaveBeenCalledWith(
        expect.objectContaining({ uri: "local:///tmp/pic.png" }),
      ),
    );
    const img = await screen.findByAltText("pic.png");
    expect((img as HTMLImageElement).src).toContain("data:image/png");
  });

  it("does not request a thumbnail for non-image files", () => {
    const readFileAsDataUri = vi.fn();
    const fs = makeFs({ readFileAsDataUri });
    renderDialog(fs, fileEntry, fileProperties);
    expect(readFileAsDataUri).not.toHaveBeenCalled();
    expect(screen.queryByAltText("file.txt")).toBeNull();
  });
});

describe("PropertiesDialog EXIF section", () => {
  it("renders curated EXIF metadata when present", () => {
    const exifImageEntry: FileEntryDto = {
      uri: "local:///tmp/photo.jpg",
      name: "photo.jpg",
      kind: "file",
    } as FileEntryDto;
    const exifImageProperties: PathPropertiesDto = {
      uri: "local:///tmp/photo.jpg",
      name: "photo.jpg",
      kind: "file",
      size: 2048,
      isHidden: false,
      isSymlink: false,
      readonly: false,
      warnings: [],
    } as PathPropertiesDto;

    renderDialog(
      makeFs({
        readFileAsDataUri: vi.fn().mockResolvedValue({
          dataUri: "data:image/jpeg;base64,/9j/",
          byteSize: 2048,
        }),
      }),
      exifImageEntry,
      {
        ...exifImageProperties,
        exif: {
          cameraMake: "Canon",
          cameraModel: "EOS R5",
          lensModel: null,
          dateTaken: "2024-05-12T10:30:00Z",
          width: 8192,
          height: 5464,
          orientation: "Horizontal",
          exposureTime: "1/125",
          fNumber: "f/2.8",
          iso: 400,
          focalLength: "50 mm",
          gpsLatitude: null,
          gpsLongitude: null,
          tags: [
            {
              group: "Exif",
              tag: "FNumber",
              label: "FNumber",
              value: "f/2.8",
            },
          ],
          warnings: [],
        },
      } as PathPropertiesDto,
    );

    expect(screen.getByText("EXIF")).toBeTruthy();
    expect(screen.getByText("Canon EOS R5")).toBeTruthy();
    expect(screen.getByText("8192 × 5464")).toBeTruthy();
    expect(screen.getByText("f/2.8")).toBeTruthy();
  });
});
