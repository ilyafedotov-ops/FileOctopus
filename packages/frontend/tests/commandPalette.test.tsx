import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "../src/components/CommandPalette";
import type { CommandEntry } from "../src/components/CommandPalette";

const commands: CommandEntry[] = [
  {
    id: "copy",
    label: "Copy selection",
    shortcutKey: "Ctrl+C",
    category: "File operations",
  },
  {
    id: "refresh",
    label: "Refresh pane",
    shortcutKey: "Ctrl+R",
    category: "View",
  },
  {
    id: "toggle-hidden",
    label: "Toggle hidden files",
    shortcutKey: "Ctrl+H",
    category: "View",
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CommandPalette", () => {
  it("renders nothing when closed", () => {
    render(
      <CommandPalette
        open={false}
        commands={commands}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders search input and command list when open", () => {
    render(
      <CommandPalette
        open
        commands={commands}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByPlaceholderText("Type a command...")).toBeTruthy();
    expect(screen.getByText("Copy selection")).toBeTruthy();
    expect(screen.getByText("Refresh pane")).toBeTruthy();
  });

  it("filters commands by search query", () => {
    render(
      <CommandPalette
        open
        commands={commands}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    const input = screen.getByPlaceholderText("Type a command...");
    fireEvent.change(input, { target: { value: "ref" } });
    expect(screen.queryByText("Copy selection")).toBeNull();
    expect(screen.getByText("Refresh pane")).toBeTruthy();
  });

  it("calls onSelect with command id when command is clicked", () => {
    const onSelect = vi.fn();
    render(
      <CommandPalette
        open
        commands={commands}
        onSelect={onSelect}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("Copy selection"));
    expect(onSelect).toHaveBeenCalledWith("copy");
  });

  it("calls onClose on Escape key", () => {
    const onClose = vi.fn();
    render(
      <CommandPalette
        open
        commands={commands}
        onSelect={() => {}}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("shows empty message for no matching results", () => {
    render(
      <CommandPalette
        open
        commands={commands}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    const input = screen.getByPlaceholderText("Type a command...");
    fireEvent.change(input, { target: { value: "zzzzz" } });
    expect(screen.getByText("No matching commands")).toBeTruthy();
  });

  it("displays shortcut key for each command", () => {
    render(
      <CommandPalette
        open
        commands={commands}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("Ctrl+C")).toBeTruthy();
  });

  it("navigates with arrow keys", () => {
    render(
      <CommandPalette
        open
        commands={commands}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    const dialog = screen.getByRole("dialog");
    const items = screen.getAllByRole("option");
    expect(items[0].className).toContain("fo-command-palette-item-active");

    fireEvent.keyDown(dialog, { key: "ArrowDown" });
    expect(items[1].className).toContain("fo-command-palette-item-active");

    fireEvent.keyDown(dialog, { key: "ArrowUp" });
    expect(items[0].className).toContain("fo-command-palette-item-active");
  });

  it("selects active item on Enter", () => {
    const onSelect = vi.fn();
    render(
      <CommandPalette
        open
        commands={commands}
        onSelect={onSelect}
        onClose={() => {}}
      />,
    );
    const dialog = screen.getByRole("dialog");

    fireEvent.keyDown(dialog, { key: "ArrowDown" });
    fireEvent.keyDown(dialog, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("refresh");
  });
});
