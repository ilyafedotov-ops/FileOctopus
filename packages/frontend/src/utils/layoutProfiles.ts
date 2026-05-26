import type { UserPreferencesDto } from "@fileoctopus/ts-api";

export interface LayoutProfile {
  id: string;
  name: string;
  createdAt: string;
  sidebarWidth: number;
  sidebarVisible: boolean;
  splitRatio: number;
  paneMode: string;
  paneDirection: string;
  statusBarVisible: boolean;
  toolbarVisible: boolean;
  toolbarEntries: string;
  activityPanelVisible: boolean;
  activityPanelWidth: number;
  fontScale: string;
  iconScale: string;
  density: string;
  accentColor: string;
  theme: string;
}

export function captureCurrentProfile(
  preferences: UserPreferencesDto,
  name: string,
): LayoutProfile {
  return {
    id: `profile-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name,
    createdAt: new Date().toISOString(),
    sidebarWidth: preferences.sidebarWidth,
    sidebarVisible: preferences.sidebarVisible,
    splitRatio: preferences.splitRatio,
    paneMode: preferences.paneMode,
    paneDirection: preferences.paneDirection,
    statusBarVisible: preferences.statusBarVisible,
    toolbarVisible: preferences.toolbarVisible,
    toolbarEntries: preferences.toolbarEntries,
    activityPanelVisible: preferences.activityPanelVisible,
    activityPanelWidth: preferences.activityPanelWidth,
    fontScale: preferences.fontScale,
    iconScale: preferences.iconScale,
    density: preferences.density,
    accentColor: preferences.accentColor,
    theme: preferences.theme,
  };
}

export function applyLayoutProfile(
  profile: LayoutProfile,
  updatePreference: (key: string, value: string) => void,
): void {
  updatePreference("sidebarWidth", String(profile.sidebarWidth));
  updatePreference("sidebarVisible", String(profile.sidebarVisible));
  updatePreference("splitRatio", String(profile.splitRatio));
  updatePreference("paneMode", profile.paneMode);
  updatePreference("paneDirection", profile.paneDirection);
  updatePreference("statusBarVisible", String(profile.statusBarVisible));
  updatePreference("toolbarVisible", String(profile.toolbarVisible));
  updatePreference("toolbarEntries", profile.toolbarEntries);
  updatePreference(
    "activityPanelVisible",
    String(profile.activityPanelVisible),
  );
  updatePreference("activityPanelWidth", String(profile.activityPanelWidth));
  updatePreference("fontScale", profile.fontScale);
  updatePreference("iconScale", profile.iconScale);
  updatePreference("density", profile.density);
  updatePreference("accentColor", profile.accentColor);
  updatePreference("theme", profile.theme);
}

export function exportProfile(profile: LayoutProfile): string {
  return JSON.stringify(profile, null, 2);
}

export function importProfile(json: string): LayoutProfile | null {
  try {
    const parsed = JSON.parse(json);
    if (!isValidLayoutProfile(parsed)) {
      return null;
    }
    return {
      ...parsed,
      id: `profile-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function isValidLayoutProfile(obj: unknown): obj is LayoutProfile {
  if (typeof obj !== "object" || obj === null) return false;
  const p = obj as Record<string, unknown>;
  return (
    typeof p.name === "string" &&
    typeof p.sidebarWidth === "number" &&
    typeof p.sidebarVisible === "boolean" &&
    typeof p.splitRatio === "number" &&
    typeof p.paneMode === "string" &&
    typeof p.paneDirection === "string" &&
    typeof p.statusBarVisible === "boolean" &&
    typeof p.toolbarVisible === "boolean" &&
    typeof p.toolbarEntries === "string" &&
    typeof p.activityPanelVisible === "boolean" &&
    typeof p.activityPanelWidth === "number" &&
    typeof p.fontScale === "string" &&
    typeof p.iconScale === "string" &&
    typeof p.density === "string" &&
    typeof p.accentColor === "string" &&
    typeof p.theme === "string"
  );
}

export function parseLayoutProfiles(json: string): LayoutProfile[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidLayoutProfile);
  } catch {
    return [];
  }
}

export function serializeLayoutProfiles(profiles: LayoutProfile[]): string {
  return JSON.stringify(profiles);
}
