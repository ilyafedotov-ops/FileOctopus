import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { FileEntryDto } from "@fileoctopus/ts-api";
import { TagProvider, useTags } from "../src/app/TagContext";
import { FileRow } from "../src/pane/FileRow";

afterEach(cleanup);

// Clear tag storage between tests
beforeEach(() => {
  localStorage.removeItem("fo-file-tags");
});

function makeEntry(overrides: Partial<FileEntryDto> = {}): FileEntryDto {
  return {
    name: "test.txt",
    uri: "local:///home/user/test.txt",
    kind: "file",
    size: 1024,
    extension: "txt",
    modifiedAt: "2026-01-01T00:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
    isHidden: false,
    providerId: "local",
    canRead: true,
    canWrite: true,
    canDelete: true,
    canRename: true,
    canList: true,
    isSymlink: false,
    symlinkTarget: null,
    ...overrides,
  };
}

function TagBadgeTester() {
  const { tags, assignTag, tagColorsForEntry } = useTags();
  const entry = makeEntry();
  const colors = tagColorsForEntry(entry.uri);

  return (
    <div>
      <div data-testid="tag-count">{tags.length}</div>
      <div data-testid="entry-colors">{colors.join(",")}</div>
      <button
        data-testid="add-red"
        onClick={() => assignTag(entry.uri, "red", "Important")}
      >
        Add Red
      </button>
      <button
        data-testid="add-blue"
        onClick={() => assignTag(entry.uri, "blue", "Work")}
      >
        Add Blue
      </button>
      <FileRow
        entry={entry}
        top={0}
        rowHeight={20}
        viewMode="details"
        selected={false}
        multiSelected={false}
        focused={false}
        tagColors={colors}
        onSelect={() => {}}
        onEntrySelect={() => {}}
        onEntryActivate={() => {}}
        onContextMenu={() => {}}
      />
    </div>
  );
}

describe("Tag integration", () => {
  it("renders FileRow without tags initially", () => {
    render(
      <TagProvider>
        <TagBadgeTester />
      </TagProvider>,
    );
    expect(screen.getByTestId("tag-count").textContent).toBe("0");
    expect(screen.getByTestId("entry-colors").textContent).toBe("");
    expect(screen.queryByTitle("Tag: red")).toBeNull();
  });

  it("assigns a tag and shows badge on FileRow", () => {
    render(
      <TagProvider>
        <TagBadgeTester />
      </TagProvider>,
    );

    fireEvent.click(screen.getByTestId("add-red"));
    expect(screen.getByTestId("tag-count").textContent).toBe("1");
    expect(screen.getByTestId("entry-colors").textContent).toBe("red");
    expect(screen.getByTitle("Tag: red")).toBeTruthy();
  });

  it("assigns multiple tags and shows multiple badges", () => {
    render(
      <TagProvider>
        <TagBadgeTester />
      </TagProvider>,
    );

    fireEvent.click(screen.getByTestId("add-red"));
    fireEvent.click(screen.getByTestId("add-blue"));
    expect(screen.getByTestId("tag-count").textContent).toBe("2");
    expect(screen.getByTestId("entry-colors").textContent).toBe("red,blue");
    expect(screen.getByTitle("Tag: red")).toBeTruthy();
    expect(screen.getByTitle("Tag: blue")).toBeTruthy();
  });

  it("prevents duplicate color tag for same URI", () => {
    render(
      <TagProvider>
        <TagBadgeTester />
      </TagProvider>,
    );

    fireEvent.click(screen.getByTestId("add-red"));
    fireEvent.click(screen.getByTestId("add-red"));
    expect(screen.getByTestId("tag-count").textContent).toBe("1");
  });

  it("FileRow renders tag badge with correct CSS class", () => {
    render(
      <TagProvider>
        <TagBadgeTester />
      </TagProvider>,
    );

    fireEvent.click(screen.getByTestId("add-red"));
    const badge = screen.getByTitle("Tag: red");
    expect(badge.className.indexOf("fo-row-tag-red") !== -1).toBe(true);
  });
});
