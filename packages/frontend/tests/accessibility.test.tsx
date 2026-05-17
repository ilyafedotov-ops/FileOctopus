import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContextMenu } from "../src/components/ContextMenu";
import { DiagnosticsDialog } from "../src/components/DiagnosticsDialog";
import { SettingsDialog } from "../src/components/SettingsDialog";
import { ShortcutsDialog } from "../src/components/ShortcutsDialog";
import { useDialogEscape } from "../src/hooks/useDialogEscape";
import { sampleAppHealth, sampleAppInfo } from "./visualFixtures";

const noop = () => undefined;

describe("accessibility basics", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
  });

  it("closes settings with Escape", () => {
    const onClose = vi.fn();
    render(
      <SettingsDialog
        open
        preferences={{
          theme: "system",
          density: "comfortable",
          defaultViewMode: "details",
          showHiddenFiles: false,
          sidebarWidth: 240,
          splitRatio: 0.5,
          activityPanelVisible: false,
          activityPanelWidth: 288,
          confirmDelete: true,
          confirmPermanentDelete: true,
          useTrashByDefault: true,
          defaultConflictPolicy: "fail",
          accentColor: "blue",
          fontScale: "medium",
          iconScale: "medium",
          confirmOverwrite: true,
          sidebarVisible: true,
          paneMode: "dual",
          jobDrawerBehavior: "manual",
        }}
        autostart={null}
        onClose={onClose}
        onChange={noop}
        onSetAutostart={async () => {}}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("exposes dialog semantics for shortcuts and diagnostics", () => {
    const { rerender } = render(<ShortcutsDialog open onClose={noop} />);
    expect(
      screen.getByRole("dialog", { name: "Keyboard shortcuts" }),
    ).toBeTruthy();

    rerender(<div />);
    render(
      <DiagnosticsDialog
        open
        appInfo={sampleAppInfo}
        appHealth={sampleAppHealth}
        destination=""
        message={null}
        exporting={false}
        showDeveloperFields={false}
        onClose={noop}
        onDestinationChange={noop}
        onRefresh={noop}
        onExport={noop}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Diagnostics" })).toBeTruthy();
  });

  it("renders the context menu with menuitem roles", () => {
    render(
      <ContextMenu
        menu={{ panelId: "left", x: 12, y: 24, entry: null }}
        canPaste={false}
        isStarred={false}
        onClose={noop}
        onOpen={noop}
        onRename={noop}
        onCopy={noop}
        onCut={noop}
        onPaste={noop}
        onTrash={noop}
        onToggleStarred={noop}
        onPermanentDelete={noop}
        onCopyPath={noop}
        onCopyName={noop}
        onProperties={noop}
        onReveal={noop}
        onCreateFolder={noop}
        onCreateFile={noop}
        onRefresh={noop}
        onSelectAll={noop}
        onViewMode={noop}
        onSort={noop}
      />,
    );

    expect(screen.getAllByRole("menu").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("menuitem").length).toBeGreaterThan(5);
  });

  it("supports useDialogEscape hook", () => {
    const onClose = vi.fn();
    function Probe() {
      useDialogEscape(true, onClose);
      return null;
    }
    render(<Probe />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
