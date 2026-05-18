import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PaneStateView } from "../src/components/PaneStateView";

afterEach(cleanup);

describe("PaneStateView offline state", () => {
  const baseProps = {
    uri: "local:///mnt/usb",
    message: null as string | null,
    canPaste: false,
    onRetry: () => {},
    onRefresh: () => {},
    onCreateFolder: () => {},
    onCreateFile: () => {},
    onPaste: () => {},
  };

  it("renders offline state with device unavailable message", () => {
    render(<PaneStateView {...baseProps} loadState="offline" />);
    expect(screen.getByText("Device unavailable")).toBeTruthy();
  });

  it("shows path in offline state", () => {
    render(<PaneStateView {...baseProps} loadState="offline" />);
    expect(screen.getByText("/mnt/usb")).toBeTruthy();
  });

  it("shows retry and refresh actions in offline state", () => {
    render(<PaneStateView {...baseProps} loadState="offline" />);
    expect(screen.getByText("Retry")).toBeTruthy();
    expect(screen.getByText("Refresh")).toBeTruthy();
  });

  it("shows guidance about removing favorites in offline state", () => {
    render(<PaneStateView {...baseProps} loadState="offline" />);
    expect(
      screen.getByText(
        "The device may be disconnected or unmounted. Try reconnecting it.",
      ),
    ).toBeTruthy();
  });
});
