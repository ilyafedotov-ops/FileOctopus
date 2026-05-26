import type { FileEntryDto } from "@fileoctopus/ts-api";
import type { PanelId, FileOctopusState, PanelAction } from "../panelStore";
import { activeTab } from "../panelStore";
import { viewModeCommandId } from "../commands/viewModeCommands";
import { ContextMenu, type ContextMenuState } from "./ContextMenu";
import { useTags } from "../app/TagContext";

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
  runPanelCommand: (
    panelId: PanelId,
    commandId: string,
    context?: import("../commands/invokeContext").CommandInvokeArg,
  ) => void;
  activateEntry: (panelId: PanelId, entry: FileEntryDto | null) => void;
  revealEntry: (panelId: PanelId, entry: FileEntryDto | null) => Promise<void>;
  openExternal: (entry: FileEntryDto) => Promise<void>;
  navigatePanel: (panelId: PanelId, uri: string) => void;
  navigateOtherPane: (uri: string) => void;
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
  revealEntry,
  openExternal,
  navigatePanel,
  navigateOtherPane,
}: ContextMenuOverlayProps) {
  const panelId = menu?.panelId ?? "left";
  const contextEntry = menu?.entry ?? undefined;
  const currentTabUri = menu?.panelId
    ? activeTab(state.panels[menu.panelId]).uri
    : activeTab(state.panels.left).uri;
  const run = (commandId: string, entry?: FileEntryDto | null) =>
    runPanelCommand(panelId, commandId, entry ?? contextEntry);

  const { tagColorsForEntry, assignTag, removeTag } = useTags();
  const entryTagColors = menu?.entry
    ? tagColorsForEntry(menu.entry.uri)
    : undefined;

  return (
    <ContextMenu
      menu={menu}
      currentTabUri={currentTabUri}
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
      onToggleStarred={() => run("op.toggleStarred")}
      onPermanentDelete={() => run("op.deletePermanent")}
      onCopyPath={() => run("clipboard.copyPath")}
      onCopyName={() => run("clipboard.copyName")}
      onView={(pid, entry) =>
        runPanelCommand(pid, "op.view", entry ?? contextEntry ?? null)
      }
      onProperties={(pid, entry) =>
        runPanelCommand(pid, "op.properties", entry ?? contextEntry ?? null)
      }
      onReveal={(pid, entry) => void revealEntry(pid, entry)}
      onCompress={() => run("op.compress")}
      onExtract={() => run("op.extract")}
      onOpenTerminal={() => run("op.openTerminal")}
      onOpenTerminalExternal={() => run("op.openTerminalExternal")}
      onChecksum={() => void run("op.checksum")}
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
        runPanelCommand(pid, "view.sort", { sortField: field })
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
      onAddFavorite={(uri) =>
        runPanelCommand(
          panelId,
          "nav.addFavorite",
          menu?.entry ?? { targetUri: uri },
        )
      }
      onAssignTag={(entry, color) => assignTag(entry.uri, color, color)}
      onRemoveTag={(entry, color) => removeTag(entry.uri, color)}
      entryTagColors={entryTagColors}
    />
  );
}
