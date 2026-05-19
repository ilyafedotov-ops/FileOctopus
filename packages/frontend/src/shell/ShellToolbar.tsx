import { useState } from "react";
import type {
  FavoriteEntryDto,
  RecentEntryDto,
  StandardLocationDto,
} from "@fileoctopus/ts-api";
import { DropdownMenu, type DropdownMenuItem } from "@fileoctopus/ui";
import { OperationToolbar } from "../pane/OperationToolbar";
import { useShellLayout } from "./ShellLayoutContext";
import {
  activeTab,
  countOperationalSelection,
  selectVisibleEntries,
  parentUri,
  homeUri,
} from "../panelStore";
import { viewModeCommandId } from "../commands/viewModeCommands";
import { localPathFromUri } from "../utils/paneUtils";

export type WorkbenchTargetKind =
  | "parent"
  | "home"
  | "volume"
  | "favorite"
  | "recent";

export interface WorkbenchTarget {
  id: string;
  kind: WorkbenchTargetKind;
  label: string;
  uri: string;
  glyph: string;
  title: string;
}

export interface WorkbenchTargetsInput {
  activeUri: string;
  parentUri: string | null;
  locations: StandardLocationDto[];
  favorites: FavoriteEntryDto[];
  recentToday: RecentEntryDto[];
  recentWeek: RecentEntryDto[];
  maxVisible?: number;
}

export interface WorkbenchTargetsResult {
  visible: WorkbenchTarget[];
  overflow: WorkbenchTarget[];
}

function locationName(uri: string): string {
  const path = localPathFromUri(uri).replace(/\/+$/, "");
  const parts = path.split("/").filter(Boolean);
  const name = parts[parts.length - 1];
  return name || path || uri;
}

function addTarget(
  targets: WorkbenchTarget[],
  seen: Set<string>,
  target: WorkbenchTarget,
) {
  if (seen.has(target.uri)) {
    return;
  }
  seen.add(target.uri);
  targets.push(target);
}

export function buildWorkbenchTargets({
  activeUri,
  parentUri: upUri,
  locations,
  favorites,
  recentToday,
  recentWeek,
  maxVisible = 10,
}: WorkbenchTargetsInput): WorkbenchTargetsResult {
  const seen = new Set<string>([activeUri]);
  const targets: WorkbenchTarget[] = [];
  const homeLocation =
    locations.find((location) => location.id === "home") ??
    locations.find(
      (location) =>
        location.section === "Favorites" &&
        location.name.toLowerCase() === "home",
    );
  const resolvedHomeUri = homeLocation?.uri ?? homeUri();
  const resolvedHomeLabel = homeLocation?.name ?? "Home";

  if (upUri) {
    addTarget(targets, seen, {
      id: "parent",
      kind: "parent",
      label: "..",
      uri: upUri,
      glyph: "↑",
      title: localPathFromUri(upUri),
    });
  }

  addTarget(targets, seen, {
    id: "home",
    kind: "home",
    label: resolvedHomeLabel,
    uri: resolvedHomeUri,
    glyph: "~",
    title: localPathFromUri(resolvedHomeUri),
  });

  locations
    .filter((location) => location.section === "Devices/Volumes")
    .forEach((location) =>
      addTarget(targets, seen, {
        id: `volume-${location.id}`,
        kind: "volume",
        label: location.name,
        uri: location.uri,
        glyph: "▣",
        title: localPathFromUri(location.uri),
      }),
    );

  favorites.forEach((favorite) =>
    addTarget(targets, seen, {
      id: `favorite-${favorite.id}`,
      kind: "favorite",
      label: favorite.label || locationName(favorite.uri),
      uri: favorite.uri,
      glyph: "★",
      title: localPathFromUri(favorite.uri),
    }),
  );

  [...recentToday, ...recentWeek].forEach((recent, index) =>
    addTarget(targets, seen, {
      id: `recent-${index}-${recent.uri}`,
      kind: "recent",
      label: recent.label || locationName(recent.uri),
      uri: recent.uri,
      glyph: "◷",
      title: localPathFromUri(recent.uri),
    }),
  );

  return {
    visible: targets.slice(0, maxVisible),
    overflow: targets.slice(maxVisible),
  };
}

export function ShellToolbar() {
  const ctx = useShellLayout();
  const pid = ctx.state.activePanelId;
  const tab = activeTab(ctx.state.panels[pid]);
  const selectedCount = countOperationalSelection(tab);
  const canPaste = Boolean(ctx.clipboard);
  const upUri = parentUri(tab.uri);
  const [hotlistOpen, setHotlistOpen] = useState(false);
  const drivebarTargets = buildWorkbenchTargets({
    activeUri: tab.uri,
    parentUri: upUri,
    locations: ctx.locations,
    favorites: ctx.favorites,
    recentToday: ctx.recentToday,
    recentWeek: ctx.recentWeek,
  });

  const handleCommand = (
    commandId: string,
    context?: import("../commands/invokeContext").CommandInvokeArg,
  ) => ctx.handleCommandSelect(commandId, pid, context);
  const openTarget = (target: WorkbenchTarget) =>
    ctx.handleCommandSelect("nav.openUri", pid, { targetUri: target.uri });
  const overflowItems: DropdownMenuItem[] = drivebarTargets.overflow.map(
    (target) => ({
      id: target.id,
      label: target.label,
      icon: target.glyph,
      onSelect: () => openTarget(target),
    }),
  );

  return (
    <div className="fo-workbench-toolbar">
      <div className="fo-drivebar" aria-label="Drive and hotlist">
        <span className="fo-drivebar-title">Drivebar</span>
        <div className="fo-drivebar-list">
          {drivebarTargets.visible.map((target) => (
            <button
              key={target.id}
              type="button"
              className={`fo-drivebar-chip fo-drivebar-chip-${target.kind}`}
              title={target.title}
              onClick={() => openTarget(target)}
            >
              <span className="fo-drivebar-glyph" aria-hidden="true">
                {target.glyph}
              </span>
              <span className="fo-drivebar-label">{target.label}</span>
            </button>
          ))}
        </div>
        {overflowItems.length > 0 ? (
          <DropdownMenu
            label="Hotlist"
            open={hotlistOpen}
            items={overflowItems}
            onOpenChange={setHotlistOpen}
            triggerClassName="fo-drivebar-more"
            triggerAriaLabel="More drivebar locations"
            align="start"
          >
            <span aria-hidden="true">»</span>
            <span>Hotlist</span>
          </DropdownMenu>
        ) : null}
        {drivebarTargets.visible.length === 0 ? (
          <button
            type="button"
            className="fo-drivebar-chip fo-drivebar-chip-home"
            onClick={() => handleCommand("nav.home")}
          >
            <span className="fo-drivebar-glyph" aria-hidden="true">
              ~
            </span>
            <span className="fo-drivebar-label">Home</span>
          </button>
        ) : null}
      </div>
      <OperationToolbar
        selectedCount={selectedCount}
        canRename={selectedCount === 1}
        canPaste={canPaste}
        showHidden={tab.showHidden}
        viewMode={tab.viewMode}
        canGoBack={tab.backStack.length > 0}
        canGoForward={tab.forwardStack.length > 0}
        canGoUp={Boolean(upUri)}
        onBack={() => handleCommand("nav.back")}
        onForward={() => handleCommand("nav.forward")}
        onUp={() => upUri && ctx.navigatePanel(pid, upUri)}
        onCreateFolder={() => ctx.handleCreateFolder(pid)}
        onCreateFile={() => ctx.handleCreateFile(pid)}
        onRename={() => ctx.triggerInlineRename(pid)}
        onCopy={() => ctx.copySelectionToFileClipboard(pid, "copy")}
        onCut={() => ctx.copySelectionToFileClipboard(pid, "move")}
        onCopyOperation={() => ctx.handleCopyOrMove(pid, "copy")}
        onMove={() => ctx.handleCopyOrMove(pid, "move")}
        onPaste={() => void ctx.pasteClipboard(pid)}
        onTrash={() => ctx.handleTrash(pid)}
        onPermanentDelete={() => ctx.handlePermanentDelete(pid)}
        onCopyPath={() => void ctx.copyTextFromSelection(pid, "path")}
        onCopyName={() => void ctx.copyTextFromSelection(pid, "name")}
        onProperties={() => void ctx.handleProperties(pid, null)}
        onRevealInFileManager={() => void ctx.revealEntry(pid, null)}
        onCalculateSize={() => {
          const entry = selectVisibleEntries(tab).find(
            (e) => e.uri === tab.selectedId,
          );
          void ctx.handleCommandSelect("op.calculateSize", pid, entry ?? null);
        }}
        onCompress={() => handleCommand("op.compress")}
        onExtract={() => handleCommand("op.extract")}
        onOpenTerminal={() => handleCommand("op.openTerminal")}
        onChecksum={() => void handleCommand("op.checksum")}
        onRefresh={() => ctx.refreshPanel(pid)}
        onCommandSearch={() => ctx.setCommandPaletteOpen(true)}
        onToggleHidden={() => ctx.toggleHidden(pid)}
        onSelectAll={() => handleCommand("selection.selectAll")}
        onViewMode={(viewMode) => {
          const commandId = viewModeCommandId(viewMode);
          if (commandId) {
            handleCommand(commandId);
          }
        }}
      />
    </div>
  );
}
