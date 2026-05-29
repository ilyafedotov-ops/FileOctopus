import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { HotlistDialog } from "../src/dialogs/HotlistDialog";

const STORAGE_KEY = "fileoctopus_hotlist";

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
});

describe("HotlistDialog", () => {
  it("renders nothing when open=false", () => {
    render(
      <HotlistDialog
        open={false}
        onNavigate={vi.fn()}
        onManage={vi.fn()}
        onClose={vi.fn()}
        onAddCurrent={vi.fn()}
        currentUri="local:///home/user"
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders dialog with header when open=true", () => {
    render(
      <HotlistDialog
        open={true}
        onNavigate={vi.fn()}
        onManage={vi.fn()}
        onClose={vi.fn()}
        onAddCurrent={vi.fn()}
        currentUri="local:///home/user"
      />,
    );
    expect(
      screen.getByRole("dialog", { name: "Directory Hotlist" }),
    ).toBeTruthy();
    expect(screen.getByText("Directory Hotlist")).toBeTruthy();
  });

  it("shows empty message when no entries", () => {
    render(
      <HotlistDialog
        open={true}
        onNavigate={vi.fn()}
        onManage={vi.fn()}
        onClose={vi.fn()}
        onAddCurrent={vi.fn()}
        currentUri="local:///home/user"
      />,
    );
    expect(screen.getByText(/No entries/)).toBeTruthy();
  });

  it("lists entries from localStorage", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: "h1", label: "Home", uri: "local:///home/user" },
        { id: "h2", label: "Projects", uri: "local:///home/user/projects" },
      ]),
    );
    render(
      <HotlistDialog
        open={true}
        onNavigate={vi.fn()}
        onManage={vi.fn()}
        onClose={vi.fn()}
        onAddCurrent={vi.fn()}
        currentUri="local:///home/user"
      />,
    );
    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("Projects")).toBeTruthy();
  });

  it("shows numbered shortcuts for first 9 entries", () => {
    const entries = Array.from({ length: 5 }, (_, i) => ({
      id: `h${i}`,
      label: `Dir ${i + 1}`,
      uri: `local:///dir${i}`,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    render(
      <HotlistDialog
        open={true}
        onNavigate={vi.fn()}
        onManage={vi.fn()}
        onClose={vi.fn()}
        onAddCurrent={vi.fn()}
        currentUri="local:///home/user"
      />,
    );
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("navigates on entry click", () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: "h1", label: "Home", uri: "local:///home/user" }]),
    );
    render(
      <HotlistDialog
        open={true}
        onNavigate={onNavigate}
        onManage={vi.fn()}
        onClose={onClose}
        onAddCurrent={vi.fn()}
        currentUri="local:///home/user"
      />,
    );
    fireEvent.click(screen.getByText("Home"));
    expect(onNavigate).toHaveBeenCalledWith("local:///home/user");
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <HotlistDialog
        open={true}
        onNavigate={vi.fn()}
        onManage={vi.fn()}
        onClose={onClose}
        onAddCurrent={vi.fn()}
        currentUri="local:///home/user"
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("opens manage dialog on Manage click", () => {
    const onManage = vi.fn();
    const onClose = vi.fn();
    render(
      <HotlistDialog
        open={true}
        onNavigate={vi.fn()}
        onManage={onManage}
        onClose={onClose}
        onAddCurrent={vi.fn()}
        currentUri="local:///home/user"
      />,
    );
    fireEvent.click(screen.getByText("Manage…"));
    expect(onManage).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onAddCurrent when Add Current clicked", () => {
    const onAddCurrent = vi.fn();
    render(
      <HotlistDialog
        open={true}
        onNavigate={vi.fn()}
        onManage={vi.fn()}
        onClose={vi.fn()}
        onAddCurrent={onAddCurrent}
        currentUri="local:///home/user/docs"
      />,
    );
    fireEvent.click(screen.getByText("Add Current"));
    expect(onAddCurrent).toHaveBeenCalledWith(
      "docs",
      "local:///home/user/docs",
    );
  });
});
