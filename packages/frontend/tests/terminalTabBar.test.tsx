import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TerminalTabBar } from "../src/terminal/TerminalTabBar";
import type { TerminalSession } from "../src/terminal/terminalSlice";

function session(
  id: string,
  label: string,
  status: TerminalSession["status"] = "running",
): TerminalSession {
  return {
    id,
    uri: `local:///${label}`,
    label,
    status,
    paneId: "rail",
  };
}

function renderBar(
  overrides: Partial<ComponentProps<typeof TerminalTabBar>> = {},
) {
  return render(
    <TerminalTabBar
      sessions={[
        session("s1", "alpha"),
        session("s2", "beta", "exited"),
        session("s3", "gamma"),
      ]}
      activeSessionId="s1"
      onSwitch={vi.fn()}
      onClose={vi.fn()}
      onNew={vi.fn()}
      {...overrides}
    />,
  );
}

afterEach(cleanup);

describe("TerminalTabBar", () => {
  it("renames the active tab inline", () => {
    const onRename = vi.fn();
    renderBar({ onRename });

    fireEvent.click(screen.getByLabelText("Terminal tab actions"));
    fireEvent.click(screen.getByText("Rename tab"));
    const input = screen.getByLabelText("Rename terminal tab");

    fireEvent.change(input, { target: { value: "api server" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onRename).toHaveBeenCalledWith("s1", "api server");
  });

  it("duplicates the active tab from the action menu", () => {
    const onDuplicate = vi.fn();
    renderBar({ onDuplicate });

    fireEvent.click(screen.getByLabelText("Terminal tab actions"));
    fireEvent.click(screen.getByText("Duplicate tab"));

    expect(onDuplicate).toHaveBeenCalledWith("s1");
  });

  it("closes exited tabs scoped to the rendered tab group", () => {
    const onClose = vi.fn();
    renderBar({ onClose });

    fireEvent.click(screen.getByLabelText("Terminal tab actions"));
    fireEvent.click(screen.getByText("Close exited tabs"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith("s2");
  });

  it("closes other tabs without closing the active tab", () => {
    const onClose = vi.fn();
    renderBar({ onClose });

    fireEvent.click(screen.getByLabelText("Terminal tab actions"));
    fireEvent.click(screen.getByText("Close other tabs"));

    expect(onClose).toHaveBeenCalledWith("s2");
    expect(onClose).toHaveBeenCalledWith("s3");
    expect(onClose).not.toHaveBeenCalledWith("s1");
  });

  it("submits terminal search in both directions", () => {
    const onSearch = vi.fn();
    renderBar({ onSearch });

    const input = screen.getByLabelText("Search terminal output");
    fireEvent.change(input, { target: { value: "panic" } });
    fireEvent.click(screen.getByLabelText("Find next terminal match"));
    fireEvent.click(screen.getByLabelText("Find previous terminal match"));

    expect(onSearch).toHaveBeenCalledWith("panic", "next");
    expect(onSearch).toHaveBeenCalledWith("panic", "previous");
  });
});
