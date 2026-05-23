import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "../src/sidebar/Sidebar";

function renderSidebar(props: {
  recentToday?: { uri: string; label: string }[];
  recentWeek?: { uri: string; label: string }[];
}) {
  return render(
    <Sidebar
      locations={[]}
      networkProfiles={[]}
      networkStatuses={[]}
      favorites={[]}
      recentToday={props.recentToday ?? []}
      recentWeek={props.recentWeek ?? []}
      starred={[]}
      activeUri=""
      busyProfileIds={new Set()}
      onNavigate={vi.fn()}
      onAddFavorite={vi.fn()}
      onRemoveFavorite={vi.fn()}
      onRenameFavorite={vi.fn()}
      onRevealFavorite={vi.fn()}
      onAddServer={vi.fn()}
      onConnectProfile={vi.fn()}
      onDisconnectProfile={vi.fn()}
      onEditProfile={vi.fn()}
      onDeleteProfile={vi.fn()}
      onOpenProfileTerminal={vi.fn()}
    />,
  );
}

describe("Sidebar recent groups", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders Today entries under a Today heading", () => {
    renderSidebar({
      recentToday: [
        {
          uri: "local:///home/docs",
          label: "docs",
          visitedAt: "2026-05-23T10:00:00Z",
        },
      ],
    });
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("docs")).toBeTruthy();
  });

  it("renders This Week entries under a This Week heading", () => {
    renderSidebar({
      recentWeek: [
        {
          uri: "local:///home/projects",
          label: "projects",
          visitedAt: "2026-05-22T10:00:00Z",
        },
      ],
    });
    expect(screen.getByText("This Week")).toBeTruthy();
    expect(screen.getByText("projects")).toBeTruthy();
  });

  it("renders both Today and This Week when both have entries", () => {
    renderSidebar({
      recentToday: [
        {
          uri: "local:///home/docs",
          label: "docs",
          visitedAt: "2026-05-23T10:00:00Z",
        },
      ],
      recentWeek: [
        {
          uri: "local:///home/projects",
          label: "projects",
          visitedAt: "2026-05-22T10:00:00Z",
        },
      ],
    });
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("This Week")).toBeTruthy();
    expect(screen.getByText("docs")).toBeTruthy();
    expect(screen.getByText("projects")).toBeTruthy();
  });

  it("does not render This Week section when empty", () => {
    renderSidebar({
      recentToday: [
        {
          uri: "local:///home/docs",
          label: "docs",
          visitedAt: "2026-05-23T10:00:00Z",
        },
      ],
    });
    expect(screen.queryByText("This Week")).toBeNull();
  });

  it("renders empty hint for Today when both groups are empty", () => {
    renderSidebar({});
    expect(screen.getByText("No recent folders")).toBeTruthy();
  });
});
