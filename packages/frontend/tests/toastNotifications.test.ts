import { describe, expect, it } from "vitest";
import { mergeToast } from "../src/toastNotifications";

describe("mergeToast", () => {
  it("appends a new toast when none match", () => {
    const result = mergeToast(
      [],
      { tone: "success", title: "Operation completed", detail: "copy" },
      () => "toast-1",
    );

    expect(result.toastId).toBe("toast-1");
    expect(result.toasts).toHaveLength(1);
    expect(result.toasts[0]?.detail).toBe("copy");
  });

  it("updates an existing toast with the same title and tone", () => {
    const result = mergeToast(
      [
        {
          id: "toast-1",
          tone: "success",
          title: "Operation completed",
          detail: "copy",
        },
      ],
      { tone: "success", title: "Operation completed", detail: "move" },
      () => "toast-2",
    );

    expect(result.toastId).toBe("toast-1");
    expect(result.toasts).toHaveLength(1);
    expect(result.toasts[0]?.detail).toBe("move");
  });

  it("keeps only the three most recent distinct toasts", () => {
    const current = [
      { id: "a", tone: "info" as const, title: "One" },
      { id: "b", tone: "info" as const, title: "Two" },
      { id: "c", tone: "info" as const, title: "Three" },
    ];

    const result = mergeToast(
      current,
      { tone: "error", title: "Operation failed", detail: "denied" },
      () => "d",
    );

    expect(result.toasts.map((toast) => toast.id)).toEqual(["b", "c", "d"]);
  });
});
