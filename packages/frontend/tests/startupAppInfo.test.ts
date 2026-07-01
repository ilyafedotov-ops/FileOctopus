import { describe, expect, it, vi } from "vitest";
import type { AppInfoResponse } from "@fileoctopus/ts-api";
import { resolveStartupAppInfo } from "../src/hooks/startupAppInfo";

const appInfo = {
  name: "FileOctopus",
  version: "0.1.1",
  tauriVersion: "2.0.0",
  platform: "linux",
  debug: false,
  networkEnabled: true,
  pluginRuntimeEnabled: false,
  configPath: "/tmp/config",
  dataPath: "/tmp/data",
  logPath: "/tmp/log",
  frontendDistPath: "/tmp/dist",
  appHealth: null,
} satisfies AppInfoResponse;

describe("resolveStartupAppInfo", () => {
  it("returns app info and requests network profile refresh when network is enabled", async () => {
    const client = {
      getAppInfo: vi.fn(async () => appInfo),
    };

    const result = await resolveStartupAppInfo(client as never);

    expect(result).toEqual({
      appInfo,
      refreshNetworkProfiles: true,
    });
  });

  it("does not request network profile refresh when network is disabled", async () => {
    const disabledInfo = { ...appInfo, networkEnabled: false };
    const client = {
      getAppInfo: vi.fn(async () => disabledInfo),
    };

    const result = await resolveStartupAppInfo(client as never);

    expect(result).toEqual({
      appInfo: disabledInfo,
      refreshNetworkProfiles: false,
    });
  });

  it("returns null when app info is unavailable", async () => {
    const client = {
      getAppInfo: vi.fn(async () => {
        throw new Error("unavailable");
      }),
    };

    await expect(resolveStartupAppInfo(client as never)).resolves.toBeNull();
  });
});
