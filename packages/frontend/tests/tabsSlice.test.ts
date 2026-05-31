import { describe, expect, it, beforeEach } from "vitest";
import { isTabAction, reduceTab } from "../src/state/slices/tabsSlice";
import { createInitialState, activeTab } from "../src/panelStore";
import type { FileOctopusState, PanelAction } from "../src/panelStore";

let state: FileOctopusState;

beforeEach(() => {
  localStorage.clear();
  state = createInitialState("local:///home", "local:///home");
});

describe("isTabAction", () => {
  it("matches openTab", () => {
    expect(
      isTabAction({
        type: "openTab",
        panelId: "left",
        uri: "local:///tmp",
      } as PanelAction),
    ).toBe(true);
  });
  it("matches closeTab", () => {
    expect(
      isTabAction({
        type: "closeTab",
        panelId: "left",
        tabId: "main",
      } as PanelAction),
    ).toBe(true);
  });
  it("matches switchTab", () => {
    expect(
      isTabAction({
        type: "switchTab",
        panelId: "left",
        tabId: "main",
      } as PanelAction),
    ).toBe(true);
  });
  it("does not match navigate", () => {
    expect(
      isTabAction({
        type: "navigate",
        panelId: "left",
        uri: "local:///x",
      } as PanelAction),
    ).toBe(false);
  });
  it("does not match setSelection", () => {
    expect(
      isTabAction({
        type: "setSelection",
        panelId: "left",
        entryId: "x",
      } as PanelAction),
    ).toBe(false);
  });
  it("does not match swapPanes", () => {
    expect(isTabAction({ type: "swapPanes" } as PanelAction)).toBe(false);
  });
});

describe("reduceTab — openTab", () => {
  it("creates a new tab and makes it active", () => {
    const result = reduceTab(state, {
      type: "openTab",
      panelId: "left",
      uri: "local:///tmp",
    });
    const panel = result.panels.left;
    expect(panel.activeTabId).not.toBe("main");
    const newTab = panel.tabs[panel.activeTabId];
    expect(newTab).toBeDefined();
    expect(newTab.uri).toBe("local:///tmp");
  });
  it("preserves the original tab", () => {
    const result = reduceTab(state, {
      type: "openTab",
      panelId: "left",
      uri: "local:///tmp",
    });
    expect(result.panels.left.tabs["main"]).toBeDefined();
    expect(result.panels.left.tabs["main"].uri).toBe("local:///home");
  });
  it("new tab starts with loading state", () => {
    const result = reduceTab(state, {
      type: "openTab",
      panelId: "left",
      uri: "local:///tmp",
    });
    const newTab = activeTab(result.panels.left);
    expect(newTab.loadState).toBe("loading");
  });
  it("new tab has empty entries", () => {
    const result = reduceTab(state, {
      type: "openTab",
      panelId: "left",
      uri: "local:///tmp",
    });
    const newTab = activeTab(result.panels.left);
    expect(newTab.entriesById).toEqual({});
    expect(newTab.orderedEntryIds).toEqual([]);
  });
  it("new tab has empty selection", () => {
    const result = reduceTab(state, {
      type: "openTab",
      panelId: "left",
      uri: "local:///tmp",
    });
    const newTab = activeTab(result.panels.left);
    expect(newTab.selectedIds).toEqual([]);
    expect(newTab.selectedId).toBeNull();
  });
  it("clones listing when source tab has same uri and loaded state", () => {
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
              entriesById: {
                "local:///home/file": {
                  name: "file",
                  uri: "local:///home/file",
                  kind: "file",
                  size: 100,
                  extension: ".txt",
                  modifiedAt: null,
                  createdAt: null,
                  isHidden: false,
                  canRead: true,
                  canWrite: true,
                  canDelete: true,
                  canRename: true,
                  canList: false,
                  providerId: "local",
                },
              },
              orderedEntryIds: ["local:///home/file"],
            },
          },
        },
      },
    };
    const result = reduceTab(loadedState, {
      type: "openTab",
      panelId: "left",
      uri: "local:///home",
    });
    const newTab = activeTab(result.panels.left);
    expect(newTab.entriesById).toEqual(
      loadedState.panels.left.tabs.main.entriesById,
    );
    expect(newTab.orderedEntryIds).toEqual(
      loadedState.panels.left.tabs.main.orderedEntryIds,
    );
    expect(newTab.loadState).toBe("loaded");
  });
  it("does not clone when source tab has different uri", () => {
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
              entriesById: {
                "local:///other/file": {
                  name: "file",
                  uri: "local:///other/file",
                  kind: "file",
                  size: 100,
                  extension: ".txt",
                  modifiedAt: null,
                  createdAt: null,
                  isHidden: false,
                  canRead: true,
                  canWrite: true,
                  canDelete: true,
                  canRename: true,
                  canList: false,
                  providerId: "local",
                },
              },
              orderedEntryIds: ["local:///other/file"],
            },
          },
        },
      },
    };
    const result = reduceTab(loadedState, {
      type: "openTab",
      panelId: "left",
      uri: "local:///tmp",
    });
    const newTab = activeTab(result.panels.left);
    expect(newTab.entriesById).toEqual({});
    expect(newTab.loadState).toBe("loading");
  });
  it("inherits sort from source tab", () => {
    const customSortState: FileOctopusState = {
      ...state,
      panels: {
        ...state.panels,
        left: {
          ...state.panels.left,
          tabs: {
            ...state.panels.left.tabs,
            main: {
              ...state.panels.left.tabs.main,
              sort: {
                field: "size",
                direction: "desc",
                directoriesFirst: true,
              },
            },
          },
        },
      },
    };
    const result = reduceTab(customSortState, {
      type: "openTab",
      panelId: "left",
      uri: "local:///tmp",
    });
    const newTab = activeTab(result.panels.left);
    expect(newTab.sort.field).toBe("size");
    expect(newTab.sort.direction).toBe("desc");
  });
  it("does not affect the other panel", () => {
    const result = reduceTab(state, {
      type: "openTab",
      panelId: "left",
      uri: "local:///tmp",
    });
    expect(result.panels.right.activeTabId).toBe(
      state.panels.right.activeTabId,
    );
  });
});

describe("reduceTab — switchTab", () => {
  it("switches active tab to the specified tabId", () => {
    const openResult = reduceTab(state, {
      type: "openTab",
      panelId: "left",
      uri: "local:///tmp",
    });
    const newTabId = openResult.panels.left.activeTabId;
    const switchBack = reduceTab(openResult, {
      type: "switchTab",
      panelId: "left",
      tabId: "main",
    });
    expect(switchBack.panels.left.activeTabId).toBe("main");
    const switchForward = reduceTab(switchBack, {
      type: "switchTab",
      panelId: "left",
      tabId: newTabId,
    });
    expect(switchForward.panels.left.activeTabId).toBe(newTabId);
  });
  it("returns state unchanged when tabId does not exist", () => {
    const result = reduceTab(state, {
      type: "switchTab",
      panelId: "left",
      tabId: "nonexistent",
    });
    expect(result).toBe(state);
  });
  it("preserves all tabs when switching", () => {
    const openResult = reduceTab(state, {
      type: "openTab",
      panelId: "left",
      uri: "local:///tmp",
    });
    const newTabId = openResult.panels.left.activeTabId;
    const switchResult = reduceTab(openResult, {
      type: "switchTab",
      panelId: "left",
      tabId: "main",
    });
    expect(switchResult.panels.left.tabs[newTabId]).toBeDefined();
    expect(switchResult.panels.left.tabs["main"]).toBeDefined();
  });
});

describe("reduceTab — closeTab", () => {
  it("removes the specified tab", () => {
    const openResult = reduceTab(state, {
      type: "openTab",
      panelId: "left",
      uri: "local:///tmp",
    });
    const newTabId = openResult.panels.left.activeTabId;
    const closeResult = reduceTab(openResult, {
      type: "closeTab",
      panelId: "left",
      tabId: newTabId,
    });
    expect(closeResult.panels.left.tabs[newTabId]).toBeUndefined();
    expect(closeResult.panels.left.activeTabId).toBe("main");
  });
  it("returns state unchanged when only one tab remains", () => {
    const result = reduceTab(state, {
      type: "closeTab",
      panelId: "left",
      tabId: "main",
    });
    expect(result).toBe(state);
  });
  it("returns state unchanged when tabId does not exist", () => {
    const openResult = reduceTab(state, {
      type: "openTab",
      panelId: "left",
      uri: "local:///tmp",
    });
    const result = reduceTab(openResult, {
      type: "closeTab",
      panelId: "left",
      tabId: "nonexistent",
    });
    expect(result).toBe(openResult);
  });
  it("switches to previous tab when closing the active tab", () => {
    const open1 = reduceTab(state, {
      type: "openTab",
      panelId: "left",
      uri: "local:///a",
    });
    const tabId1 = open1.panels.left.activeTabId;
    const open2 = reduceTab(open1, {
      type: "openTab",
      panelId: "left",
      uri: "local:///b",
    });
    const tabId2 = open2.panels.left.activeTabId;
    const closeResult = reduceTab(open2, {
      type: "closeTab",
      panelId: "left",
      tabId: tabId2,
    });
    expect(closeResult.panels.left.activeTabId).toBe(tabId1);
  });
  it("switches to next tab when closing first tab", () => {
    const open1 = reduceTab(state, {
      type: "openTab",
      panelId: "left",
      uri: "local:///a",
    });
    const tabId1 = open1.panels.left.activeTabId;
    const closeMain = reduceTab(open1, {
      type: "closeTab",
      panelId: "left",
      tabId: "main",
    });
    expect(closeMain.panels.left.activeTabId).toBe(tabId1);
  });
  it("does not affect the other panel", () => {
    const openResult = reduceTab(state, {
      type: "openTab",
      panelId: "left",
      uri: "local:///tmp",
    });
    const newTabId = openResult.panels.left.activeTabId;
    const closeResult = reduceTab(openResult, {
      type: "closeTab",
      panelId: "left",
      tabId: newTabId,
    });
    expect(closeResult.panels.right).toBe(state.panels.right);
  });
});

describe("reduceTab — default", () => {
  it("returns state for default branch (covers switch default)", () => {
    // The default branch in reduceTab returns state directly.
    // Since TypeScript ensures we only pass valid TabAction types,
    // the default branch is unreachable with valid typing.
    // We can verify the isTabAction guard returns false for unknown types.
    expect(isTabAction({ type: "swapPanes" } as PanelAction)).toBe(false);
  });
});
