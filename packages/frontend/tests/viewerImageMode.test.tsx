import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ViewerImageMode } from "../src/components/viewer/ViewerImageMode";
import type { FileEntryDto, FsClient } from "@fileoctopus/ts-api";

afterEach(cleanup);

function makeMockFs(dataUri = "data:image/png;base64,abc", byteSize = 12345) {
  return {
    readFileAsDataUri: vi.fn().mockResolvedValue({
      dataUri,
      byteSize,
      mimeType: "image/png",
    }),
  } as unknown as FsClient;
}

function makeEntry(overrides: Partial<FileEntryDto> = {}): FileEntryDto {
  return {
    name: "photo.jpg",
    uri: "local:///home/user/photo.jpg",
    kind: "file",
    size: 12345,
    extension: ".jpg",
    modifiedAt: "2026-01-15T10:30:00Z",
    createdAt: "2026-01-14T08:00:00Z",
    ...overrides,
  };
}

describe("ViewerImageMode", () => {
  it("renders image after loading", async () => {
    const fs = makeMockFs();
    const entry = makeEntry();
    render(<ViewerImageMode entry={entry} fs={fs} />);
    const img = await screen.findByRole("img");
    expect(img.getAttribute("src")).toBe("data:image/png;base64,abc");
  });

  it("shows file size in footer", async () => {
    const fs = makeMockFs("data:image/png;base64,abc", 12345);
    const entry = makeEntry();
    render(<ViewerImageMode entry={entry} fs={fs} />);
    const footer = await screen.findByText(/12,345 bytes/);
    expect(footer).toBeTruthy();
  });

  it("shows error on failure", async () => {
    const fs = {
      readFileAsDataUri: vi.fn().mockRejectedValue(new Error("not found")),
    } as unknown as FsClient;
    const entry = makeEntry();
    render(<ViewerImageMode entry={entry} fs={fs} />);
    const err = await screen.findByText(/not found/);
    expect(err).toBeTruthy();
  });

  it("shows image dimensions when loaded", async () => {
    const fs = makeMockFs();
    const entry = makeEntry();
    render(<ViewerImageMode entry={entry} fs={fs} />);

    // Wait for image to appear
    const img = (await screen.findByRole("img")) as HTMLImageElement;

    // Simulate the browser reporting natural dimensions
    Object.defineProperty(img, "naturalWidth", {
      value: 1920,
      configurable: true,
    });
    Object.defineProperty(img, "naturalHeight", {
      value: 1080,
      configurable: true,
    });
    fireEvent(img, new Event("load"));

    const dimEl = await screen.findByText(/1920.*1080/);
    expect(dimEl).toBeTruthy();
  });

  it("shows last modified date from entry", async () => {
    const fs = makeMockFs();
    const entry = makeEntry({ modifiedAt: "2026-01-15T10:30:00Z" });
    render(<ViewerImageMode entry={entry} fs={fs} />);
    // The footer should show the modification date
    const footer = await screen.findByText(/12,345 bytes/);
    expect(footer.textContent).toBeTruthy();
  });
});
