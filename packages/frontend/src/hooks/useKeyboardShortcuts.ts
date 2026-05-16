import type { KeyboardEvent } from "react";
import type { FileEntryDto } from "@fileoctopus/ts-api";
import {
  type PanelId,
  type PanelState,
  type PanelAction,
  activeTab,
  selectVisibleEntries,
  parentUri,
} from "../panelStore";
import { isEditableTarget } from "../shortcuts";

export interface UseKeyboardShortcutsDeps {
  state: { activePanelId: PanelId; panels: Record<PanelId, PanelState> };
  dispatch: (action: PanelAction) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  previewOpen: boolean;
  setPreviewOpen: (open: boolean) => void;
  dialog: unknown;
  setDialog: (dialog: null) => void;
  contextMenu: unknown;
  setContextMenu: (menu: null) => void;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setPathFocusToken: (updater: (v: number) => number) => void;
  setFilterFocusToken: (updater: (v: number) => number) => void;
  setRecursiveSearchFocusToken: (updater: (v: number) => number) => void;
  activateEntry: (panelId: PanelId, entry: FileEntryDto | null) => void;
  navigatePanel: (
    panelId: PanelId,
    uri: string,
    options?: {
      replace?: boolean;
      includeHidden?: boolean;
      softRefresh?: boolean;
    },
  ) => Promise<void>;
  goHistory: (panelId: PanelId, direction: "back" | "forward") => Promise<void>;
  refreshPanel: (
    panelId: PanelId,
    options?: {
      replace?: boolean;
      includeHidden?: boolean;
      softRefresh?: boolean;
    },
  ) => void;
  toggleHidden: (panelId: PanelId) => void;
  handleProperties: (
    panelId: PanelId,
    entry: FileEntryDto | null,
  ) => Promise<void>;
  handleCreateFolder: (panelId: PanelId) => void;
  handleRename: (panelId: PanelId) => void;
  handleTrash: (panelId: PanelId) => void;
  handlePermanentDelete: (panelId: PanelId) => void;
  copySelectionToFileClipboard: (
    panelId: PanelId,
    kind: "copy" | "move",
  ) => void;
  pasteClipboard: (panelId: PanelId) => Promise<void>;
  isTextPreviewable: (entry: FileEntryDto | null) => boolean;
}

export function createKeyboardShortcutsHandler(
  deps: UseKeyboardShortcutsDeps,
): (event: KeyboardEvent<HTMLElement>) => void {
  return function handleShellKeyDown(event: KeyboardEvent<HTMLElement>) {
    const {
      state,
      dispatch,
      commandPaletteOpen,
      setCommandPaletteOpen,
      previewOpen,
      setPreviewOpen,
      dialog,
      setDialog,
      contextMenu,
      setContextMenu,
      helpOpen,
      setHelpOpen,
      setSettingsOpen,
      setShortcutsOpen,
      setPathFocusToken,
      setFilterFocusToken,
      setRecursiveSearchFocusToken,
      activateEntry,
      navigatePanel,
      goHistory,
      refreshPanel,
      toggleHidden,
      handleProperties,
      handleCreateFolder,
      handleRename,
      handleTrash,
      handlePermanentDelete,
      copySelectionToFileClipboard,
      pasteClipboard,
      isTextPreviewable,
    } = deps;

    if (event.key === "Escape") {
      if (commandPaletteOpen) {
        event.preventDefault();
        setCommandPaletteOpen(false);
        return;
      }
      if (previewOpen) {
        event.preventDefault();
        setPreviewOpen(false);
        return;
      }
      if (dialog) {
        event.preventDefault();
        setDialog(null);
        return;
      }
      if (contextMenu) {
        event.preventDefault();
        setContextMenu(null);
        return;
      }
      if (helpOpen) {
        event.preventDefault();
        setHelpOpen(false);
        return;
      }
    }

    if (isEditableTarget(event.target)) {
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      dispatch({
        type: "setActivePanel",
        panelId: state.activePanelId === "left" ? "right" : "left",
      });
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key === ",") {
      event.preventDefault();
      setSettingsOpen(true);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key === "/") {
      event.preventDefault();
      setShortcutsOpen(true);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
      event.preventDefault();
      setCommandPaletteOpen(true);
      return;
    }

    const panelId = state.activePanelId;
    const tab = activeTab(state.panels[panelId]);
    const selectedEntry =
      selectVisibleEntries(tab).find((entry) => entry.uri === tab.selectedId) ??
      null;

    if (event.key === " " && !event.metaKey && !event.ctrlKey) {
      if (!previewOpen && selectedEntry && isTextPreviewable(selectedEntry)) {
        event.preventDefault();
        setPreviewOpen(true);
        return;
      }
      if (previewOpen) {
        event.preventDefault();
        setPreviewOpen(false);
        return;
      }
    }

    if (dialog) {
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      activateEntry(panelId, selectedEntry);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "l") {
      event.preventDefault();
      setPathFocusToken((value) => value + 1);
      return;
    }

    if (
      (event.metaKey || event.ctrlKey) &&
      event.shiftKey &&
      event.key.toLowerCase() === "f"
    ) {
      event.preventDefault();
      setRecursiveSearchFocusToken((value) => value + 1);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
      event.preventDefault();
      setFilterFocusToken((value) => value + 1);
      return;
    }

    if (
      (event.metaKey || event.ctrlKey) &&
      (event.code === "Period" || event.key.toLowerCase() === "h")
    ) {
      event.preventDefault();
      toggleHidden(panelId);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "i") {
      event.preventDefault();
      void handleProperties(panelId, null);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
      event.preventDefault();
      handleCreateFolder(panelId);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      dispatch({ type: "selectAll", panelId });
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
      event.preventDefault();
      copySelectionToFileClipboard(panelId, "copy");
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "x") {
      event.preventDefault();
      copySelectionToFileClipboard(panelId, "move");
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v") {
      event.preventDefault();
      void pasteClipboard(panelId);
      return;
    }

    if (event.key === "F2") {
      event.preventDefault();
      handleRename(panelId);
      return;
    }

    if (event.altKey && event.key === "ArrowLeft") {
      event.preventDefault();
      void goHistory(panelId, "back");
      return;
    }

    if (event.altKey && event.key === "ArrowRight") {
      event.preventDefault();
      void goHistory(panelId, "forward");
      return;
    }

    if (
      event.key === "Backspace" ||
      (event.altKey && event.key === "ArrowUp")
    ) {
      const upUri = parentUri(tab.uri);

      if (upUri) {
        event.preventDefault();
        void navigatePanel(panelId, upUri);
      }

      return;
    }

    if (
      event.key === "F5" ||
      ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "r")
    ) {
      event.preventDefault();
      refreshPanel(panelId);
      return;
    }

    if (event.key === "Delete") {
      event.preventDefault();
      if (event.shiftKey) {
        handlePermanentDelete(panelId);
      } else {
        handleTrash(panelId);
      }
    }
  };
}
