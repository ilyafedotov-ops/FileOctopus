import { describe, expect, it } from "vitest";
import {
  activeTab,
  createInitialState,
  panelReducer,
  homeUri,
} from "../src/panelStore";

describe("tab management", () => {
  it("opens a new tab with a given URI", () => {
    let state = createInitialState();

    state = panelReducer(state, {
      type: "openTab",
      panelId: "left",
      uri: "local:///tmp",
    });

    const panel = state.panels.left;
    const tabIds = Object.keys(panel.tabs);
    expect(tabIds.length).toBe(2);
    expect(panel.activeTabId).not.toBe("main");
    expect(activeTab(panel).uri).toBe("local:///tmp");
  });

  it("switches to an existing tab", () => {
    let state = createInitialState();

    state = panelReducer(state, {
      type: "openTab",
      panelId: "left",
      uri: "local:///tmp",
    });

    const secondTabId = state.panels.left.activeTabId;

    state = panelReducer(state, {
      type: "switchTab",
      panelId: "left",
      tabId: "main",
    });

    expect(state.panels.left.activeTabId).toBe("main");
    expect(activeTab(state.panels.left).uri).toBe(homeUri());

    state = panelReducer(state, {
      type: "switchTab",
      panelId: "left",
      tabId: secondTabId,
    });

    expect(state.panels.left.activeTabId).toBe(secondTabId);
    expect(activeTab(state.panels.left).uri).toBe("local:///tmp");
  });

  it("closes a tab and switches to the previous one", () => {
    let state = createInitialState();

    state = panelReducer(state, {
      type: "openTab",
      panelId: "left",
      uri: "local:///tmp",
    });

    const secondTabId = state.panels.left.activeTabId;

    state = panelReducer(state, {
      type: "closeTab",
      panelId: "left",
      tabId: secondTabId,
    });

    expect(Object.keys(state.panels.left.tabs).length).toBe(1);
    expect(state.panels.left.activeTabId).toBe("main");
    expect(state.panels.left.tabs).not.toHaveProperty(secondTabId);
  });

  it("does not close the last remaining tab", () => {
    const state = createInitialState();

    const next = panelReducer(state, {
      type: "closeTab",
      panelId: "left",
      tabId: "main",
    });

    expect(Object.keys(next.panels.left.tabs).length).toBe(1);
    expect(next.panels.left.activeTabId).toBe("main");
    expect(next).toBe(state);
  });

  it("preserves state of background tabs", () => {
    let state = createInitialState();

    state = panelReducer(state, {
      type: "startSession",
      panelId: "left",
      sessionId: "s1",
      requestId: "r1",
    });

    state = panelReducer(state, {
      type: "openTab",
      panelId: "left",
      uri: "local:///tmp",
    });

    const secondTabId = state.panels.left.activeTabId;

    state = panelReducer(state, {
      type: "switchTab",
      panelId: "left",
      tabId: "main",
    });

    expect(state.panels.left.tabs.main.sessionId).toBe("s1");
    expect(state.panels.left.tabs[secondTabId].uri).toBe("local:///tmp");
  });

  it("generates unique tab IDs", () => {
    let state = createInitialState();

    state = panelReducer(state, {
      type: "openTab",
      panelId: "left",
      uri: "local:///a",
    });
    const id1 = state.panels.left.activeTabId;

    state = panelReducer(state, {
      type: "switchTab",
      panelId: "left",
      tabId: "main",
    });

    state = panelReducer(state, {
      type: "openTab",
      panelId: "left",
      uri: "local:///b",
    });
    const id2 = state.panels.left.activeTabId;

    expect(id1).not.toBe(id2);
    expect(id1).not.toBe("main");
    expect(id2).not.toBe("main");
    expect(Object.keys(state.panels.left.tabs).length).toBe(3);
  });

  it("closing a tab when multiple exist switches to the nearest tab", () => {
    let state = createInitialState();

    state = panelReducer(state, {
      type: "openTab",
      panelId: "left",
      uri: "local:///a",
    });

    state = panelReducer(state, {
      type: "openTab",
      panelId: "left",
      uri: "local:///b",
    });
    const tabB = state.panels.left.activeTabId;

    state = panelReducer(state, {
      type: "openTab",
      panelId: "left",
      uri: "local:///c",
    });
    const tabC = state.panels.left.activeTabId;

    expect(Object.keys(state.panels.left.tabs).length).toBe(4);

    state = panelReducer(state, {
      type: "closeTab",
      panelId: "left",
      tabId: tabB,
    });

    expect(state.panels.left.activeTabId).toBe(tabC);
    expect(Object.keys(state.panels.left.tabs).length).toBe(3);
  });

  it("openTab creates tab in loadState loading", () => {
    let state = createInitialState();

    state = panelReducer(state, {
      type: "openTab",
      panelId: "left",
      uri: "local:///tmp",
    });

    expect(activeTab(state.panels.left).loadState).toBe("loading");
    expect(activeTab(state.panels.left).entriesById).toEqual({});
    expect(activeTab(state.panels.left).orderedEntryIds).toEqual([]);
  });

  it("tab actions only affect the target panel", () => {
    let state = createInitialState();

    state = panelReducer(state, {
      type: "openTab",
      panelId: "left",
      uri: "local:///tmp",
    });

    expect(Object.keys(state.panels.right.tabs).length).toBe(1);
    expect(state.panels.right.activeTabId).toBe("main");
  });
});
