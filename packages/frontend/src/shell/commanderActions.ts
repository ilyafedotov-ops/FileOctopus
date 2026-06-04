import type { FileEntryDto } from "@fileoctopus/ts-api";
import type { PanelId, PanelTabState } from "../panelStore";
import { countOperationalSelection, selectVisibleEntries } from "../panelStore";
import { fileMutationState } from "../navigation/fileMutationState";

export interface CommanderActionsDeps {
  panelId: PanelId;
  tab: PanelTabState;
  setViewerOpen: (open: boolean) => void;
  setViewerEntry: (entry: FileEntryDto | null) => void;
  setEditorOpen: (open: boolean) => void;
  setEditorEntry: (entry: FileEntryDto | null) => void;
  openPreviewInOppositePane?: (
    sourcePanelId: PanelId,
    entry: FileEntryDto,
  ) => void;
  openEditorInOppositePane?: (
    sourcePanelId: PanelId,
    entry: FileEntryDto,
  ) => void;
  isTextEditable: (entry: FileEntryDto | null) => boolean;
  handleCommandSelect: (id: string, panelId?: PanelId) => void;
  handleCopyOrMove: (panelId: PanelId, mode: "copy" | "move") => void;
  handleCreateFolder: (panelId: PanelId) => void;
  handleDelete: (panelId: PanelId) => void;
  handleProperties: (
    panelId: PanelId,
    entry: FileEntryDto | null,
  ) => Promise<void>;
  setOperationError: (error: string | null) => void;
}

export function createCommanderActions(deps: CommanderActionsDeps) {
  const {
    panelId,
    tab,
    setViewerOpen,
    setViewerEntry,
    setEditorOpen,
    setEditorEntry,
    openPreviewInOppositePane,
    openEditorInOppositePane,
    isTextEditable,
    handleCommandSelect,
    handleCopyOrMove,
    handleCreateFolder,
    handleDelete,
    handleProperties,
    setOperationError,
  } = deps;

  const selectedEntries = selectVisibleEntries(tab).filter((entry) =>
    tab.selectedIds.includes(entry.uri),
  );
  const selectedEntry =
    selectedEntries.find((entry) => entry.uri === tab.selectedId) ?? null;
  const hasSelection = countOperationalSelection(tab) > 0;
  const mutation = fileMutationState(tab, selectedEntries);

  return {
    selectedEntry,
    hasSelection,
    view: () => {
      if (selectedEntry) {
        setOperationError(null);
        if (openPreviewInOppositePane) {
          openPreviewInOppositePane(panelId, selectedEntry);
        } else {
          setViewerEntry(selectedEntry);
          setViewerOpen(true);
        }
        return;
      }
      void handleProperties(panelId, selectedEntry);
    },
    edit: () => {
      if (!selectedEntry) {
        return;
      }
      if (isTextEditable(selectedEntry)) {
        setOperationError(null);
        if (openEditorInOppositePane) {
          openEditorInOppositePane(panelId, selectedEntry);
        } else {
          setEditorEntry(selectedEntry);
          setEditorOpen(true);
        }
        return;
      }
      handleCommandSelect("op.openDefault", panelId);
    },
    copy: () => {
      if (!mutation.canCopy) {
        return;
      }
      handleCopyOrMove(panelId, "copy");
    },
    move: () => {
      if (!mutation.canMove) {
        return;
      }
      handleCopyOrMove(panelId, "move");
    },
    rename: () => {
      if (!mutation.canRename) {
        return;
      }
      handleCommandSelect("op.rename", panelId);
    },
    newFolder: () => {
      if (!mutation.canNewFolder) {
        return;
      }
      handleCreateFolder(panelId);
    },
    delete: () => {
      if (!mutation.canDelete) {
        return;
      }
      handleDelete(panelId);
    },
    terminal: () => handleCommandSelect("op.openTerminal", panelId),
    help: () => handleCommandSelect("app.shortcuts", panelId),
    menu: () => handleCommandSelect("app.commandPalette", panelId),
    canEdit: mutation.canEdit,
    canRename: mutation.canRename,
    canCopy: mutation.canCopy,
    canMove: mutation.canMove,
    canDelete: mutation.canDelete,
    canNewFolder: mutation.canNewFolder,
  };
}

export type CommanderActions = ReturnType<typeof createCommanderActions>;

export const COMMANDER_FUNCTION_ITEMS = [
  { key: "F1", label: "Help", action: "help" as const },
  { key: "F2", label: "Rename", action: "rename" as const },
  { key: "F3", label: "View", action: "view" as const },
  { key: "F4", label: "Edit", action: "edit" as const },
  { key: "F5", label: "Copy", action: "copy" as const },
  { key: "F6", label: "Move", action: "move" as const },
  { key: "F7", label: "New Folder", action: "newFolder" as const },
  { key: "F8", label: "Delete", action: "delete" as const },
  { key: "F9", label: "Terminal", action: "terminal" as const },
  { key: "F10", label: "Menu", action: "menu" as const },
];

export function commanderItemDisabled(
  action: (typeof COMMANDER_FUNCTION_ITEMS)[number]["action"],
  commander: CommanderActions,
): boolean {
  switch (action) {
    case "view":
    case "terminal":
    case "help":
    case "menu":
      return false;
    case "newFolder":
      return !commander.canNewFolder;
    case "rename":
      return !commander.canRename;
    case "edit":
      return !commander.canEdit;
    case "copy":
      return !commander.canCopy;
    case "move":
      return !commander.canMove;
    case "delete":
      return !commander.canDelete;
  }
}
