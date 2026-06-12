import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  it("renders a setup assistant with workspace and network steps", () => {
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
    expect(screen.getByRole("button", { name: "Workspace" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Connections" })).toBeTruthy();
    expect(screen.getByText("Dual pane workspace")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Remote connections")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add connection" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onOpenNetwork).toHaveBeenCalledTimes(1);
  });

  it("dismisses before opening settings or shortcuts from finish", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Shortcuts" }));
    expect(onDismiss).toHaveBeenCalledTimes(2);
    expect(onOpenShortcuts).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(onDismiss).toHaveBeenCalledTimes(3);
  });
});
