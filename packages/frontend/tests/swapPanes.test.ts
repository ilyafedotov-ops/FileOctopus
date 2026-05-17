import { describe, it, expect } from "vitest";
import { panelReducer, createInitialState } from "../src/panelStore";
import type { FileOctopusState, PanelAction } from "../src/panelStore";

describe("swapPanes action", () => {
  it("swaps left and right panel state", () => {
    const state = createInitialState("local:///home/user", "local:///tmp");
    const leftUri = state.panels.left.tabs[state.panels.left.activeTabId].uri;
    const rightUri =
      state.panels.right.tabs[state.panels.right.activeTabId].uri;

    const action: PanelAction = { type: "swapPanes" } as PanelAction;
    const next = panelReducer(state, action);

    const newLeftUri = next.panels.left.tabs[next.panels.left.activeTabId].uri;
    const newRightUri =
      next.panels.right.tabs[next.panels.right.activeTabId].uri;

    expect(newLeftUri).toBe(rightUri);
    expect(newRightUri).toBe(leftUri);
  });

  it("preserves activePanelId", () => {
    const state = createInitialState("local:///home/user", "local:///tmp");
    expect(state.activePanelId).toBe("left");

    const action: PanelAction = { type: "swapPanes" } as PanelAction;
    const next = panelReducer(state, action);

    expect(next.activePanelId).toBe("left");
  });

  it("swaps selection state along with URI", () => {
    const state = createInitialState("local:///home/user", "local:///tmp");
    // Simulate left panel having a selected item
    const leftTab = state.panels.left.tabs[state.panels.left.activeTabId];
    const modifiedState: FileOctopusState = {
      ...state,
      panels: {
        ...state.panels,
        left: {
          ...state.panels.left,
          tabs: {
            ...state.panels.left.tabs,
            [state.panels.left.activeTabId]: {
              ...leftTab,
              selectedId: "file1",
              selectedIds: ["file1"],
            },
          },
        },
      },
    };

    const action: PanelAction = { type: "swapPanes" } as PanelAction;
    const next = panelReducer(modifiedState, action);

    const newRightTab = next.panels.right.tabs[next.panels.right.activeTabId];
    expect(newRightTab.selectedId).toBe("file1");
    expect(newRightTab.selectedIds).toEqual(["file1"]);
  });
});
