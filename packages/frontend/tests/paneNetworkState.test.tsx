import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IPC_ERROR_CODES } from "@fileoctopus/ts-api";
import { PaneStateView } from "../src/components/PaneStateView";

afterEach(cleanup);

describe("PaneStateView network errors", () => {
  const baseProps = {
    uri: "sftp://550e8400-e29b-41d4-a716-446655440000/home",
    message: "Login failed",
    loadState: "error" as const,
    onRetry: vi.fn(),
    onRefresh: vi.fn(),
    onCreateFolder: vi.fn(),
  };

  it("shows authentication guidance and edit credentials action", () => {
    render(
      <PaneStateView
        {...baseProps}
        errorCode={IPC_ERROR_CODES.AUTHENTICATION_FAILED}
        onEditCredentials={vi.fn()}
      />,
    );

    expect(screen.getByText("Authentication failed")).toBeTruthy();
    expect(
      screen.getByText(
        "Check the username, password, or private key for this server.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Edit credentials")).toBeTruthy();
    expect(screen.getByText("Reconnect")).toBeTruthy();
  });

  it("shows remote path label for sftp URIs", () => {
    render(
      <PaneStateView
        {...baseProps}
        errorCode={IPC_ERROR_CODES.CONNECTION_LOST}
      />,
    );

    expect(screen.getByText("/home")).toBeTruthy();
    expect(screen.getByText("Connection lost")).toBeTruthy();
  });

  it("hides creation actions for remote empty folders", () => {
    render(
      <PaneStateView {...baseProps} loadState="empty" allowCreation={false} />,
    );

    expect(screen.queryByText("New Folder")).toBeNull();
    expect(screen.getByText("Refresh")).toBeTruthy();
  });
});
