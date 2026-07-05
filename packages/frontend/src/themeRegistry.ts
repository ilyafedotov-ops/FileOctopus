export interface ThemeDefinition {
  /** Value persisted in the `theme` preference and written to the data-theme attribute. */
  id: string;
  /** Human-readable label shown in Settings → Display. */
  label: string;
  /** Whether the theme is dark (drives color-scheme for native form controls). */
  isDark: boolean;
  /** Whether the theme can be picked directly; `system` resolves at runtime. */
  selectable: boolean;
}

export const THEMES: ReadonlyArray<ThemeDefinition> = [
  { id: "system", label: "System", isDark: false, selectable: true },
  { id: "light", label: "Light", isDark: false, selectable: true },
  { id: "dark", label: "Dark", isDark: true, selectable: true },
  {
    id: "commander-blue",
    label: "Commander Blue",
    isDark: true,
    selectable: true,
  },
  {
    id: "aubergine-technical",
    label: "Aubergine Muted Technical",
    isDark: true,
    selectable: true,
  },
];

export function themeById(id: string): ThemeDefinition | undefined {
  return THEMES.find((theme) => theme.id === id);
}

export function isKnownTheme(id: string): boolean {
  return themeById(id) !== undefined;
}

export function selectableThemes(): ThemeDefinition[] {
  return THEMES.filter((theme) => theme.selectable);
}
