import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PaneStateView } from "../src/components/PaneStateView";
import { DiagnosticsDialog } from "../src/components/DiagnosticsDialog";
import { AboutDialog } from "../src/components/dialogs/AboutDialog";
import { SettingsDialog } from "../src/components/SettingsDialog";
import { ShortcutsDialog } from "../src/components/ShortcutsDialog";
import { FileTable } from "../src/pane/FileTable";
import {
  renderVisualState,
  sampleAppHealth,
  sampleAppInfo,
} from "./visualFixtures";

const noop = () => undefined;

const defaultPreferences = {
  theme: "dark" as const,
  density: "comfortable" as const,
  defaultViewMode: "details" as const,
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
  statusBarVisible: true,
  toolbarVisible: true,
  toolbarEntries: "",
  paneMode: "dual",
  jobDrawerBehavior: "manual",
  showAdvancedCopyOptions: false,
  paneTerminalHeightLeft: 0.35,
  paneTerminalHeightRight: 0.35,
  paneTerminalDefaultOpen: false,
  terminalCdOnNavigate: false,
  confirmClosePaneWithTerminal: true,
  terminalShell: "",
  terminalArgs: "",
};

describe("visual state fixtures", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-density");
  });

  it("renders empty pane state with action buttons", () => {
    const view = renderVisualState(
      <PaneStateView
        loadState="empty"
        uri="local:///Users/ilya/Documents"
        message={null}
        onRetry={noop}
        onRefresh={noop}
        onCreateFolder={noop}
      />,
    );

    expect(screen.getByText("This folder is empty")).toBeTruthy();
    expect(screen.getByText("New Folder")).toBeTruthy();
    expect(screen.getByText("Refresh")).toBeTruthy();
    expect(screen.getByText("/Users/ilya/Documents")).toBeTruthy();
    view.restore();
  });

  it("empty pane state fires onCreateFolder when New Folder clicked", () => {
    let called = false;
    const handleCreateFolder = () => {
      called = true;
    };
    const view = renderVisualState(
      <PaneStateView
        loadState="empty"
        uri="local:///tmp/empty"
        message={null}
        onRetry={noop}
        onRefresh={noop}
        onCreateFolder={handleCreateFolder}
      />,
    );

    screen.getByText("New Folder").click();
    expect(called).toBe(true);
    view.restore();
  });

  it("empty pane state fires onRefresh when Refresh clicked", () => {
    let called = false;
    const handleRefresh = () => {
      called = true;
    };
    const view = renderVisualState(
      <PaneStateView
        loadState="empty"
        uri="local:///tmp/empty"
        message={null}
        onRetry={noop}
        onRefresh={handleRefresh}
        onCreateFolder={noop}
      />,
    );

    screen.getByText("Refresh").click();
    expect(called).toBe(true);
    view.restore();
  });

  it("renders permission denied pane state", () => {
    const view = renderVisualState(
      <PaneStateView
        loadState="permissionDenied"
        uri="local:///Users/ilya/Documents/Secret"
        message="Operation not permitted"
        onRetry={noop}
        onRefresh={noop}
        onCreateFolder={noop}
      />,
    );

    expect(screen.getByText("Permission denied")).toBeTruthy();
    expect(
      screen.getByText(
        "Check macOS privacy settings or choose another location.",
      ),
    ).toBeTruthy();
    view.restore();
  });

  it("renders not found pane state", () => {
    const view = renderVisualState(
      <PaneStateView
        loadState="notFound"
        uri="local:///Users/ilya/Documents/Missing"
        message="not found"
        onRetry={noop}
        onRefresh={noop}
        onCreateFolder={noop}
      />,
    );

    expect(screen.getByText("Folder not found")).toBeTruthy();
    expect(
      screen.getByText("The path may have been moved, renamed, or deleted."),
    ).toBeTruthy();
    view.restore();
  });

  it("renders generic error pane state", () => {
    const view = renderVisualState(
      <PaneStateView
        loadState="error"
        uri="local:///Users/ilya/Documents"
        message="I/O error"
        onRetry={noop}
        onRefresh={noop}
        onCreateFolder={noop}
      />,
    );

    expect(screen.getByText("Unable to read this location")).toBeTruthy();
    view.restore();
  });

  it("renders settings dialog", () => {
    const view = renderVisualState(
      <SettingsDialog
        open
        preferences={defaultPreferences}
        autostart={null}
        onClose={noop}
        onChange={noop}
        onSetAutostart={async () => {}}
      />,
      { theme: "dark" },
    );

    expect(screen.getByText("Settings")).toBeTruthy();
    expect(document.documentElement.dataset.theme).toBe("dark");
    view.restore();
  });

  it("renders shortcuts dialog", () => {
    const view = renderVisualState(<ShortcutsDialog open onClose={noop} />);

    expect(
      screen.getByRole("heading", { name: "Keyboard shortcuts" }),
    ).toBeTruthy();
    expect(screen.getByText("Copy")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Navigation" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "File operations" }),
    ).toBeTruthy();
    view.restore();
  });

  it("renders about dialog", () => {
    const view = renderVisualState(
      <AboutDialog open appInfo={sampleAppInfo} onClose={noop} />,
    );

    expect(
      screen.getByRole("dialog", { name: "About FileOctopus" }),
    ).toBeTruthy();
    expect(screen.getByText("0.1.0")).toBeTruthy();
    view.restore();
  });

  it("renders pane loading state", () => {
    const view = renderVisualState(
      <PaneStateView
        loadState="loading"
        uri="local:///Users/ilya/Documents"
        message={null}
        onRetry={noop}
        onRefresh={noop}
        onCreateFolder={noop}
      />,
    );

    expect(screen.getByText("Loading folder")).toBeTruthy();
    view.restore();
  });

  it("renders diagnostics dialog", () => {
    const view = renderVisualState(
      <DiagnosticsDialog
        open
        appInfo={sampleAppInfo}
        appHealth={sampleAppHealth}
        destination="/tmp/export"
        message={null}
        exporting={false}
        showDeveloperFields
        onClose={noop}
        onDestinationChange={noop}
        onRefresh={noop}
        onExport={noop}
      />,
    );

    expect(screen.getByText("Diagnostics")).toBeTruthy();
    expect(screen.getByText("0.1.0")).toBeTruthy();
    expect(screen.getByText("/tmp/logs")).toBeTruthy();
    view.restore();
  });

  it("renders file table loading skeleton in compact density", () => {
    const view = renderVisualState(
      <FileTable
        entries={[]}
        currentUri="local:///tmp/nested"
        loadState="loading"
        rowHeight={24}
        selectedId={null}
        selectedIds={[]}
        focusedId={null}
        sortField="name"
        sortDirection="asc"
        viewMode="details"
        onSelect={noop}
        onEntrySelect={noop}
        onMove={noop}
        onSort={noop}
        onActivate={noop}
        onEntryActivate={noop}
        onContextMenu={noop}
      />,
      { density: "compact" },
    );

    expect(document.documentElement.dataset.density).toBe("compact");
    expect(document.querySelector(".fo-file-skeleton")).toBeTruthy();
    view.restore();
  });
});
