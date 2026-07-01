import { describe, expect, it } from "vitest";
import { createPreviewTransport } from "../src/transports/preview";
import type {
  AppDataHealthResponse,
  NetworkNeighborhoodResponse,
  NetworkProfileTestResponse,
  NetworkProvidersListResponse,
  StandardLocationsResponse,
} from "../src/types";

describe("preview transport — platform-safe fixtures", () => {
  const transport = createPreviewTransport();

  it("does not expose developer-specific local paths in diagnostics or standard locations", async () => {
    const health = await transport.invoke<AppDataHealthResponse>(
      "diagnostics.appDataHealth",
    );
    const locations = await transport.invoke<StandardLocationsResponse>(
      "fs.standard_locations",
    );

    const serialized = JSON.stringify({ health, locations });
    expect(serialized).not.toContain("/Users/ilya");
    expect(serialized).not.toContain("/Users/you");
    expect(serialized).not.toContain("/tmp/fileoctopus-diagnostics.zip");
    expect(health.databasePath).toContain("fileoctopus");
    expect(locations.locations[0].uri).toMatch(/^local:\/\//);
  });
});

describe("preview transport — network.discoverNeighborhood", () => {
  const transport = createPreviewTransport();

  it("returns the four root groups for network:///", async () => {
    const response = await transport.invoke<NetworkNeighborhoodResponse>(
      "network.discoverNeighborhood",
      { request: { uri: "network:///" } },
    );

    expect(response.uri).toBe("network:///");
    expect(response.entries.map((entry) => entry.uri)).toEqual([
      "network:///cloud",
      "network:///lan",
      "network:///saved",
      "network:///add",
    ]);
    // The first three are listable groups (kind directory); the last is an action.
    expect(response.entries[0].virtualKind).toBe("group");
    expect(response.entries[3].virtualKind).toBe("addConnection");
    expect(response.entries[3].kind).toBe("virtual");
  });

  it("returns mock cloud drives for network:///cloud", async () => {
    const response = await transport.invoke<NetworkNeighborhoodResponse>(
      "network.discoverNeighborhood",
      { request: { uri: "network:///cloud" } },
    );

    expect(response.entries).toHaveLength(3);
    expect(response.entries.map((entry) => entry.virtualKind)).toEqual([
      "cloudDrive",
      "cloudDrive",
      "cloudDrive",
    ]);
    expect(response.entries.every((entry) => entry.canRead)).toBe(true);
    expect(
      response.entries.every(
        (entry) => entry.targetUri && entry.targetUri.startsWith("local://"),
      ),
    ).toBe(true);
  });

  it("returns a discovered LAN service entry for network:///lan", async () => {
    const response = await transport.invoke<NetworkNeighborhoodResponse>(
      "network.discoverNeighborhood",
      { request: { uri: "network:///lan" } },
    );

    expect(response.entries).toHaveLength(1);
    const entry = response.entries[0];
    expect(entry.virtualKind).toBe("discoveredService");
    expect(entry.protocol).toBe("smb");
    expect(entry.status).toBe("credentialsRequired");
    // Discovered services have no target URI — they need credentials first.
    expect(entry.targetUri).toBeNull();
    expect(entry.canRead).toBe(false);
  });

  it("returns a mock saved connection for network:///saved", async () => {
    const response = await transport.invoke<NetworkNeighborhoodResponse>(
      "network.discoverNeighborhood",
      { request: { uri: "network:///saved" } },
    );

    expect(response.entries).toHaveLength(1);
    expect(response.entries[0].virtualKind).toBe("savedConnection");
    expect(response.entries[0].protocol).toBe("sftp");
    expect(response.entries[0].targetUri).toMatch(/^sftp:\/\//);
  });

  it("echoes the request URI in the response even for unknown URIs", async () => {
    const response = await transport.invoke<NetworkNeighborhoodResponse>(
      "network.discoverNeighborhood",
      { request: { uri: "network:///does-not-exist" } },
    );

    expect(response.uri).toBe("network:///does-not-exist");
    // The default branch returns the four root groups (or none). We just
    // assert that the call returns successfully and echoes the URI.
    expect(Array.isArray(response.entries)).toBe(true);
  });

  it("falls back to the default URI when no request is provided", async () => {
    const response = await transport.invoke<NetworkNeighborhoodResponse>(
      "network.discoverNeighborhood",
      {},
    );

    expect(response.uri).toBe("network:///");
    expect(response.entries.length).toBeGreaterThan(0);
  });
});

describe("preview transport — network provider catalog", () => {
  const transport = createPreviewTransport();

  it("returns provider capabilities with webdav marked unavailable", async () => {
    const response = await transport.invoke<NetworkProvidersListResponse>(
      "network.providersList",
    );

    expect(response.providers.map((provider) => provider.scheme)).toEqual([
      "sftp",
      "ssh",
      "smb",
      "s3",
      "webdav",
    ]);
    expect(
      response.providers.find((provider) => provider.scheme === "sftp"),
    ).toMatchObject({
      fileCapable: true,
      terminalCapable: true,
      authKinds: ["password", "privateKey"],
    });
    expect(
      response.providers.find((provider) => provider.scheme === "webdav"),
    ).toMatchObject({
      status: "unavailable",
      missingDependency: "WebDAV provider is not registered yet.",
    });
  });

  it("returns a deterministic profile test result", async () => {
    const response = await transport.invoke<NetworkProfileTestResponse>(
      "network.profileTest",
      {
        request: {
          draft: {
            label: "Preview",
            scheme: "sftp",
            host: "example.com",
            port: 22,
            username: "deploy",
            authKind: "privateKey",
            privateKeyPath: "~/.ssh/id_ed25519",
            defaultPath: "/home/deploy",
            options: { ssh: { useAgent: true } },
          },
        },
      },
    );

    expect(response.ok).toBe(true);
    expect(response.resolvedUri).toBe("sftp://preview/home/deploy");
    expect(response.trustState).toBe("untrusted");
    expect(response.warnings).toContain(
      "Preview transport does not open sockets.",
    );
  });
});
