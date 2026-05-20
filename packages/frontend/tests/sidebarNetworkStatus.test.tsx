import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "../src/sidebar/Sidebar";
import type {
  NetworkConnectionStatusDto,
  NetworkProfileDto,
} from "@fileoctopus/ts-api";

const baseProfile: NetworkProfileDto = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  label: "Prod",
  scheme: "sftp",
  host: "prod.example.com",
  port: 22,
  username: "deploy",
  authKind: "password",
  privateKeyPath: null,
  defaultPath: "/",
  defaultUri: "sftp://550e8400-e29b-41d4-a716-446655440000/",
  hostKeyFingerprint: null,
  sortOrder: 0,
  lastConnectedAt: null,
  lastError: null,
  hasStoredSecret: false,
  createdAt: "2026-05-19T00:00:00Z",
  updatedAt: "2026-05-19T00:00:00Z",
};

function renderSidebar(
  profile: NetworkProfileDto,
  statuses: NetworkConnectionStatusDto[] = [],
  busyProfileIds: Set<string> = new Set(),
) {
  return render(
    <Sidebar
      locations={[]}
      networkProfiles={[profile]}
      networkStatuses={statuses}
      networkEnabled
      favorites={[]}
      recentToday={[]}
      recentWeek={[]}
      starred={[]}
      activeUri=""
      busyProfileIds={busyProfileIds}
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
    />,
  );
}

describe("Sidebar network section", () => {
  afterEach(() => {
    cleanup();
  });

  it("marks profiles without stored credentials", () => {
    renderSidebar(baseProfile);
    expect(screen.getAllByTitle("Prod (credentials missing)")).toHaveLength(2);
  });

  it("reflects connected status in title", () => {
    renderSidebar({ ...baseProfile, hasStoredSecret: true }, [
      {
        profileId: baseProfile.id,
        status: "connected",
        message: null,
      },
    ]);
    expect(screen.getAllByTitle("Prod (connected)")).toHaveLength(2);
  });

  it("reflects error status in title", () => {
    renderSidebar({ ...baseProfile, hasStoredSecret: true }, [
      {
        profileId: baseProfile.id,
        status: "error",
        message: "TCP timeout",
      },
    ]);
    expect(screen.getAllByTitle("Prod (TCP timeout)")).toHaveLength(2);
  });

  it("sets aria-busy while a connect is in flight", () => {
    const profile = { ...baseProfile, hasStoredSecret: true };
    renderSidebar(profile, [], new Set([profile.id]));
    const busyItems = screen
      .getAllByTitle("Prod")
      .filter((item) => item.getAttribute("aria-busy") === "true");
    expect(busyItems).toHaveLength(2);
  });

  it("shows network profiles under Devices / Volumes", () => {
    renderSidebar(baseProfile);
    expect(screen.getByText("Network drives")).toBeTruthy();
    expect(screen.getAllByTitle("Prod (credentials missing)")).toHaveLength(2);
  });

  it("highlights network profile when browsing inside its tree", () => {
    const nestedUri = "sftp://550e8400-e29b-41d4-a716-446655440000/var/log";
    render(
      <Sidebar
        locations={[]}
        networkProfiles={[baseProfile]}
        networkStatuses={[]}
        networkEnabled
        favorites={[]}
        recentToday={[]}
        recentWeek={[]}
        starred={[]}
        activeUri={nestedUri}
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
      />,
    );

    const activeItems = screen
      .getAllByTitle("Prod (credentials missing)")
      .filter((item) => item.classList.contains("fo-sidebar-active"));
    expect(activeItems).toHaveLength(2);
  });
});
