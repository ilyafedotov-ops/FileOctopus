import { describe, expect, it } from "vitest";
import { IPC_ERROR_CODES } from "@fileoctopus/ts-api";
import {
  activeTab,
  createInitialState,
  normalizeLocalInput,
  panelReducer,
  parentUri,
  selectVisibleEntries,
  selectDisplayedEntries,
  countVisibleEntries,
  countOperationalSelection,
  moveSelection,
  selectEntry,
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
        error: { code: IPC_ERROR_CODES.PERMISSION_DENIED, message: "denied" },
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
        error: { code: IPC_ERROR_CODES.TIMEOUT, message: "timed out" },
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

  it("inverts visible selection", () => {
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
      entryId: "local:///tmp/b.txt",
      mode: "single",
    });
    state = panelReducer(state, { type: "invertSelection", panelId: "left" });

    expect(activeTab(state.panels.left).selectedIds).toEqual([
      "local:///tmp/a.txt",
      "local:///tmp/c.txt",
    ]);
  });

  it("starts in details view mode", () => {
    const state = createInitialState("local:///left", "local:///right");

    expect(activeTab(state.panels.left).viewMode).toBe("details");
    expect(activeTab(state.panels.right).viewMode).toBe("details");
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

  it("prepends parent directory entry to displayed entries", () => {
    const tab = activeTab(
      createInitialState("local:///tmp/nested").panels.left,
    );
    const withEntries = {
      ...tab,
      uri: "local:///tmp/nested",
      orderedEntryIds: [entry("a.txt").uri],
      entriesById: { [entry("a.txt").uri]: entry("a.txt") },
      loadState: "loaded" as const,
    };

    const displayed = selectDisplayedEntries(withEntries);

    expect(displayed).toHaveLength(2);
    expect(displayed[0]?.name).toBe("..");
    expect(displayed[0]?.uri).toBe("local:///tmp");
    expect(displayed[1]?.name).toBe("a.txt");
    expect(countVisibleEntries(withEntries)).toBe(1);
  });

  it("includes parent entry in keyboard selection movement", () => {
    const tab = activeTab(
      createInitialState("local:///tmp/nested").panels.left,
    );
    const withEntries = {
      ...tab,
      uri: "local:///tmp/nested",
      orderedEntryIds: [entry("a.txt").uri],
      entriesById: { [entry("a.txt").uri]: entry("a.txt") },
      loadState: "loaded" as const,
      selectedId: entry("a.txt").uri,
      focusedId: entry("a.txt").uri,
      selectedIds: [entry("a.txt").uri],
    };

    const movedUp = moveSelection(withEntries, -1);

    expect(movedUp.selectedId).toBe("local:///tmp");
    expect(movedUp.focusedId).toBe("local:///tmp");
  });

  it("excludes parent entry from range and toggle multi-selection", () => {
    const tab = activeTab(
      createInitialState("local:///tmp/nested").panels.left,
    );
    const withEntries = {
      ...tab,
      uri: "local:///tmp/nested",
      orderedEntryIds: [entry("a.txt").uri, entry("b.txt").uri],
      entriesById: {
        [entry("a.txt").uri]: entry("a.txt"),
        [entry("b.txt").uri]: entry("b.txt"),
      },
      loadState: "loaded" as const,
      anchorId: entry("a.txt").uri,
      focusedId: entry("a.txt").uri,
      selectedIds: [entry("a.txt").uri],
    };

    const ranged = selectEntry(withEntries, entry("b.txt").uri, "range");

    expect(ranged.selectedIds).toEqual([
      entry("a.txt").uri,
      entry("b.txt").uri,
    ]);

    const fromParent = selectEntry(
      {
        ...withEntries,
        anchorId: "local:///tmp",
        focusedId: "local:///tmp",
        selectedIds: ["local:///tmp"],
      },
      entry("b.txt").uri,
      "range",
    );

    expect(fromParent.selectedIds).toEqual([entry("b.txt").uri]);

    const toggled = selectEntry(
      {
        ...withEntries,
        selectedIds: [entry("a.txt").uri],
        anchorId: entry("a.txt").uri,
        focusedId: entry("a.txt").uri,
      },
      entry("b.txt").uri,
      "toggle",
    );

    expect(toggled.selectedIds).toEqual([
      entry("a.txt").uri,
      entry("b.txt").uri,
    ]);
  });

  it("counts only operational selections for status and toolbar", () => {
    const tab = activeTab(
      createInitialState("local:///tmp/nested").panels.left,
    );
    const withParentSelected = {
      ...tab,
      uri: "local:///tmp/nested",
      selectedIds: ["local:///tmp"],
    };

    expect(countOperationalSelection(withParentSelected)).toBe(0);
  });
});
