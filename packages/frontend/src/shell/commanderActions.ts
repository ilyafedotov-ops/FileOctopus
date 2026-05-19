import type { FileEntryDto } from "@fileoctopus/ts-api";
import { isRemoteUri } from "@fileoctopus/ts-api";
import type { PanelId, PanelTabState } from "../panelStore";
import { countOperationalSelection, selectVisibleEntries } from "../panelStore";

export interface CommanderActionsDeps {
  panelId: PanelId;
  tab: PanelTabState;
  setPreviewOpen: (open: boolean) => void;
  handleCommandSelect: (id: string, panelId?: PanelId) => void;
  handleCopyOrMove: (panelId: PanelId, mode: "copy" | "move") => void;
  handleCreateFolder: (panelId: PanelId) => void;
  handleTrash: (panelId: PanelId) => void;
  handleProperties: (
    panelId: PanelId,
    entry: FileEntryDto | null,
  ) => Promise<void>;
  isPreviewable: (entry: FileEntryDto | null) => boolean;
}

export function createCommanderActions(deps: CommanderActionsDeps) {
  const {
    panelId,
    tab,
    setPreviewOpen,
    handleCommandSelect,
    handleCopyOrMove,
    handleCreateFolder,
    handleTrash,
    handleProperties,
    isPreviewable,
  } = deps;

  const selectedEntries = selectVisibleEntries(tab).filter((entry) =>
    tab.selectedIds.includes(entry.uri),
  );
  const selectedEntry =
    selectedEntries.find((entry) => entry.uri === tab.selectedId) ?? null;
  const hasSelection = countOperationalSelection(tab) > 0;
  const remotePane = isRemoteUri(tab.uri);
  const selectionAllowsWrite =
    selectedEntries.length > 0 &&
    selectedEntries.every((entry) => entry.canWrite && entry.canDelete);
  const paneAllowsMutation = !remotePane && selectionAllowsWrite;

  return {
    selectedEntry,
    hasSelection,
    view: () => {
      if (selectedEntry && isPreviewable(selectedEntry)) {
        setPreviewOpen(true);
        return;
      }
      void handleProperties(panelId, selectedEntry);
    },
    edit: () => {
      if (!selectedEntry) {
        return;
      }
      handleCommandSelect("op.openDefault", panelId);
    },
    copy: () => {
      if (!paneAllowsMutation) {
        return;
      }
      handleCopyOrMove(panelId, "copy");
    },
    move: () => {
      if (!paneAllowsMutation) {
        return;
      }
      handleCopyOrMove(panelId, "move");
    },
    rename: () => {
      if (!paneAllowsMutation) {
        return;
      }
      handleCommandSelect("op.rename", panelId);
    },
    newFolder: () => {
      if (remotePane) {
        return;
      }
      handleCreateFolder(panelId);
    },
    delete: () => {
      if (!paneAllowsMutation) {
        return;
      }
      handleTrash(panelId);
    },
    terminal: () => handleCommandSelect("op.openTerminal", panelId),
    canEdit: Boolean(selectedEntry) && !remotePane,
    canRename: countOperationalSelection(tab) === 1 && paneAllowsMutation,
    canCopy: hasSelection && paneAllowsMutation,
    canMove: hasSelection && paneAllowsMutation,
    canDelete: hasSelection && paneAllowsMutation,
    canNewFolder: !remotePane,
  };
}

export type CommanderActions = ReturnType<typeof createCommanderActions>;

export const COMMANDER_FUNCTION_ITEMS = [
  { key: "F2", label: "Rename", action: "rename" as const },
  { key: "F3", label: "View", action: "view" as const },
  { key: "F4", label: "Edit", action: "edit" as const },
  { key: "F5", label: "Copy", action: "copy" as const },
  { key: "F6", label: "Move", action: "move" as const },
  { key: "F7", label: "New Folder", action: "newFolder" as const },
  { key: "F8", label: "Delete", action: "delete" as const },
  { key: "F9", label: "Terminal", action: "terminal" as const },
];

export function commanderItemDisabled(
  action: (typeof COMMANDER_FUNCTION_ITEMS)[number]["action"],
  commander: CommanderActions,
): boolean {
  switch (action) {
    case "view":
    case "terminal":
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
