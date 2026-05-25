import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ViewerMediaMode } from "../src/components/viewer/ViewerMediaMode";
import type { FileEntryDto, FsClient } from "@fileoctopus/ts-api";

afterEach(cleanup);

function makeMockFs(dataUri = "data:audio/mpeg;base64,abc", byteSize = 54321) {
  return {
    readImageAsDataUri: vi.fn().mockResolvedValue({ dataUri, byteSize }),
  } as unknown as FsClient;
}

function makeEntry(overrides: Partial<FileEntryDto> = {}): FileEntryDto {
  return {
    name: "song.mp3",
    uri: "local:///home/user/Music/song.mp3",
    kind: "file",
    size: 54321,
    extension: ".mp3",
    modifiedAt: "2026-01-15T10:30:00Z",
    createdAt: "2026-01-14T08:00:00Z",
    ...overrides,
  };
}

describe("ViewerMediaMode", () => {
  it("renders audio element for mp3 files", async () => {
    const fs = makeMockFs("data:audio/mpeg;base64,abc", 54321);
    const entry = makeEntry({ name: "song.mp3", extension: ".mp3" });
    render(<ViewerMediaMode entry={entry} fs={fs} />);
    const audio = await screen.findByTestId("viewer-audio");
    expect(audio).toBeTruthy();
    expect(audio.tagName.toLowerCase()).toBe("audio");
    expect(audio.getAttribute("src")).toBeTruthy();
  });

  it("renders video element for mp4 files", async () => {
    const fs = makeMockFs("data:video/mp4;base64,abc", 999999);
    const entry = makeEntry({
      name: "clip.mp4",
      extension: ".mp4",
      uri: "local:///home/user/Videos/clip.mp4",
    });
    render(<ViewerMediaMode entry={entry} fs={fs} />);
    const video = await screen.findByTestId("viewer-video");
    expect(video).toBeTruthy();
    expect(video.tagName.toLowerCase()).toBe("video");
  });

  it("shows file size in footer", async () => {
    const fs = makeMockFs("data:audio/mpeg;base64,abc", 54321);
    const entry = makeEntry();
    render(<ViewerMediaMode entry={entry} fs={fs} />);
    const footer = await screen.findByText(/54,321 bytes/);
    expect(footer).toBeTruthy();
  });

  it("shows loading state initially", () => {
    const fs = {
      readImageAsDataUri: vi.fn().mockReturnValue(new Promise(() => {})),
    } as unknown as FsClient;
    const entry = makeEntry();
    render(<ViewerMediaMode entry={entry} fs={fs} />);
    expect(screen.getByText("Loading media…")).toBeTruthy();
  });

  it("shows error on failure", async () => {
    const fs = {
      readImageAsDataUri: vi.fn().mockRejectedValue(new Error("read error")),
    } as unknown as FsClient;
    const entry = makeEntry();
    render(<ViewerMediaMode entry={entry} fs={fs} />);
    const err = await screen.findByText(/read error/);
    expect(err).toBeTruthy();
  });

  it("shows filename in header", async () => {
    const fs = makeMockFs();
    const entry = makeEntry({ name: "mysong.mp3" });
    render(<ViewerMediaMode entry={entry} fs={fs} />);
    const name = await screen.findByText("mysong.mp3");
    expect(name).toBeTruthy();
  });
});
