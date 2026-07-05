import type { ReactElement } from "react";
import { render } from "@testing-library/react";

export type VisualTheme = "light" | "dark";
export type VisualDensity = "compact" | "comfortable" | "spacious";

export function renderVisualState(
  ui: ReactElement,
  options?: { theme?: VisualTheme; density?: VisualDensity },
) {
  const root = document.documentElement;
  const previousTheme = root.dataset.theme;
  const previousDensity = root.dataset.density;

  if (options?.theme) {
    root.dataset.theme = options.theme;
  }
  if (options?.density) {
    root.dataset.density = options.density;
  }

  const view = render(ui);

  return {
    ...view,
    restore() {
      if (previousTheme === undefined) {
        delete root.dataset.theme;
      } else {
        root.dataset.theme = previousTheme;
      }
      if (previousDensity === undefined) {
        delete root.dataset.density;
      } else {
        root.dataset.density = previousDensity;
      }
      view.unmount();
    },
  };
}

export const sampleAppInfo = {
  version: "0.1.5",
  buildProfile: "debug",
  commitSha: "abc1234",
} as const;

export const sampleAppHealth = {
  schemaVersion: 3,
  startupRecoveryCount: 0,
  configDir: "/tmp/config",
  dataDir: "/tmp/data",
  logDir: "/tmp/logs",
  databasePath: "/tmp/data/history.db",
} as const;
