import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PaneStateView } from "../src/components/PaneStateView";
import { SettingsDialog } from "../src/components/SettingsDialog";
import { ShortcutsDialog } from "../src/components/ShortcutsDialog";

describe("visual state fixtures", () => {
  it("renders empty pane state", () => {
    render(
      <PaneStateView
        loadState="empty"
        uri="local:///Users/ilya/Documents"
        message={null}
        onRetry={() => undefined}
        onRefresh={() => undefined}
        onCreateFolder={() => undefined}
      />,
    );

    expect(screen.getByText("This folder is empty")).toBeTruthy();
  });

  it("renders settings dialog", () => {
    render(
      <SettingsDialog
        open
        preferences={{
          theme: "dark",
          density: "comfortable",
          defaultViewMode: "details",
          showHiddenFiles: false,
          sidebarWidth: 240,
          splitRatio: 0.5,
        }}
        onClose={() => undefined}
        onChange={() => undefined}
      />,
    );

    expect(screen.getByText("Settings")).toBeTruthy();
  });

  it("renders shortcuts dialog", () => {
    render(
      <ShortcutsDialog open onClose={() => undefined} />,
    );

    expect(screen.getByText("Keyboard shortcuts")).toBeTruthy();
    expect(screen.getByText("Copy selection")).toBeTruthy();
  });
});
