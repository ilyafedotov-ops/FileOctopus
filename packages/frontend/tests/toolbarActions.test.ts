import { describe, expect, it, vi } from "vitest";
import { runToolbarCommand } from "../src/pane/toolbarActions";
import type { ToolbarActionHandlers } from "../src/pane/toolbarActions";

function noop() {
  return vi.fn();
}

function createHandlers(): ToolbarActionHandlers {
  return {
    onBack: noop(),
    onForward: noop(),
    onUp: noop(),
    onRoot: noop(),
    onHome: noop(),
    onDrives: noop(),
    onRefresh: noop(),
    onCommandSearch: noop(),
    onView: noop(),
    onCommand: noop(),
    onCustomizeToolbar: noop(),
    dropdowns: {
      selectedCount: 0,
      canRename: false,
      canPaste: false,
      showHidden: false,
      viewMode: "details",
      onCreateFolder: noop(),
      onCreateFile: noop(),
      onRename: noop(),
      onCopy: noop(),
      onCut: noop(),
      onCopyOperation: noop(),
      onMove: noop(),
      onPaste: noop(),
      onTrash: noop(),
      onPermanentDelete: noop(),
      onCopyPath: noop(),
      onCopyName: noop(),
      onProperties: noop(),
      onSelectAll: noop(),
      onToggleHidden: noop(),
      onViewMode: noop(),
      onRevealInFileManager: noop(),
      onCalculateSize: noop(),
      onCompress: noop(),
      onExtract: noop(),
      onOpenTerminal: noop(),
      onOpenTerminalExternal: noop(),
      onChecksum: noop(),
    },
  };
}

describe("runToolbarCommand", () => {
  it("dispatches nav.back to onBack handler", () => {
    const handlers = createHandlers();
    runToolbarCommand("nav.back", handlers);
    expect(handlers.onBack).toHaveBeenCalledOnce();
  });

  it("dispatches nav.forward to onForward handler", () => {
    const handlers = createHandlers();
    runToolbarCommand("nav.forward", handlers);
    expect(handlers.onForward).toHaveBeenCalledOnce();
  });

  it("dispatches nav.up to onUp handler", () => {
    const handlers = createHandlers();
    runToolbarCommand("nav.up", handlers);
    expect(handlers.onUp).toHaveBeenCalledOnce();
  });

  it("dispatches nav.root to onRoot handler", () => {
    const handlers = createHandlers();
    runToolbarCommand("nav.root", handlers);
    expect(handlers.onRoot).toHaveBeenCalledOnce();
  });

  it("dispatches nav.home to onHome handler", () => {
    const handlers = createHandlers();
    runToolbarCommand("nav.home", handlers);
    expect(handlers.onHome).toHaveBeenCalledOnce();
  });

  it("dispatches nav.volumePicker to onDrives handler", () => {
    const handlers = createHandlers();
    runToolbarCommand("nav.volumePicker", handlers);
    expect(handlers.onDrives).toHaveBeenCalledOnce();
  });

  it("dispatches nav.refresh to onRefresh handler", () => {
    const handlers = createHandlers();
    runToolbarCommand("nav.refresh", handlers);
    expect(handlers.onRefresh).toHaveBeenCalledOnce();
  });

  it("dispatches app.commandPalette to onCommandSearch handler", () => {
    const handlers = createHandlers();
    runToolbarCommand("app.commandPalette", handlers);
    expect(handlers.onCommandSearch).toHaveBeenCalledOnce();
  });

  it("dispatches op.view to onView handler", () => {
    const handlers = createHandlers();
    runToolbarCommand("op.view", handlers);
    expect(handlers.onView).toHaveBeenCalledOnce();
  });

  it("dispatches create.folder to dropdowns.onCreateFolder", () => {
    const handlers = createHandlers();
    runToolbarCommand("create.folder", handlers);
    expect(handlers.dropdowns.onCreateFolder).toHaveBeenCalledOnce();
  });

  it("dispatches create.file to dropdowns.onCreateFile", () => {
    const handlers = createHandlers();
    runToolbarCommand("create.file", handlers);
    expect(handlers.dropdowns.onCreateFile).toHaveBeenCalledOnce();
  });

  it("dispatches op.rename to dropdowns.onRename", () => {
    const handlers = createHandlers();
    runToolbarCommand("op.rename", handlers);
    expect(handlers.dropdowns.onRename).toHaveBeenCalledOnce();
  });

  it("dispatches op.copy to dropdowns.onCopy", () => {
    const handlers = createHandlers();
    runToolbarCommand("op.copy", handlers);
    expect(handlers.dropdowns.onCopy).toHaveBeenCalledOnce();
  });

  it("dispatches op.cut to dropdowns.onCut", () => {
    const handlers = createHandlers();
    runToolbarCommand("op.cut", handlers);
    expect(handlers.dropdowns.onCut).toHaveBeenCalledOnce();
  });

  it("dispatches op.paste to dropdowns.onPaste", () => {
    const handlers = createHandlers();
    runToolbarCommand("op.paste", handlers);
    expect(handlers.dropdowns.onPaste).toHaveBeenCalledOnce();
  });

  it("dispatches op.copyTo to dropdowns.onCopyOperation", () => {
    const handlers = createHandlers();
    runToolbarCommand("op.copyTo", handlers);
    expect(handlers.dropdowns.onCopyOperation).toHaveBeenCalledOnce();
  });

  it("dispatches op.moveTo to dropdowns.onMove", () => {
    const handlers = createHandlers();
    runToolbarCommand("op.moveTo", handlers);
    expect(handlers.dropdowns.onMove).toHaveBeenCalledOnce();
  });

  it("dispatches op.trash to dropdowns.onTrash", () => {
    const handlers = createHandlers();
    runToolbarCommand("op.trash", handlers);
    expect(handlers.dropdowns.onTrash).toHaveBeenCalledOnce();
  });

  it("dispatches op.deletePermanent to dropdowns.onPermanentDelete", () => {
    const handlers = createHandlers();
    runToolbarCommand("op.deletePermanent", handlers);
    expect(handlers.dropdowns.onPermanentDelete).toHaveBeenCalledOnce();
  });

  it("dispatches clipboard.copyPath to dropdowns.onCopyPath", () => {
    const handlers = createHandlers();
    runToolbarCommand("clipboard.copyPath", handlers);
    expect(handlers.dropdowns.onCopyPath).toHaveBeenCalledOnce();
  });

  it("dispatches clipboard.copyName to dropdowns.onCopyName", () => {
    const handlers = createHandlers();
    runToolbarCommand("clipboard.copyName", handlers);
    expect(handlers.dropdowns.onCopyName).toHaveBeenCalledOnce();
  });

  it("dispatches op.properties to dropdowns.onProperties", () => {
    const handlers = createHandlers();
    runToolbarCommand("op.properties", handlers);
    expect(handlers.dropdowns.onProperties).toHaveBeenCalledOnce();
  });

  it("dispatches op.reveal to dropdowns.onRevealInFileManager", () => {
    const handlers = createHandlers();
    runToolbarCommand("op.reveal", handlers);
    expect(handlers.dropdowns.onRevealInFileManager).toHaveBeenCalledOnce();
  });

  it("dispatches op.calculateSize to dropdowns.onCalculateSize", () => {
    const handlers = createHandlers();
    runToolbarCommand("op.calculateSize", handlers);
    expect(handlers.dropdowns.onCalculateSize).toHaveBeenCalledOnce();
  });

  it("dispatches op.compress to dropdowns.onCompress", () => {
    const handlers = createHandlers();
    runToolbarCommand("op.compress", handlers);
    expect(handlers.dropdowns.onCompress).toHaveBeenCalledOnce();
  });

  it("dispatches op.extract to dropdowns.onExtract", () => {
    const handlers = createHandlers();
    runToolbarCommand("op.extract", handlers);
    expect(handlers.dropdowns.onExtract).toHaveBeenCalledOnce();
  });

  it("dispatches op.openTerminal to dropdowns.onOpenTerminal", () => {
    const handlers = createHandlers();
    runToolbarCommand("op.openTerminal", handlers);
    expect(handlers.dropdowns.onOpenTerminal).toHaveBeenCalledOnce();
  });

  it("dispatches op.openTerminalExternal to dropdowns.onOpenTerminalExternal", () => {
    const handlers = createHandlers();
    runToolbarCommand("op.openTerminalExternal", handlers);
    expect(handlers.dropdowns.onOpenTerminalExternal).toHaveBeenCalledOnce();
  });

  it("dispatches op.checksum to dropdowns.onChecksum", () => {
    const handlers = createHandlers();
    runToolbarCommand("op.checksum", handlers);
    expect(handlers.dropdowns.onChecksum).toHaveBeenCalledOnce();
  });

  it("dispatches selection.selectAll to dropdowns.onSelectAll", () => {
    const handlers = createHandlers();
    runToolbarCommand("selection.selectAll", handlers);
    expect(handlers.dropdowns.onSelectAll).toHaveBeenCalledOnce();
  });

  it("dispatches view.toggleHidden to dropdowns.onToggleHidden", () => {
    const handlers = createHandlers();
    runToolbarCommand("view.toggleHidden", handlers);
    expect(handlers.dropdowns.onToggleHidden).toHaveBeenCalledOnce();
  });

  it("dispatches view.details to dropdowns.onViewMode with 'details'", () => {
    const handlers = createHandlers();
    runToolbarCommand("view.details", handlers);
    expect(handlers.dropdowns.onViewMode).toHaveBeenCalledWith("details");
  });

  it("dispatches view.list to dropdowns.onViewMode with 'list'", () => {
    const handlers = createHandlers();
    runToolbarCommand("view.list", handlers);
    expect(handlers.dropdowns.onViewMode).toHaveBeenCalledWith("list");
  });

  it("dispatches view.compact to dropdowns.onViewMode with 'compact'", () => {
    const handlers = createHandlers();
    runToolbarCommand("view.compact", handlers);
    expect(handlers.dropdowns.onViewMode).toHaveBeenCalledWith("compact");
  });

  it("dispatches view.icons to dropdowns.onViewMode with 'icons'", () => {
    const handlers = createHandlers();
    runToolbarCommand("view.icons", handlers);
    expect(handlers.dropdowns.onViewMode).toHaveBeenCalledWith("icons");
  });

  it("dispatches view.columns to dropdowns.onViewMode with 'columns'", () => {
    const handlers = createHandlers();
    runToolbarCommand("view.columns", handlers);
    expect(handlers.dropdowns.onViewMode).toHaveBeenCalledWith("columns");
  });

  it("falls back to onCommand for unhandled command IDs", () => {
    const handlers = createHandlers();
    runToolbarCommand("app.customizeToolbar", handlers);
    expect(handlers.onCommand).toHaveBeenCalledWith("app.customizeToolbar");
  });

  it("does not call any specific handler for unhandled command IDs", () => {
    const handlers = createHandlers();
    runToolbarCommand("app.settings", handlers);
    expect(handlers.onBack).not.toHaveBeenCalled();
    expect(handlers.onForward).not.toHaveBeenCalled();
    expect(handlers.onCommand).toHaveBeenCalledWith("app.settings");
  });
});
