import { describe, expect, it, vi } from "vitest";
import type { StandardLocationDto } from "@fileoctopus/ts-api";
import { documentsUri, homeUri } from "../src/panelStore";
import { resolveStartupNavigation } from "../src/hooks/startupNavigation";

const homeLocation: StandardLocationDto = {
  id: "home",
  name: "Home",
  uri: "local:///home/tester",
  section: "places",
};

const documentsLocation: StandardLocationDto = {
  id: "documents",
  name: "Documents",
  uri: "local:///home/tester/Documents",
  section: "places",
};

function createClient(
  stat = vi.fn(async () => ({ entry: { kind: "directory" } })),
) {
  const locations = [homeLocation, documentsLocation];
  return {
    fs: {
      stat,
      standardLocations: vi.fn(async () => ({ locations })),
    },
  };
}

describe("resolveStartupNavigation", () => {
  it("replaces placeholder home and documents uris with standard locations", async () => {
    const client = createClient();

    const result = await resolveStartupNavigation(
      client as never,
      homeUri(),
      documentsUri(),
    );

    expect(result.leftUri).toBe(homeLocation.uri);
    expect(result.rightUri).toBe(documentsLocation.uri);
    expect(result.locations).toEqual([homeLocation, documentsLocation]);
  });

  it("falls back to standard locations when a local startup uri is missing", async () => {
    const stat = vi.fn(async () => {
      throw { code: "not_found", message: "missing" };
    });
    const client = createClient(stat);

    const result = await resolveStartupNavigation(
      client as never,
      "local:///gone-left",
      "local:///gone-right",
    );

    expect(result.leftUri).toBe(homeLocation.uri);
    expect(result.rightUri).toBe(documentsLocation.uri);
  });

  it("falls back to standard locations when a local startup uri points to a file", async () => {
    const stat = vi.fn(async () => ({ entry: { kind: "file" } }));
    const client = createClient(stat);

    const result = await resolveStartupNavigation(
      client as never,
      "local:///home/tester/notes.txt",
      "local:///home/tester/archive.zip",
    );

    expect(result.leftUri).toBe(homeLocation.uri);
    expect(result.rightUri).toBe(documentsLocation.uri);
  });

  it("keeps local symlinks navigable because they may target directories", async () => {
    const stat = vi.fn(async () => ({ entry: { kind: "symlink" } }));
    const client = createClient(stat);

    const result = await resolveStartupNavigation(
      client as never,
      "local:///home/tester/project-link",
      "local:///home/tester/docs-link",
    );

    expect(result.leftUri).toBe("local:///home/tester/project-link");
    expect(result.rightUri).toBe("local:///home/tester/docs-link");
  });

  it("keeps remote, network, and non-local uris without stat checks", async () => {
    const stat = vi.fn(async () => ({ entry: { kind: "directory" } }));
    const client = createClient(stat);

    const result = await resolveStartupNavigation(
      client as never,
      "sftp://profile/projects",
      "network:///saved",
    );

    expect(result.leftUri).toBe("sftp://profile/projects");
    expect(result.rightUri).toBe("network:///saved");
    expect(stat).not.toHaveBeenCalled();
  });

  it("keeps a local startup uri when stat fails for a non-missing reason", async () => {
    const stat = vi.fn(async () => {
      throw { code: "permission_denied", message: "denied" };
    });
    const client = createClient(stat);

    const result = await resolveStartupNavigation(
      client as never,
      "local:///locked-left",
      "local:///locked-right",
    );

    expect(result.leftUri).toBe("local:///locked-left");
    expect(result.rightUri).toBe("local:///locked-right");
  });
});
