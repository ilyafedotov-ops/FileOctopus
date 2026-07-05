export type ToolbarOverflowTier =
  "full" | "comfortable" | "compact" | "minimal";

export type ToolbarSection =
  | "archive"
  | "compare"
  | "sync"
  | "terminal"
  | "hotlist"
  | "network"
  | "settings";

export function resolveToolbarOverflowTier(width: number): ToolbarOverflowTier {
  if (width >= 1180) {
    return "full";
  }
  if (width >= 980) {
    return "comfortable";
  }
  if (width >= 760) {
    return "compact";
  }
  return "minimal";
}

export function isToolbarSectionVisible(
  section: ToolbarSection,
  tier: ToolbarOverflowTier,
): boolean {
  switch (section) {
    case "archive":
      return tier === "full" || tier === "comfortable";
    case "compare":
    case "network":
      return tier === "full";
    case "sync":
      return tier === "full" || tier === "comfortable";
    case "terminal":
      return true;
    case "hotlist":
      return tier === "full" || tier === "comfortable";
    case "settings":
      return tier === "full";
  }
}
