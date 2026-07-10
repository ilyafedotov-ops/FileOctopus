import type {
  ContentSearchCompletedEventDto,
  ContentSearchMatchDto,
  ContentSearchMatchEventDto,
} from "@fileoctopus/ts-api";
import { describe, expect, it } from "vitest";
import {
  activeTab,
  createInitialState,
  panelReducer,
  type FileOctopusState,
  type PanelId,
} from "../src/panelStore";

const options = {
  caseSensitive: false,
  useRegex: false,
  filePattern: "",
};

function match(name: string, lineNumber = 1): ContentSearchMatchDto {
  return {
    uri: `local:///origin/${name}`,
    parentUri: "local:///origin",
    name,
    kind: "file",
    size: 10,
    modifiedAt: null,
    lineNumber,
    lineContent: "needle",
    matchStart: 0,
    matchEnd: 6,
  };
}

function startSearch(
  state: FileOctopusState,
  panelId: PanelId,
  tabId: string,
  requestId: string,
  jobId: string,
  query = "needle",
) {
  const started = panelReducer(state, {
    type: "startContentSearch",
    panelId,
    tabId,
    requestId,
    rootUri: "local:///origin",
    query,
    options,
  });
  return panelReducer(started, {
    type: "bindContentSearchJob",
    panelId,
    tabId,
    requestId,
    jobId,
  });
}

function matchEvent(
  jobId: string,
  item: ContentSearchMatchDto,
  query = "needle",
) {
  return {
    jobId,
    uri: "local:///origin",
    query,
    item,
  } satisfies ContentSearchMatchEventDto;
}

function completedEvent(
  jobId: string,
  matches: ContentSearchMatchDto[],
  query = "needle",
) {
  return {
    jobId,
    uri: "local:///origin",
    query,
    result: { matches, warnings: [], incomplete: false },
  } satisfies ContentSearchCompletedEventDto;
}

describe("tab-scoped content search state", () => {
  it("replays match and completion events that arrive before job binding", () => {
    let state = createInitialState("local:///origin", "local:///right");
    state = panelReducer(state, {
      type: "startContentSearch",
      panelId: "left",
      tabId: "main",
      requestId: "request-a",
      rootUri: "local:///origin",
      query: "needle",
      options,
    });
    state = panelReducer(state, {
      type: "applyContentSearchMatch",
      event: matchEvent("job-a", match("early.txt")),
    });
    state = panelReducer(state, {
      type: "applyContentSearchCompleted",
      event: completedEvent("job-a", [match("early.txt")]),
    });
    expect(state.panels.left.tabs.main.contentSearch?.status).toBe("starting");

    state = panelReducer(state, {
      type: "bindContentSearchJob",
      panelId: "left",
      tabId: "main",
      requestId: "request-a",
      jobId: "job-a",
    });

    expect(state.panels.left.tabs.main.contentSearch?.status).toBe("completed");
    expect(
      state.panels.left.tabs.main.contentSearch?.result?.matches[0]?.name,
    ).toBe("early.txt");
    expect(state.pendingContentSearchEvents["job-a"]).toBeUndefined();
    expect(state.absorbedContentSearchJobIds).toContain("job-a");
  });

  it("replays an early terminal event and absorbs later results", () => {
    let state = createInitialState("local:///origin", "local:///right");
    state = panelReducer(state, {
      type: "startContentSearch",
      panelId: "left",
      tabId: "main",
      requestId: "request-a",
      rootUri: "local:///origin",
      query: "needle",
      options,
    });
    state = panelReducer(state, {
      type: "terminateContentSearchJob",
      jobId: "job-a",
      status: "failed",
      error: "Failed before bind",
    });
    state = panelReducer(state, {
      type: "bindContentSearchJob",
      panelId: "left",
      tabId: "main",
      requestId: "request-a",
      jobId: "job-a",
    });
    state = panelReducer(state, {
      type: "applyContentSearchCompleted",
      event: completedEvent("job-a", [match("late.txt")]),
    });

    const search = state.panels.left.tabs.main.contentSearch;
    expect(search?.status).toBe("failed");
    expect(search?.error).toBe("Failed before bind");
    expect(search?.result?.matches).toEqual([]);
  });

  it("updates the originating tab while another tab is active", () => {
    let state = createInitialState("local:///origin", "local:///right");
    state = startSearch(state, "left", "main", "request-a", "job-a");
    state = panelReducer(state, {
      type: "openTab",
      panelId: "left",
      uri: "local:///other",
    });
    const otherTabId = state.panels.left.activeTabId;

    state = panelReducer(state, {
      type: "applyContentSearchMatch",
      event: matchEvent("job-a", match("origin.txt")),
    });
    state = panelReducer(state, {
      type: "applyContentSearchCompleted",
      event: completedEvent("job-a", [match("origin.txt")]),
    });

    expect(state.panels.left.tabs[otherTabId].contentSearch).toBeNull();
    expect(state.panels.left.tabs.main.contentSearch?.status).toBe("completed");
    expect(
      state.panels.left.tabs.main.contentSearch?.result?.matches[0]?.name,
    ).toBe("origin.txt");

    state = panelReducer(state, {
      type: "switchTab",
      panelId: "left",
      tabId: "main",
    });
    expect(activeTab(state.panels.left).contentSearch?.query).toBe("needle");
  });

  it("absorbs stale bindings and events after a search is replaced", () => {
    let state = createInitialState("local:///origin", "local:///right");
    state = panelReducer(state, {
      type: "startContentSearch",
      panelId: "left",
      tabId: "main",
      requestId: "request-a",
      rootUri: "local:///origin",
      query: "old",
      options,
    });
    state = panelReducer(state, {
      type: "startContentSearch",
      panelId: "left",
      tabId: "main",
      requestId: "request-b",
      rootUri: "local:///origin",
      query: "new",
      options,
    });
    state = panelReducer(state, {
      type: "bindContentSearchJob",
      panelId: "left",
      tabId: "main",
      requestId: "request-a",
      jobId: "job-a",
    });
    state = panelReducer(state, {
      type: "bindContentSearchJob",
      panelId: "left",
      tabId: "main",
      requestId: "request-b",
      jobId: "job-b",
    });
    state = panelReducer(state, {
      type: "applyContentSearchMatch",
      event: matchEvent("job-a", match("stale.txt"), "old"),
    });
    state = panelReducer(state, {
      type: "applyContentSearchCompleted",
      event: completedEvent("job-a", [match("stale.txt")], "old"),
    });

    const current = state.panels.left.tabs.main.contentSearch;
    expect(current?.requestId).toBe("request-b");
    expect(current?.jobId).toBe("job-b");
    expect(current?.status).toBe("running");
    expect(current?.result?.matches).toEqual([]);
  });

  it("deduplicates matches and ignores events after completion", () => {
    let state = startSearch(
      createInitialState("local:///origin", "local:///right"),
      "left",
      "main",
      "request-a",
      "job-a",
    );
    const item = match("result.txt");
    for (let index = 0; index < 2; index += 1) {
      state = panelReducer(state, {
        type: "applyContentSearchMatch",
        event: matchEvent("job-a", item),
      });
    }
    state = panelReducer(state, {
      type: "applyContentSearchCompleted",
      event: completedEvent("job-a", [item]),
    });
    state = panelReducer(state, {
      type: "applyContentSearchMatch",
      event: matchEvent("job-a", match("late.txt")),
    });

    const search = state.panels.left.tabs.main.contentSearch;
    expect(search?.status).toBe("completed");
    expect(search?.result?.matches.map((entry) => entry.name)).toEqual([
      "result.txt",
    ]);
  });

  it("preserves partial results and absorbs late completion after cancellation", () => {
    let state = startSearch(
      createInitialState("local:///origin", "local:///right"),
      "left",
      "main",
      "request-a",
      "job-a",
    );
    state = panelReducer(state, {
      type: "applyContentSearchMatch",
      event: matchEvent("job-a", match("partial.txt")),
    });
    state = panelReducer(state, {
      type: "terminateContentSearchJob",
      jobId: "job-a",
      status: "cancelled",
      error: "Operation cancelled.",
    });
    state = panelReducer(state, {
      type: "applyContentSearchCompleted",
      event: completedEvent("job-a", [match("late.txt")]),
    });

    const search = state.panels.left.tabs.main.contentSearch;
    expect(search?.status).toBe("cancelled");
    expect(search?.error).toBe("Operation cancelled.");
    expect(search?.result?.matches[0]?.name).toBe("partial.txt");
  });

  it("clears a tab search when that tab navigates elsewhere", () => {
    let state = startSearch(
      createInitialState("local:///origin", "local:///right"),
      "left",
      "main",
      "request-a",
      "job-a",
    );
    state = panelReducer(state, {
      type: "navigate",
      panelId: "left",
      uri: "local:///next",
    });

    expect(state.panels.left.tabs.main.contentSearch).toBeNull();
    expect(state.panels.left.tabs.main.contentSearchQuery).toBe("");
  });
});
