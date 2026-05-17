import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

export interface LayoutFocusState {
  pathFocusToken: number;
  renameFocusToken: number;
  filterFocusToken: number;
  recursiveSearchFocusToken: number;
}

export interface LayoutFocusActions {
  setPathFocusToken: Dispatch<SetStateAction<number>>;
  setRenameFocusToken: Dispatch<SetStateAction<number>>;
  setFilterFocusToken: Dispatch<SetStateAction<number>>;
  setRecursiveSearchFocusToken: Dispatch<SetStateAction<number>>;
}

export type LayoutFocusStore = LayoutFocusState & LayoutFocusActions;

export function useLayoutFocusStore(): LayoutFocusStore {
  const [pathFocusToken, setPathFocusToken] = useState(0);
  const [renameFocusToken, setRenameFocusToken] = useState(0);
  const [filterFocusToken, setFilterFocusToken] = useState(0);
  const [recursiveSearchFocusToken, setRecursiveSearchFocusToken] = useState(0);

  return useMemo(
    () => ({
      pathFocusToken,
      renameFocusToken,
      filterFocusToken,
      recursiveSearchFocusToken,
      setPathFocusToken,
      setRenameFocusToken,
      setFilterFocusToken,
      setRecursiveSearchFocusToken,
    }),
    [
      pathFocusToken,
      renameFocusToken,
      filterFocusToken,
      recursiveSearchFocusToken,
    ],
  );
}
