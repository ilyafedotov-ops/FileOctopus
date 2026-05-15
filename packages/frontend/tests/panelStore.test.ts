import { describe, expect, it } from "vitest";
import {
  activeTab,
  createInitialState,
  normalizeLocalInput,
  panelReducer,
  parentUri,
  selectVisibleEntries,
} from "../src/panelStore";
import type { FileEntryDto } from "@fileoctopus/ts-api";

function entry(
  name: string,
  kind: FileEntryDto["kind"] = "file",
  size = 0,
): FileEntryDto {
  return {
    uri: `local:///tmp/${name}`,
    name,
    kind,
    size,
    isHidden: false,
    isSymlink: false,
    providerId: "local",
    canRead: kind !== "directory",
    canList: kind === "directory",
    canWrite: false,
    canDelete: false,
    canRename: false,
  };
}

describe("panel store", () => {
  it("keeps left and right panel sessions independent", () => {
    let state = createInitialState("local:///left", "local:///right");

    state = panelReducer(state, {
      type: "startSession",
      panelId: "left",
      sessionId: "left-session",
      requestId: "left-request",
    });
    state = panelReducer(state, {
      type: "startSession",
      panelId: "right",
      sessionId: "right-session",
      requestId: "right-request",
    });
    state = panelReducer(state, {
      type: "applyBatch",
      batch: {
        sessionId: "left-session",
        requestId: "left-request",
        uri: "local:///left",
        entries: [entry("a.txt")],
        batchIndex: 0,
        isComplete: true,
      },
    });

    expect(activeTab(state.panels.left).orderedEntryIds).toEqual([
      "local:///tmp/a.txt",
    ]);
    expect(activeTab(state.panels.right).orderedEntryIds).toEqual([]);
  });

  it("ignores stale directory batches by session and request id", () => {
    let state = createInitialState("local:///left", "local:///right");

    state = panelReducer(state, {
      type: "startSession",
      panelId: "left",
      sessionId: "new-session",
      requestId: "new-request",
    });
    state = panelReducer(state, {
      type: "applyBatch",
      batch: {
        sessionId: "old-session",
        requestId: "old-request",
        uri: "local:///left",
        entries: [entry("stale.txt")],
        batchIndex: 0,
        isComplete: true,
      },
    });

    expect(activeTab(state.panels.left).orderedEntryIds).toEqual([]);

    state = panelReducer(state, {
      type: "applyBatch",
      batch: {
        sessionId: "new-session",
        requestId: "old-request",
        uri: "local:///left",
        entries: [entry("stale-request.txt")],
        batchIndex: 0,
        isComplete: true,
      },
    });

    expect(activeTab(state.panels.left).orderedEntryIds).toEqual([]);
  });

  it("ignores batches with empty request id while pane expects correlation", () => {
    let state = createInitialState("local:///left", "local:///right");

    state = panelReducer(state, {
      type: "startSession",
      panelId: "left",
      sessionId: "new-session",
      requestId: "new-request",
    });
    state = panelReducer(state, {
      type: "applyBatch",
      batch: {
        sessionId: "new-session",
        requestId: "",
        uri: "local:///left",
        entries: [entry("uncorrelated.txt")],
        batchIndex: 0,
        isComplete: true,
      },
    });

    expect(activeTab(state.panels.left).orderedEntryIds).toEqual([]);
  });

  it("transitions to empty and loaded terminal states", () => {
    let state = createInitialState("local:///left", "local:///right");

    state = panelReducer(state, {
      type: "startSession",
      panelId: "left",
      sessionId: "session",
      requestId: "request",
    });
    state = panelReducer(state, {
      type: "applyBatch",
      batch: {
        sessionId: "session",
        requestId: "request",
        uri: "local:///left",
        entries: [],
        batchIndex: 0,
        isComplete: true,
      },
    });

    expect(activeTab(state.panels.left).loadState).toBe("empty");

    state = panelReducer(state, {
      type: "applyBatch",
      batch: {
        sessionId: "session",
        requestId: "request",
        uri: "local:///left",
        entries: [entry("a.txt")],
        batchIndex: 1,
        isComplete: true,
      },
    });

    expect(activeTab(state.panels.left).loadState).toBe("loaded");
  });

  it("maps permission and timeout errors to pane states", () => {
    let state = createInitialState("local:///left", "local:///right");

    state = panelReducer(state, {
      type: "startSession",
      panelId: "left",
      sessionId: "session",
      requestId: "request",
    });
    state = panelReducer(state, {
      type: "applyBatch",
      batch: {
        sessionId: "session",
        requestId: "request",
        uri: "local:///left",
        entries: [],
        batchIndex: 0,
        isComplete: true,
        error: { code: "permission_denied", message: "denied" },
      },
    });

    expect(activeTab(state.panels.left).loadState).toBe("permissionDenied");

    state = panelReducer(state, {
      type: "startSession",
      panelId: "left",
      sessionId: "session-2",
      requestId: "request-2",
    });
    state = panelReducer(state, {
      type: "applyBatch",
      batch: {
        sessionId: "session-2",
        requestId: "request-2",
        uri: "local:///left",
        entries: [],
        batchIndex: 0,
        isComplete: true,
        error: { code: "timeout", message: "timed out" },
      },
    });

    expect(activeTab(state.panels.left).loadState).toBe("timeout");
  });

  it("sorts directories first and filters by name", () => {
    let state = createInitialState("local:///left", "local:///right");

    state = panelReducer(state, {
      type: "startSession",
      panelId: "left",
      sessionId: "session",
      requestId: "request",
    });
    state = panelReducer(state, {
      type: "applyBatch",
      batch: {
        sessionId: "session",
        requestId: "request",
        uri: "local:///left",
        entries: [
          entry("zeta.txt"),
          entry("alpha", "directory"),
          entry("beta.txt"),
        ],
        batchIndex: 0,
        isComplete: true,
      },
    });
    state = panelReducer(state, {
      type: "setFilter",
      panelId: "left",
      filter: "a",
    });

    expect(
      selectVisibleEntries(activeTab(state.panels.left)).map(
        (item) => item.name,
      ),
    ).toEqual(["alpha", "beta.txt", "zeta.txt"]);
  });

  it("supports toggle and range multi-selection", () => {
    let state = createInitialState("local:///left", "local:///right");

    state = panelReducer(state, {
      type: "startSession",
      panelId: "left",
      sessionId: "session",
      requestId: "request",
    });
    state = panelReducer(state, {
      type: "applyBatch",
      batch: {
        sessionId: "session",
        requestId: "request",
        uri: "local:///left",
        entries: [entry("a.txt"), entry("b.txt"), entry("c.txt")],
        batchIndex: 0,
        isComplete: true,
      },
    });
    state = panelReducer(state, {
      type: "selectEntry",
      panelId: "left",
      entryId: "local:///tmp/a.txt",
      mode: "single",
    });
    state = panelReducer(state, {
      type: "selectEntry",
      panelId: "left",
      entryId: "local:///tmp/c.txt",
      mode: "range",
    });

    expect(activeTab(state.panels.left).selectedIds).toEqual([
      "local:///tmp/a.txt",
      "local:///tmp/b.txt",
      "local:///tmp/c.txt",
    ]);
  });

  it("hydrates both panes from persisted preferences", () => {
    let state = createInitialState("local:///left", "local:///right");

    state = panelReducer(state, {
      type: "hydratePreferences",
      showHidden: true,
      viewMode: "list",
    });

    expect(activeTab(state.panels.left).showHidden).toBe(true);
    expect(activeTab(state.panels.right).showHidden).toBe(true);
    expect(activeTab(state.panels.left).viewMode).toBe("list");
    expect(activeTab(state.panels.right).viewMode).toBe("list");
  });

  it("hydrates columns view mode from persisted preferences", () => {
    let state = createInitialState("local:///left", "local:///right");

    state = panelReducer(state, {
      type: "hydratePreferences",
      showHidden: false,
      viewMode: "columns",
    });

    expect(activeTab(state.panels.left).viewMode).toBe("columns");
    expect(activeTab(state.panels.right).viewMode).toBe("columns");
  });

  it("normalizes local paths and finds parent uris", () => {
    expect(normalizeLocalInput("/Users/ilya")).toBe("local:///Users/ilya");
    expect(normalizeLocalInput("C:\\Users\\Ilya")).toBe(
      "local://C:/Users/Ilya",
    );
    expect(parentUri("local:///Users/ilya/Documents")).toBe(
      "local:///Users/ilya",
    );
  });
});
