import type { FileEntryDto } from "@fileoctopus/ts-api";
import type { PanelId, FileOctopusState } from "../panelStore";
import { activeTab } from "../panelStore";
import { ContextMenu, type ContextMenuState } from "./ContextMenu";
import type { ToastMessage } from "./ToastStack";

interface FileClipboardState {
  kind: "copy" | "move";
  uris: string[];
  providerId: string;
  timestamp: number;
}

export interface ContextMenuOverlayProps {
  menu: ContextMenuState | null;
  state: FileOctopusState;
  clipboard: FileClipboardState | null;
  starredUriSet: Set<string>;
  dispatch: React.Dispatch<import("../panelStore").PanelAction>;
  onClose: () => void;
  activateEntry: (panelId: PanelId, entry: FileEntryDto | null) => void;
  handleRename: (panelId: PanelId) => void;
  copySelectionToFileClipboard: (
    panelId: PanelId,
    mode: "copy" | "move",
  ) => void;
  pasteClipboard: (panelId: PanelId) => Promise<void>;
  handleTrash: (panelId: PanelId) => void;
  toggleStarredForEntry: (entry: FileEntryDto) => Promise<void>;
  handlePermanentDelete: (panelId: PanelId) => void;
  copyTextFromSelection: (
    panelId: PanelId,
    kind: "path" | "name" | "parentPath" | "uri",
  ) => Promise<void>;
  handleProperties: (
    panelId: PanelId,
    entry: FileEntryDto | null,
  ) => Promise<void>;
  revealEntry: (panelId: PanelId, entry: FileEntryDto | null) => Promise<void>;
  pushToast: (toast: Omit<ToastMessage, "id">) => void;
  openTerminal: (uri: string) => void;
  handleChecksum: (panelId: PanelId) => Promise<void>;
  handleCreateFolder: (panelId: PanelId) => void;
  handleCreateFile: (panelId: PanelId) => void;
  refreshPanel: (panelId: PanelId) => void;
  handleCopyOrMove: (panelId: PanelId, mode: "copy" | "move") => void;
  openExternal: (entry: FileEntryDto) => Promise<void>;
  toggleHidden: (panelId: PanelId) => void;
}

export function ContextMenuOverlay({
  menu,
  state,
  clipboard,
  starredUriSet,
  dispatch,
  onClose,
  activateEntry,
  handleRename,
  copySelectionToFileClipboard,
  pasteClipboard,
  handleTrash,
  toggleStarredForEntry,
  handlePermanentDelete,
  copyTextFromSelection,
  handleProperties,
  revealEntry,
  pushToast,
  openTerminal,
  handleChecksum,
  handleCreateFolder,
  handleCreateFile,
  refreshPanel,
  handleCopyOrMove,
  openExternal,
  toggleHidden,
}: ContextMenuOverlayProps) {
  return (
    <ContextMenu
      menu={menu}
      canPaste={Boolean(clipboard)}
      isStarred={menu?.entry ? starredUriSet.has(menu.entry.uri) : false}
      showHidden={
        menu?.panelId ? activeTab(state.panels[menu.panelId]).showHidden : false
      }
      onClose={onClose}
      onToggleHidden={(panelId) => toggleHidden(panelId)}
      onOpen={(panelId, entry) => activateEntry(panelId, entry)}
      onRename={handleRename}
      onCopy={(panelId) => copySelectionToFileClipboard(panelId, "copy")}
      onCut={(panelId) => copySelectionToFileClipboard(panelId, "move")}
      onPaste={(panelId) => void pasteClipboard(panelId)}
      onTrash={handleTrash}
      onToggleStarred={(_, entry) => void toggleStarredForEntry(entry)}
      onPermanentDelete={handlePermanentDelete}
      onCopyPath={(panelId) => void copyTextFromSelection(panelId, "path")}
      onCopyName={(panelId) => void copyTextFromSelection(panelId, "name")}
      onProperties={(panelId, entry) => void handleProperties(panelId, entry)}
      onReveal={(panelId, entry) => void revealEntry(panelId, entry)}
      onCompress={() =>
        pushToast({ tone: "info", title: "Compress coming soon" })
      }
      onExtract={() =>
        pushToast({ tone: "info", title: "Extract coming soon" })
      }
      onOpenTerminal={(panelId) =>
        openTerminal(activeTab(state.panels[panelId]).uri)
      }
      onChecksum={(panelId) => void handleChecksum(panelId)}
      onCreateFolder={handleCreateFolder}
      onCreateFile={handleCreateFile}
      onRefresh={refreshPanel}
      onSelectAll={(panelId) => dispatch({ type: "selectAll", panelId })}
      onViewMode={(panelId, viewMode) =>
        dispatch({ type: "setViewMode", panelId, viewMode })
      }
      onSort={(panelId, field) => dispatch({ type: "setSort", panelId, field })}
      onOpenWithDefaultApp={(panelId) => {
        if (menu?.panelId !== panelId) return;
        const entry = menu?.entry;
        if (entry && entry.kind !== "directory") void openExternal(entry);
      }}
      onCopyTo={(panelId) => handleCopyOrMove(panelId, "copy")}
      onMoveTo={(panelId) => handleCopyOrMove(panelId, "move")}
      onCopyParentPath={(panelId) =>
        void copyTextFromSelection(panelId, "parentPath")
      }
      onCopyResourceUri={(panelId) =>
        void copyTextFromSelection(panelId, "uri")
      }
      onClearSelection={(panelId) =>
        dispatch({ type: "clearSelection", panelId })
      }
    />
  );
}
