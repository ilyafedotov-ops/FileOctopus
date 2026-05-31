import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBar } from "../src/shell/StatusBar";

describe("StatusBar", () => {
  it("shows selection and total item count", () => {
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
        onOpenActivity={() => {}}
      />,
    );

    expect(screen.getByText(/Selected: 2 items \(4\.2 MB\)/)).toBeTruthy();
    expect(screen.getByText(/Total: 18 items/)).toBeTruthy();
  });

  it("shows loading state and active jobs with errors", () => {
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
        onOpenActivity={() => {}}
      />,
    );

    expect(screen.getByText("Loading…")).toBeTruthy();
    expect(screen.getAllByText(/1 active job/).length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getAllByText(/Errors/).length).toBeGreaterThanOrEqual(1);
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
        onOpenActivity={() => {}}
      />,
    );

    expect(screen.getByText(/Total: Empty/)).toBeTruthy();
    expect(screen.getByText(/Selected: No selection/)).toBeTruthy();
  });
});
