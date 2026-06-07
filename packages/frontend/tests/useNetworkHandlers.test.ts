import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { useNetworkHandlers } from "../src/hooks/useNetworkHandlers";
import type { FileOctopusClient } from "@fileoctopus/ts-api";

afterEach(cleanup);

function createMockClient() {
  return {
    network: {
      connect: vi
        .fn<() => Promise<{ ok: boolean }>>()
        .mockResolvedValue({ ok: true }),
      disconnect: vi
        .fn<() => Promise<{ ok: boolean }>>()
        .mockResolvedValue({ ok: true }),
      deleteProfile: vi
        .fn<() => Promise<{ ok: boolean }>>()
        .mockResolvedValue({ ok: true }),
      forgetFingerprint: vi
        .fn<() => Promise<{ ok: boolean }>>()
        .mockResolvedValue({ ok: true }),
      addProfile: vi
        .fn<() => Promise<{ profile: { id: string } }>>()
        .mockResolvedValue({
          profile: { id: "new-profile-1" },
        }),
      updateProfile: vi
        .fn<() => Promise<{ profile: { id: string } }>>()
        .mockResolvedValue({
          profile: { id: "existing-1" },
        }),
      setSecret: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      listProfiles: vi.fn(),
      connectionStatus: vi.fn(),
    },
    fs: {},
  } as unknown as FileOctopusClient;
}

describe("useNetworkHandlers", () => {
  let client: FileOctopusClient;
  let refreshNetworkProfiles: ReturnType<typeof vi.fn>;
  let setOperationError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = createMockClient();
    refreshNetworkProfiles = vi.fn().mockResolvedValue(undefined);
    setOperationError = vi.fn();
  });

  it("connectProfile calls client.network.connect and refreshes profiles", async () => {
    const { result } = renderHook(() =>
      useNetworkHandlers({ client, refreshNetworkProfiles, setOperationError }),
    );

    await act(async () => {
      await result.current.connectProfile("profile-1");
    });

    expect(client.network.connect).toHaveBeenCalledWith({ id: "profile-1" });
    expect(refreshNetworkProfiles).toHaveBeenCalled();
    expect(setOperationError).toHaveBeenCalledWith(null);
  });

  it("connectProfile sets error on failure", async () => {
    (client.network.connect as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Connection refused"),
    );

    const { result } = renderHook(() =>
      useNetworkHandlers({ client, refreshNetworkProfiles, setOperationError }),
    );

    await act(async () => {
      try {
        await result.current.connectProfile("profile-1");
      } catch {
        // expected
      }
    });

    expect(setOperationError).toHaveBeenCalledWith(null);
    expect(setOperationError).toHaveBeenCalledWith("Connection refused");
  });

  it("disconnectProfile calls client.network.disconnect and refreshes profiles", async () => {
    const { result } = renderHook(() =>
      useNetworkHandlers({ client, refreshNetworkProfiles, setOperationError }),
    );

    await act(async () => {
      await result.current.disconnectProfile("profile-1");
    });

    expect(client.network.disconnect).toHaveBeenCalledWith({ id: "profile-1" });
    expect(refreshNetworkProfiles).toHaveBeenCalled();
  });

  it("deleteProfile calls client.network.deleteProfile and refreshes", async () => {
    const { result } = renderHook(() =>
      useNetworkHandlers({ client, refreshNetworkProfiles, setOperationError }),
    );

    await act(async () => {
      await result.current.deleteProfile("profile-1");
    });

    expect(client.network.deleteProfile).toHaveBeenCalledWith({
      id: "profile-1",
    });
    expect(refreshNetworkProfiles).toHaveBeenCalled();
  });

  it("forgetFingerprint calls client.network.forgetFingerprint and refreshes", async () => {
    const { result } = renderHook(() =>
      useNetworkHandlers({ client, refreshNetworkProfiles, setOperationError }),
    );

    await act(async () => {
      await result.current.forgetFingerprint("profile-1");
    });

    expect(client.network.forgetFingerprint).toHaveBeenCalledWith({
      id: "profile-1",
    });
    expect(refreshNetworkProfiles).toHaveBeenCalled();
  });

  it("saveProfile creates new profile when no id provided", async () => {
    const { result } = renderHook(() =>
      useNetworkHandlers({ client, refreshNetworkProfiles, setOperationError }),
    );

    let profile: { id: string } | undefined;
    await act(async () => {
      profile = await result.current.saveProfile({
        scheme: "sftp",
        label: "Test Server",
        host: "example.com",
        port: 22,
        username: "user",
        authKind: "password",
        privateKeyPath: null,
        defaultPath: "/home/user",
        password: "secret123",
        passphrase: "",
      });
    });

    expect(client.network.addProfile).toHaveBeenCalled();
    expect(client.network.setSecret).toHaveBeenCalledWith({
      id: "new-profile-1",
      secretKind: "password",
      value: "secret123",
    });
    expect(client.network.connect).not.toHaveBeenCalled();
    expect(profile).toEqual({ id: "new-profile-1" });
    expect(refreshNetworkProfiles).toHaveBeenCalled();
  });

  it("saveProfile updates existing profile when id is provided", async () => {
    const { result } = renderHook(() =>
      useNetworkHandlers({ client, refreshNetworkProfiles, setOperationError }),
    );

    await act(async () => {
      await result.current.saveProfile({
        id: "existing-1",
        scheme: "smb",
        label: "Updated",
        host: "smb.local",
        port: 445,
        username: "admin",
        authKind: "password",
        privateKeyPath: null,
        defaultPath: "/share",
        password: "",
        passphrase: "",
      });
    });

    expect(client.network.updateProfile).toHaveBeenCalled();
    expect(client.network.addProfile).not.toHaveBeenCalled();
    expect(client.network.setSecret).not.toHaveBeenCalled();
  });

  it("saveProfile sets error on failure", async () => {
    (client.network.addProfile as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Profile limit reached"),
    );

    const { result } = renderHook(() =>
      useNetworkHandlers({ client, refreshNetworkProfiles, setOperationError }),
    );

    await act(async () => {
      try {
        await result.current.saveProfile({
          scheme: "s3",
          label: "S3 Bucket",
          host: "s3.amazonaws.com",
          port: 443,
          username: "key",
          authKind: "accessKey",
          privateKeyPath: null,
          defaultPath: "/bucket",
          password: "secret",
          passphrase: "",
        });
      } catch {
        // expected
      }
    });

    expect(setOperationError).toHaveBeenCalledWith(null);
    expect(setOperationError).toHaveBeenCalledWith("Profile limit reached");
  });
});
