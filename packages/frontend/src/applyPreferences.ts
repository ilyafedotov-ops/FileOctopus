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

export type AccentPreference =
  | "blue"
  | "indigo"
  | "violet"
  | "pink"
  | "red"
  | "orange"
  | "amber"
  | "green";
export type ScalePreference = "small" | "medium" | "large";

const ACCENT_VALUES: ReadonlyArray<AccentPreference> = [
  "blue",
  "indigo",
  "violet",
  "pink",
  "red",
  "orange",
  "amber",
  "green",
];
const SCALE_VALUES: ReadonlyArray<ScalePreference> = [
  "small",
  "medium",
  "large",
];

function includes<T>(arr: ReadonlyArray<T>, v: T): boolean {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === v) return true;
  }
  return false;
}

export function applyAccentPreference(value: string): AccentPreference {
  const resolved = includes(ACCENT_VALUES, value as AccentPreference)
    ? (value as AccentPreference)
    : "blue";
  document.documentElement.dataset.accent = resolved;
  return resolved;
}

export function applyFontScalePreference(value: string): ScalePreference {
  const resolved = includes(SCALE_VALUES, value as ScalePreference)
    ? (value as ScalePreference)
    : "medium";
  document.documentElement.dataset.fontScale = resolved;
  return resolved;
}

export function applyIconScalePreference(value: string): ScalePreference {
  const resolved = includes(SCALE_VALUES, value as ScalePreference)
    ? (value as ScalePreference)
    : "medium";
  document.documentElement.dataset.iconScale = resolved;
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
  if (preferences.sidebarVisible) {
    delete root.dataset.sidebarHidden;
  } else {
    root.dataset.sidebarHidden = "true";
  }
  applyChromeLayout(
    preferences.statusBarVisible !== false,
    preferences.toolbarVisible !== false,
  );
}

export function applyChromeLayout(
  statusBarVisible: boolean,
  toolbarVisible: boolean,
) {
  const root = document.documentElement;
  root.dataset.statusBar = statusBarVisible ? "visible" : "hidden";
  if (toolbarVisible) {
    delete root.dataset.toolbarHidden;
  } else {
    root.dataset.toolbarHidden = "true";
  }
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
  return value === "list" ||
    value === "compact" ||
    value === "icons" ||
    value === "columns"
    ? value
    : "details";
}

export function applyAllPreferences(preferences: UserPreferencesDto) {
  applyThemePreference(preferences.theme);
  applyDensityPreference(preferences.density);
  applyAccentPreference(preferences.accentColor);
  applyFontScalePreference(preferences.fontScale);
  applyIconScalePreference(preferences.iconScale);
  applyLayoutPreferences(preferences);
}
