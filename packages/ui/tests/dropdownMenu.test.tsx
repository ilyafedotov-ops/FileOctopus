import { act } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DropdownMenu, type DropdownMenuItem } from "../src/DropdownMenu";

afterEach(() => {
  cleanup();
});

describe("DropdownMenu nested children", () => {
  it("renders a submenu trigger when an item has children", () => {
    const onChildSelect = vi.fn();
    const items: DropdownMenuItem[] = [
      {
        id: "parent",
        label: "Sort By",
        onSelect: () => {},
        children: [
          { id: "name", label: "Name", onSelect: onChildSelect },
          { id: "size", label: "Size", onSelect: onChildSelect },
        ],
      },
    ];

    render(
      <DropdownMenu label="View" open items={items} onOpenChange={() => {}} />,
    );

    const submenuTrigger = screen.getByRole("menuitem", { name: /Sort By/ });
    expect(submenuTrigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(submenuTrigger.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("DropdownMenu submenu behaviour", () => {
  it("opens submenu on hover and closes root on child select", async () => {
    const onChildSelect = vi.fn();
    const onOpenChange = vi.fn();
    const items: DropdownMenuItem[] = [
      {
        id: "parent",
        label: "Sort By",
        onSelect: () => {},
        children: [{ id: "name", label: "Name", onSelect: onChildSelect }],
      },
    ];

    render(
      <DropdownMenu
        label="View"
        open
        items={items}
        onOpenChange={onOpenChange}
      />,
    );

    const trigger = screen.getByRole("menuitem", { name: /Sort By/ });
    fireEvent.mouseEnter(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    const child = screen.getByRole("menuitem", { name: "Name" });
    fireEvent.click(child);
    expect(onChildSelect).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes submenu when clicking outside both trigger and submenu", () => {
    const items: DropdownMenuItem[] = [
      {
        id: "parent",
        label: "Sort By",
        onSelect: () => {},
        children: [{ id: "name", label: "Name", onSelect: () => {} }],
      },
    ];

    render(
      <DropdownMenu label="View" open items={items} onOpenChange={() => {}} />,
    );

    fireEvent.mouseEnter(screen.getByRole("menuitem", { name: /Sort By/ }));
    expect(screen.getByRole("menuitem", { name: "Name" })).not.toBeNull();

    act(() => {
      document.body.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true }),
      );
    });
    expect(screen.queryByRole("menuitem", { name: "Name" })).toBeNull();
  });
});
