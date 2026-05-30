import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectServerDialog } from "../src/components/dialogs/ConnectServerDialog";
import type {
  NetworkConnectionDraftDto,
  NetworkProfileDto,
} from "@fileoctopus/ts-api";

function baseProps(
  overrides: Partial<{
    open: boolean;
    editingProfile: NetworkProfileDto | null;
    initialDraft: NetworkConnectionDraftDto | null;
    onClose: () => void;
    onSave: ReturnType<typeof vi.fn>;
  }> = {},
) {
  const onSave =
    overrides.onSave ?? vi.fn().mockResolvedValue({ id: "new-profile" });
  return {
    open: overrides.open ?? true,
    editingProfile: overrides.editingProfile ?? null,
    initialDraft: overrides.initialDraft ?? null,
    onClose: overrides.onClose ?? vi.fn(),
    onSave,
    onForgetFingerprint: undefined,
  };
}

function dialog() {
  return screen.getByRole("dialog");
}

function footer(): HTMLElement {
  const node = dialog().querySelector(".fo-dialog-footer");
  if (!(node instanceof HTMLElement)) {
    throw new Error("dialog footer not found");
  }
  return node;
}

function footerButton(name: string) {
  return within(footer()).getByRole("button", { name });
}

function nextButton() {
  return footerButton("Next");
}

describe("ConnectServerDialog", () => {
  afterEach(() => cleanup());

  it("renders nothing when closed", () => {
    const { container } = render(
      <ConnectServerDialog {...baseProps({ open: false })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("exposes WebDAV as a selectable scheme", () => {
    render(<ConnectServerDialog {...baseProps()} />);
    const select = within(dialog()).getByLabelText(
      "Protocol",
    ) as HTMLSelectElement;

    const options = Array.from(select.options).map((option) => option.value);

    expect(options).toContain("webdav");
  });

  it("switches to WebDAV defaults (port 443, password auth, default path /)", () => {
    render(<ConnectServerDialog {...baseProps()} />);
    const select = within(dialog()).getByLabelText(
      "Protocol",
    ) as HTMLSelectElement;

    fireEvent.change(select, { target: { value: "webdav" } });

    const portField = within(dialog()).getByLabelText(
      "Port",
    ) as HTMLInputElement;
    const defaultPathField = within(dialog()).getByLabelText(
      "Default path",
    ) as HTMLInputElement;

    expect(portField.value).toBe("443");
    expect(defaultPathField.value).toBe("/");

    // Advance to the Credentials step to inspect the auth fields.
    fireEvent.change(within(dialog()).getByLabelText("Label"), {
      target: { value: "Office" },
    });
    fireEvent.change(within(dialog()).getByLabelText("Host"), {
      target: { value: "files.example.com" },
    });
    fireEvent.click(nextButton());

    // The Authentication select is only rendered when there is more than one
    // valid auth kind. WebDAV only supports password auth, so the select must
    // not be in the DOM.
    expect(within(dialog()).queryByLabelText("Authentication")).toBeNull();
    // The password field should still be rendered (single auth kind is password).
    expect(within(dialog()).getByLabelText("Password")).toBeTruthy();
  });

  it("requires label and host before advancing past the Target step", () => {
    render(<ConnectServerDialog {...baseProps()} />);

    // Try to advance without filling anything.
    fireEvent.click(nextButton());

    expect(
      within(dialog()).getByText("Label and host are required."),
    ).toBeTruthy();
    // Still on Target step.
    expect(footerButton("Next")).toBeTruthy();
  });

  it("walks through the wizard from Target to Save and submits on the last step", async () => {
    const onSave = vi.fn().mockResolvedValue({ id: "new-profile" });
    render(<ConnectServerDialog {...baseProps({ onSave })} />);

    // Target step fields.
    fireEvent.change(within(dialog()).getByLabelText("Label"), {
      target: { value: "Prod" },
    });
    fireEvent.change(within(dialog()).getByLabelText("Host"), {
      target: { value: "prod.example.com" },
    });

    // Step 1 → 2 (Target → Credentials)
    fireEvent.click(footerButton("Next"));

    // Credentials step fields.
    fireEvent.change(within(dialog()).getByLabelText("Username"), {
      target: { value: "deploy" },
    });
    fireEvent.change(within(dialog()).getByLabelText("Password"), {
      target: { value: "hunter2" },
    });

    // Step 2 → 3 (Credentials → Test)
    fireEvent.click(footerButton("Next"));
    // Step 3 → 4 (Test → Save)
    fireEvent.click(footerButton("Test"));

    expect(
      within(dialog()).getByText("Connection details are ready to save."),
    ).toBeTruthy();

    // Final step shows "Save connection" instead of "Next".
    fireEvent.click(footerButton("Save connection"));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({
      scheme: "sftp",
      label: "Prod",
      host: "prod.example.com",
      username: "deploy",
      password: "hunter2",
      defaultPath: "/",
    });
  });

  it("supports going back to a previous wizard step", () => {
    render(<ConnectServerDialog {...baseProps()} />);

    fireEvent.change(within(dialog()).getByLabelText("Label"), {
      target: { value: "L" },
    });
    fireEvent.change(within(dialog()).getByLabelText("Host"), {
      target: { value: "h.example.com" },
    });
    fireEvent.click(footerButton("Next"));

    // On Credentials step now → Back button is rendered.
    fireEvent.click(footerButton("Back"));

    // Should be back on Target step where Back is hidden but Next is shown.
    expect(within(footer()).queryByRole("button", { name: "Back" })).toBeNull();
    expect(footerButton("Next")).toBeTruthy();
  });

  it("prefills label, host, scheme, and default path from initialDraft", () => {
    const initialDraft: NetworkConnectionDraftDto = {
      scheme: "webdav",
      host: "files.example.com",
      label: "Office WebDAV",
      defaultPath: "/remote.php/dav/files/me",
    };
    render(<ConnectServerDialog {...baseProps({ initialDraft })} />);

    const labelField = within(dialog()).getByLabelText(
      "Label",
    ) as HTMLInputElement;
    const hostField = within(dialog()).getByLabelText(
      "Host",
    ) as HTMLInputElement;
    const protocolField = within(dialog()).getByLabelText(
      "Protocol",
    ) as HTMLSelectElement;
    const defaultPathField = within(dialog()).getByLabelText(
      "Default path",
    ) as HTMLInputElement;

    expect(labelField.value).toBe("Office WebDAV");
    expect(hostField.value).toBe("files.example.com");
    expect(protocolField.value).toBe("webdav");
    expect(defaultPathField.value).toBe("/remote.php/dav/files/me");
  });

  it("ignores initialDraft when editingProfile is also present", () => {
    const profile: NetworkProfileDto = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      label: "Existing",
      scheme: "sftp",
      host: "existing.example.com",
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
    const initialDraft: NetworkConnectionDraftDto = {
      scheme: "webdav",
      host: "files.example.com",
      label: "From draft",
      defaultPath: "/draft",
    };

    render(
      <ConnectServerDialog
        {...baseProps({ editingProfile: profile, initialDraft })}
      />,
    );

    const labelField = within(dialog()).getByLabelText(
      "Label",
    ) as HTMLInputElement;
    const hostField = within(dialog()).getByLabelText(
      "Host",
    ) as HTMLInputElement;

    expect(labelField.value).toBe("Existing");
    expect(hostField.value).toBe("existing.example.com");
  });
});
