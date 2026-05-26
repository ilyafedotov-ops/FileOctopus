import { describe, it, expect } from "vitest";
import { panelReducer, createInitialState } from "../src/panelStore";
import type { FileEntryDto } from "@fileoctopus/ts-api";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

const archiveEntries: FileEntryDto[] = [
  {
    uri: "archive:///tmp/test.zip!/hello.txt",
    name: "hello.txt",
    kind: "file",
    size: 11,
    extension: "txt",
    modifiedAt: null,
    createdAt: null,
    accessedAt: null,
    isHidden: false,
    isSymlink: false,
    symlinkTarget: null,
    providerId: "archive",
    canRead: true,
    canWrite: false,
    canDelete: false,
    canRename: false,
    canList: false,
    permissions: null,
    owner: null,
  },
  {
    uri: "archive:///tmp/test.zip!/subdir",
    name: "subdir",
    kind: "directory",
    size: null,
    extension: null,
    modifiedAt: null,
    createdAt: null,
    accessedAt: null,
    isHidden: false,
    isSymlink: false,
    symlinkTarget: null,
    providerId: "archive",
    canRead: true,
    canWrite: false,
    canDelete: false,
    canRename: false,
    canList: true,
    permissions: null,
    owner: null,
  },
];

describe("setArchiveEntries reducer", () => {
  it("populates panel with archive entries and sets loadState to loaded", () => {
    const state = createInitialState();
    const result = panelReducer(state, {
      type: "setArchiveEntries",
      panelId: "left",
      uri: "archive:///tmp/test.zip",
      entries: archiveEntries,
    });

    const tab = result.panels.left.tabs[result.panels.left.activeTabId];
    expect(tab.uri).toBe("archive:///tmp/test.zip");
    expect(tab.loadState).toBe("loaded");
    expect(tab.orderedEntryIds).toHaveLength(2);
    expect(tab.entriesById[archiveEntries[0].uri]).toBeDefined();
    expect(tab.entriesById[archiveEntries[1].uri]).toBeDefined();
    expect(tab.error).toBeNull();
  });

  it("selects the first entry", () => {
    const state = createInitialState();
    const result = panelReducer(state, {
      type: "setArchiveEntries",
      panelId: "left",
      uri: "archive:///tmp/test.zip",
      entries: archiveEntries,
    });

    const tab = result.panels.left.tabs[result.panels.left.activeTabId];
    expect(tab.selectedId).toBe(archiveEntries[0].uri);
    expect(tab.selectedIds).toEqual([archiveEntries[0].uri]);
  });

  it("pushes previous URI to backStack", () => {
    const state = createInitialState();
    const prevUri = state.panels.left.tabs[state.panels.left.activeTabId].uri;

    const result = panelReducer(state, {
      type: "setArchiveEntries",
      panelId: "left",
      uri: "archive:///tmp/test.zip",
      entries: archiveEntries,
    });

    const tab = result.panels.left.tabs[result.panels.left.activeTabId];
    expect(tab.backStack).toContain(prevUri);
    expect(tab.forwardStack).toEqual([]);
  });

  it("clears filter", () => {
    let state = createInitialState();
    state = panelReducer(state, {
      type: "setFilter",
      panelId: "left",
      filter: "hello",
    });

    const result = panelReducer(state, {
      type: "setArchiveEntries",
      panelId: "left",
      uri: "archive:///tmp/test.zip",
      entries: archiveEntries,
    });

    const tab = result.panels.left.tabs[result.panels.left.activeTabId];
    expect(tab.filter).toBe("");
  });

  it("handles empty archive", () => {
    const state = createInitialState();
    const result = panelReducer(state, {
      type: "setArchiveEntries",
      panelId: "left",
      uri: "archive:///tmp/empty.zip",
      entries: [],
    });

    const tab = result.panels.left.tabs[result.panels.left.activeTabId];
    expect(tab.uri).toBe("archive:///tmp/empty.zip");
    expect(tab.loadState).toBe("loaded");
    expect(tab.orderedEntryIds).toHaveLength(0);
    expect(tab.selectedId).toBeNull();
  });
});
