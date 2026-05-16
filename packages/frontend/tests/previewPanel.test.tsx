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
} from "../src/components/PreviewPanel";
import type { FileEntryDto, ReadTextFileResponse } from "@fileoctopus/ts-api";

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
        entry={makeEntry({ name: "image.png" })}
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
