import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ManageHotlistDialog } from "../src/dialogs/ManageHotlistDialog";

const STORAGE_KEY = "fileoctopus_hotlist";

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
});

describe("ManageHotlistDialog", () => {
  it("renders nothing when open=false", () => {
    render(<ManageHotlistDialog open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders dialog header when open=true", () => {
    render(<ManageHotlistDialog open={true} onClose={vi.fn()} />);
    expect(
      screen.getByRole("dialog", { name: "Manage Directory Hotlist" }),
    ).toBeTruthy();
  });

  it("shows empty message when no entries", () => {
    render(<ManageHotlistDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText(/No hotlist entries/)).toBeTruthy();
  });

  it("lists existing entries", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: "h1", label: "Home", uri: "local:///home/user" },
        { id: "h2", label: "Work", uri: "local:///work" },
      ]),
    );
    render(<ManageHotlistDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("Work")).toBeTruthy();
  });

  it("removes an entry on delete button click", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: "h1", label: "Home", uri: "local:///home/user" },
        { id: "h2", label: "Work", uri: "local:///work" },
      ]),
    );
    render(<ManageHotlistDialog open={true} onClose={vi.fn()} />);
    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    fireEvent.click(removeButtons[0]);
    expect(screen.queryByText("Home")).toBeNull();
    expect(screen.getByText("Work")).toBeTruthy();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    expect(stored.length).toBe(1);
    expect(stored[0].label).toBe("Work");
  });

  it("adds a new entry on Add click", () => {
    render(<ManageHotlistDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Add"));
    const inputs = screen.getAllByRole("textbox");
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    expect(stored.length).toBe(1);
    expect(stored[0].label).toBe("New Entry");
  });

  it("closes on Done click", () => {
    const onClose = vi.fn();
    render(<ManageHotlistDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText("Done"));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on backdrop click", () => {
    const onClose = vi.fn();
    render(<ManageHotlistDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(onClose).toHaveBeenCalled();
  });

  it("moves entry up on up arrow click", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: "h1", label: "First", uri: "local:///first" },
        { id: "h2", label: "Second", uri: "local:///second" },
      ]),
    );
    render(<ManageHotlistDialog open={true} onClose={vi.fn()} />);
    const upButtons = screen.getAllByRole("button", { name: "Move up" });
    fireEvent.click(upButtons[1]); // move "Second" up
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    expect(stored[0].label).toBe("Second");
    expect(stored[1].label).toBe("First");
  });

  it("enters edit mode on edit button click", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: "h1", label: "Home", uri: "local:///home/user" }]),
    );
    render(<ManageHotlistDialog open={true} onClose={vi.fn()} />);
    const editButton = screen.getByRole("button", { name: "Edit" });
    fireEvent.click(editButton);
    expect(screen.getByRole("button", { name: /✓/ })).toBeTruthy();
  });
});
