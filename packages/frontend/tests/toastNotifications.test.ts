import { describe, expect, it } from "vitest";
import {
  mergeNotification,
  mergeToast,
  shouldShowPopupNotification,
} from "../src/toastNotifications";

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

describe("mergeNotification", () => {
  it("appends every notification without collapsing matching titles", () => {
    const first = mergeNotification(
      [],
      { tone: "success", title: "Operation completed", detail: "copy" },
      () => "notification-1",
    );
    const second = mergeNotification(
      first.notifications,
      { tone: "success", title: "Operation completed", detail: "move" },
      () => "notification-2",
    );

    expect(second.notificationId).toBe("notification-2");
    expect(second.notifications.map((item) => item.detail)).toEqual([
      "copy",
      "move",
    ]);
  });
});

describe("shouldShowPopupNotification", () => {
  it("requires popup notifications to be enabled", () => {
    expect(
      shouldShowPopupNotification(false, {
        tone: "success",
        title: "Operation completed",
      }),
    ).toBe(false);
  });

  it("allows popup notifications when enabled", () => {
    expect(
      shouldShowPopupNotification(true, {
        tone: "error",
        title: "Operation failed",
      }),
    ).toBe(true);
  });

  it("keeps center-only notifications out of popups", () => {
    expect(
      shouldShowPopupNotification(true, {
        tone: "success",
        title: "Operation completed",
        popup: false,
      }),
    ).toBe(false);
  });
});
