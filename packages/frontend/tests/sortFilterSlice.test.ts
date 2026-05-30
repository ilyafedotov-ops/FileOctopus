import { describe, expect, it, beforeEach } from "vitest";
import {
  reduceSortFilter,
  isSortFilterAction,
} from "../src/state/slices/sortFilterSlice";
import { createInitialState, activeTab } from "../src/panelStore";
import type { FileOctopusState } from "../src/panelStore";

let state: FileOctopusState;

beforeEach(() => {
  localStorage.clear();
  state = createInitialState("local:///home", "local:///home");
});

describe("isSortFilterAction", () => {
  it("matches setFilter", () => {
    expect(
      isSortFilterAction({ type: "setFilter", panelId: "left", filter: "a" }),
    ).toBe(true);
  });
  it("matches setRecursiveQuery", () => {
    expect(
      isSortFilterAction({
        type: "setRecursiveQuery",
        panelId: "left",
        query: "q",
      }),
    ).toBe(true);
  });
  it("matches setSort", () => {
    expect(
      isSortFilterAction({ type: "setSort", panelId: "left", field: "name" }),
    ).toBe(true);
  });
  it("matches setViewMode", () => {
    expect(
      isSortFilterAction({
        type: "setViewMode",
        panelId: "left",
        viewMode: "list",
      }),
    ).toBe(true);
  });
  it("matches toggleHidden", () => {
    expect(isSortFilterAction({ type: "toggleHidden", panelId: "left" })).toBe(
      true,
    );
  });
  it("matches hydratePreferences", () => {
    expect(
      isSortFilterAction({
        type: "hydratePreferences",
        showHidden: false,
        viewMode: "details",
      }),
    ).toBe(true);
  });
  it("matches setHash", () => {
    expect(
      isSortFilterAction({
        type: "setHash",
        panelId: "left",
        entryId: "e1",
        hashState: "abc",
      }),
    ).toBe(true);
  });
  it("does not match navigate", () => {
    expect(
      isSortFilterAction({
        type: "navigate",
        panelId: "left",
        uri: "local:///x",
      }),
    ).toBe(false);
  });
  it("does not match setSelection", () => {
    expect(
      isSortFilterAction({
        type: "setSelection",
        panelId: "left",
        entryId: null,
      }),
    ).toBe(false);
  });
  it("does not match swapPanes", () => {
    expect(isSortFilterAction({ type: "swapPanes" })).toBe(false);
  });
});

describe("reduceSortFilter — setFilter", () => {
  it("sets filter text on the panel", () => {
    const result = reduceSortFilter(state, {
      type: "setFilter",
      panelId: "left",
      filter: "test",
    });
    expect(activeTab(result.panels.left).filter).toBe("test");
  });
  it("does not affect the other panel", () => {
    const result = reduceSortFilter(state, {
      type: "setFilter",
      panelId: "left",
      filter: "test",
    });
    expect(activeTab(result.panels.right).filter).toBe("");
  });
  it("can clear filter with empty string", () => {
    let s = reduceSortFilter(state, {
      type: "setFilter",
      panelId: "left",
      filter: "abc",
    });
    s = reduceSortFilter(s, { type: "setFilter", panelId: "left", filter: "" });
    expect(activeTab(s.panels.left).filter).toBe("");
  });
});

describe("reduceSortFilter — setRecursiveQuery", () => {
  it("sets recursive query on the panel", () => {
    const result = reduceSortFilter(state, {
      type: "setRecursiveQuery",
      panelId: "right",
      query: "*.txt",
    });
    expect(activeTab(result.panels.right).recursiveQuery).toBe("*.txt");
  });
  it("does not affect the other panel", () => {
    const result = reduceSortFilter(state, {
      type: "setRecursiveQuery",
      panelId: "right",
      query: "*.txt",
    });
    expect(activeTab(result.panels.left).recursiveQuery).toBe("");
  });
});

describe("reduceSortFilter — setSort", () => {
  it("sets sort field with asc direction on first click", () => {
    const result = reduceSortFilter(state, {
      type: "setSort",
      panelId: "left",
      field: "size",
    });
    const tab = activeTab(result.panels.left);
    expect(tab.sort.field).toBe("size");
    expect(tab.sort.direction).toBe("asc");
  });
  it("toggles to desc when clicking same field again", () => {
    let s = reduceSortFilter(state, {
      type: "setSort",
      panelId: "left",
      field: "size",
    });
    s = reduceSortFilter(s, {
      type: "setSort",
      panelId: "left",
      field: "size",
    });
    expect(activeTab(s.panels.left).sort.direction).toBe("desc");
  });
  it("resets to asc when clicking different field", () => {
    let s = reduceSortFilter(state, {
      type: "setSort",
      panelId: "left",
      field: "size",
    });
    s = reduceSortFilter(s, {
      type: "setSort",
      panelId: "left",
      field: "size",
    });
    expect(activeTab(s.panels.left).sort.direction).toBe("desc");
    s = reduceSortFilter(s, {
      type: "setSort",
      panelId: "left",
      field: "modified",
    });
    expect(activeTab(s.panels.left).sort.field).toBe("modified");
    expect(activeTab(s.panels.left).sort.direction).toBe("asc");
  });
  it("persists sort to localStorage", () => {
    // Default sort is name/asc; clicking same field toggles to desc
    reduceSortFilter(state, {
      type: "setSort",
      panelId: "left",
      field: "name",
    });
    const stored = localStorage.getItem("fileoctopus.sort.left");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.field).toBe("name");
    expect(parsed.direction).toBe("desc");
  });
  it("persists per-panel independently", () => {
    reduceSortFilter(state, {
      type: "setSort",
      panelId: "left",
      field: "name",
    });
    reduceSortFilter(state, {
      type: "setSort",
      panelId: "right",
      field: "size",
    });
    const leftStored = JSON.parse(
      localStorage.getItem("fileoctopus.sort.left")!,
    );
    const rightStored = JSON.parse(
      localStorage.getItem("fileoctopus.sort.right")!,
    );
    expect(leftStored.field).toBe("name");
    expect(rightStored.field).toBe("size");
  });
});

describe("reduceSortFilter — setViewMode", () => {
  it("changes view mode", () => {
    const result = reduceSortFilter(state, {
      type: "setViewMode",
      panelId: "left",
      viewMode: "list",
    });
    expect(activeTab(result.panels.left).viewMode).toBe("list");
  });
  it("persists view mode to localStorage", () => {
    reduceSortFilter(state, {
      type: "setViewMode",
      panelId: "left",
      viewMode: "icons",
    });
    expect(localStorage.getItem("fileoctopus.viewMode.left")).toBe("icons");
  });
  it("does not affect other panel", () => {
    const result = reduceSortFilter(state, {
      type: "setViewMode",
      panelId: "left",
      viewMode: "compact",
    });
    expect(activeTab(result.panels.right).viewMode).not.toBe("compact");
  });
});

describe("reduceSortFilter — toggleHidden", () => {
  it("toggles showHidden from false to true", () => {
    const result = reduceSortFilter(state, {
      type: "toggleHidden",
      panelId: "left",
    });
    expect(activeTab(result.panels.left).showHidden).toBe(true);
  });
  it("toggles back to false", () => {
    let s = reduceSortFilter(state, { type: "toggleHidden", panelId: "left" });
    s = reduceSortFilter(s, { type: "toggleHidden", panelId: "left" });
    expect(activeTab(s.panels.left).showHidden).toBe(false);
  });
  it("persists showHidden to localStorage", () => {
    reduceSortFilter(state, { type: "toggleHidden", panelId: "left" });
    expect(localStorage.getItem("fileoctopus.showHidden.left")).toBe("true");
  });
  it("resets entries and selection state", () => {
    const result = reduceSortFilter(state, {
      type: "toggleHidden",
      panelId: "left",
    });
    const tab = activeTab(result.panels.left);
    expect(tab.entriesById).toEqual({});
    expect(tab.orderedEntryIds).toEqual([]);
    expect(tab.selectedIds).toEqual([]);
    expect(tab.selectedId).toBeNull();
    expect(tab.focusedId).toBeNull();
    expect(tab.anchorId).toBeNull();
    expect(tab.sessionId).toBeNull();
    expect(tab.activeRequestId).toBeNull();
    expect(tab.loadState).toBe("loading");
    expect(tab.error).toBeNull();
    expect(tab.errorCode).toBeNull();
  });
});

describe("reduceSortFilter — hydratePreferences", () => {
  it("applies default viewMode and showHidden from action", () => {
    const result = reduceSortFilter(state, {
      type: "hydratePreferences",
      showHidden: true,
      viewMode: "list",
    });
    expect(activeTab(result.panels.left).showHidden).toBe(true);
    expect(activeTab(result.panels.left).viewMode).toBe("list");
    expect(activeTab(result.panels.right).showHidden).toBe(true);
    expect(activeTab(result.panels.right).viewMode).toBe("list");
  });
  it("reads per-pane viewMode from localStorage over action default", () => {
    localStorage.setItem("fileoctopus.viewMode.left", "icons");
    const result = reduceSortFilter(state, {
      type: "hydratePreferences",
      showHidden: false,
      viewMode: "details",
    });
    expect(activeTab(result.panels.left).viewMode).toBe("icons");
    expect(activeTab(result.panels.right).viewMode).toBe("details");
  });
  it("reads per-pane showHidden from localStorage over action default", () => {
    localStorage.setItem("fileoctopus.showHidden.right", "true");
    const result = reduceSortFilter(state, {
      type: "hydratePreferences",
      showHidden: false,
      viewMode: "details",
    });
    expect(activeTab(result.panels.left).showHidden).toBe(false);
    expect(activeTab(result.panels.right).showHidden).toBe(true);
  });
  it("handles missing localStorage gracefully", () => {
    const result = reduceSortFilter(state, {
      type: "hydratePreferences",
      showHidden: false,
      viewMode: "details",
    });
    expect(activeTab(result.panels.left).showHidden).toBe(false);
    expect(activeTab(result.panels.left).viewMode).toBe("details");
  });
});

describe("reduceSortFilter — setHash", () => {
  it("sets hash state for an entry", () => {
    const result = reduceSortFilter(state, {
      type: "setHash",
      panelId: "left",
      entryId: "local:///home/file.txt",
      hashState: "abc123",
    });
    expect(
      activeTab(result.panels.left).hashMap["local:///home/file.txt"],
    ).toBe("abc123");
  });
  it("preserves existing hash entries", () => {
    let s = reduceSortFilter(state, {
      type: "setHash",
      panelId: "left",
      entryId: "file1",
      hashState: "hash1",
    });
    s = reduceSortFilter(s, {
      type: "setHash",
      panelId: "left",
      entryId: "file2",
      hashState: "hash2",
    });
    const map = activeTab(s.panels.left).hashMap;
    expect(map["file1"]).toBe("hash1");
    expect(map["file2"]).toBe("hash2");
  });
  it("can set computing state", () => {
    const result = reduceSortFilter(state, {
      type: "setHash",
      panelId: "left",
      entryId: "file1",
      hashState: "computing",
    });
    expect(activeTab(result.panels.left).hashMap["file1"]).toBe("computing");
  });
  it("can set error state", () => {
    const result = reduceSortFilter(state, {
      type: "setHash",
      panelId: "left",
      entryId: "file1",
      hashState: "error",
    });
    expect(activeTab(result.panels.left).hashMap["file1"]).toBe("error");
  });
  it("does not affect other panel hash map", () => {
    const result = reduceSortFilter(state, {
      type: "setHash",
      panelId: "left",
      entryId: "file1",
      hashState: "abc",
    });
    expect(Object.keys(activeTab(result.panels.right).hashMap).length).toBe(0);
  });
});
