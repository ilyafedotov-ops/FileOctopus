import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ContentSearchPanel,
  ContentSearchInput,
  type ContentSearchState,
} from "../src/pane/ContentSearchPanel";
import type { ContentSearchMatchDto } from "@fileoctopus/ts-api";

afterEach(cleanup);

function makeMatch(
  overrides: Partial<ContentSearchMatchDto> = {},
): ContentSearchMatchDto {
  return {
    uri: "local:///home/user/docs/readme.txt",
    parentUri: "local:///home/user/docs",
    name: "readme.txt",
    kind: "file",
    size: 1024,
    modifiedAt: "2026-01-01T00:00:00Z",
    lineNumber: 1,
    lineContent: "Hello World",
    matchStart: 0,
    matchEnd: 5,
    ...overrides,
  };
}

function makeState(
  overrides: Partial<ContentSearchState> = {},
): ContentSearchState {
  return {
    panelId: "left",
    query: "Hello",
    options: { caseSensitive: false, useRegex: false, filePattern: "" },
    running: false,
    jobId: null,
    result: null,
    error: null,
    ...overrides,
  };
}

describe("ContentSearchPanel", () => {
  it("renders null when search is null", () => {
    const { container } = render(
      <ContentSearchPanel
        panelId="left"
        search={null}
        onOpen={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders empty state when no matches and not running", () => {
    render(
      <ContentSearchPanel
        panelId="left"
        search={makeState()}
        onOpen={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByText("0 match(es) in 0 file(s)")).toBeTruthy();
    expect(screen.getByText("No content matches")).toBeTruthy();
  });

  it("renders 'Searching' when running", () => {
    render(
      <ContentSearchPanel
        panelId="left"
        search={makeState({ running: true })}
        onOpen={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByText("Searching")).toBeTruthy();
  });

  it("renders error message", () => {
    render(
      <ContentSearchPanel
        panelId="left"
        search={makeState({ error: "Permission denied" })}
        onOpen={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByText("Permission denied")).toBeTruthy();
  });

  it("renders match count with single file", () => {
    const match = makeMatch();
    render(
      <ContentSearchPanel
        panelId="left"
        search={makeState({
          result: { matches: [match], warnings: [], incomplete: false },
        })}
        onOpen={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByText("1 match(es) in 1 file(s)")).toBeTruthy();
    expect(screen.getByText("readme.txt")).toBeTruthy();
  });

  it("renders match count with plural 'matches'", () => {
    const match1 = makeMatch({ lineNumber: 1 });
    const match2 = makeMatch({
      lineNumber: 5,
      matchStart: 0,
      matchEnd: 5,
      lineContent: "Hello Again",
    });
    render(
      <ContentSearchPanel
        panelId="left"
        search={makeState({
          result: {
            matches: [match1, match2],
            warnings: [],
            incomplete: false,
          },
        })}
        onOpen={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByText("2 match(es) in 1 file(s)")).toBeTruthy();
    expect(screen.getByText("2 matches")).toBeTruthy();
  });

  it("renders file path via localPathFromUri", () => {
    const match = makeMatch({ parentUri: "local:///home/user/docs" });
    render(
      <ContentSearchPanel
        panelId="left"
        search={makeState({
          result: { matches: [match], warnings: [], incomplete: false },
        })}
        onOpen={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    const pathEl = screen.getByText("/home/user/docs");
    expect(pathEl).toBeTruthy();
    expect(
      pathEl.classList.contains("fo-content-search-file-path") ||
        pathEl.closest(".fo-content-search-file-path"),
    ).toBeTruthy();
  });

  it("groups matches by file URI", () => {
    const match1 = makeMatch({
      uri: "local:///a.txt",
      name: "a.txt",
      parentUri: "local:///",
    });
    const match2 = makeMatch({
      uri: "local:///b.txt",
      name: "b.txt",
      parentUri: "local:///",
    });
    const match3 = makeMatch({
      uri: "local:///a.txt",
      name: "a.txt",
      parentUri: "local:///",
      lineNumber: 5,
    });
    render(
      <ContentSearchPanel
        panelId="left"
        search={makeState({
          result: {
            matches: [match1, match2, match3],
            warnings: [],
            incomplete: false,
          },
        })}
        onOpen={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByText("3 match(es) in 2 file(s)")).toBeTruthy();
    expect(screen.getByText("a.txt")).toBeTruthy();
    expect(screen.getByText("b.txt")).toBeTruthy();
  });

  it("calls onOpen when Open button is clicked", () => {
    const onOpen = vi.fn();
    const match = makeMatch();
    render(
      <ContentSearchPanel
        panelId="left"
        search={makeState({
          result: { matches: [match], warnings: [], incomplete: false },
        })}
        onOpen={onOpen}
        onReveal={vi.fn()}
      />,
    );
    const openBtn = screen.getByText("Open");
    fireEvent.click(openBtn);
    expect(onOpen).toHaveBeenCalledTimes(1);
    const [entry, matchArg] = onOpen.mock.calls[0];
    expect(entry.uri).toBe(match.uri);
    expect(matchArg.lineNumber).toBe(1);
  });

  it("calls onReveal when Reveal button is clicked", () => {
    const onReveal = vi.fn();
    const match = makeMatch();
    render(
      <ContentSearchPanel
        panelId="left"
        search={makeState({
          result: { matches: [match], warnings: [], incomplete: false },
        })}
        onOpen={vi.fn()}
        onReveal={onReveal}
      />,
    );
    const revealBtn = screen.getByText("Reveal");
    fireEvent.click(revealBtn);
    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(onReveal.mock.calls[0][0].uri).toBe(match.uri);
  });

  it("does not render 'No content matches' when running", () => {
    render(
      <ContentSearchPanel
        panelId="left"
        search={makeState({ running: true })}
        onOpen={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.queryByText("No content matches")).toBeNull();
  });

  it("renders incomplete warning", () => {
    const match = makeMatch();
    render(
      <ContentSearchPanel
        panelId="left"
        search={makeState({
          result: { matches: [match], warnings: [], incomplete: true },
        })}
        onOpen={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(
      screen.getByText("Some folders could not be searched."),
    ).toBeTruthy();
  });

  it("does not render incomplete warning when complete", () => {
    const match = makeMatch();
    render(
      <ContentSearchPanel
        panelId="left"
        search={makeState({
          result: { matches: [match], warnings: [], incomplete: false },
        })}
        onOpen={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(
      screen.queryByText("Some folders could not be searched."),
    ).toBeNull();
  });

  it("expands file to show match details on header click", () => {
    const match = makeMatch({ lineContent: "Hello World" });
    render(
      <ContentSearchPanel
        panelId="left"
        search={makeState({
          result: { matches: [match], warnings: [], incomplete: false },
        })}
        onOpen={vi.fn()}
        onReveal={vi.fn()}
      />,
    );

    const header = document.querySelector(".fo-content-search-file-header");
    expect(header).toBeTruthy();
    fireEvent.click(header!);

    const matchEl = document.querySelector(".fo-content-search-matches");
    expect(matchEl).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("collapses expanded file on second click", () => {
    const match = makeMatch();
    render(
      <ContentSearchPanel
        panelId="left"
        search={makeState({
          result: { matches: [match], warnings: [], incomplete: false },
        })}
        onOpen={vi.fn()}
        onReveal={vi.fn()}
      />,
    );

    const header = document.querySelector(".fo-content-search-file-header")!;
    fireEvent.click(header);
    expect(document.querySelector(".fo-content-search-matches")).toBeTruthy();

    fireEvent.click(header);
    expect(document.querySelector(".fo-content-search-matches")).toBeNull();
  });

  it("renders highlight mark around matched text", () => {
    const match = makeMatch({
      lineContent: "Hello World",
      matchStart: 0,
      matchEnd: 5,
    });
    render(
      <ContentSearchPanel
        panelId="left"
        search={makeState({
          result: { matches: [match], warnings: [], incomplete: false },
        })}
        onOpen={vi.fn()}
        onReveal={vi.fn()}
      />,
    );

    const header = document.querySelector(".fo-content-search-file-header")!;
    fireEvent.click(header);

    const mark = document.querySelector(".fo-content-search-highlight");
    expect(mark).toBeTruthy();
    expect(mark?.textContent).toBe("Hello");
  });

  it("calls onOpen when expanded match line is clicked", () => {
    const onOpen = vi.fn();
    const match = makeMatch();
    render(
      <ContentSearchPanel
        panelId="left"
        search={makeState({
          result: { matches: [match], warnings: [], incomplete: false },
        })}
        onOpen={onOpen}
        onReveal={vi.fn()}
      />,
    );

    const header = document.querySelector(".fo-content-search-file-header")!;
    fireEvent.click(header);

    const matchLine = document.querySelector(".fo-content-search-match")!;
    fireEvent.click(matchLine);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("limits displayed files to 50", () => {
    const matches: ContentSearchMatchDto[] = [];
    for (let i = 0; i < 60; i++) {
      matches.push(
        makeMatch({
          uri: `local:///file${i}.txt`,
          name: `file${i}.txt`,
          parentUri: "local:///",
        }),
      );
    }
    render(
      <ContentSearchPanel
        panelId="left"
        search={makeState({
          result: { matches, warnings: [], incomplete: false },
        })}
        onOpen={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    const fileHeaders = document.querySelectorAll(".fo-content-search-file");
    expect(fileHeaders.length).toBe(50);
  });

  it("stopPropagation on Open/Reveal buttons prevents header toggle", () => {
    const match = makeMatch();
    render(
      <ContentSearchPanel
        panelId="left"
        search={makeState({
          result: { matches: [match], warnings: [], incomplete: false },
        })}
        onOpen={vi.fn()}
        onReveal={vi.fn()}
      />,
    );

    const openBtn = screen.getByText("Open");
    fireEvent.click(openBtn);
    expect(document.querySelector(".fo-content-search-matches")).toBeNull();
  });
});

describe("ContentSearchInput", () => {
  it("renders search input with correct aria-label", () => {
    render(
      <ContentSearchInput
        panelId="left"
        active={true}
        value="test"
        focusToken={1}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    const input = screen.getByLabelText("left content search");
    expect(input).toBeTruthy();
  });

  it("calls onChange on input change", () => {
    const onChange = vi.fn();
    render(
      <ContentSearchInput
        panelId="left"
        active={true}
        value=""
        focusToken={1}
        onChange={onChange}
        onSubmit={vi.fn()}
      />,
    );
    const input = screen.getByLabelText("left content search");
    fireEvent.change(input, { target: { value: "new query" } });
    expect(onChange).toHaveBeenCalledWith("new query");
  });

  it("calls onSubmit on Enter key", () => {
    const onSubmit = vi.fn();
    render(
      <ContentSearchInput
        panelId="left"
        active={true}
        value="test"
        focusToken={1}
        onChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    const input = screen.getByLabelText("left content search");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not call onSubmit on non-Enter key", () => {
    const onSubmit = vi.fn();
    render(
      <ContentSearchInput
        panelId="left"
        active={true}
        value="test"
        focusToken={1}
        onChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    const input = screen.getByLabelText("left content search");
    fireEvent.keyDown(input, { key: "a" });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
