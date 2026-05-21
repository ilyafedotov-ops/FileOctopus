import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NetworkProfileDto } from "@fileoctopus/ts-api";
import { NetworkLocationsDialog } from "../src/components/dialogs/NetworkLocationsDialog";

const sshProfile: NetworkProfileDto = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  label: "Prod Shell",
  scheme: "ssh",
  host: "prod.example.com",
  port: 22,
  username: "deploy",
  authKind: "password",
  privateKeyPath: null,
  defaultPath: "",
  defaultUri: "",
  hostKeyFingerprint: null,
  sortOrder: 0,
  lastConnectedAt: null,
  lastError: null,
  hasStoredSecret: true,
  createdAt: "2026-05-19T00:00:00Z",
  updatedAt: "2026-05-19T00:00:00Z",
};

describe("NetworkLocationsDialog SSH profiles", () => {
  afterEach(() => cleanup());

  it("offers terminal launch instead of file navigation for ssh-only profiles", () => {
    const onOpenTerminal = vi.fn();
    const onNavigate = vi.fn();
    render(
      <NetworkLocationsDialog
        open
        profiles={[sshProfile]}
        statuses={[]}
        onClose={vi.fn()}
        onNavigate={onNavigate}
        onConnect={vi.fn()}
        onDisconnect={vi.fn()}
        onAddServer={vi.fn()}
        onEditServer={vi.fn()}
        onDeleteServer={vi.fn()}
        onOpenTerminal={onOpenTerminal}
      />,
    );

    screen.getByText("Open Terminal").click();

    expect(onOpenTerminal).toHaveBeenCalledWith(sshProfile);
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
