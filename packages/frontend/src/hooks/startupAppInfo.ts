import type { AppInfoResponse, FileOctopusClient } from "@fileoctopus/ts-api";

export interface StartupAppInfo {
  appInfo: AppInfoResponse;
  refreshNetworkProfiles: boolean;
}

export async function resolveStartupAppInfo(
  client: FileOctopusClient,
): Promise<StartupAppInfo | null> {
  try {
    const appInfo = await client.getAppInfo();
    return {
      appInfo,
      refreshNetworkProfiles: appInfo.networkEnabled,
    };
  } catch {
    return null;
  }
}
