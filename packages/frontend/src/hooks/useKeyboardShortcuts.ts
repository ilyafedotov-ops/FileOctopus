import type { KeyboardEvent } from "react";
import type { FileEntryDto } from "@fileoctopus/ts-api";
import {
  type PanelId,
  type PanelState,
  activeTab,
  selectVisibleEntries,
} from "../panelStore";
import { isEditableTarget, isTerminalInputContext } from "../shortcuts";
import { createCommanderActions } from "../shell/commanderActions";
import {
  DEFAULT_KEY_BINDINGS,
  type KeyBinding,
} from "../commands/defaultBindings";
import {
  matchesKeyCombo,
  parseKeyCombo,
  type KeyCombo,
} from "../commands/keyCombo";

export interface UseKeyboardShortcutsDeps {
  state: { activePanelId: PanelId; panels: Record<PanelId, PanelState> };
  runCommand: (commandId: string) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  previewOpen: boolean;
  viewerOpen: boolean;
  editorOpen: boolean;
  setPreviewOpen: (open: boolean) => void;
  setViewerOpen: (open: boolean) => void;
  setViewerEntry: (entry: FileEntryDto | null) => void;
  setEditorOpen: (open: boolean) => void;
  setEditorEntry: (entry: FileEntryDto | null) => void;
  isTextEditable: (entry: FileEntryDto | null) => boolean;
  dialog: unknown;
  setDialog: (dialog: null) => void;
  contextMenu: unknown;
  setContextMenu: (menu: null) => void;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  setPathFocusToken: (updater: (v: number) => number) => void;
  setRecursiveSearchFocusToken: (updater: (v: number) => number) => void;
  isPreviewable: (entry: FileEntryDto | null) => boolean;
  handleCommandSelect: (commandId: string, panelId?: PanelId) => void;
  handleCopyOrMove: (panelId: PanelId, mode: "copy" | "move") => void;
  handleCreateFolder: (panelId: PanelId) => void;
  handleTrash: (panelId: PanelId) => void;
  handleProperties: (
    panelId: PanelId,
    entry: FileEntryDto | null,
  ) => Promise<void>;
  setOperationError: (error: string | null) => void;
  customShortcuts?: string;
}

export function createKeyboardShortcutsHandler(
  deps: UseKeyboardShortcutsDeps,
): (event: KeyboardEvent<HTMLElement>) => void {
  const customBindings = parseCustomShortcuts(deps.customShortcuts);
  const effectiveBindings = mergeBindings(DEFAULT_KEY_BINDINGS, customBindings);

  return function handleShellKeyDown(event: KeyboardEvent<HTMLElement>) {
    const {
      state,
      runCommand,
      commandPaletteOpen,
      setCommandPaletteOpen,
      previewOpen,
      viewerOpen,
      editorOpen,
      setPreviewOpen,
      setViewerOpen,
      setViewerEntry,
      setEditorOpen,
      setEditorEntry,
      isTextEditable,
      dialog,
      setDialog,
      contextMenu,
      setContextMenu,
      helpOpen,
      setHelpOpen,
      setPathFocusToken,
      setRecursiveSearchFocusToken,
      isPreviewable,
      handleCommandSelect,
      handleCopyOrMove,
      handleCreateFolder,
      handleTrash,
      handleProperties,
      setOperationError,
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
      if (viewerOpen) {
        event.preventDefault();
        setViewerOpen(false);
        return;
      }
      if (editorOpen) {
        event.preventDefault();
        setEditorOpen(false);
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

    if (
      isEditableTarget(event.target) ||
      isTerminalInputContext(event.target) ||
      isTerminalInputContext()
    ) {
      return;
    }

    const mod = event.metaKey || event.ctrlKey;
    const panelId = state.activePanelId;
    const tab = activeTab(state.panels[panelId]);
    const selectedEntry =
      selectVisibleEntries(tab).find((entry) => entry.uri === tab.selectedId) ??
      null;

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

    const commander = createCommanderActions({
      panelId,
      tab,
      setViewerOpen,
      setViewerEntry,
      setEditorOpen,
      setEditorEntry,
      isTextEditable,
      handleCommandSelect,
      handleCopyOrMove,
      handleCreateFolder,
      handleTrash,
      handleProperties,
      setOperationError,
    });

    const commanderCommands: Record<string, () => void> = {
      "op.view": commander.view,
      "op.edit": commander.edit,
      "op.copyTo": commander.copy,
      "op.moveTo": commander.move,
      "create.folder": commander.newFolder,
      "op.trash": commander.delete,
      "op.openTerminal": commander.terminal,
    };

    for (const binding of effectiveBindings) {
      for (const combo of binding.combos) {
        if (matchesKeyCombo(event, combo)) {
          event.preventDefault();
          if (binding.commandId === "nav.goToLocation") {
            setPathFocusToken((value) => value + 1);
          } else if (binding.commandId === "search.recursive") {
            setRecursiveSearchFocusToken((value) => value + 1);
          } else if (commanderCommands[binding.commandId]) {
            commanderCommands[binding.commandId]();
          } else {
            runCommand(binding.commandId);
          }
          return;
        }
      }
    }
  };
}

function parseCustomShortcuts(
  json: string | undefined,
): Map<string, KeyCombo[]> {
  if (!json) return new Map();
  try {
    const parsed = JSON.parse(json) as Record<string, string[]>;
    const map = new Map<string, KeyCombo[]>();
    for (const [commandId, comboStrings] of Object.entries(parsed)) {
      const combos: KeyCombo[] = [];
      for (const str of comboStrings) {
        const combo = parseKeyCombo(str);
        if (combo) combos.push(combo);
      }
      if (combos.length > 0) {
        map.set(commandId, combos);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

function mergeBindings(
  defaults: KeyBinding[],
  custom: Map<string, KeyCombo[]>,
): KeyBinding[] {
  const result = new Map<string, KeyCombo[]>();
  for (const binding of defaults) {
    result.set(binding.commandId, binding.combos);
  }
  for (const [commandId, combos] of custom) {
    result.set(commandId, combos);
  }
  return Array.from(result.entries()).map(([commandId, combos]) => ({
    commandId,
    combos,
  }));
}
