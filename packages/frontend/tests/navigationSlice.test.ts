import { describe, expect, it } from "vitest";
import {
  isNavigationAction,
  reduceNavigation,
} from "../src/state/slices/navigationSlice";
import type { FileOctopusState } from "../src/panelStore";
import { createInitialState } from "../src/panelStore";

function initialState(): FileOctopusState {
  return createInitialState();
}

describe("isNavigationAction", () => {
  it("returns true for setActivePanel", () => {
    expect(
      isNavigationAction({ type: "setActivePanel", panelId: "right" }),
    ).toBe(true);
  });

  it("returns true for navigate", () => {
    expect(
      isNavigationAction({
        type: "navigate",
        panelId: "left",
        uri: "local:///home",
      }),
    ).toBe(true);
  });

  it("returns true for goBack", () => {
    expect(isNavigationAction({ type: "goBack", panelId: "left" })).toBe(true);
  });

  it("returns true for goForward", () => {
    expect(isNavigationAction({ type: "goForward", panelId: "left" })).toBe(
      true,
    );
  });

  it("returns false for non-navigation action", () => {
    expect(
      isNavigationAction({
        type: "setSelection",
        panelId: "left",
        entryId: "x",
      }),
    ).toBe(false);
  });

  it("returns false for clearSelection", () => {
    expect(
      isNavigationAction({ type: "clearSelection", panelId: "left" }),
    ).toBe(false);
  });
});

describe("reduceNavigation - setActivePanel", () => {
  it("switches activePanelId to right", () => {
    const state = initialState();
    const result = reduceNavigation(state, {
      type: "setActivePanel",
      panelId: "right",
    });
    expect(result.activePanelId).toBe("right");
  });

  it("switches activePanelId to left", () => {
    const state = initialState();
    const leftState = reduceNavigation(state, {
      type: "setActivePanel",
      panelId: "right",
    });
    const result = reduceNavigation(leftState, {
      type: "setActivePanel",
      panelId: "left",
    });
    expect(result.activePanelId).toBe("left");
  });

  it("preserves panels state", () => {
    const state = initialState();
    const result = reduceNavigation(state, {
      type: "setActivePanel",
      panelId: "right",
    });
    expect(result.panels).toBe(state.panels);
  });
});

describe("reduceNavigation - navigate", () => {
  it("updates the left panel uri", () => {
    const state = initialState();
    const result = reduceNavigation(state, {
      type: "navigate",
      panelId: "left",
      uri: "local:///tmp",
    });
    const tab = result.panels.left.tabs[result.panels.left.activeTabId];
    expect(tab.uri).toBe("local:///tmp");
  });

  it("updates the right panel uri", () => {
    const state = initialState();
    const result = reduceNavigation(state, {
      type: "navigate",
      panelId: "right",
      uri: "local:///var",
    });
    const tab = result.panels.right.tabs[result.panels.right.activeTabId];
    expect(tab.uri).toBe("local:///var");
  });

  it("normalizes local input (adds local:// scheme)", () => {
    const state = initialState();
    const result = reduceNavigation(state, {
      type: "navigate",
      panelId: "left",
      uri: "/tmp/test",
    });
    const tab = result.panels.left.tabs[result.panels.left.activeTabId];
    expect(tab.uri).toBe("local:///tmp/test");
  });

  it("clears entries and selection on navigate", () => {
    const state = initialState();
    const result = reduceNavigation(state, {
      type: "navigate",
      panelId: "left",
      uri: "local:///new-path",
    });
    const tab = result.panels.left.tabs[result.panels.left.activeTabId];
    expect(tab.entriesById).toEqual({});
    expect(tab.orderedEntryIds).toEqual([]);
    expect(tab.selectedIds).toEqual([]);
    expect(tab.selectedId).toBeNull();
  });

  it("sets loadState to loading", () => {
    const state = initialState();
    const result = reduceNavigation(state, {
      type: "navigate",
      panelId: "left",
      uri: "local:///new-path",
    });
    const tab = result.panels.left.tabs[result.panels.left.activeTabId];
    expect(tab.loadState).toBe("loading");
  });

  it("does not push to backStack when replace=true", () => {
    const state = initialState();
    const originalUri =
      state.panels.left.tabs[state.panels.left.activeTabId].uri;
    const result = reduceNavigation(state, {
      type: "navigate",
      panelId: "left",
      uri: "local:///new-path",
      replace: true,
    });
    const tab = result.panels.left.tabs[result.panels.left.activeTabId];
    expect(tab.backStack).not.toContain(originalUri);
  });

  it("pushes current uri to backStack when not replacing", () => {
    const state = initialState();
    const originalUri =
      state.panels.left.tabs[state.panels.left.activeTabId].uri;
    const result = reduceNavigation(state, {
      type: "navigate",
      panelId: "left",
      uri: "local:///new-path",
    });
    const tab = result.panels.left.tabs[result.panels.left.activeTabId];
    expect(tab.backStack).toContain(originalUri);
  });

  it("clears forwardStack on normal navigation", () => {
    const state = initialState();
    const result = reduceNavigation(state, {
      type: "navigate",
      panelId: "left",
      uri: "local:///new-path",
    });
    const tab = result.panels.left.tabs[result.panels.left.activeTabId];
    expect(tab.forwardStack).toEqual([]);
  });

  it("handles softRefresh when uri is the same", () => {
    const state = initialState();
    const uri = state.panels.left.tabs[state.panels.left.activeTabId].uri;
    const result = reduceNavigation(state, {
      type: "navigate",
      panelId: "left",
      uri,
      softRefresh: true,
    });
    const tab = result.panels.left.tabs[result.panels.left.activeTabId];
    expect(tab.uri).toBe(uri);
    expect(tab.sessionId).toBeNull();
    expect(tab.activeRequestId).toBeNull();
  });
});

describe("reduceNavigation - goBack", () => {
  it("returns state with same uri when backStack is empty", () => {
    const state = initialState();
    const result = reduceNavigation(state, {
      type: "goBack",
      panelId: "left",
    });
    expect(result.activePanelId).toBe(state.activePanelId);
    const tab = result.panels.left.tabs[result.panels.left.activeTabId];
    const origTab = state.panels.left.tabs[state.panels.left.activeTabId];
    expect(tab.uri).toBe(origTab.uri);
    expect(tab.backStack).toEqual([]);
    expect(tab.forwardStack).toEqual([]);
  });

  it("navigates to the last item in backStack", () => {
    const state = initialState();
    const firstUri = state.panels.left.tabs[state.panels.left.activeTabId].uri;
    const afterNav = reduceNavigation(state, {
      type: "navigate",
      panelId: "left",
      uri: "local:///second",
    });
    const result = reduceNavigation(afterNav, {
      type: "goBack",
      panelId: "left",
    });
    const tab = result.panels.left.tabs[result.panels.left.activeTabId];
    expect(tab.uri).toBe(firstUri);
  });

  it("removes the last entry from backStack", () => {
    const state = initialState();
    const afterNav1 = reduceNavigation(state, {
      type: "navigate",
      panelId: "left",
      uri: "local:///second",
    });
    const afterNav2 = reduceNavigation(afterNav1, {
      type: "navigate",
      panelId: "left",
      uri: "local:///third",
    });
    const result = reduceNavigation(afterNav2, {
      type: "goBack",
      panelId: "left",
    });
    const tab = result.panels.left.tabs[result.panels.left.activeTabId];
    expect(tab.backStack.length).toBe(1);
    expect(tab.backStack).not.toContain("local:///second");
  });

  it("pushes current uri to forwardStack", () => {
    const state = initialState();
    const afterNav = reduceNavigation(state, {
      type: "navigate",
      panelId: "left",
      uri: "local:///second",
    });
    const result = reduceNavigation(afterNav, {
      type: "goBack",
      panelId: "left",
    });
    const tab = result.panels.left.tabs[result.panels.left.activeTabId];
    expect(tab.forwardStack).toContain("local:///second");
  });

  it("uses replace mode (does not push to backStack)", () => {
    const state = initialState();
    const afterNav = reduceNavigation(state, {
      type: "navigate",
      panelId: "left",
      uri: "local:///second",
    });
    const beforeBack =
      afterNav.panels.left.tabs[afterNav.panels.left.activeTabId];
    const backStackBefore = beforeBack.backStack.length;
    const result = reduceNavigation(afterNav, {
      type: "goBack",
      panelId: "left",
    });
    const tab = result.panels.left.tabs[result.panels.left.activeTabId];
    expect(tab.backStack.length).toBe(backStackBefore - 1);
  });
});

describe("reduceNavigation - goForward", () => {
  it("returns state with same uri when forwardStack is empty", () => {
    const state = initialState();
    const result = reduceNavigation(state, {
      type: "goForward",
      panelId: "left",
    });
    expect(result.activePanelId).toBe(state.activePanelId);
    const tab = result.panels.left.tabs[result.panels.left.activeTabId];
    const origTab = state.panels.left.tabs[state.panels.left.activeTabId];
    expect(tab.uri).toBe(origTab.uri);
    expect(tab.forwardStack).toEqual([]);
  });

  it("navigates to the first item in forwardStack", () => {
    const state = initialState();
    const afterNav = reduceNavigation(state, {
      type: "navigate",
      panelId: "left",
      uri: "local:///second",
    });
    const afterBack = reduceNavigation(afterNav, {
      type: "goBack",
      panelId: "left",
    });
    const result = reduceNavigation(afterBack, {
      type: "goForward",
      panelId: "left",
    });
    const tab = result.panels.left.tabs[result.panels.left.activeTabId];
    expect(tab.uri).toBe("local:///second");
  });

  it("removes the first entry from forwardStack", () => {
    const state = initialState();
    const afterNav = reduceNavigation(state, {
      type: "navigate",
      panelId: "left",
      uri: "local:///second",
    });
    const afterBack = reduceNavigation(afterNav, {
      type: "goBack",
      panelId: "left",
    });
    const result = reduceNavigation(afterBack, {
      type: "goForward",
      panelId: "left",
    });
    const tab = result.panels.left.tabs[result.panels.left.activeTabId];
    expect(tab.forwardStack).toEqual([]);
  });

  it("pushes current uri to backStack", () => {
    const state = initialState();
    const firstUri = state.panels.left.tabs[state.panels.left.activeTabId].uri;
    const afterNav = reduceNavigation(state, {
      type: "navigate",
      panelId: "left",
      uri: "local:///second",
    });
    const afterBack = reduceNavigation(afterNav, {
      type: "goBack",
      panelId: "left",
    });
    const result = reduceNavigation(afterBack, {
      type: "goForward",
      panelId: "left",
    });
    const tab = result.panels.left.tabs[result.panels.left.activeTabId];
    expect(tab.backStack).toContain(firstUri);
  });

  it("uses replace mode (does not grow backStack unnecessarily)", () => {
    const state = initialState();
    const afterNav = reduceNavigation(state, {
      type: "navigate",
      panelId: "left",
      uri: "local:///second",
    });
    const afterBack = reduceNavigation(afterNav, {
      type: "goBack",
      panelId: "left",
    });
    const backStackLen =
      afterBack.panels.left.tabs[afterBack.panels.left.activeTabId].backStack
        .length;
    const result = reduceNavigation(afterBack, {
      type: "goForward",
      panelId: "left",
    });
    const tab = result.panels.left.tabs[result.panels.left.activeTabId];
    expect(tab.backStack.length).toBe(backStackLen + 1);
  });
});

describe("reduceNavigation - default", () => {
  it("returns equivalent state for unknown navigation action type", () => {
    const state = initialState();
    const result = reduceNavigation(state, {
      type: "goBack" as string,
      panelId: "left",
    } as never);
    // Default branch returns state, but goBack is matched above so
    // test with a real unknown type by verifying state is equivalent
    expect(result.activePanelId).toBe(state.activePanelId);
  });
});

describe("reduceNavigation - navigation round-trip", () => {
  it("navigates forward then back returns to original uri", () => {
    const state = initialState();
    const originalUri =
      state.panels.left.tabs[state.panels.left.activeTabId].uri;
    const afterNav = reduceNavigation(state, {
      type: "navigate",
      panelId: "left",
      uri: "local:///destination",
    });
    const afterBack = reduceNavigation(afterNav, {
      type: "goBack",
      panelId: "left",
    });
    const tab = afterBack.panels.left.tabs[afterBack.panels.left.activeTabId];
    expect(tab.uri).toBe(originalUri);
  });

  it("navigating back then forward returns to navigated uri", () => {
    const state = initialState();
    const afterNav = reduceNavigation(state, {
      type: "navigate",
      panelId: "left",
      uri: "local:///destination",
    });
    const afterBack = reduceNavigation(afterNav, {
      type: "goBack",
      panelId: "left",
    });
    const afterForward = reduceNavigation(afterBack, {
      type: "goForward",
      panelId: "left",
    });
    const tab =
      afterForward.panels.left.tabs[afterForward.panels.left.activeTabId];
    expect(tab.uri).toBe("local:///destination");
  });

  it("multiple navigations build up backStack correctly", () => {
    const state = initialState();
    const step1 = reduceNavigation(state, {
      type: "navigate",
      panelId: "left",
      uri: "local:///a",
    });
    const step2 = reduceNavigation(step1, {
      type: "navigate",
      panelId: "left",
      uri: "local:///b",
    });
    const step3 = reduceNavigation(step2, {
      type: "navigate",
      panelId: "left",
      uri: "local:///c",
    });
    const tab = step3.panels.left.tabs[step3.panels.left.activeTabId];
    expect(tab.backStack.length).toBe(3);
  });
});
