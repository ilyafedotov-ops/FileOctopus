import {
  cleanup,
  render,
  screen,
  fireEvent,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RemoveServerDialog } from "../src/components/dialogs/RemoveServerDialog";
import type { NetworkProfileDto } from "@fileoctopus/ts-api";

const profile: NetworkProfileDto = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  label: "Production",
  scheme: "sftp",
  host: "prod.example.com",
  port: 22,
  username: "deploy",
  authKind: "password",
  privateKeyPath: null,
  defaultPath: "/var/www",
  defaultUri: "sftp://550e8400-e29b-41d4-a716-446655440000/var/www",
  hostKeyFingerprint: null,
  sortOrder: 0,
  lastConnectedAt: null,
  lastError: null,
  hasStoredSecret: true,
  createdAt: "2026-05-19T00:00:00Z",
  updatedAt: "2026-05-19T00:00:00Z",
};

describe("RemoveServerDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <RemoveServerDialog
        open={false}
        profile={profile}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows profile identity and confirm/cancel buttons", () => {
    render(
      <RemoveServerDialog
        open
        profile={profile}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText("Production")).toBeTruthy();
    expect(screen.getByText("deploy@prod.example.com:22")).toBeTruthy();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(
      within(dialog).getByRole("button", { name: "Remove Server" }),
    ).toBeTruthy();
  });

  it("invokes onConfirm and onClose when confirm is clicked", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <RemoveServerDialog
        open
        profile={profile}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Remove Server" }),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes onClose but not onConfirm when cancel is clicked", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <RemoveServerDialog
        open
        profile={profile}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
