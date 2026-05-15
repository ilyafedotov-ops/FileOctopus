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

export function applySplitRatio(ratio: number) {
  const root = document.documentElement;
  const resolved = Math.min(0.75, Math.max(0.25, Number(ratio) || 0.5));
  const leftWeight = Math.max(1, Math.round(resolved * 100));
  const rightWeight = Math.max(1, Math.round((1 - resolved) * 100));
  root.style.setProperty("--fo-left-pane-fr", `${leftWeight}fr`);
  root.style.setProperty("--fo-right-pane-fr", `${rightWeight}fr`);
  return resolved;
}

export function applyLayoutPreferences(preferences: UserPreferencesDto) {
  const root = document.documentElement;
  root.style.setProperty("--fo-sidebar-width", `${preferences.sidebarWidth}px`);
  root.style.setProperty(
    "--fo-activity-width",
    preferences.activityPanelVisible
      ? `${preferences.activityPanelWidth}px`
      : "44px",
  );
  applySplitRatio(preferences.splitRatio);
  root.dataset.activityPanel = preferences.activityPanelVisible
    ? "visible"
    : "hidden";
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
  return value === "list" || value === "icons" || value === "columns"
    ? value
    : "details";
}

export function applyAllPreferences(preferences: UserPreferencesDto) {
  applyThemePreference(preferences.theme);
  applyDensityPreference(preferences.density);
  applyLayoutPreferences(preferences);
}
