import type { FileEntryDto } from "@fileoctopus/ts-api";
import type { PanelId, FileOctopusState, PanelAction } from "../panelStore";
import { activeTab } from "../panelStore";
import { viewModeCommandId } from "../commands/viewModeCommands";
import { ContextMenu, type ContextMenuState } from "./ContextMenu";

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
  dispatch: React.Dispatch<PanelAction>;
  onClose: () => void;
  runPanelCommand: (panelId: PanelId, commandId: string) => void;
  activateEntry: (panelId: PanelId, entry: FileEntryDto | null) => void;
  toggleStarredForEntry: (entry: FileEntryDto) => Promise<void>;
  handleProperties: (
    panelId: PanelId,
    entry: FileEntryDto | null,
  ) => Promise<void>;
  handleCompress: (panelId: PanelId) => void;
  handleExtract: (panelId: PanelId) => void;
  openTerminal: (uri: string) => void;
  handleChecksum: (panelId: PanelId) => Promise<void>;
  revealEntry: (panelId: PanelId, entry: FileEntryDto | null) => Promise<void>;
  openExternal: (entry: FileEntryDto) => Promise<void>;
  navigatePanel: (panelId: PanelId, uri: string) => void;
  navigateOtherPane: (uri: string) => void;
  addFavorite: (uri: string) => void;
}

export function ContextMenuOverlay({
  menu,
  state,
  clipboard,
  starredUriSet,
  dispatch,
  onClose,
  runPanelCommand,
  activateEntry,
  toggleStarredForEntry,
  handleProperties,
  handleCompress,
  handleExtract,
  openTerminal,
  handleChecksum,
  revealEntry,
  openExternal,
  navigatePanel,
  navigateOtherPane,
  addFavorite,
}: ContextMenuOverlayProps) {
  const panelId = menu?.panelId ?? "left";
  const run = (commandId: string) => runPanelCommand(panelId, commandId);

  return (
    <ContextMenu
      menu={menu}
      canPaste={Boolean(clipboard)}
      isStarred={menu?.entry ? starredUriSet.has(menu.entry.uri) : false}
      showHidden={
        menu?.panelId ? activeTab(state.panels[menu.panelId]).showHidden : false
      }
      onClose={onClose}
      onToggleHidden={() => run("view.toggleHidden")}
      onOpen={(pid, entry) => activateEntry(pid, entry)}
      onRename={() => run("op.rename")}
      onCopy={() => run("op.copy")}
      onCut={() => run("op.cut")}
      onPaste={() => run("op.paste")}
      onTrash={() => run("op.trash")}
      onToggleStarred={(_, entry) => void toggleStarredForEntry(entry)}
      onPermanentDelete={() => run("op.deletePermanent")}
      onCopyPath={() => run("clipboard.copyPath")}
      onCopyName={() => run("clipboard.copyName")}
      onProperties={(pid, entry) => void handleProperties(pid, entry)}
      onReveal={(pid, entry) => void revealEntry(pid, entry)}
      onCompress={(pid) => void handleCompress(pid)}
      onExtract={(pid) => void handleExtract(pid)}
      onOpenTerminal={(pid) => openTerminal(activeTab(state.panels[pid]).uri)}
      onChecksum={(pid) => void handleChecksum(pid)}
      onCreateFolder={() => run("create.folder")}
      onCreateFile={() => run("create.file")}
      onRefresh={() => run("nav.refresh")}
      onSelectAll={() => run("selection.selectAll")}
      onViewMode={(pid, viewMode) => {
        const commandId = viewModeCommandId(viewMode);
        if (commandId) {
          runPanelCommand(pid, commandId);
          return;
        }
        dispatch({ type: "setViewMode", panelId: pid, viewMode });
      }}
      onSort={(pid, field) =>
        dispatch({ type: "setSort", panelId: pid, field })
      }
      onOpenWithDefaultApp={(pid) => {
        if (menu?.panelId !== pid) return;
        const entry = menu?.entry;
        if (entry && entry.kind !== "directory") {
          void openExternal(entry);
          return;
        }
        run("op.openDefault");
      }}
      onCopyTo={() => run("op.copyTo")}
      onMoveTo={() => run("op.moveTo")}
      onCopyParentPath={() => run("clipboard.copyParent")}
      onCopyResourceUri={() => run("clipboard.copyUri")}
      onClearSelection={() => run("selection.clear")}
      onNavigateTo={(pid, uri) => navigatePanel(pid, uri)}
      onNavigateOtherPane={(uri) => navigateOtherPane(uri)}
      onCopyBreadcrumbPath={(path) => {
        void navigator.clipboard.writeText(path);
      }}
      onRevealBreadcrumb={() => undefined}
      onAddFavorite={(uri) => addFavorite(uri)}
    />
  );
}
