import { Icons } from "@fileoctopus/ui";
import type { ReactNode } from "react";
export function sidebarSectionTitle(section: string): string {
  if (section === "Devices/Volumes") {
    return "Devices / Volumes";
  }

  return section;
}

export function emptySectionHint(section: string): string {
  switch (section) {
    case "Favorites":
      return "No favorite locations";
    case "User folders":
      return "No user folders found";
    case "Devices/Volumes":
      return "No mounted volumes";
    default:
      return "Nothing here yet";
  }
}

export function locationIcon(id: string): ReactNode {
  switch (id) {
    case "home":
      return Icons.home();
    case "desktop":
      return Icons.desktop();
    case "documents":
      return Icons.documents();
    case "downloads":
      return Icons.downloads();
    case "pictures":
      return Icons.pictures();
    case "music":
      return Icons.music();
    case "videos":
      return Icons.video();
    default:
      return Icons.volume();
  }
}
