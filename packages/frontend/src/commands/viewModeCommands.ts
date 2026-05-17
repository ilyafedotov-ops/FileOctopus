import type { ViewMode } from "../panelStore";

export const VIEW_MODE_COMMAND_IDS: Record<ViewMode, string> = {
  details: "view.details",
  list: "view.list",
  compact: "view.compact",
  icons: "view.icons",
  columns: "view.columns",
};

export function viewModeCommandId(mode: ViewMode | string): string | undefined {
  return VIEW_MODE_COMMAND_IDS[mode as ViewMode];
}
