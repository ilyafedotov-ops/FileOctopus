import { describe, expect, it, beforeEach } from "vitest";
import {
  isListingAction,
  reduceListing,
} from "../src/state/slices/listingSlice";
import { createInitialState, activeTab } from "../src/panelStore";
import type { FileOctopusState, PanelAction } from "../src/panelStore";
import type { DirectoryBatchEventDto, FileEntryDto } from "@fileoctopus/ts-api";

let state: FileOctopusState;

function makeEntry(name: string, uri: string): FileEntryDto {
  return {
    name,
    uri,
    kind: "file",
    size: 100,
    extension: ".txt",
    modifiedAt: null,
    createdAt: null,
    isHidden: false,
    isSymlink: false,
    canRead: true,
    canWrite: true,
    canDelete: true,
    canRename: true,
    canList: false,
    providerId: "local",
  };
}

beforeEach(() => {
  localStorage.clear();
  state = createInitialState("local:///home", "local:///home");
});

describe("isListingAction", () => {
  it("matches startSession", () => {
    expect(
      isListingAction({
        type: "startSession",
        panelId: "left",
        sessionId: "s1",
        requestId: "r1",
      } as PanelAction),
    ).toBe(true);
  });
  it("matches startRequest", () => {
    expect(
      isListingAction({
        type: "startRequest",
        panelId: "left",
        requestId: "r1",
      } as PanelAction),
    ).toBe(true);
  });
  it("matches applyBatch", () => {
    expect(
      isListingAction({
        type: "applyBatch",
        batch: {} as DirectoryBatchEventDto,
      } as PanelAction),
    ).toBe(true);
  });
  it("matches setPaneError", () => {
    expect(
      isListingAction({
        type: "setPaneError",
        panelId: "left",
        error: "fail",
      } as PanelAction),
    ).toBe(true);
  });
  it("matches setArchiveEntries", () => {
    expect(
      isListingAction({
        type: "setArchiveEntries",
        panelId: "left",
        uri: "local:///a",
        entries: [],
      } as PanelAction),
    ).toBe(true);
  });
  it("does not match navigate", () => {
    expect(
      isListingAction({
        type: "navigate",
        panelId: "left",
        uri: "local:///x",
      } as PanelAction),
    ).toBe(false);
  });
  it("does not match setSelection", () => {
    expect(
      isListingAction({
        type: "setSelection",
        panelId: "left",
        entryId: "x",
      } as PanelAction),
    ).toBe(false);
  });
  it("does not match swapPanes", () => {
    expect(isListingAction({ type: "swapPanes" } as PanelAction)).toBe(false);
  });
});

describe("reduceListing — startRequest", () => {
  it("sets activeRequestId and loadState to loading", () => {
    const result = reduceListing(state, {
      type: "startRequest",
      panelId: "left",
      requestId: "req-1",
    });
    const tab = activeTab(result.panels.left);
    expect(tab.activeRequestId).toBe("req-1");
    expect(tab.loadState).toBe("loading");
    expect(tab.sessionId).toBeNull();
  });
  it("clears error state", () => {
    const errorState: FileOctopusState = {
      ...state,
      panels: {
        ...state.panels,
        left: {
          ...state.panels.left,
          tabs: {
            ...state.panels.left.tabs,
            main: {
              ...state.panels.left.tabs.main,
              error: "previous error",
              errorCode: "err_code",
            },
          },
        },
      },
    };
    const result = reduceListing(errorState, {
      type: "startRequest",
      panelId: "left",
      requestId: "req-2",
    });
    const tab = activeTab(result.panels.left);
    expect(tab.error).toBeNull();
    expect(tab.errorCode).toBeNull();
  });
  it("does not affect the other panel", () => {
    const result = reduceListing(state, {
      type: "startRequest",
      panelId: "left",
      requestId: "req-1",
    });
    expect(activeTab(result.panels.right).activeRequestId).toBe(
      state.panels.right.tabs.main.activeRequestId,
    );
  });
});

describe("reduceListing — startSession", () => {
  it("sets sessionId and activeRequestId", () => {
    const started = reduceListing(state, {
      type: "startRequest",
      panelId: "left",
      requestId: "r1",
    });
    const result = reduceListing(started, {
      type: "startSession",
      panelId: "left",
      sessionId: "s1",
      requestId: "r1",
    });
    const tab = activeTab(result.panels.left);
    expect(tab.sessionId).toBe("s1");
    expect(tab.activeRequestId).toBe("r1");
  });
  it("preserves loadState when requestId matches and not loading", () => {
    const loadedState: FileOctopusState = {
      ...state,
      panels: {
        ...state.panels,
        left: {
          ...state.panels.left,
          tabs: {
            ...state.panels.left.tabs,
            main: {
              ...state.panels.left.tabs.main,
              activeRequestId: "r1",
              loadState: "loaded",
            },
          },
        },
      },
    };
    const result = reduceListing(loadedState, {
      type: "startSession",
      panelId: "left",
      sessionId: "s1",
      requestId: "r1",
    });
    const tab = activeTab(result.panels.left);
    expect(tab.loadState).toBe("loaded");
  });
  it("sets loadState to loading when requestId does not match", () => {
    const result = reduceListing(state, {
      type: "startSession",
      panelId: "left",
      sessionId: "s1",
      requestId: "r-new",
    });
    const tab = activeTab(result.panels.left);
    expect(tab.loadState).toBe("loading");
  });
  it("clears error when requestId does not match", () => {
    const errorState: FileOctopusState = {
      ...state,
      panels: {
        ...state.panels,
        left: {
          ...state.panels.left,
          tabs: {
            ...state.panels.left.tabs,
            main: {
              ...state.panels.left.tabs.main,
              error: "old error",
              errorCode: "err",
            },
          },
        },
      },
    };
    const result = reduceListing(errorState, {
      type: "startSession",
      panelId: "left",
      sessionId: "s1",
      requestId: "r-new",
    });
    const tab = activeTab(result.panels.left);
    expect(tab.error).toBeNull();
    expect(tab.errorCode).toBeNull();
  });
});

describe("reduceListing — applyBatch", () => {
  it("delegates to applyBatch from panelStore", () => {
    const started = reduceListing(state, {
      type: "startRequest",
      panelId: "left",
      requestId: "r1",
    });
    const sessioned = reduceListing(started, {
      type: "startSession",
      panelId: "left",
      sessionId: "s1",
      requestId: "r1",
    });
    const batch: DirectoryBatchEventDto = {
      sessionId: "s1",
      requestId: "r1",
      uri: "local:///home",
      entries: [makeEntry("file.txt", "local:///home/file.txt")],
      isComplete: true,
      batchIndex: 0,
    };
    const result = reduceListing(sessioned, { type: "applyBatch", batch });
    const tab = activeTab(result.panels.left);
    expect(tab.entriesById["local:///home/file.txt"]).toBeDefined();
  });
});

describe("reduceListing — setPaneError", () => {
  it("sets error and errorCode", () => {
    const result = reduceListing(state, {
      type: "setPaneError",
      panelId: "left",
      error: "Something went wrong",
      errorCode: "permission_denied",
    });
    const tab = activeTab(result.panels.left);
    expect(tab.error).toBe("Something went wrong");
    expect(tab.errorCode).toBe("permission_denied");
  });
  it("defaults loadState to error when error is set", () => {
    const result = reduceListing(state, {
      type: "setPaneError",
      panelId: "left",
      error: "fail",
    });
    const tab = activeTab(result.panels.left);
    expect(tab.loadState).toBe("error");
  });
  it("preserves loadState when error is null and no loadState override", () => {
    const loadedState: FileOctopusState = {
      ...state,
      panels: {
        ...state.panels,
        left: {
          ...state.panels.left,
          tabs: {
            ...state.panels.left.tabs,
            main: {
              ...state.panels.left.tabs.main,
              loadState: "loaded",
            },
          },
        },
      },
    };
    const result = reduceListing(loadedState, {
      type: "setPaneError",
      panelId: "left",
      error: null,
    });
    const tab = activeTab(result.panels.left);
    expect(tab.loadState).toBe("loaded");
  });
  it("uses explicit loadState override", () => {
    const result = reduceListing(state, {
      type: "setPaneError",
      panelId: "left",
      error: "retry",
      loadState: "loading",
    });
    const tab = activeTab(result.panels.left);
    expect(tab.loadState).toBe("loading");
  });
  it("sets errorCode to null when not provided", () => {
    const result = reduceListing(state, {
      type: "setPaneError",
      panelId: "left",
      error: "fail",
    });
    const tab = activeTab(result.panels.left);
    expect(tab.errorCode).toBeNull();
  });
});

describe("reduceListing — setArchiveEntries", () => {
  it("sets entries and uri for archive content", () => {
    const entries = [
      makeEntry("readme.md", "local:///archive/readme.md"),
      makeEntry("src.ts", "local:///archive/src.ts"),
    ];
    const result = reduceListing(state, {
      type: "setArchiveEntries",
      panelId: "left",
      uri: "local:///archive",
      entries,
    });
    const tab = activeTab(result.panels.left);
    expect(tab.uri).toBe("local:///archive");
    expect(tab.orderedEntryIds.length).toBe(2);
    expect(tab.entriesById["local:///archive/readme.md"]).toBeDefined();
    expect(tab.loadState).toBe("loaded");
  });
  it("selects first entry", () => {
    const entries = [
      makeEntry("file-a", "local:///archive/file-a"),
      makeEntry("file-b", "local:///archive/file-b"),
    ];
    const result = reduceListing(state, {
      type: "setArchiveEntries",
      panelId: "left",
      uri: "local:///archive",
      entries,
    });
    const tab = activeTab(result.panels.left);
    expect(tab.selectedId).toBe("local:///archive/file-a");
    expect(tab.selectedIds).toEqual(["local:///archive/file-a"]);
  });
  it("pushes to backStack when uri changes", () => {
    const entries = [makeEntry("file-a", "local:///archive/file-a")];
    const result = reduceListing(state, {
      type: "setArchiveEntries",
      panelId: "left",
      uri: "local:///archive",
      entries,
    });
    const tab = activeTab(result.panels.left);
    expect(tab.backStack).toContain("local:///home");
  });
  it("does not push to backStack when uri is same", () => {
    const sameUriState: FileOctopusState = {
      ...state,
      panels: {
        ...state.panels,
        left: {
          ...state.panels.left,
          tabs: {
            ...state.panels.left.tabs,
            main: {
              ...state.panels.left.tabs.main,
              uri: "local:///archive",
            },
          },
        },
      },
    };
    const entries = [makeEntry("file-a", "local:///archive/file-a")];
    const result = reduceListing(sameUriState, {
      type: "setArchiveEntries",
      panelId: "left",
      uri: "local:///archive",
      entries,
    });
    const tab = activeTab(result.panels.left);
    expect(tab.backStack.length).toBe(0);
  });
  it("clears forwardStack when uri changes", () => {
    const fwdState: FileOctopusState = {
      ...state,
      panels: {
        ...state.panels,
        left: {
          ...state.panels.left,
          tabs: {
            ...state.panels.left.tabs,
            main: {
              ...state.panels.left.tabs.main,
              forwardStack: ["local:///old"],
            },
          },
        },
      },
    };
    const entries = [makeEntry("file-a", "local:///archive/file-a")];
    const result = reduceListing(fwdState, {
      type: "setArchiveEntries",
      panelId: "left",
      uri: "local:///archive",
      entries,
    });
    const tab = activeTab(result.panels.left);
    expect(tab.forwardStack).toEqual([]);
  });
  it("clears filter and resets sessionId", () => {
    const filterState: FileOctopusState = {
      ...state,
      panels: {
        ...state.panels,
        left: {
          ...state.panels.left,
          tabs: {
            ...state.panels.left.tabs,
            main: {
              ...state.panels.left.tabs.main,
              filter: "*.txt",
              sessionId: "old-session",
            },
          },
        },
      },
    };
    const entries = [makeEntry("file-a", "local:///archive/file-a")];
    const result = reduceListing(filterState, {
      type: "setArchiveEntries",
      panelId: "left",
      uri: "local:///archive",
      entries,
    });
    const tab = activeTab(result.panels.left);
    expect(tab.filter).toBe("");
    expect(tab.sessionId).toBeNull();
  });
  it("handles empty entries list", () => {
    const result = reduceListing(state, {
      type: "setArchiveEntries",
      panelId: "left",
      uri: "local:///empty-archive",
      entries: [],
    });
    const tab = activeTab(result.panels.left);
    expect(tab.orderedEntryIds).toEqual([]);
    expect(tab.entriesById).toEqual({});
    expect(tab.selectedId).toBeNull();
    expect(tab.selectedIds).toEqual([]);
  });
});
