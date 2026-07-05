import type { FileOctopusState, PanelAction } from "../../panelStore";
import {
  moveSelection,
  selectEntry,
  selectVisibleEntries,
  updatePanel,
} from "../../panelStore";

type SelectionAction = Extract<
  PanelAction,
  | { type: "setSelection" }
  | { type: "setSelectionMany" }
  | { type: "selectAll" }
  | { type: "invertSelection" }
  | { type: "clearSelection" }
  | { type: "selectEntry" }
  | { type: "moveSelection" }
>;

export function isSelectionAction(
  action: PanelAction,
): action is SelectionAction {
  return (
    action.type === "setSelection" ||
    action.type === "setSelectionMany" ||
    action.type === "selectAll" ||
    action.type === "invertSelection" ||
    action.type === "clearSelection" ||
    action.type === "selectEntry" ||
    action.type === "moveSelection"
  );
}

export function reduceSelection(
  state: FileOctopusState,
  action: SelectionAction,
): FileOctopusState {
  switch (action.type) {
    case "setSelection":
      return updatePanel(state, action.panelId, (tab) => ({
        ...tab,
        selectedIds: action.entryId ? [action.entryId] : [],
        selectedId: action.entryId,
        focusedId: action.entryId,
        anchorId: action.entryId,
      }));
    case "setSelectionMany":
      return updatePanel(state, action.panelId, (tab) => {
        const existing = new Set(Object.keys(tab.entriesById));
        const ids = action.entryIds.filter((id) => existing.has(id));
        const focusedId = ids[ids.length - 1] ?? null;
        return {
          ...tab,
          selectedIds: ids,
          selectedId: focusedId,
          focusedId,
          anchorId: ids[0] ?? null,
        };
      });
    case "selectAll":
      return updatePanel(state, action.panelId, (tab) => {
        const ids = selectVisibleEntries(tab).map((entry) => entry.uri);
        return {
          ...tab,
          selectedIds: ids,
          selectedId: ids[0] ?? null,
          focusedId: ids[0] ?? null,
          anchorId: ids[0] ?? null,
        };
      });
    case "invertSelection":
      return updatePanel(state, action.panelId, (tab) => {
        const selected = new Set(tab.selectedIds);
        const ids = selectVisibleEntries(tab)
          .map((entry) => entry.uri)
          .filter((id) => !selected.has(id));
        return {
          ...tab,
          selectedIds: ids,
          selectedId: ids[0] ?? null,
          focusedId: ids[0] ?? null,
          anchorId: ids[0] ?? null,
        };
      });
    case "clearSelection":
      return updatePanel(state, action.panelId, (tab) => ({
        ...tab,
        selectedIds: [],
        selectedId: null,
        focusedId: null,
        anchorId: null,
      }));
    case "selectEntry":
      return updatePanel(state, action.panelId, (tab) =>
        selectEntry(tab, action.entryId, action.mode),
      );
    case "moveSelection":
      return updatePanel(state, action.panelId, (tab) =>
        moveSelection(tab, action.delta),
      );
    default:
      return state;
  }
}
