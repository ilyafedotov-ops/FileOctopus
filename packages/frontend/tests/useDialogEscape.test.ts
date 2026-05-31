import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { act } from "@testing-library/react";
import { useDialogEscape } from "../src/hooks/useDialogEscape";

describe("useDialogEscape", () => {
  const addEventListener = vi.spyOn(window, "addEventListener");
  const removeEventListener = vi.spyOn(window, "removeEventListener");

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("registers a keydown listener on mount", () => {
    renderHook(() => useDialogEscape(true, vi.fn()));
    expect(addEventListener).toHaveBeenCalledWith(
      "keydown",
      expect.any(Function),
    );
  });

  it("removes the keydown listener on unmount", () => {
    const { unmount } = renderHook(() => useDialogEscape(true, vi.fn()));
    unmount();
    expect(removeEventListener).toHaveBeenCalledWith(
      "keydown",
      expect.any(Function),
    );
  });

  it("calls onClose when Escape is pressed and open is true", () => {
    const onClose = vi.fn();
    renderHook(() => useDialogEscape(true, onClose));

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when a non-Escape key is pressed", () => {
    const onClose = vi.fn();
    renderHook(() => useDialogEscape(true, onClose));

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not call onClose when open is false", () => {
    const onClose = vi.fn();
    renderHook(() => useDialogEscape(false, onClose));

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not call onClose after unmount", () => {
    const onClose = vi.fn();
    const { unmount } = renderHook(() => useDialogEscape(true, onClose));

    unmount();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});
