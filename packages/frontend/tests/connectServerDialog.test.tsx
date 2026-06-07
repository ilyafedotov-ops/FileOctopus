import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectServerDialog } from "../src/components/dialogs/ConnectServerDialog";
import type {
  FsClient,
  NetworkProviderCapabilityDto,
  NetworkProfileDto,
  StandardLocationDto,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";

const homeLocation = {
  id: "home",
  name: "Home",
  uri: "local:///Users/ilya",
  section: "Favorites",
} satisfies StandardLocationDto;

const defaultPreferences = {
  networkSshKeyPath: "",
  networkUseSshAgent: false,
} as UserPreferencesDto;

const providerCapabilities: NetworkProviderCapabilityDto[] = [
  {
    scheme: "sftp",
    label: "SFTP",
    category: "server",
    defaultPort: 22,
    authKinds: ["password", "privateKey"],
    fileCapable: true,
    terminalCapable: true,
    status: "available",
    missingDependency: null,
    supportedOptions: ["useAgent", "proxyJump"],
  },
  {
    scheme: "ssh",
    label: "SSH",
    category: "server",
    defaultPort: 22,
    authKinds: ["password", "privateKey"],
    fileCapable: false,
    terminalCapable: true,
    status: "available",
    missingDependency: null,
    supportedOptions: ["useAgent", "terminalInitialCommand"],
  },
  {
    scheme: "smb",
    label: "SMB / CIFS",
    category: "server",
    defaultPort: 445,
    authKinds: ["password"],
    fileCapable: true,
    terminalCapable: false,
    status: "available",
    missingDependency: null,
    supportedOptions: ["workgroup", "signingMode"],
  },
  {
    scheme: "s3",
    label: "S3",
    category: "server",
    defaultPort: 443,
    authKinds: ["accessKey"],
    fileCapable: true,
    terminalCapable: false,
    status: "available",
    missingDependency: null,
    supportedOptions: ["region", "pathStyle"],
  },
  {
    scheme: "webdav",
    label: "WebDAV",
    category: "server",
    defaultPort: 443,
    authKinds: ["password"],
    fileCapable: false,
    terminalCapable: false,
    status: "unavailable",
    missingDependency: "WebDAV provider is not registered yet.",
    supportedOptions: [],
  },
];

function existingProfile(
  overrides: Partial<NetworkProfileDto> = {},
): NetworkProfileDto {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    label: "Preview SFTP",
    scheme: "sftp",
    host: "preview.example.com",
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
    options: {},
    createdAt: "2026-05-19T00:00:00Z",
    updatedAt: "2026-05-19T00:00:00Z",
    ...overrides,
  };
}

function baseProps(
  overrides: Partial<ComponentProps<typeof ConnectServerDialog>> = {},
) {
  const onSave =
    overrides.onSave ?? vi.fn().mockResolvedValue(existingProfile());
  return {
    open: overrides.open ?? true,
    editingProfile: overrides.editingProfile ?? null,
    initialDraft: overrides.initialDraft ?? null,
    networkProfiles: overrides.networkProfiles ?? [existingProfile()],
    providerCapabilities:
      overrides.providerCapabilities ?? providerCapabilities,
    onClose: overrides.onClose ?? vi.fn(),
    onSave,
    onConnectProfile: overrides.onConnectProfile ?? vi.fn(),
    onForgetFingerprint: undefined,
    preferences: defaultPreferences,
    locations: [homeLocation],
    ...overrides,
  };
}

function dialog() {
  return screen.getByRole("dialog", { name: /connections/i });
}

function footerButton(name: string) {
  return within(dialog()).getByRole("button", { name });
}

function selectTab(name: string) {
  fireEvent.click(within(dialog()).getByRole("tab", { name }));
}

describe("ConnectServerDialog", () => {
  afterEach(() => cleanup());

  it("renders nothing when closed", () => {
    const { container } = render(
      <ConnectServerDialog {...baseProps({ open: false })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a two-pane connection manager with saved profiles", () => {
    render(<ConnectServerDialog {...baseProps()} />);

    expect(
      within(dialog()).getByRole("button", { name: "New Connection" }),
    ).toBeTruthy();
    expect(within(dialog()).getByText("Preview SFTP")).toBeTruthy();
    expect(within(dialog()).getByRole("tab", { name: "General" })).toBeTruthy();
    expect(within(dialog()).getByRole("tab", { name: "SSH" })).toBeTruthy();
    expect(
      within(dialog()).getByRole("tab", { name: "Test & Trust" }),
    ).toBeTruthy();
  });

  it("switches saved profiles and hydrates the editor", () => {
    const smb = existingProfile({
      id: "smb-profile",
      label: "Office SMB",
      scheme: "smb",
      host: "files.example.com",
      port: 445,
      username: "domain-user",
      defaultPath: "/share",
      defaultUri: "smb://smb-profile/share",
      options: {
        smb: {
          workgroup: "WORKGROUP",
          signingMode: "required",
        },
      },
    });
    render(
      <ConnectServerDialog
        {...baseProps({ networkProfiles: [existingProfile(), smb] })}
      />,
    );

    fireEvent.click(
      within(dialog()).getByRole("button", { name: /Office SMB/ }),
    );

    expect(
      (within(dialog()).getByLabelText("Profile name") as HTMLInputElement)
        .value,
    ).toBe("Office SMB");
    expect(
      (within(dialog()).getByLabelText("Host") as HTMLInputElement).value,
    ).toBe("files.example.com");
    expect(within(dialog()).queryByRole("tab", { name: "SSH" })).toBeNull();
    expect(within(dialog()).getByRole("tab", { name: "SMB" })).toBeTruthy();
  });

  it("shows unavailable WebDAV from provider capabilities without allowing selection", () => {
    render(<ConnectServerDialog {...baseProps()} />);

    const option = Array.from(
      (within(dialog()).getByLabelText("Protocol") as HTMLSelectElement)
        .options,
    ).find((item) => item.value === "webdav");

    expect(option?.disabled).toBe(true);
    expect(option?.textContent).toContain("unavailable");
    expect(
      within(dialog()).getByText("WebDAV provider is not registered yet."),
    ).toBeTruthy();
  });

  it("detects common SSH keys and keeps the preferred key selected", async () => {
    const fs = {
      stat: vi.fn(async ({ uri }: { uri: string }) => {
        if (uri.endsWith("/id_ed25519")) {
          return { entry: { kind: "file" } };
        }
        throw new Error("not found");
      }),
    } as unknown as FsClient;

    render(
      <ConnectServerDialog
        {...baseProps({
          preferences: {
            ...defaultPreferences,
            networkSshKeyPath: "/Users/ilya/.ssh/id_rsa",
          },
          fs,
        })}
      />,
    );

    selectTab("SSH");
    fireEvent.click(
      within(dialog()).getByRole("button", { name: "Private key" }),
    );

    await vi.waitFor(() => {
      expect(
        within(dialog()).getByRole("button", {
          name: "/Users/ilya/.ssh/id_ed25519",
        }),
      ).toBeTruthy();
    });
    expect(
      (within(dialog()).getByLabelText("Private key path") as HTMLInputElement)
        .value,
    ).toBe("/Users/ilya/.ssh/id_rsa");
  });

  it("uses unrestricted browse fallback for private keys", async () => {
    const pickLocalPath = vi
      .fn()
      .mockResolvedValue("/Users/ilya/.ssh/custom_key");
    render(<ConnectServerDialog {...baseProps({ pickLocalPath })} />);

    selectTab("SSH");
    fireEvent.click(
      within(dialog()).getByRole("button", { name: "Private key" }),
    );
    fireEvent.click(
      within(dialog()).getByRole("button", { name: "Browse private key path" }),
    );

    await vi.waitFor(() => {
      expect(
        (
          within(dialog()).getByLabelText(
            "Private key path",
          ) as HTMLInputElement
        ).value,
      ).toBe("/Users/ilya/.ssh/custom_key");
    });
    expect(pickLocalPath).toHaveBeenCalledWith({
      kind: "file",
      currentPath: "",
      title: "Choose private key",
    });
  });

  it("runs a draft connection test before saving", async () => {
    const onTestDraft = vi.fn().mockResolvedValue({
      ok: true,
      status: "success",
      message: "Profile details are valid.",
      durationMs: 12,
      resolvedUri: "sftp://draft/",
      observedFingerprint: "SHA256:test",
      trustState: "untrusted",
      warnings: ["Draft tests do not persist secrets."],
    });
    render(
      <ConnectServerDialog
        {...baseProps({
          networkProfiles: [],
          onTestDraft,
        })}
      />,
    );

    fireEvent.change(within(dialog()).getByLabelText("Profile name"), {
      target: { value: "Prod" },
    });
    fireEvent.change(within(dialog()).getByLabelText("Host"), {
      target: { value: "prod.example.com" },
    });
    fireEvent.change(within(dialog()).getByLabelText("Username"), {
      target: { value: "deploy" },
    });
    fireEvent.change(within(dialog()).getByLabelText("Password"), {
      target: { value: "hunter2" },
    });
    fireEvent.click(footerButton("Test"));

    await vi.waitFor(() => {
      expect(onTestDraft).toHaveBeenCalledTimes(1);
    });
    expect(onTestDraft.mock.calls[0][0]).toMatchObject({
      scheme: "sftp",
      label: "Prod",
      host: "prod.example.com",
      username: "deploy",
      password: "hunter2",
    });
    selectTab("Test & Trust");
    expect(
      within(dialog()).getByText("Profile details are valid."),
    ).toBeTruthy();
    expect(within(dialog()).getByText("SHA256:test")).toBeTruthy();
    expect(
      within(dialog()).getByText("Draft tests do not persist secrets."),
    ).toBeTruthy();
  });

  it("runs a saved connection test", async () => {
    const onTest = vi.fn().mockResolvedValue({
      ok: true,
      message: "Connection test succeeded.",
    });
    render(<ConnectServerDialog {...baseProps({ onTest })} />);

    fireEvent.click(
      within(dialog()).getByRole("button", { name: /Preview SFTP/ }),
    );
    fireEvent.click(footerButton("Test"));

    await vi.waitFor(() => {
      expect(onTest).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
      );
    });
    selectTab("Test & Trust");
    expect(
      within(dialog()).getByText("Connection test succeeded."),
    ).toBeTruthy();
  });

  it("saves the current profile without connecting", async () => {
    const onSave = vi.fn().mockResolvedValue(existingProfile());
    const onConnectProfile = vi.fn();
    render(
      <ConnectServerDialog
        {...baseProps({
          networkProfiles: [],
          onSave,
          onConnectProfile,
        })}
      />,
    );

    fireEvent.change(within(dialog()).getByLabelText("Profile name"), {
      target: { value: "Prod" },
    });
    fireEvent.change(within(dialog()).getByLabelText("Host"), {
      target: { value: "prod.example.com" },
    });
    fireEvent.change(within(dialog()).getByLabelText("Username"), {
      target: { value: "deploy" },
    });
    fireEvent.change(within(dialog()).getByLabelText("Password"), {
      target: { value: "hunter2" },
    });
    selectTab("SSH");
    fireEvent.click(within(dialog()).getByLabelText("Use SSH agent"));
    fireEvent.change(within(dialog()).getByLabelText("ProxyJump"), {
      target: { value: "bastion.example.com" },
    });
    fireEvent.click(footerButton("Save"));

    await vi.waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    expect(onSave.mock.calls[0][0]).toMatchObject({
      scheme: "sftp",
      label: "Prod",
      host: "prod.example.com",
      username: "deploy",
      password: "hunter2",
      options: {
        ssh: {
          useAgent: true,
          proxyJump: "bastion.example.com",
        },
      },
    });
    expect(onConnectProfile).not.toHaveBeenCalled();
  });

  it("enables Connect only for saved profiles", () => {
    const onConnectProfile = vi.fn();
    const profile = existingProfile();
    render(
      <ConnectServerDialog
        {...baseProps({
          networkProfiles: [profile],
          onConnectProfile,
        })}
      />,
    );

    fireEvent.click(
      within(dialog()).getByRole("button", { name: "New Connection" }),
    );
    expect((footerButton("Connect") as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(
      within(dialog()).getByRole("button", { name: /Preview SFTP/ }),
    );
    fireEvent.click(footerButton("Connect"));

    expect(onConnectProfile).toHaveBeenCalledWith(profile);
  });
});
