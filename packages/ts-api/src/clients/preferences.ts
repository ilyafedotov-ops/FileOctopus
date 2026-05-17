import type {
  GetPreferencesResponse,
  IpcTransport,
  SetPreferenceRequest,
  SetPreferenceResponse,
} from "../types";
import { normalizeIpcError } from "../normalizeError";

export class PreferencesClient {
  constructor(private readonly transport: IpcTransport) {}

  async get(): Promise<GetPreferencesResponse> {
    try {
      return await this.transport.invoke<GetPreferencesResponse>(
        "preferences.get",
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async set(request: SetPreferenceRequest): Promise<SetPreferenceResponse> {
    try {
      return await this.transport.invoke<SetPreferenceResponse>(
        "preferences.set",
        {
          request,
        },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }
}

export function preferenceValue(
  key: string | undefined,
  value: string,
): string | number | boolean {
  if (
    key === "showHiddenFiles" ||
    key === "activityPanelVisible" ||
    key === "confirmDelete" ||
    key === "confirmPermanentDelete" ||
    key === "useTrashByDefault"
  ) {
    return value === "true";
  }

  if (
    key === "sidebarWidth" ||
    key === "activityPanelWidth" ||
    key === "splitRatio"
  ) {
    return Number(value);
  }

  return value;
}
