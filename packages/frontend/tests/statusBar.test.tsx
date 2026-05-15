import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBar } from "../src/shell/StatusBar";

describe("StatusBar", () => {
  it("shows active pane path and selection summary", () => {
    render(
      <StatusBar
        activePanelLabel="Left pane"
        pathLabel="/Users/ilya/Documents"
        loadState="loaded"
        selectedCount={2}
        entryCount={18}
        filterActive={false}
        selectedSizeLabel="4.2 MB"
        activeJobCount={0}
        operationError={null}
      />,
    );

    expect(screen.getByText("Ready")).toBeTruthy();
    expect(
      screen.getByText(/Left pane - \/Users\/ilya\/Documents/),
    ).toBeTruthy();
    expect(screen.getByText("2 selected - 4.2 MB")).toBeTruthy();
    expect(screen.getByText("18 items")).toBeTruthy();
  });

  it("shows loading and filtered state", () => {
    render(
      <StatusBar
        activePanelLabel="Right pane"
        pathLabel="/tmp"
        loadState="loading"
        selectedCount={0}
        entryCount={5}
        filterActive
        selectedSizeLabel={null}
        activeJobCount={1}
        operationError="copy failed"
      />,
    );

    expect(screen.getByText("Loading")).toBeTruthy();
    expect(screen.getByText(/Filtered/)).toBeTruthy();
    expect(screen.getByText("No selection")).toBeTruthy();
    expect(screen.getByText("Loading…")).toBeTruthy();
    expect(screen.getByText(/Errors/)).toBeTruthy();
  });

  it("shows empty folder state", () => {
    render(
      <StatusBar
        activePanelLabel="Left pane"
        pathLabel="/Users/ilya/Empty"
        loadState="empty"
        selectedCount={0}
        entryCount={0}
        filterActive={false}
        selectedSizeLabel={null}
        activeJobCount={0}
        operationError={null}
      />,
    );

    expect(screen.getByText("Empty folder")).toBeTruthy();
  });
});
