import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ViewerDialog } from "../src/components/viewer/ViewerDialog";
import type { FileEntryDto, FsClient } from "@fileoctopus/ts-api";

afterEach(cleanup);

function makeMockFs() {
  return {
    readImageAsDataUri: vi.fn().mockResolvedValue({
      dataUri: "data:image/png;base64,abc",
      byteSize: 5000,
    }),
    readTextFile: vi
      .fn()
      .mockResolvedValue({ content: "hello", truncated: false, byteSize: 5 }),
  } as unknown as FsClient;
}

function makeEntry(overrides: Partial<FileEntryDto> = {}): FileEntryDto {
  return {
    name: "photo.jpg",
    uri: "local:///home/user/photo.jpg",
    kind: "file",
    size: 5000,
    extension: ".jpg",
    modifiedAt: "2026-01-15T10:30:00Z",
    createdAt: "2026-01-14T08:00:00Z",
    ...overrides,
  };
}

function makeSiblingEntries(): FileEntryDto[] {
  return [
    makeEntry({ name: "alpha.jpg", uri: "local:///home/user/alpha.jpg" }),
    makeEntry({ name: "photo.jpg", uri: "local:///home/user/photo.jpg" }),
    makeEntry({ name: "zeta.png", uri: "local:///home/user/zeta.png" }),
  ];
}

describe("ViewerDialog gallery navigation", () => {
  it("renders prev/next buttons when siblings provided", () => {
    const fs = makeMockFs();
    const entry = makeEntry();
    const siblings = makeSiblingEntries();
    render(
      <ViewerDialog
        open={true}
        entry={entry}
        fs={fs}
        siblings={siblings}
        onClose={() => {}}
      />,
    );
    // Should find prev and next buttons
    const prevBtn = screen.getByLabelText("Previous image");
    const nextBtn = screen.getByLabelText("Next image");
    expect(prevBtn).toBeTruthy();
    expect(nextBtn).toBeTruthy();
  });

  it("calls onNavigate with previous entry when prev clicked", () => {
    const fs = makeMockFs();
    const entry = makeEntry();
    const siblings = makeSiblingEntries();
    const onNavigate = vi.fn();
    render(
      <ViewerDialog
        open={true}
        entry={entry}
        fs={fs}
        siblings={siblings}
        onNavigate={onNavigate}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByLabelText("Previous image"));
    // photo.jpg is index 1, prev should be alpha.jpg at index 0
    expect(onNavigate).toHaveBeenCalledWith(siblings[0]);
  });

  it("calls onNavigate with next entry when next clicked", () => {
    const fs = makeMockFs();
    const entry = makeEntry();
    const siblings = makeSiblingEntries();
    const onNavigate = vi.fn();
    render(
      <ViewerDialog
        open={true}
        entry={entry}
        fs={fs}
        siblings={siblings}
        onNavigate={onNavigate}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByLabelText("Next image"));
    // photo.jpg is index 1, next should be zeta.png at index 2
    expect(onNavigate).toHaveBeenCalledWith(siblings[2]);
  });

  it("does not render prev/next when no siblings provided", () => {
    const fs = makeMockFs();
    const entry = makeEntry();
    render(
      <ViewerDialog open={true} entry={entry} fs={fs} onClose={() => {}} />,
    );
    expect(screen.queryByLabelText("Previous image")).toBeNull();
    expect(screen.queryByLabelText("Next image")).toBeNull();
  });

  it("disables prev button at first image", () => {
    const fs = makeMockFs();
    const siblings = makeSiblingEntries();
    const entry = siblings[0]; // alpha.jpg — first
    render(
      <ViewerDialog
        open={true}
        entry={entry}
        fs={fs}
        siblings={siblings}
        onClose={() => {}}
      />,
    );
    const prevBtn = screen.getByLabelText(
      "Previous image",
    ) as HTMLButtonElement;
    expect(prevBtn.disabled).toBe(true);
  });

  it("disables next button at last image", () => {
    const fs = makeMockFs();
    const siblings = makeSiblingEntries();
    const entry = siblings[2]; // zeta.png — last
    render(
      <ViewerDialog
        open={true}
        entry={entry}
        fs={fs}
        siblings={siblings}
        onClose={() => {}}
      />,
    );
    const nextBtn = screen.getByLabelText("Next image") as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);
  });
});
