import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FirstRunOverlay } from "../src/components/FirstRunOverlay";
import {
  FIRST_RUN_DISMISSED_KEY,
  markFirstRunOverlayDismissed,
  shouldShowFirstRunOverlay,
} from "../src/onboarding/firstRun";

describe("first-run overlay", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("uses localStorage to show only before dismissal", () => {
    expect(shouldShowFirstRunOverlay()).toBe(true);

    markFirstRunOverlayDismissed();

    expect(localStorage.getItem(FIRST_RUN_DISMISSED_KEY)).toBe("true");
    expect(shouldShowFirstRunOverlay()).toBe(false);
  });

  it("renders primary actions and dismisses before opening another surface", () => {
    const onDismiss = vi.fn();
    const onOpenSettings = vi.fn();
    const onOpenShortcuts = vi.fn();
    const onOpenNetwork = vi.fn();

    render(
      <FirstRunOverlay
        open
        onDismiss={onDismiss}
        onOpenSettings={onOpenSettings}
        onOpenShortcuts={onOpenShortcuts}
        onOpenNetwork={onOpenNetwork}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Welcome to FileOctopus" }),
    ).toBeTruthy();

    screen.getByRole("button", { name: "Settings" }).click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);

    screen.getByRole("button", { name: "Shortcuts" }).click();
    expect(onDismiss).toHaveBeenCalledTimes(2);
    expect(onOpenShortcuts).toHaveBeenCalledTimes(1);

    screen.getByRole("button", { name: "Network" }).click();
    expect(onDismiss).toHaveBeenCalledTimes(3);
    expect(onOpenNetwork).toHaveBeenCalledTimes(1);
  });
});
