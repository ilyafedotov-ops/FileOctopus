import { describe, expect, it, beforeEach } from "vitest";
import {
  isSelectionAction,
  reduceSelection,
} from "../src/state/slices/selectionSlice";
import { createInitialState, activeTab } from "../src/panelStore";
import type { FileOctopusState, PanelAction } from "../src/panelStore";
import type { FileEntryDto } from "@fileoctopus/ts-api";

function makeEntry(name: string, id: string): FileEntryDto {
  return {
    name,
    uri: `local:///home/${id}`,
    kind: "file",
    size: 100,
    extension: ".txt",
    modifiedAt: "2026-01-01T00:00:00Z",
    createdAt: null,
    isHidden: false,
    canRead: true,
    canWrite: true,
    canDelete: true,
    canRename: true,
    canList: false,
    providerId: "local",
  };
}

let state: FileOctopusState;

beforeEach(() => {
  localStorage.clear();
  state = createInitialState("local:///home", "local:///home");
});

function addEntries(state: FileOctopusState, panelId: "left" | "right") {
  const entries = [
    makeEntry("file-a", "file-a"),
    makeEntry("file-b", "file-b"),
    makeEntry("file-c", "file-c"),
  ];
  const tab = activeTab(state.panels[panelId]);
  const entriesById = { ...tab.entriesById };
  const orderedEntryIds = [...tab.orderedEntryIds];
  for (const e of entries) {
    entriesById[e.uri] = e;
    orderedEntryIds.push(e.uri);
  }
  return {
    ...state,
    panels: {
      ...state.panels,
      [panelId]: {
        ...state.panels[panelId],
        tabs: {
          ...state.panels[panelId].tabs,
          [state.panels[panelId].activeTabId]: {
            ...tab,
            entriesById,
            orderedEntryIds,
            loadState: "loaded" as const,
          },
        },
      },
    },
  };
}

describe("isSelectionAction", () => {
  it("matches setSelection", () => {
    expect(
      isSelectionAction({
        type: "setSelection",
        panelId: "left",
        entryId: "x",
      } as PanelAction),
    ).toBe(true);
  });
  it("matches selectAll", () => {
    expect(
      isSelectionAction({ type: "selectAll", panelId: "left" } as PanelAction),
    ).toBe(true);
  });
  it("matches invertSelection", () => {
    expect(
      isSelectionAction({
        type: "invertSelection",
        panelId: "left",
      } as PanelAction),
    ).toBe(true);
  });
  it("matches clearSelection", () => {
    expect(
      isSelectionAction({
        type: "clearSelection",
        panelId: "left",
      } as PanelAction),
    ).toBe(true);
  });
  it("matches selectEntry", () => {
    expect(
      isSelectionAction({
        type: "selectEntry",
        panelId: "left",
        entryId: "x",
        mode: "replace",
      } as PanelAction),
    ).toBe(true);
  });
  it("matches moveSelection", () => {
    expect(
      isSelectionAction({
        type: "moveSelection",
        panelId: "left",
        delta: 1,
      } as PanelAction),
    ).toBe(true);
  });
  it("does not match navigate", () => {
    expect(
      isSelectionAction({
        type: "navigate",
        panelId: "left",
        uri: "x",
      } as PanelAction),
    ).toBe(false);
  });
  it("does not match setActivePanel", () => {
    expect(
      isSelectionAction({
        type: "setActivePanel",
        panelId: "left",
      } as PanelAction),
    ).toBe(false);
  });
});

describe("reduceSelection", () => {
  it("setSelection sets selectedIds to single entry", () => {
    const result = reduceSelection(state, {
      type: "setSelection",
      panelId: "left",
      entryId: "local:///home/file-a",
    });
    const tab = activeTab(result.panels.left);
    expect(tab.selectedIds).toEqual(["local:///home/file-a"]);
    expect(tab.selectedId).toBe("local:///home/file-a");
    expect(tab.focusedId).toBe("local:///home/file-a");
    expect(tab.anchorId).toBe("local:///home/file-a");
  });

  it("setSelection with null entryId clears selection", () => {
    state = addEntries(state, "left");
    const result = reduceSelection(state, {
      type: "setSelection",
      panelId: "left",
      entryId: null,
    });
    const tab = activeTab(result.panels.left);
    expect(tab.selectedIds).toEqual([]);
    expect(tab.selectedId).toBeNull();
  });

  it("selectAll selects all visible entries", () => {
    state = addEntries(state, "left");
    const result = reduceSelection(state, {
      type: "selectAll",
      panelId: "left",
    });
    const tab = activeTab(result.panels.left);
    expect(tab.selectedIds.length).toBe(3);
  });

  it("clearSelection clears all selection state", () => {
    state = addEntries(state, "left");
    const selected = reduceSelection(state, {
      type: "selectAll",
      panelId: "left",
    });
    const result = reduceSelection(selected, {
      type: "clearSelection",
      panelId: "left",
    });
    const tab = activeTab(result.panels.left);
    expect(tab.selectedIds).toEqual([]);
    expect(tab.selectedId).toBeNull();
    expect(tab.focusedId).toBeNull();
    expect(tab.anchorId).toBeNull();
  });

  it("invertSelection toggles selection", () => {
    state = addEntries(state, "left");
    // Select first entry
    const selected = reduceSelection(state, {
      type: "setSelection",
      panelId: "left",
      entryId: "local:///home/file-a",
    });
    // Invert
    const inverted = reduceSelection(selected, {
      type: "invertSelection",
      panelId: "left",
    });
    const tab = activeTab(inverted.panels.left);
    expect(tab.selectedIds).not.toContain("local:///home/file-a");
    expect(tab.selectedIds).toContain("local:///home/file-b");
    expect(tab.selectedIds).toContain("local:///home/file-c");
  });

  it("invertSelection with empty initial selection selects all", () => {
    state = addEntries(state, "left");
    const cleared = reduceSelection(state, {
      type: "clearSelection",
      panelId: "left",
    });
    const inverted = reduceSelection(cleared, {
      type: "invertSelection",
      panelId: "left",
    });
    const tab = activeTab(inverted.panels.left);
    expect(tab.selectedIds.length).toBe(3);
  });

  it("does not affect right panel when operating on left", () => {
    const rightTabBefore = activeTab(state.panels.right);
    const result = reduceSelection(state, {
      type: "setSelection",
      panelId: "left",
      entryId: "local:///home/file-a",
    });
    const rightTabAfter = activeTab(result.panels.right);
    expect(rightTabAfter.selectedIds).toEqual(rightTabBefore.selectedIds);
  });
});
