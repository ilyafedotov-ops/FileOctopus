import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ToolbarEntry } from "../src/commands/toolbarConfig";
import { DEFAULT_TOOLBAR_ENTRIES } from "../src/commands/toolbarConfig";
import { ToolbarCustomizeDialog } from "../src/components/ToolbarCustomizeDialog";

afterEach(() => {
  cleanup();
});

const sampleEntries: ToolbarEntry[] = [
  { kind: "command", commandId: "op.copy" },
  { kind: "separator" },
  { kind: "command", commandId: "op.trash" },
];

function createProps(overrides: Record<string, unknown> = {}) {
  return {
    open: true,
    entries: sampleEntries,
    onClose: vi.fn(),
    onSave: vi.fn(),
    ...overrides,
  };
}

describe("ToolbarCustomizeDialog", () => {
  it("renders nothing when open is false", () => {
    render(<ToolbarCustomizeDialog {...createProps({ open: false })} />);
    expect(screen.queryByText("Customize Toolbar")).toBeNull();
  });

  it("renders the dialog title when open", () => {
    render(<ToolbarCustomizeDialog {...createProps()} />);
    expect(screen.getByText("Customize Toolbar")).toBeTruthy();
  });

  it("lists current toolbar entries", () => {
    render(<ToolbarCustomizeDialog {...createProps()} />);
    const list = screen.getByRole("list");
    expect(within(list).getByText("Copy")).toBeTruthy();
    expect(within(list).getByText("Separator")).toBeTruthy();
    expect(within(list).getByText("Trash")).toBeTruthy();
  });

  it("calls onSave with updated entries when Save is clicked", () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<ToolbarCustomizeDialog {...createProps({ onSave, onClose })} />);

    fireEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledWith(sampleEntries);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("resets to default entries when Reset to default is clicked", () => {
    render(<ToolbarCustomizeDialog {...createProps()} />);

    fireEvent.click(screen.getByText("Reset to default"));

    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items.length).toBe(DEFAULT_TOOLBAR_ENTRIES.length);
  });

  it("removes an entry when Remove is clicked", () => {
    render(<ToolbarCustomizeDialog {...createProps()} />);

    const list = screen.getByRole("list");
    const rows = within(list).getAllByRole("listitem");
    expect(rows.length).toBe(3);

    const removeButtons = within(list).getAllByText("Remove");
    fireEvent.click(removeButtons[0]);

    const updatedRows = within(list).getAllByRole("listitem");
    expect(updatedRows.length).toBe(2);
    expect(within(list).queryByText("Copy")).toBeNull();
  });

  it("adds a separator when Add separator is clicked", () => {
    render(<ToolbarCustomizeDialog {...createProps()} />);

    fireEvent.click(screen.getByText("Add separator"));

    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items.length).toBe(4);
    const separators = within(list).getAllByText("Separator");
    expect(separators.length).toBe(2);
  });

  it("disables Up on first item and Down on last item", () => {
    render(<ToolbarCustomizeDialog {...createProps()} />);

    const list = screen.getByRole("list");
    const rows = within(list).getAllByRole("listitem");

    const firstUp = within(rows[0]).getByText("Up");
    const firstDown = within(rows[0]).getByText("Down");
    expect(firstUp.closest("button")?.disabled).toBe(true);
    expect(firstDown.closest("button")?.disabled).toBe(false);

    const lastUp = within(rows[2]).getByText("Up");
    const lastDown = within(rows[2]).getByText("Down");
    expect(lastUp.closest("button")?.disabled).toBe(false);
    expect(lastDown.closest("button")?.disabled).toBe(true);
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(<ToolbarCustomizeDialog {...createProps({ onClose })} />);

    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("disables Add when no command is selected", () => {
    render(<ToolbarCustomizeDialog {...createProps()} />);

    const addBtn = screen.getByText("Add");
    expect(addBtn.closest("button")?.disabled).toBe(true);
  });
});
