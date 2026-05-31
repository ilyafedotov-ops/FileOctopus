import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FilterInput,
  RecursiveSearchInput,
  RecursiveSearchPanel,
} from "../src/pane/PaneFilterBar";

import React from "react";

const { SearchInputMock } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require("react");
  return {
    SearchInputMock: R.forwardRef(
      (props: Record<string, unknown>, ref: React.Ref<HTMLInputElement>) =>
        R.createElement("input", { ...props, ref }),
    ),
  };
});

vi.mock("@fileoctopus/ui", () => ({
  SearchInput: SearchInputMock,
}));

vi.mock("../src/pane/fileTableUtils", () => ({
  fileIconGlyph: () => "📄",
}));

vi.mock("../src/utils/paneUtils", () => ({
  localPathFromUri: (uri: string) => uri.replace("local://", ""),
  searchMatchToEntry: (match: Record<string, unknown>) => ({
    uri: match.uri,
    name: match.name,
    kind: match.kind,
    size: match.size ?? 0,
    modifiedAt: match.modifiedAt ?? null,
    isHidden: false,
    isSymlink: false,
    providerId: "local",
    canRead: true,
    canList: match.kind === "directory",
    canWrite: true,
    canDelete: true,
    canRename: true,
  }),
}));

afterEach(cleanup);

describe("FilterInput", () => {
  it("renders with correct aria-label", () => {
    render(
      <FilterInput
        panelId="left"
        active={true}
        value=""
        focusToken={0}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("left filter")).toBeTruthy();
  });

  it("renders with placeholder text", () => {
    render(
      <FilterInput
        panelId="left"
        active={true}
        value=""
        focusToken={0}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText("Filter current folder…")).toBeTruthy();
  });

  it("displays the current value", () => {
    render(
      <FilterInput
        panelId="left"
        active={true}
        value="test"
        focusToken={0}
        onChange={vi.fn()}
      />,
    );
    const input = screen.getByLabelText("left filter") as HTMLInputElement;
    expect(input.value).toBe("test");
  });

  it("calls onChange when input value changes", () => {
    const onChange = vi.fn();
    render(
      <FilterInput
        panelId="left"
        active={true}
        value=""
        focusToken={0}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("left filter"), {
      target: { value: "abc" },
    });
    expect(onChange).toHaveBeenCalledWith("abc");
  });

  it("applies fo-filter className", () => {
    render(
      <FilterInput
        panelId="left"
        active={true}
        value=""
        focusToken={0}
        onChange={vi.fn()}
      />,
    );
    const input = screen.getByLabelText("left filter");
    expect(input.classList.contains("fo-filter")).toBe(true);
  });
});

describe("RecursiveSearchInput", () => {
  it("renders with correct aria-label", () => {
    render(
      <RecursiveSearchInput
        panelId="right"
        active={true}
        value=""
        focusToken={0}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("right recursive search")).toBeTruthy();
  });

  it("renders with placeholder text", () => {
    render(
      <RecursiveSearchInput
        panelId="right"
        active={true}
        value=""
        focusToken={0}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText("Search recursively…")).toBeTruthy();
  });

  it("displays the current value", () => {
    render(
      <RecursiveSearchInput
        panelId="right"
        active={true}
        value="query"
        focusToken={0}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    const input = screen.getByLabelText(
      "right recursive search",
    ) as HTMLInputElement;
    expect(input.value).toBe("query");
  });

  it("calls onChange when input value changes", () => {
    const onChange = vi.fn();
    render(
      <RecursiveSearchInput
        panelId="right"
        active={true}
        value=""
        focusToken={0}
        onChange={onChange}
        onSubmit={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("right recursive search"), {
      target: { value: "search" },
    });
    expect(onChange).toHaveBeenCalledWith("search");
  });

  it("calls onSubmit on Enter key", () => {
    const onSubmit = vi.fn();
    render(
      <RecursiveSearchInput
        panelId="right"
        active={true}
        value="query"
        focusToken={0}
        onChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.keyDown(screen.getByLabelText("right recursive search"), {
      key: "Enter",
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("prevents default on Enter key", () => {
    const onSubmit = vi.fn();
    render(
      <RecursiveSearchInput
        panelId="right"
        active={true}
        value="query"
        focusToken={0}
        onChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    const input = screen.getByLabelText("right recursive search");
    const event = createEvent.keyDown(input, { key: "Enter" });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");
    fireEvent(input, event);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it("does not call onSubmit on non-Enter keys", () => {
    const onSubmit = vi.fn();
    render(
      <RecursiveSearchInput
        panelId="right"
        active={true}
        value="query"
        focusToken={0}
        onChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.keyDown(screen.getByLabelText("right recursive search"), {
      key: "Escape",
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("applies fo-recursive-search className", () => {
    render(
      <RecursiveSearchInput
        panelId="right"
        active={true}
        value=""
        focusToken={0}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    const input = screen.getByLabelText("right recursive search");
    expect(input.classList.contains("fo-recursive-search")).toBe(true);
  });
});

describe("RecursiveSearchPanel", () => {
  function makeSearch(overrides: Record<string, unknown> = {}) {
    return {
      panelId: "left" as const,
      query: "test",
      running: false,
      jobId: null,
      result: null,
      error: null,
      ...overrides,
    };
  }

  it("returns null when search is null", () => {
    const { container } = render(
      <RecursiveSearchPanel
        panelId="left"
        search={null}
        onOpen={vi.fn()}
        onReveal={vi.fn()}
        onProperties={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows 'Searching' when search is running", () => {
    render(
      <RecursiveSearchPanel
        panelId="left"
        search={makeSearch({ running: true })}
        onOpen={vi.fn()}
        onReveal={vi.fn()}
        onProperties={vi.fn()}
      />,
    );
    expect(screen.getByText("Searching")).toBeTruthy();
  });

  it("shows result count when search has completed", () => {
    render(
      <RecursiveSearchPanel
        panelId="left"
        search={makeSearch({
          result: {
            matches: [
              {
                uri: "local:///a",
                parentUri: "local:///",
                name: "a",
                kind: "file",
                size: 0,
                modifiedAt: null,
              },
              {
                uri: "local:///b",
                parentUri: "local:///",
                name: "b",
                kind: "file",
                size: 0,
                modifiedAt: null,
              },
            ],
            incomplete: false,
          },
        })}
        onOpen={vi.fn()}
        onReveal={vi.fn()}
        onProperties={vi.fn()}
      />,
    );
    expect(screen.getByText("2 result(s)")).toBeTruthy();
  });

  it("shows 'No recursive matches' when no results and not running", () => {
    render(
      <RecursiveSearchPanel
        panelId="left"
        search={makeSearch({ result: { matches: [], incomplete: false } })}
        onOpen={vi.fn()}
        onReveal={vi.fn()}
        onProperties={vi.fn()}
      />,
    );
    expect(screen.getByText("No recursive matches")).toBeTruthy();
  });

  it("does not show 'No recursive matches' while running", () => {
    render(
      <RecursiveSearchPanel
        panelId="left"
        search={makeSearch({ running: true, result: null })}
        onOpen={vi.fn()}
        onReveal={vi.fn()}
        onProperties={vi.fn()}
      />,
    );
    expect(screen.queryByText("No recursive matches")).toBeNull();
  });

  it("renders match rows", () => {
    render(
      <RecursiveSearchPanel
        panelId="left"
        search={makeSearch({
          result: {
            matches: [
              {
                uri: "local:///home/a.txt",
                parentUri: "local:///home",
                name: "a.txt",
                kind: "file",
                size: 10,
                modifiedAt: null,
              },
            ],
            incomplete: false,
          },
        })}
        onOpen={vi.fn()}
        onReveal={vi.fn()}
        onProperties={vi.fn()}
      />,
    );
    expect(screen.getByText(/a\.txt/)).toBeTruthy();
    expect(screen.getByText("Open")).toBeTruthy();
    expect(screen.getByText("Reveal")).toBeTruthy();
    expect(screen.getByText("Properties")).toBeTruthy();
  });

  it("calls onOpen when Open button is clicked", () => {
    const onOpen = vi.fn();
    render(
      <RecursiveSearchPanel
        panelId="left"
        search={makeSearch({
          result: {
            matches: [
              {
                uri: "local:///home/a.txt",
                parentUri: "local:///home",
                name: "a.txt",
                kind: "file",
                size: 10,
                modifiedAt: null,
              },
            ],
            incomplete: false,
          },
        })}
        onOpen={onOpen}
        onReveal={vi.fn()}
        onProperties={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Open"));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0][0].name).toBe("a.txt");
  });

  it("calls onReveal when Reveal button is clicked", () => {
    const onReveal = vi.fn();
    render(
      <RecursiveSearchPanel
        panelId="left"
        search={makeSearch({
          result: {
            matches: [
              {
                uri: "local:///home/a.txt",
                parentUri: "local:///home",
                name: "a.txt",
                kind: "file",
                size: 10,
                modifiedAt: null,
              },
            ],
            incomplete: false,
          },
        })}
        onOpen={vi.fn()}
        onReveal={onReveal}
        onProperties={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Reveal"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("calls onProperties when Properties button is clicked", () => {
    const onProperties = vi.fn();
    render(
      <RecursiveSearchPanel
        panelId="left"
        search={makeSearch({
          result: {
            matches: [
              {
                uri: "local:///home/a.txt",
                parentUri: "local:///home",
                name: "a.txt",
                kind: "file",
                size: 10,
                modifiedAt: null,
              },
            ],
            incomplete: false,
          },
        })}
        onOpen={vi.fn()}
        onReveal={vi.fn()}
        onProperties={onProperties}
      />,
    );
    fireEvent.click(screen.getByText("Properties"));
    expect(onProperties).toHaveBeenCalledTimes(1);
  });

  it("shows error when search has error", () => {
    render(
      <RecursiveSearchPanel
        panelId="left"
        search={makeSearch({ error: "Permission denied" })}
        onOpen={vi.fn()}
        onReveal={vi.fn()}
        onProperties={vi.fn()}
      />,
    );
    expect(screen.getByText("Permission denied")).toBeTruthy();
  });

  it("shows incomplete message when result is incomplete", () => {
    render(
      <RecursiveSearchPanel
        panelId="left"
        search={makeSearch({
          result: {
            matches: [],
            incomplete: true,
          },
        })}
        onOpen={vi.fn()}
        onReveal={vi.fn()}
        onProperties={vi.fn()}
      />,
    );
    expect(
      screen.getByText("Some folders could not be searched."),
    ).toBeTruthy();
  });

  it("does not show incomplete message when result is complete", () => {
    render(
      <RecursiveSearchPanel
        panelId="left"
        search={makeSearch({
          result: { matches: [], incomplete: false },
        })}
        onOpen={vi.fn()}
        onReveal={vi.fn()}
        onProperties={vi.fn()}
      />,
    );
    expect(
      screen.queryByText("Some folders could not be searched."),
    ).toBeNull();
  });

  it("renders at most 50 matches", () => {
    const matches = Array.from({ length: 55 }, (_, i) => ({
      uri: `local:///file${i}`,
      parentUri: "local:///",
      name: `file${i}`,
      kind: "file" as const,
      size: 0,
      modifiedAt: null,
    }));

    render(
      <RecursiveSearchPanel
        panelId="left"
        search={makeSearch({ result: { matches, incomplete: false } })}
        onOpen={vi.fn()}
        onReveal={vi.fn()}
        onProperties={vi.fn()}
      />,
    );

    const rows = document.querySelectorAll(".fo-search-row");
    expect(rows.length).toBe(50);
  });
});
