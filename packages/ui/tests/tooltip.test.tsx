import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { Tooltip } from "../src/Tooltip";

afterEach(() => {
  cleanup();
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  it("shows tooltip after hover delay", async () => {
    render(
      <Tooltip label="Tip text" delay={200}>
        <Trigger />
      </Tooltip>,
    );
    const trigger = screen.getByText("Hover me");
    fireEvent.mouseEnter(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
    await waitFor(() => {
      expect(screen.getByRole("tooltip").textContent).toBe("Tip text");
    });
  });

  it("hides tooltip on mouse leave before delay", async () => {
    render(
      <Tooltip label="Tip" delay={300}>
        <Trigger />
      </Tooltip>,
    );
    const trigger = screen.getByText("Hover me");
    fireEvent.mouseEnter(trigger);
    await sleep(150);
    fireEvent.mouseLeave(trigger);
    await sleep(300);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("hides tooltip on mouse leave after shown", async () => {
    render(
      <Tooltip label="Tip" delay={100}>
        <Trigger />
      </Tooltip>,
    );
    const trigger = screen.getByText("Hover me");
    fireEvent.mouseEnter(trigger);
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeTruthy();
    });
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows tooltip on focus", async () => {
    render(
      <Tooltip label="Focused tip" delay={100}>
        <Trigger />
      </Tooltip>,
    );
    const trigger = screen.getByText("Hover me");
    fireEvent.focus(trigger);
    await waitFor(() => {
      expect(screen.getByRole("tooltip").textContent).toBe("Focused tip");
    });
  });

  it("hides tooltip on blur", async () => {
    render(
      <Tooltip label="Tip" delay={100}>
        <Trigger />
      </Tooltip>,
    );
    const trigger = screen.getByText("Hover me");
    fireEvent.focus(trigger);
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeTruthy();
    });
    fireEvent.blur(trigger);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("does not show tooltip when disabled", async () => {
    render(
      <Tooltip label="Disabled tip" delay={100} disabled>
        <Trigger />
      </Tooltip>,
    );
    const trigger = screen.getByText("Hover me");
    fireEvent.mouseEnter(trigger);
    await sleep(120);
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

  it("uses default delay of 400ms", async () => {
    render(
      <Tooltip label="Default delay">
        <Trigger />
      </Tooltip>,
    );
    const trigger = screen.getByText("Hover me");
    fireEvent.mouseEnter(trigger);
    await sleep(100);
    expect(screen.queryByRole("tooltip")).toBeNull();
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toBeTruthy();
    });
  });
});
