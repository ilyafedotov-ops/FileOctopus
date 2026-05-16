import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DropdownMenu, type DropdownMenuItem } from "../src/DropdownMenu";

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
