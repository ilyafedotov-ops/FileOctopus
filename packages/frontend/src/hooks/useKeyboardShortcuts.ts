import type { KeyboardEvent } from "react";
import type { FileEntryDto } from "@fileoctopus/ts-api";
import {
  type PanelId,
  type PanelState,
  activeTab,
  selectVisibleEntries,
} from "../panelStore";
import { isEditableTarget } from "../shortcuts";

export interface UseKeyboardShortcutsDeps {
  state: { activePanelId: PanelId; panels: Record<PanelId, PanelState> };
  runCommand: (commandId: string) => void;
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
  setPathFocusToken: (updater: (v: number) => number) => void;
  setRecursiveSearchFocusToken: (updater: (v: number) => number) => void;
  isPreviewable: (entry: FileEntryDto | null) => boolean;
}

export function createKeyboardShortcutsHandler(
  deps: UseKeyboardShortcutsDeps,
): (event: KeyboardEvent<HTMLElement>) => void {
  return function handleShellKeyDown(event: KeyboardEvent<HTMLElement>) {
    const {
      state,
      runCommand,
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
      setPathFocusToken,
      setRecursiveSearchFocusToken,
      isPreviewable,
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
      runCommand("switch-pane");
      return;
    }

    const mod = event.metaKey || event.ctrlKey;
    const panelId = state.activePanelId;
    const tab = activeTab(state.panels[panelId]);
    const selectedEntry =
      selectVisibleEntries(tab).find((entry) => entry.uri === tab.selectedId) ??
      null;

    if (mod && event.key === ",") {
      event.preventDefault();
      runCommand("app.settings");
      return;
    }

    if (mod && event.key === "/") {
      event.preventDefault();
      runCommand("app.shortcuts");
      return;
    }

    if (mod && event.key.toLowerCase() === "p") {
      event.preventDefault();
      runCommand("app.commandPalette");
      return;
    }

    if (event.key === " " && !mod) {
      if (!previewOpen && selectedEntry && isPreviewable(selectedEntry)) {
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
      runCommand("op.open");
      return;
    }

    if (mod && event.key.toLowerCase() === "l") {
      event.preventDefault();
      setPathFocusToken((value) => value + 1);
      return;
    }

    if (mod && event.shiftKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      setRecursiveSearchFocusToken((value) => value + 1);
      return;
    }

    if (mod && event.key.toLowerCase() === "f") {
      event.preventDefault();
      runCommand("filter");
      return;
    }

    if (mod && (event.code === "Period" || event.key.toLowerCase() === "h")) {
      event.preventDefault();
      runCommand("view.toggleHidden");
      return;
    }

    if (mod && event.key.toLowerCase() === "i") {
      event.preventDefault();
      runCommand("op.properties");
      return;
    }

    if (mod && event.key.toLowerCase() === "n") {
      event.preventDefault();
      runCommand("create.folder");
      return;
    }

    if (mod && event.key.toLowerCase() === "a") {
      event.preventDefault();
      runCommand("selection.selectAll");
      return;
    }

    if (mod && event.key.toLowerCase() === "c") {
      event.preventDefault();
      runCommand("op.copy");
      return;
    }

    if (mod && event.key.toLowerCase() === "x") {
      event.preventDefault();
      runCommand("op.cut");
      return;
    }

    if (mod && event.key.toLowerCase() === "v") {
      event.preventDefault();
      runCommand("op.paste");
      return;
    }

    if (event.key === "F2") {
      event.preventDefault();
      runCommand("op.rename");
      return;
    }

    if (event.altKey && event.key === "ArrowLeft") {
      event.preventDefault();
      runCommand("nav.back");
      return;
    }

    if (event.altKey && event.key === "ArrowRight") {
      event.preventDefault();
      runCommand("nav.forward");
      return;
    }

    if (
      event.key === "Backspace" ||
      (event.altKey && event.key === "ArrowUp")
    ) {
      event.preventDefault();
      runCommand("nav.up");
      return;
    }

    if (event.key === "F5" || (mod && event.key.toLowerCase() === "r")) {
      event.preventDefault();
      runCommand("nav.refresh");
      return;
    }

    if (event.key === "Delete") {
      event.preventDefault();
      runCommand(event.shiftKey ? "op.deletePermanent" : "op.trash");
    }
  };
}
