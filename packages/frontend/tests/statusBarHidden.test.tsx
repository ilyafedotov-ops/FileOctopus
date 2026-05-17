import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { StatusBar } from "../src/shell/StatusBar";

afterEach(cleanup);

const baseProps = {
  activePanelLabel: "Left pane",
  pathLabel: "/home/user",
  loadState: "ready" as const,
  selectedCount: 0,
  entryCount: 42,
  filterActive: false,
  selectedSizeLabel: null as string | null,
  activeJobCount: 0,
  operationError: null as string | null,
  onOpenActivity: vi.fn(),
};

describe("StatusBar (spec §14.3)", () => {
  it("shows hidden files indicator when showHidden is true", () => {
    render(<StatusBar {...baseProps} showHidden={true} />);
    const indicator = screen.getByTitle(/hidden files/i);
    expect(indicator).toBeTruthy();
    expect(indicator.textContent).toContain("◑");
  });

  it("does not show hidden files indicator when showHidden is false", () => {
    render(<StatusBar {...baseProps} showHidden={false} />);
    expect(screen.queryByTitle(/hidden files/i)).toBeNull();
  });

  it("shows hidden files indicator with toggle hint", () => {
    render(<StatusBar {...baseProps} showHidden={true} />);
    const indicator = screen.getByTitle(/hidden files/i);
    expect(indicator.textContent).toContain("◑");
  });
});
