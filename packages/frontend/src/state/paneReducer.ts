import type { FileOctopusState, PanelAction } from "../panelStore";
import { isListingAction, reduceListing } from "./slices/listingSlice";
import { isNavigationAction, reduceNavigation } from "./slices/navigationSlice";
import { isSelectionAction, reduceSelection } from "./slices/selectionSlice";
import { isSortFilterAction, reduceSortFilter } from "./slices/sortFilterSlice";

export function reducePanelAction(
  state: FileOctopusState,
  action: PanelAction,
): FileOctopusState {
  if (isNavigationAction(action)) {
    return reduceNavigation(state, action);
  }
  if (isListingAction(action)) {
    return reduceListing(state, action);
  }
  if (isSelectionAction(action)) {
    return reduceSelection(state, action);
  }
  if (isSortFilterAction(action)) {
    return reduceSortFilter(state, action);
  }
  return state;
}
