import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PaneStateView } from "../src/components/PaneStateView";
import { StatusBar } from "../src/shell/StatusBar";
import { renderVisualState } from "./visualFixtures";
import { VisualShellFixture } from "./visualShellFixture";

const noop = () => undefined;

describe("visual regression snapshots", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-density");
  });

  it("matches the shell chrome structure in light theme", () => {
    const view = renderVisualState(<VisualShellFixture />);

    expect(screen.getByText("FileOctopus")).toBeTruthy();
    expect(screen.getByLabelText("File workspace preview")).toBeTruthy();
    expect(screen.getByLabelText("Activity and terminal")).toBeTruthy();
    expect(document.querySelector(".fo-dual-pane")).toBeTruthy();
    expect(view.container.querySelector(".fo-shell-frame")).toMatchSnapshot();
    view.restore();
  });

  it("matches the shell chrome structure in dark theme", () => {
    const view = renderVisualState(<VisualShellFixture />, { theme: "dark" });

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(view.container.querySelector(".fo-shell-frame")).toMatchSnapshot();
    view.restore();
  });

  it("matches the permission denied failure state", () => {
    const view = renderVisualState(
      <PaneStateView
        loadState="permissionDenied"
        uri="local:///Users/ilya/Documents/Secret"
        message="Operation not permitted"
        onRetry={noop}
        onRefresh={noop}
        onCreateFolder={noop}
      />,
      { theme: "dark" },
    );

    expect(screen.getByText("Permission denied")).toBeTruthy();
    expect(
      view.container.querySelector(".fo-pane-state-error"),
    ).toMatchSnapshot();
    view.restore();
  });

  it("matches the status bar operation error state", () => {
    const view = renderVisualState(
      <StatusBar
        activePanelLabel="Left pane"
        pathLabel="/Users/ilya/Documents"
        loadState="loaded"
        selectedCount={2}
        entryCount={12}
        filterActive={false}
        selectedSizeLabel="128 KB"
        activeJobCount={1}
        operationError="Copy failed"
        onOpenActivity={noop}
        onShowErrorDetails={noop}
      />,
      { theme: "dark" },
    );

    expect(screen.getByText("View error")).toBeTruthy();
    expect(view.container.querySelector(".fo-status-error")).toMatchSnapshot();
    view.restore();
  });
});
