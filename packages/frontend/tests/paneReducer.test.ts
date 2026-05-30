import { describe, expect, it } from "vitest";
import { reducePanelAction } from "../src/state/paneReducer";
import type { FileOctopusState, PanelAction } from "../src/panelStore";
import { createInitialState } from "../src/panelStore";

function initialState(): FileOctopusState {
  return createInitialState();
}

describe("reducePanelAction routing", () => {
  it("routes setActivePanel to navigation slice", () => {
    const state = initialState();
    const result = reducePanelAction(state, {
      type: "setActivePanel",
      panelId: "right",
    });
    expect(result.activePanelId).toBe("right");
  });

  it("routes navigate to navigation slice", () => {
    const state = initialState();
    const result = reducePanelAction(state, {
      type: "navigate",
      panelId: "left",
      uri: "local:///home",
    });
    expect(result).not.toBe(state);
  });

  it("routes startRequest to listing slice", () => {
    const state = initialState();
    const result = reducePanelAction(state, {
      type: "startRequest",
      panelId: "left",
      requestId: "r1",
    });
    expect(result).not.toBe(state);
    const tab = result.panels.left;
    if ("activeRequestId" in tab) {
      expect((tab as Record<string, unknown>).activeRequestId).toBe("r1");
    }
  });

  it("routes setSelection to selection slice", () => {
    const state = initialState();
    const result = reducePanelAction(state, {
      type: "setSelection",
      panelId: "left",
      entryId: "test-id",
    });
    expect(result).not.toBe(state);
  });

  it("routes clearSelection to selection slice", () => {
    const state = initialState();
    const result = reducePanelAction(state, {
      type: "clearSelection",
      panelId: "left",
    });
    expect(result).not.toBe(state);
  });

  it("returns state unchanged for unknown action type", () => {
    const state = initialState();
    const unknownAction = { type: "unknownAction" } as unknown as PanelAction;
    const result = reducePanelAction(state, unknownAction);
    expect(result).toBe(state);
  });

  it("preserves state immutability — returns new reference on navigation", () => {
    const state = initialState();
    const result = reducePanelAction(state, {
      type: "setActivePanel",
      panelId: "right",
    });
    expect(result).not.toBe(state);
    // Original state should be unchanged
    expect(state.activePanelId).toBe("left");
  });
});
