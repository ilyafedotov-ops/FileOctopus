import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PreviewPanel,
  isTextPreviewable,
  isImagePreviewable,
  isPdfPreviewable,
  isMediaPreviewable,
  isPreviewable,
} from "../src/components/PreviewPanel";
import { PreviewToolbar } from "../src/components/PreviewToolbar";
import type {
  FileEntryDto,
  ReadFileAsDataUriResponse,
  ReadTextFileResponse,
} from "@fileoctopus/ts-api";

function makeEntry(overrides: Partial<FileEntryDto> = {}): FileEntryDto {
  return {
    uri: "file:///test/file.txt",
    name: "file.txt",
    kind: "file",
    ...overrides,
  };
}

function createMockFs() {
  return {
    readTextFile: vi.fn<() => Promise<ReadTextFileResponse>>(),
    readFileAsDataUri: vi.fn<() => Promise<ReadFileAsDataUriResponse>>(),
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ─── isTextPreviewable ───

describe("isTextPreviewable", () => {
  it("returns false for null", () => {
    expect(isTextPreviewable(null)).toBe(false);
  });

  it("returns false for directories", () => {
    expect(
      isTextPreviewable(makeEntry({ kind: "directory", name: "folder" })),
    ).toBe(false);
  });

  it("returns true for common text extensions", () => {
    const exts = [
      ".txt",
      ".md",
      ".json",
      ".yaml",
      ".yml",
      ".ts",
      ".tsx",
      ".py",
      ".rs",
      ".sh",
      ".html",
      ".css",
    ];
    for (const ext of exts) {
      expect(isTextPreviewable(makeEntry({ name: `test${ext}` }))).toBe(true);
    }
  });

  it("returns true for extensionless common filenames", () => {
    expect(isTextPreviewable(makeEntry({ name: "Makefile" }))).toBe(true);
    expect(isTextPreviewable(makeEntry({ name: "Dockerfile" }))).toBe(true);
    expect(isTextPreviewable(makeEntry({ name: "README" }))).toBe(true);
    expect(isTextPreviewable(makeEntry({ name: "LICENSE" }))).toBe(true);
  });

  it("returns false for binary extensions", () => {
    expect(isTextPreviewable(makeEntry({ name: "image.png" }))).toBe(false);
    expect(isTextPreviewable(makeEntry({ name: "archive.zip" }))).toBe(false);
    expect(isTextPreviewable(makeEntry({ name: "binary.exe" }))).toBe(false);
    expect(isTextPreviewable(makeEntry({ name: "data.db" }))).toBe(false);
  });

  it("returns false for unknown files without extension", () => {
    expect(isTextPreviewable(makeEntry({ name: "somebinarydata" }))).toBe(
      false,
    );
  });
});

// ─── PreviewPanel ───

describe("PreviewPanel", () => {
  it("renders nothing when entry is null", () => {
    const onClose = vi.fn();
    const mockFs = createMockFs();
    const { container } = render(
      <PreviewPanel entry={null} fs={mockFs} onClose={onClose} />,
    );
    expect(container.querySelector(".fo-preview-panel")).toBeNull();
  });

  it("renders nothing for non-previewable entry", () => {
    const onClose = vi.fn();
    const mockFs = createMockFs();
    const { container } = render(
      <PreviewPanel
        entry={makeEntry({ name: "archive.zip" })}
        fs={mockFs}
        onClose={onClose}
      />,
    );
    expect(container.querySelector(".fo-preview-panel")).toBeNull();
  });

  it("loads and displays file content", async () => {
    const mockFs = createMockFs();
    mockFs.readTextFile.mockResolvedValue({
      content: "hello world",
      truncated: false,
      byteSize: 11,
    });

    const onClose = vi.fn();
    const { container } = render(
      <PreviewPanel
        entry={makeEntry({ name: "readme.md" })}
        fs={mockFs}
        onClose={onClose}
      />,
    );

    // Should show loading first
    expect(container.querySelector(".fo-preview-loading")).toBeTruthy();

    // Wait for content
    await waitFor(() => {
      expect(screen.getByText("hello world")).toBeTruthy();
    });

    expect(mockFs.readTextFile).toHaveBeenCalledWith({
      uri: "file:///test/file.txt",
      maxBytes: 524288,
    });
  });

  it("shows error when readTextFile fails", async () => {
    const mockFs = createMockFs();
    mockFs.readTextFile.mockRejectedValue(new Error("Permission denied"));

    const onClose = vi.fn();
    render(
      <PreviewPanel
        entry={makeEntry({ name: "secret.txt" })}
        fs={mockFs}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Permission denied")).toBeTruthy();
    });
  });

  it("calls onClose when Escape is pressed", async () => {
    const mockFs = createMockFs();
    mockFs.readTextFile.mockResolvedValue({
      content: "data",
      truncated: false,
      byteSize: 4,
    });

    const onClose = vi.fn();
    render(
      <PreviewPanel
        entry={makeEntry({ name: "file.txt" })}
        fs={mockFs}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("data")).toBeTruthy();
    });

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when close button is clicked", async () => {
    const mockFs = createMockFs();
    mockFs.readTextFile.mockResolvedValue({
      content: "data",
      truncated: false,
      byteSize: 4,
    });

    const onClose = vi.fn();
    render(
      <PreviewPanel
        entry={makeEntry({ name: "file.txt" })}
        fs={mockFs}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("data")).toBeTruthy();
    });

    fireEvent.click(screen.getByTitle("Close preview (Esc)"));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows truncated indicator when file is too large", async () => {
    const mockFs = createMockFs();
    mockFs.readTextFile.mockResolvedValue({
      content: "a".repeat(100),
      truncated: true,
      byteSize: 600000,
    });

    const onClose = vi.fn();
    render(
      <PreviewPanel
        entry={makeEntry({ name: "big.log" })}
        fs={mockFs}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/truncated/)).toBeTruthy();
    });
  });
});

// ─── isImagePreviewable ───

describe("isImagePreviewable", () => {
  it("returns false for null", () => {
    expect(isImagePreviewable(null)).toBe(false);
  });

  it("returns false for directories", () => {
    expect(
      isImagePreviewable(makeEntry({ kind: "directory", name: "folder" })),
    ).toBe(false);
  });

  it("returns true for common image extensions", () => {
    const exts = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".ico"];
    for (const ext of exts) {
      expect(isImagePreviewable(makeEntry({ name: `image${ext}` }))).toBe(true);
    }
  });

  it("returns true for uppercase image extensions", () => {
    expect(isImagePreviewable(makeEntry({ name: "photo.PNG" }))).toBe(true);
    expect(isImagePreviewable(makeEntry({ name: "photo.JPG" }))).toBe(true);
  });

  it("returns false for non-image extensions", () => {
    expect(isImagePreviewable(makeEntry({ name: "file.txt" }))).toBe(false);
    expect(isImagePreviewable(makeEntry({ name: "archive.zip" }))).toBe(false);
    expect(isImagePreviewable(makeEntry({ name: "data.pdf" }))).toBe(false);
  });
});

// ─── isPdfPreviewable ───

describe("isPdfPreviewable", () => {
  it("returns false for null", () => {
    expect(isPdfPreviewable(null)).toBe(false);
  });

  it("returns false for directories", () => {
    expect(
      isPdfPreviewable(makeEntry({ kind: "directory", name: "folder" })),
    ).toBe(false);
  });

  it("returns true for .pdf extension", () => {
    expect(isPdfPreviewable(makeEntry({ name: "doc.pdf" }))).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isPdfPreviewable(makeEntry({ name: "report.PDF" }))).toBe(true);
    expect(isPdfPreviewable(makeEntry({ name: "manual.Pdf" }))).toBe(true);
  });

  it("returns false for non-PDF files", () => {
    expect(isPdfPreviewable(makeEntry({ name: "file.txt" }))).toBe(false);
    expect(isPdfPreviewable(makeEntry({ name: "photo.png" }))).toBe(false);
    expect(isPdfPreviewable(makeEntry({ name: "archive.zip" }))).toBe(false);
  });
});

// ─── isPreviewable (combined) ───

describe("isPreviewable", () => {
  it("returns true for text files", () => {
    expect(isPreviewable(makeEntry({ name: "readme.md" }))).toBe(true);
    expect(isPreviewable(makeEntry({ name: "script.ts" }))).toBe(true);
  });

  it("returns true for image files", () => {
    expect(isPreviewable(makeEntry({ name: "photo.png" }))).toBe(true);
    expect(isPreviewable(makeEntry({ name: "banner.jpg" }))).toBe(true);
  });

  it("returns true for PDF files", () => {
    expect(isPreviewable(makeEntry({ name: "document.pdf" }))).toBe(true);
  });

  it("returns false for non-previewable files", () => {
    expect(isPreviewable(makeEntry({ name: "archive.zip" }))).toBe(false);
    expect(isPreviewable(makeEntry({ name: "binary.exe" }))).toBe(false);
  });

  it("returns false for null", () => {
    expect(isPreviewable(null)).toBe(false);
  });
});

// ─── PreviewPanel image preview ───

describe("PreviewPanel image preview", () => {
  it("renders image preview for image files", async () => {
    const mockFs = createMockFs();
    mockFs.readFileAsDataUri.mockResolvedValue({
      dataUri: "data:image/png;base64,iVBOR",
      byteSize: 12345,
      mimeType: "image/png",
    });

    const onClose = vi.fn();
    const { container } = render(
      <PreviewPanel
        entry={makeEntry({
          name: "photo.png",
          uri: "local:///home/user/photo.png",
        })}
        fs={mockFs}
        onClose={onClose}
      />,
    );

    // Should show loading first
    expect(container.querySelector(".fo-preview-loading")).toBeTruthy();

    // Wait for image to load
    await waitFor(() => {
      const img = container.querySelector(
        ".fo-preview-image",
      ) as HTMLImageElement;
      expect(img).toBeTruthy();
      expect(img.src.indexOf("data:image/png;base64,iVBOR") !== -1).toBe(true);
    });

    expect(mockFs.readFileAsDataUri).toHaveBeenCalledWith({
      uri: "local:///home/user/photo.png",
      maxBytes: 20971520,
    });
  });

  it("shows error when image load fails", async () => {
    const mockFs = createMockFs();
    mockFs.readFileAsDataUri.mockRejectedValue(new Error("File too large"));

    const onClose = vi.fn();
    render(
      <PreviewPanel
        entry={makeEntry({ name: "big.png" })}
        fs={mockFs}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("File too large")).toBeTruthy();
    });
  });

  it("renders nothing for non-previewable image-like file", () => {
    const mockFs = createMockFs();
    const { container } = render(
      <PreviewPanel
        entry={makeEntry({ name: "file.raw" })}
        fs={mockFs}
        onClose={vi.fn()}
      />,
    );
    expect(container.querySelector(".fo-preview-panel")).toBeNull();
  });
});

// ─── isMediaPreviewable ───

describe("isMediaPreviewable", () => {
  it("returns false for null", () => {
    expect(isMediaPreviewable(null)).toBe(false);
  });

  it("returns false for directories", () => {
    expect(
      isMediaPreviewable(makeEntry({ kind: "directory", name: "folder" })),
    ).toBe(false);
  });

  it("returns true for audio extensions", () => {
    const exts = [".mp3", ".ogg", ".wav", ".flac", ".aac", ".m4a"];
    for (const ext of exts) {
      expect(isMediaPreviewable(makeEntry({ name: `audio${ext}` }))).toBe(true);
    }
  });

  it("returns true for video extensions", () => {
    const exts = [".mp4", ".webm", ".mkv", ".avi", ".mov"];
    for (const ext of exts) {
      expect(isMediaPreviewable(makeEntry({ name: `video${ext}` }))).toBe(true);
    }
  });

  it("returns false for non-media extensions", () => {
    expect(isMediaPreviewable(makeEntry({ name: "file.txt" }))).toBe(false);
    expect(isMediaPreviewable(makeEntry({ name: "photo.png" }))).toBe(false);
    expect(isMediaPreviewable(makeEntry({ name: "archive.zip" }))).toBe(false);
  });
});

// ─── isPreviewable with media ───

describe("isPreviewable includes media", () => {
  it("returns true for audio files", () => {
    expect(isPreviewable(makeEntry({ name: "song.mp3" }))).toBe(true);
    expect(isPreviewable(makeEntry({ name: "podcast.ogg" }))).toBe(true);
  });

  it("returns true for video files", () => {
    expect(isPreviewable(makeEntry({ name: "clip.mp4" }))).toBe(true);
    expect(isPreviewable(makeEntry({ name: "movie.webm" }))).toBe(true);
  });
});

// ─── PreviewPanel media preview ───

describe("PreviewPanel media preview", () => {
  it("renders audio element for mp3 files", async () => {
    const mockFs = createMockFs();
    mockFs.readFileAsDataUri.mockResolvedValue({
      dataUri: "data:audio/mpeg;base64,abc",
      byteSize: 54321,
      mimeType: "audio/mpeg",
    });

    const onClose = vi.fn();
    const { container } = render(
      <PreviewPanel
        entry={makeEntry({
          name: "song.mp3",
          uri: "local:///home/user/Music/song.mp3",
        })}
        fs={mockFs}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      const audio = container.querySelector(".fo-preview-audio");
      expect(audio).toBeTruthy();
      expect(audio?.tagName.toLowerCase()).toBe("audio");
    });

    expect(mockFs.readFileAsDataUri).toHaveBeenCalledWith({
      uri: "local:///home/user/Music/song.mp3",
      maxBytes: 20971520,
    });
  });

  it("renders video element for mp4 files", async () => {
    const mockFs = createMockFs();
    mockFs.readFileAsDataUri.mockResolvedValue({
      dataUri: "data:video/mp4;base64,abc",
      byteSize: 999999,
      mimeType: "video/mp4",
    });

    const onClose = vi.fn();
    const { container } = render(
      <PreviewPanel
        entry={makeEntry({
          name: "clip.mp4",
          uri: "local:///home/user/Videos/clip.mp4",
        })}
        fs={mockFs}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      const video = container.querySelector(".fo-preview-video");
      expect(video).toBeTruthy();
      expect(video?.tagName.toLowerCase()).toBe("video");
    });
  });

  it("shows error when media load fails", async () => {
    const mockFs = createMockFs();
    mockFs.readFileAsDataUri.mockRejectedValue(new Error("Too large"));

    const onClose = vi.fn();
    render(
      <PreviewPanel
        entry={makeEntry({ name: "big.mp4" })}
        fs={mockFs}
        onClose={onClose}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Too large")).toBeTruthy();
    });
  });
});

// ─── PreviewToolbar ───

describe("PreviewToolbar", () => {
  it("shows toolbar with zoom controls for image preview", () => {
    render(
      <PreviewToolbar
        mode="image"
        zoom={1}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onFit={vi.fn()}
        onActualSize={vi.fn()}
        onCopyContent={vi.fn()}
        onOpenExternally={vi.fn()}
        onCopyPath={vi.fn()}
      />,
    );
    expect(screen.getByRole("toolbar", { name: /preview/i })).toBeTruthy();
    expect(screen.getByLabelText("Zoom in")).toBeTruthy();
    expect(screen.getByLabelText("Zoom out")).toBeTruthy();
    expect(screen.getByLabelText("Fit to panel")).toBeTruthy();
    expect(screen.getByLabelText("Actual size")).toBeTruthy();
  });

  it("shows toolbar with text actions for text preview", () => {
    render(
      <PreviewToolbar
        mode="text"
        zoom={1}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onFit={vi.fn()}
        onActualSize={vi.fn()}
        onCopyContent={vi.fn()}
        onOpenExternally={vi.fn()}
        onCopyPath={vi.fn()}
      />,
    );
    expect(screen.getByRole("toolbar", { name: /preview/i })).toBeTruthy();
    expect(screen.getByLabelText("Copy content")).toBeTruthy();
  });

  it("shows open externally and copy path buttons for any preview", () => {
    render(
      <PreviewToolbar
        mode="image"
        zoom={1}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onFit={vi.fn()}
        onActualSize={vi.fn()}
        onCopyContent={vi.fn()}
        onOpenExternally={vi.fn()}
        onCopyPath={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Open externally")).toBeTruthy();
    expect(screen.getByLabelText("Copy path")).toBeTruthy();
  });

  it("displays current zoom level", () => {
    render(
      <PreviewToolbar
        mode="image"
        zoom={1.5}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onFit={vi.fn()}
        onActualSize={vi.fn()}
        onCopyContent={vi.fn()}
        onOpenExternally={vi.fn()}
        onCopyPath={vi.fn()}
      />,
    );
    expect(screen.getByText("150%")).toBeTruthy();
  });

  it("does not show zoom controls for text mode", () => {
    render(
      <PreviewToolbar
        mode="text"
        zoom={1}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onFit={vi.fn()}
        onActualSize={vi.fn()}
        onCopyContent={vi.fn()}
        onOpenExternally={vi.fn()}
        onCopyPath={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("Zoom in")).toBeNull();
    expect(screen.queryByLabelText("Zoom out")).toBeNull();
  });

  it("calls onZoomIn when Zoom in is clicked", () => {
    const onZoomIn = vi.fn();
    render(
      <PreviewToolbar
        mode="image"
        zoom={1}
        onZoomIn={onZoomIn}
        onZoomOut={vi.fn()}
        onFit={vi.fn()}
        onActualSize={vi.fn()}
        onCopyContent={vi.fn()}
        onOpenExternally={vi.fn()}
        onCopyPath={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText("Zoom in"));
    expect(onZoomIn).toHaveBeenCalledTimes(1);
  });

  it("calls onCopyContent when Copy content is clicked", () => {
    const onCopyContent = vi.fn();
    render(
      <PreviewToolbar
        mode="text"
        zoom={1}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onFit={vi.fn()}
        onActualSize={vi.fn()}
        onCopyContent={onCopyContent}
        onOpenExternally={vi.fn()}
        onCopyPath={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText("Copy content"));
    expect(onCopyContent).toHaveBeenCalledTimes(1);
  });
});

// ─── PreviewPanel toolbar integration ───

describe("PreviewPanel toolbar integration", () => {
  it("shows toolbar with zoom controls for image preview", async () => {
    const mockFs = createMockFs();
    mockFs.readFileAsDataUri.mockResolvedValue({
      dataUri: "data:image/png;base64,iVBOR",
      byteSize: 12345,
      mimeType: "image/png",
    });

    render(
      <PreviewPanel
        entry={makeEntry({
          name: "photo.png",
          uri: "local:///home/user/photo.png",
        })}
        fs={mockFs}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("toolbar", { name: /preview/i })).toBeTruthy();
    });
    expect(screen.getByLabelText("Zoom in")).toBeTruthy();
    expect(screen.getByLabelText("Zoom out")).toBeTruthy();
    expect(screen.getByLabelText("Fit to panel")).toBeTruthy();
    expect(screen.getByLabelText("Actual size")).toBeTruthy();
  });

  it("shows toolbar with copy content for text preview", async () => {
    const mockFs = createMockFs();
    mockFs.readTextFile.mockResolvedValue({
      content: "hello world",
      truncated: false,
      byteSize: 11,
    });

    render(
      <PreviewPanel
        entry={makeEntry({ name: "readme.md" })}
        fs={mockFs}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("toolbar", { name: /preview/i })).toBeTruthy();
    });
    expect(screen.getByLabelText("Copy content")).toBeTruthy();
  });

  it("shows open externally and copy path buttons for any preview", async () => {
    const mockFs = createMockFs();
    mockFs.readFileAsDataUri.mockResolvedValue({
      dataUri: "data:image/png;base64,iVBOR",
      byteSize: 12345,
      mimeType: "image/png",
    });

    render(
      <PreviewPanel
        entry={makeEntry({
          name: "photo.png",
          uri: "local:///home/user/photo.png",
        })}
        fs={mockFs}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Open externally")).toBeTruthy();
    });
    expect(screen.getByLabelText("Copy path")).toBeTruthy();
  });

  it("zoom in increases zoom level", async () => {
    const mockFs = createMockFs();
    mockFs.readFileAsDataUri.mockResolvedValue({
      dataUri: "data:image/png;base64,iVBOR",
      byteSize: 12345,
      mimeType: "image/png",
    });

    render(
      <PreviewPanel
        entry={makeEntry({
          name: "photo.png",
          uri: "local:///home/user/photo.png",
        })}
        fs={mockFs}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("img")).toBeTruthy();
    });

    fireEvent.click(screen.getByLabelText("Zoom in"));
    // Verify zoom state changed — the image should have a transform style
    const img = screen.getByRole("img");
    expect(img.style.transform).toBeTruthy();
    expect(img.style.transform).toContain("scale(1.25)");
  });

  it("zoom out decreases zoom level", async () => {
    const mockFs = createMockFs();
    mockFs.readFileAsDataUri.mockResolvedValue({
      dataUri: "data:image/png;base64,iVBOR",
      byteSize: 12345,
      mimeType: "image/png",
    });

    render(
      <PreviewPanel
        entry={makeEntry({
          name: "photo.png",
          uri: "local:///home/user/photo.png",
        })}
        fs={mockFs}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("img")).toBeTruthy();
    });

    fireEvent.click(screen.getByLabelText("Zoom out"));
    const img = screen.getByRole("img");
    expect(img.style.transform).toContain("scale(0.75)");
  });

  it("actual size resets zoom to 1", async () => {
    const mockFs = createMockFs();
    mockFs.readFileAsDataUri.mockResolvedValue({
      dataUri: "data:image/png;base64,iVBOR",
      byteSize: 12345,
      mimeType: "image/png",
    });

    render(
      <PreviewPanel
        entry={makeEntry({
          name: "photo.png",
          uri: "local:///home/user/photo.png",
        })}
        fs={mockFs}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("img")).toBeTruthy();
    });

    fireEvent.click(screen.getByLabelText("Zoom in"));
    fireEvent.click(screen.getByLabelText("Actual size"));
    const img = screen.getByRole("img");
    expect(img.style.transform).toContain("scale(1)");
  });
});
