import type { FileOctopusState, PanelAction } from "../panelStore";
import { isListingAction, reduceListing } from "./slices/listingSlice";
import { isNavigationAction, reduceNavigation } from "./slices/navigationSlice";
import { isSelectionAction, reduceSelection } from "./slices/selectionSlice";
import { isSortFilterAction, reduceSortFilter } from "./slices/sortFilterSlice";
import { isTabAction, reduceTab } from "./slices/tabsSlice";
import {
  isContentSearchAction,
  reduceContentSearch,
} from "./slices/contentSearchSlice";

export function reducePanelAction(
  state: FileOctopusState,
  action: PanelAction,
): FileOctopusState {
  if (isTabAction(action)) {
    return reduceTab(state, action);
  }
  if (isContentSearchAction(action)) {
    return reduceContentSearch(state, action);
  }
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
