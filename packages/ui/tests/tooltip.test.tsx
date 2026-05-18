import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
} from "@testing-library/react";
import { Tooltip } from "../src/Tooltip";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Trigger({
  children,
  ...rest
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}) {
  return <button {...rest}>{children ?? "Hover me"}</button>;
}

describe("Tooltip", () => {
  it("renders children without tooltip by default", () => {
    render(
      <Tooltip label="Hello">
        <Trigger />
      </Tooltip>,
    );
    expect(screen.getByText("Hover me")).toBeTruthy();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows tooltip after hover delay", () => {
    render(
      <Tooltip label="Tip text" delay={200}>
        <Trigger />
      </Tooltip>,
    );
    const trigger = screen.getByText("Hover me");
    fireEvent.mouseEnter(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).toBe("Tip text");
  });

  it("hides tooltip on mouse leave before delay", () => {
    render(
      <Tooltip label="Tip" delay={300}>
        <Trigger />
      </Tooltip>,
    );
    const trigger = screen.getByText("Hover me");
    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(150);
    });
    fireEvent.mouseLeave(trigger);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("hides tooltip on mouse leave after shown", () => {
    render(
      <Tooltip label="Tip" delay={100}>
        <Trigger />
      </Tooltip>,
    );
    const trigger = screen.getByText("Hover me");
    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows tooltip on focus", () => {
    render(
      <Tooltip label="Focused tip" delay={100}>
        <Trigger />
      </Tooltip>,
    );
    const trigger = screen.getByText("Hover me");
    fireEvent.focus(trigger);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByRole("tooltip").textContent).toBe("Focused tip");
  });

  it("hides tooltip on blur", () => {
    render(
      <Tooltip label="Tip" delay={100}>
        <Trigger />
      </Tooltip>,
    );
    const trigger = screen.getByText("Hover me");
    fireEvent.focus(trigger);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.blur(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("does not show tooltip when disabled", () => {
    render(
      <Tooltip label="Disabled tip" delay={100} disabled>
        <Trigger />
      </Tooltip>,
    );
    const trigger = screen.getByText("Hover me");
    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("sets aria-label on the child element", () => {
    render(
      <Tooltip label="Accessible text">
        <Trigger />
      </Tooltip>,
    );
    expect(screen.getByText("Hover me").getAttribute("aria-label")).toBe(
      "Accessible text",
    );
  });

  it("preserves existing aria-label on child", () => {
    render(
      <Tooltip label="Tooltip text">
        <Trigger aria-label="Custom label" />
      </Tooltip>,
    );
    expect(screen.getByText("Hover me").getAttribute("aria-label")).toBe(
      "Custom label",
    );
  });

  it("calls existing onMouseEnter handler on child", () => {
    const onMouseEnter = vi.fn();
    render(
      <Tooltip label="Tip">
        <Trigger onMouseEnter={onMouseEnter} />
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByText("Hover me"));
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
  });

  it("calls existing onMouseLeave handler on child", () => {
    const onMouseLeave = vi.fn();
    render(
      <Tooltip label="Tip">
        <Trigger onMouseLeave={onMouseLeave} />
      </Tooltip>,
    );
    fireEvent.mouseLeave(screen.getByText("Hover me"));
    expect(onMouseLeave).toHaveBeenCalledTimes(1);
  });

  it("uses default delay of 400ms", () => {
    render(
      <Tooltip label="Default delay">
        <Trigger />
      </Tooltip>,
    );
    const trigger = screen.getByText("Hover me");
    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("tooltip")).toBeTruthy();
  });
});
