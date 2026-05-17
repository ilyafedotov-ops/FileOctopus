import { useEffect, useRef, type RefObject } from "react";

const MIN_PANE_WIDTH = 420;
const ACTIVITY_RAIL_WIDTH = 320;
const RESIZER_WIDTH = 4;
const COLLAPSED_RAIL_WIDTH = 44;
const LAYOUT_NARROW = 820;
const LAYOUT_MEDIUM = 1040;
const LAYOUT_TIER_XS = 700;
const LAYOUT_TIER_SM = 900;
const LAYOUT_TIER_MD = 1100;
const LAYOUT_TIER_LG = 1400;

export type WorkspaceLayoutTier = "xs" | "sm" | "md" | "lg" | "xl";

export type WorkspaceLayoutMode = "wide" | "medium" | "narrow";

export function useWorkspaceLayout({
  workspaceRef,
  sidebarWidth,
  activityCollapsed,
  activityPanelVisible,
  onCollapseActivity,
}: {
  workspaceRef: RefObject<HTMLElement | null>;
  sidebarWidth: number;
  activityCollapsed: boolean;
  activityPanelVisible: boolean;
  onCollapseActivity: () => void;
}) {
  const pinnedOpenRef = useRef(false);
  const onCollapseRef = useRef(onCollapseActivity);
  onCollapseRef.current = onCollapseActivity;

  useEffect(() => {
    if (activityCollapsed) {
      pinnedOpenRef.current = false;
    }
  }, [activityCollapsed]);

  useEffect(() => {
    const element = workspaceRef.current;
    if (!element) {
      return;
    }

    const evaluate = () => {
      const width = element.clientWidth;
      if (width <= 0) {
        return;
      }

      const railWidth = activityPanelVisible
        ? activityCollapsed
          ? COLLAPSED_RAIL_WIDTH
          : ACTIVITY_RAIL_WIDTH
        : COLLAPSED_RAIL_WIDTH;
      const dualPaneNeed = MIN_PANE_WIDTH * 2 + RESIZER_WIDTH;
      const required = sidebarWidth + RESIZER_WIDTH + dualPaneNeed + railWidth;

      const layout: WorkspaceLayoutMode =
        width < LAYOUT_NARROW
          ? "narrow"
          : width < LAYOUT_MEDIUM
            ? "medium"
            : "wide";

      const layoutTier: WorkspaceLayoutTier =
        width < LAYOUT_TIER_XS
          ? "xs"
          : width < LAYOUT_TIER_SM
            ? "sm"
            : width < LAYOUT_TIER_MD
              ? "md"
              : width < LAYOUT_TIER_LG
                ? "lg"
                : "xl";

      element.dataset.workspace = width < required ? "compact" : "comfortable";
      element.dataset.layout = layout;
      element.dataset.layoutTier = layoutTier;
      document.documentElement.dataset.shellLayout = layout;
      document.documentElement.dataset.shellLayoutTier = layoutTier;

      if (
        width < required &&
        activityPanelVisible &&
        !activityCollapsed &&
        !pinnedOpenRef.current
      ) {
        onCollapseRef.current();
      }
    };

    if (typeof ResizeObserver === "undefined") {
      evaluate();
      return;
    }

    const observer = new ResizeObserver(evaluate);
    observer.observe(element);
    evaluate();

    return () => observer.disconnect();
  }, [activityCollapsed, activityPanelVisible, sidebarWidth, workspaceRef]);

  return {
    markActivityPinnedOpen: () => {
      pinnedOpenRef.current = true;
    },
  };
}
