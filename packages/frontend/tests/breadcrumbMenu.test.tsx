import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock @fileoctopus/ui — provide a real-ish Button
vi.mock("@fileoctopus/ui", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...rest
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    [k: string]: unknown;
  }) => (
    <button disabled={disabled} onClick={onClick} {...rest}>
      {children}
    </button>
  ),
}));

import { buildBreadcrumbMenu } from "../src/menus/context/buildBreadcrumbMenu";

// ── helpers ──────────────────────────────────────────────────────────────

function makeMenuProps(overrides: Record<string, unknown> = {}) {
  return {
    panelId: "left" as const,
    breadcrumbPath: "local:///home/user/projects",
    run: (action: () => void) => action(),
    onNavigateTo: vi.fn(),
    onNavigateOtherPane: vi.fn(),
    onCopyBreadcrumbPath: vi.fn(),
    onRevealBreadcrumb: vi.fn(),
    onAddFavorite: vi.fn(),
    ...overrides,
  };
}

afterEach(cleanup);

// ── tests ────────────────────────────────────────────────────────────────

describe("buildBreadcrumbMenu", () => {
  it("renders all expected menu items", () => {
    const props = makeMenuProps();
    render(<>{buildBreadcrumbMenu(props)}</>);
    expect(screen.getByText("Open This Location")).toBeTruthy();
    expect(screen.getByText("Open in Other Pane")).toBeTruthy();
    expect(screen.getByText("Copy Path")).toBeTruthy();
    expect(screen.getByText("Reveal in File Manager")).toBeTruthy();
    expect(screen.getByText("Add to Favorites")).toBeTruthy();
  });

  it("calls onNavigateTo with panelId and breadcrumbPath on click", () => {
    const onNavigateTo = vi.fn();
    const props = makeMenuProps({ onNavigateTo });
    render(<>{buildBreadcrumbMenu(props)}</>);
    fireEvent.click(screen.getByText("Open This Location"));
    expect(onNavigateTo).toHaveBeenCalledWith(
      "left",
      "local:///home/user/projects",
    );
  });

  it("calls onNavigateOtherPane with breadcrumbPath on click", () => {
    const onNavigateOtherPane = vi.fn();
    const props = makeMenuProps({ onNavigateOtherPane });
    render(<>{buildBreadcrumbMenu(props)}</>);
    fireEvent.click(screen.getByText("Open in Other Pane"));
    expect(onNavigateOtherPane).toHaveBeenCalledWith(
      "local:///home/user/projects",
    );
  });

  it("calls onCopyBreadcrumbPath with breadcrumbPath on click", () => {
    const onCopyBreadcrumbPath = vi.fn();
    const props = makeMenuProps({ onCopyBreadcrumbPath });
    render(<>{buildBreadcrumbMenu(props)}</>);
    fireEvent.click(screen.getByText("Copy Path"));
    expect(onCopyBreadcrumbPath).toHaveBeenCalledWith(
      "local:///home/user/projects",
    );
  });

  it("calls onRevealBreadcrumb with breadcrumbPath on click", () => {
    const onRevealBreadcrumb = vi.fn();
    const props = makeMenuProps({ onRevealBreadcrumb });
    render(<>{buildBreadcrumbMenu(props)}</>);
    fireEvent.click(screen.getByText("Reveal in File Manager"));
    expect(onRevealBreadcrumb).toHaveBeenCalledWith(
      "local:///home/user/projects",
    );
  });

  it("calls onAddFavorite with breadcrumbPath on click", () => {
    const onAddFavorite = vi.fn();
    const props = makeMenuProps({ onAddFavorite });
    render(<>{buildBreadcrumbMenu(props)}</>);
    fireEvent.click(screen.getByText("Add to Favorites"));
    expect(onAddFavorite).toHaveBeenCalledWith("local:///home/user/projects");
  });

  it("uses run wrapper for all actions", () => {
    const run = vi.fn((action: () => void) => action());
    const onNavigateTo = vi.fn();
    const props = makeMenuProps({ run, onNavigateTo });
    render(<>{buildBreadcrumbMenu(props)}</>);
    fireEvent.click(screen.getByText("Open This Location"));
    expect(run).toHaveBeenCalled();
    expect(onNavigateTo).toHaveBeenCalled();
  });

  it("passes different breadcrumb paths correctly", () => {
    const onNavigateTo = vi.fn();
    const props = makeMenuProps({
      breadcrumbPath: "sftp://server/var/log",
      onNavigateTo,
    });
    render(<>{buildBreadcrumbMenu(props)}</>);
    fireEvent.click(screen.getByText("Open This Location"));
    expect(onNavigateTo).toHaveBeenCalledWith("left", "sftp://server/var/log");
  });

  it("renders separator elements between groups", () => {
    const props = makeMenuProps();
    const { container } = render(<>{buildBreadcrumbMenu(props)}</>);
    const separators = container.querySelectorAll('[role="separator"]');
    expect(separators.length).toBeGreaterThanOrEqual(2);
  });

  it("uses the correct panelId for navigation", () => {
    const onNavigateTo = vi.fn();
    const props = makeMenuProps({ panelId: "right", onNavigateTo });
    render(<>{buildBreadcrumbMenu(props)}</>);
    fireEvent.click(screen.getByText("Open This Location"));
    expect(onNavigateTo).toHaveBeenCalledWith(
      "right",
      "local:///home/user/projects",
    );
  });
});
