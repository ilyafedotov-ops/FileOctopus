import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastStack } from "../src/components/ToastStack";

afterEach(() => {
  cleanup();
});

describe("ToastStack", () => {
  it("renders toast actions and dismisses", () => {
    const onDismiss = vi.fn();
    const onAction = vi.fn();

    render(
      <ToastStack
        toasts={[
          {
            id: "toast-1",
            tone: "error",
            title: "Operation failed",
            detail: "Permission denied",
            actionLabel: "View details",
            onAction,
          },
        ]}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByText("Operation failed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "View details" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledWith("toast-1");
  });

  it("announces errors assertively and others politely (UPP-I1)", () => {
    const { rerender } = render(
      <ToastStack
        toasts={[{ id: "e", tone: "error", title: "Boom" }]}
        onDismiss={vi.fn()}
      />,
    );
    // Error toast is an assertive alert.
    expect(screen.getByRole("alert")).toBeTruthy();

    rerender(
      <ToastStack
        toasts={[{ id: "s", tone: "success", title: "Done" }]}
        onDismiss={vi.fn()}
      />,
    );
    // Success toast is a polite status.
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("keeps the live region mounted when empty", () => {
    const { container } = render(
      <ToastStack toasts={[]} onDismiss={vi.fn()} />,
    );
    const region = container.querySelector(".fo-toast-stack");
    expect(region).not.toBeNull();
    expect(region?.getAttribute("aria-live")).toBe("polite");
  });
});
