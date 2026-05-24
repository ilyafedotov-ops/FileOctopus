import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "../src/sidebar/Sidebar";

function renderSidebarWithVideos() {
  return render(
    <Sidebar
      locations={[
        {
          id: "videos",
          name: "Videos",
          uri: "local:///home/user/Videos",
          section: "User folders",
        },
      ]}
      networkProfiles={[]}
      networkStatuses={[]}
      favorites={[]}
      recentToday={[]}
      recentWeek={[]}
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

describe("Sidebar videos location", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the Videos label when a videos location is provided", () => {
    renderSidebarWithVideos();
    expect(screen.getByText("Videos")).toBeTruthy();
  });
});
