import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BreadcrumbPath, type BreadcrumbSegment } from "@fileoctopus/ui";

afterEach(cleanup);

function makeSegments(count: number): BreadcrumbSegment[] {
  const result: BreadcrumbSegment[] = [];
  let path = "";
  for (let i = 0; i < count; i++) {
    const label = `seg${i}`;
    path = path ? `${path}/${label}` : label;
    result.push({ label, path });
  }
  return result;
}

describe("BreadcrumbPath overflow", () => {
  it("renders all segments when few enough", () => {
    const segments = makeSegments(3);
    render(
      <BreadcrumbPath
        segments={segments}
        onNavigate={() => {}}
        onEditPath={() => {}}
      />,
    );

    for (const seg of segments) {
      expect(screen.getAllByText(seg.label).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("renders last segment with bold class", () => {
    const segments = makeSegments(3);
    render(
      <BreadcrumbPath
        segments={segments}
        onNavigate={() => {}}
        onEditPath={() => {}}
      />,
    );

    const lastButtons = screen.getAllByText(segments[2].label);
    const lastButton = lastButtons[lastButtons.length - 1];
    expect(
      lastButton
        .closest("button")
        ?.className.indexOf("fo-breadcrumb-current") !== -1,
    ).toBe(true);
  });

  it("shows an overflow button when maxVisible limits displayed segments", () => {
    const segments = makeSegments(8);
    render(
      <BreadcrumbPath
        segments={segments}
        onNavigate={() => {}}
        onEditPath={() => {}}
        maxVisible={3}
      />,
    );

    expect(screen.getByLabelText("More path segments")).toBeTruthy();
  });

  it("always shows first and last segments when overflow is present", () => {
    const segments = makeSegments(8);
    render(
      <BreadcrumbPath
        segments={segments}
        onNavigate={() => {}}
        onEditPath={() => {}}
        maxVisible={3}
      />,
    );

    expect(
      screen.getAllByText(segments[0].label).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(segments[7].label).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("overflow menu contains hidden middle segments", () => {
    const segments = makeSegments(6);
    render(
      <BreadcrumbPath
        segments={segments}
        onNavigate={() => {}}
        onEditPath={() => {}}
        maxVisible={3}
      />,
    );

    const overflowBtn = screen.getByLabelText("More path segments");
    fireEvent.click(overflowBtn);

    for (let i = 1; i < 5; i++) {
      expect(
        screen.getAllByText(segments[i].label).length,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("clicking an overflow segment calls onNavigate", () => {
    const onNavigate = vi.fn();
    const segments = makeSegments(6);
    render(
      <BreadcrumbPath
        segments={segments}
        onNavigate={onNavigate}
        onEditPath={() => {}}
        maxVisible={3}
      />,
    );

    const overflowBtn = screen.getByLabelText("More path segments");
    fireEvent.click(overflowBtn);

    const hiddenItems = screen.getAllByText(segments[2].label);
    const overflowItem = hiddenItems[hiddenItems.length - 1];
    fireEvent.click(overflowItem);

    expect(onNavigate).toHaveBeenCalledWith(segments[2].path);
  });

  it("does not show overflow when segments fit within maxVisible", () => {
    const segments = makeSegments(3);
    render(
      <BreadcrumbPath
        segments={segments}
        onNavigate={() => {}}
        onEditPath={() => {}}
        maxVisible={5}
      />,
    );

    expect(screen.queryByLabelText("More path segments")).toBeNull();
  });

  it("still renders edit button", () => {
    const segments = makeSegments(4);
    render(
      <BreadcrumbPath
        segments={segments}
        onNavigate={() => {}}
        onEditPath={() => {}}
        maxVisible={2}
      />,
    );

    expect(screen.getByLabelText("Edit current path")).toBeTruthy();
  });
});
