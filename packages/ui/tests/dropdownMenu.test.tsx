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

describe("DropdownMenu keyboard navigation (UPP-D2)", () => {
  const navItems: DropdownMenuItem[] = [
    { id: "open", label: "Open", onSelect: () => {} },
    { id: "save", label: "Save", onSelect: () => {} },
    { id: "settings", label: "Settings", onSelect: () => {} },
  ];

  function renderNav(onOpenChange = vi.fn()) {
    render(
      <DropdownMenu
        label="File"
        open
        items={navItems}
        onOpenChange={onOpenChange}
      />,
    );
    return { menu: screen.getByRole("menu"), onOpenChange };
  }

  it("ArrowDown moves focus to the first item, then the next", () => {
    const { menu } = renderNav();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Open" }),
    );
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Save" }),
    );
  });

  it("ArrowUp from the container wraps to the last item", () => {
    const { menu } = renderNav();
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Settings" }),
    );
  });

  it("Home and End jump to the first and last item", () => {
    const { menu } = renderNav();
    fireEvent.keyDown(menu, { key: "End" });
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Settings" }),
    );
    fireEvent.keyDown(menu, { key: "Home" });
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Open" }),
    );
  });

  it("type-ahead focuses the next item matching the typed character", () => {
    const { menu } = renderNav();
    fireEvent.keyDown(menu, { key: "s" });
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Save" }),
    );
    // Pressing "s" again advances to the next "s" item.
    fireEvent.keyDown(menu, { key: "s" });
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Settings" }),
    );
  });

  it("Escape closes the menu", () => {
    const { menu, onOpenChange } = renderNav();
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("skips disabled items during arrow navigation", () => {
    render(
      <DropdownMenu
        label="File"
        open
        items={[
          { id: "a", label: "Alpha", onSelect: () => {} },
          { id: "b", label: "Bravo", onSelect: () => {}, disabled: true },
          { id: "c", label: "Charlie", onSelect: () => {} },
        ]}
        onOpenChange={() => {}}
      />,
    );
    const menu = screen.getByRole("menu");
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Charlie" }),
    );
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
