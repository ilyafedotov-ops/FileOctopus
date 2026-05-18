import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilterInput, RecursiveSearchInput } from "../src/pane/PaneFilterBar";

afterEach(() => {
  cleanup();
});

describe("RecursiveSearchInput", () => {
  it("focuses when active and focusToken changes", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const { rerender } = render(
      <RecursiveSearchInput
        panelId="left"
        active
        value=""
        focusToken={0}
        onChange={onChange}
        onSubmit={onSubmit}
      />,
    );

    rerender(
      <RecursiveSearchInput
        panelId="left"
        active
        value=""
        focusToken={1}
        onChange={onChange}
        onSubmit={onSubmit}
      />,
    );

    expect(document.activeElement).toBe(
      screen.getByPlaceholderText("Search recursively…"),
    );
  });

  it("does not focus when inactive", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const { rerender } = render(
      <RecursiveSearchInput
        panelId="left"
        active={false}
        value=""
        focusToken={0}
        onChange={onChange}
        onSubmit={onSubmit}
      />,
    );

    rerender(
      <RecursiveSearchInput
        panelId="left"
        active={false}
        value=""
        focusToken={1}
        onChange={onChange}
        onSubmit={onSubmit}
      />,
    );

    expect(document.activeElement).not.toBe(
      screen.getByPlaceholderText("Search recursively…"),
    );
  });

  it("calls onSubmit on Enter", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    render(
      <RecursiveSearchInput
        panelId="left"
        active
        value="needle"
        focusToken={0}
        onChange={onChange}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.keyDown(screen.getByPlaceholderText("Search recursively…"), {
      key: "Enter",
    });

    expect(onSubmit).toHaveBeenCalledOnce();
  });
});

describe("FilterInput active pane", () => {
  it("does not focus when inactive", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <FilterInput
        panelId="left"
        active={false}
        value=""
        focusToken={0}
        onChange={onChange}
      />,
    );

    rerender(
      <FilterInput
        panelId="left"
        active={false}
        value=""
        focusToken={1}
        onChange={onChange}
      />,
    );

    expect(document.activeElement).not.toBe(
      screen.getByPlaceholderText("Filter current folder…"),
    );
  });

  it("focuses when active and focusToken changes", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <FilterInput
        panelId="left"
        active
        value=""
        focusToken={0}
        onChange={onChange}
      />,
    );

    rerender(
      <FilterInput
        panelId="left"
        active
        value=""
        focusToken={1}
        onChange={onChange}
      />,
    );

    expect(document.activeElement).toBe(
      screen.getByPlaceholderText("Filter current folder…"),
    );
  });
});
