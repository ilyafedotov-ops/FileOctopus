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
    const item = screen.getByTitle("Prod (credentials missing)");
    expect(item).toBeTruthy();
  });

  it("reflects connected status in title", () => {
    renderSidebar({ ...baseProfile, hasStoredSecret: true }, [
      {
        profileId: baseProfile.id,
        status: "connected",
        message: null,
      },
    ]);
    const item = screen.getByTitle("Prod (connected)");
    expect(item).toBeTruthy();
  });

  it("reflects error status in title", () => {
    renderSidebar({ ...baseProfile, hasStoredSecret: true }, [
      {
        profileId: baseProfile.id,
        status: "error",
        message: "TCP timeout",
      },
    ]);
    const item = screen.getByTitle("Prod (TCP timeout)");
    expect(item).toBeTruthy();
  });

  it("sets aria-busy while a connect is in flight", () => {
    const profile = { ...baseProfile, hasStoredSecret: true };
    renderSidebar(profile, [], new Set([profile.id]));
    const item = screen.getByTitle("Prod");
    expect(item.getAttribute("aria-busy")).toBe("true");
  });
});
