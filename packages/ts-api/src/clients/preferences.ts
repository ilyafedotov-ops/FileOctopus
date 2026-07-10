import type { IpcTransport } from "../types";
import type {
  GetPreferencesResponse,
  SetPreferenceRequest,
  SetPreferenceResponse,
} from "../generated/ipc";

export class PreferencesClient {
  constructor(private readonly transport: IpcTransport) {}

  async get(): Promise<GetPreferencesResponse> {
    return this.transport.invoke<GetPreferencesResponse>("preferences.get");
  }

  async set(request: SetPreferenceRequest): Promise<SetPreferenceResponse> {
    return this.transport.invoke<SetPreferenceResponse>("preferences.set", {
      request,
    });
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
    key === "useTrashByDefault" ||
    key === "confirmOverwrite" ||
    key === "sidebarVisible" ||
    key === "statusBarVisible" ||
    key === "toolbarVisible" ||
    key === "showAdvancedCopyOptions" ||
    key === "paneTerminalDefaultOpen" ||
    key === "terminalCdOnNavigate" ||
    key === "confirmClosePaneWithTerminal" ||
    key === "rememberLastUsedPanes" ||
    key === "popupNotifications"
  ) {
    return value === "true";
  }

  if (
    key === "sidebarWidth" ||
    key === "activityPanelWidth" ||
    key === "splitRatio" ||
    key === "paneTerminalHeightLeft" ||
    key === "paneTerminalHeightRight"
  ) {
    return Number(value);
  }

  return value;
}
