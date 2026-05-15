import type { UserPreferencesDto } from "@fileoctopus/ts-api";
import type { ViewMode } from "./panelStore";

export type ThemePreference = "system" | "light" | "dark";
export type DensityPreference = "compact" | "comfortable" | "spacious";

export function applyThemePreference(theme: string) {
  const root = document.documentElement;
  const resolved: ThemePreference =
    theme === "light" || theme === "dark" ? theme : "system";

  root.dataset.theme = resolved;
}

export function applyDensityPreference(density: string): DensityPreference {
  const resolved: DensityPreference =
    density === "compact" || density === "spacious" ? density : "comfortable";

  document.documentElement.dataset.density = resolved;
  return resolved;
}

export function rowHeightForDensity(density: DensityPreference): number {
  switch (density) {
    case "compact":
      return 24;
    case "spacious":
      return 36;
    case "comfortable":
    default:
      return 30;
  }
}

export function viewModeFromPreference(value: string): ViewMode {
  return value === "list" || value === "icons" ? value : "details";
}

export function applyAllPreferences(preferences: UserPreferencesDto) {
  applyThemePreference(preferences.theme);
  applyDensityPreference(preferences.density);
}
