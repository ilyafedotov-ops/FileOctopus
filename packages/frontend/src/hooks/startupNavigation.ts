import {
  isNetworkUri,
  normalizeIpcError,
  type FileOctopusClient,
  type StandardLocationDto,
} from "@fileoctopus/ts-api";
import { documentsUri, homeUri } from "../panelStore";

export interface StartupNavigation {
  locations: StandardLocationDto[];
  leftUri: string;
  rightUri: string;
}

async function resolveStartupUri(
  client: FileOctopusClient,
  uri: string,
  fallbackUri: string,
): Promise<string> {
  if (!uri.startsWith("local://") || isNetworkUri(uri)) {
    return uri;
  }

  try {
    await client.fs.stat({ uri });
    return uri;
  } catch (error) {
    const normalized = normalizeIpcError(error);
    if (
      normalized.code === "not_found" ||
      normalized.code === "folder_not_found" ||
      normalized.code === "invalid_uri"
    ) {
      return fallbackUri;
    }
    return uri;
  }
}

export async function resolveStartupNavigation(
  client: FileOctopusClient,
  leftUri: string,
  rightUri: string,
): Promise<StartupNavigation> {
  const response = await client.fs.standardLocations();
  const homeLocation = response.locations.find(
    (location) => location.id === "home",
  );
  const documentsLocation = response.locations.find(
    (location) => location.id === "documents",
  );
  const fallbackLeftUri = homeLocation?.uri ?? homeUri();
  const fallbackRightUri = documentsLocation?.uri ?? documentsUri();
  const initialLeftUri =
    leftUri === homeUri() && homeLocation ? homeLocation.uri : leftUri;
  const initialRightUri =
    rightUri === documentsUri() && documentsLocation
      ? documentsLocation.uri
      : rightUri;
  const [resolvedLeftUri, resolvedRightUri] = await Promise.all([
    resolveStartupUri(client, initialLeftUri, fallbackLeftUri),
    resolveStartupUri(client, initialRightUri, fallbackRightUri),
  ]);

  return {
    locations: response.locations,
    leftUri: resolvedLeftUri,
    rightUri: resolvedRightUri,
  };
}
