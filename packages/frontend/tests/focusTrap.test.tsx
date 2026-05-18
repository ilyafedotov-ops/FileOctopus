import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useRef, useState } from "react";
import { useFocusTrap } from "../src/hooks/useFocusTrap";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

function FocusTrapProbe({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open);
  if (!open) return null;
  return (
    <div ref={ref}>
      <button data-testid="first-btn" onClick={onClose}>
        First
      </button>
      <button data-testid="second-btn">Second</button>
      <button data-testid="third-btn">Third</button>
    </div>
  );
}

describe("useFocusTrap", () => {
  it("auto-focuses the first focusable element when opened", () => {
    const { rerender } = render(
      <FocusTrapProbe open={false} onClose={() => {}} />,
    );
    // Nothing focused
    expect(document.activeElement).toBe(document.body);

    rerender(<FocusTrapProbe open onClose={() => {}} />);
    const first = screen.getByTestId("first-btn");
    expect(document.activeElement).toBe(first);
  });

  it("traps Tab within the container", () => {
    render(<FocusTrapProbe open onClose={() => {}} />);
    const first = screen.getByTestId("first-btn");
    const third = screen.getByTestId("third-btn");

    // From third → Tab → should wrap to first
    act(() => {
      third.focus();
    });
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    // From first → Shift+Tab → should wrap to third
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(third);
  });

  it("restores focus to previously active element on close", () => {
    // Create a trigger button outside the dialog
    function Wrapper() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button data-testid="trigger" onClick={() => setOpen(true)}>
            Open
          </button>
          <FocusTrapProbe open={open} onClose={() => setOpen(false)} />
        </div>
      );
    }

    render(<Wrapper />);
    const trigger = screen.getByTestId("trigger");

    // Focus the trigger, then open the dialog
    act(() => {
      trigger.focus();
    });
    fireEvent.click(trigger);
    expect(document.activeElement).toBe(screen.getByTestId("first-btn"));

    // Close the dialog → focus should return to trigger
    fireEvent.click(screen.getByTestId("first-btn"));
    expect(document.activeElement).toBe(trigger);
  });

  it("does nothing when open is false", () => {
    const { container } = render(
      <FocusTrapProbe open={false} onClose={() => {}} />,
    );
    // No dialog rendered, nothing should happen
    expect(container.querySelector("[data-testid]")).toBeNull();
  });

  it("handles container with no focusable elements gracefully", () => {
    function EmptyProbe({ open }: { open: boolean }) {
      const ref = useRef<HTMLDivElement>(null);
      useFocusTrap(ref, open);
      if (!open) return null;
      return <div ref={ref}>No buttons here</div>;
    }
    // Should not throw
    expect(() => {
      render(<EmptyProbe open />);
    }).not.toThrow();
  });
});
