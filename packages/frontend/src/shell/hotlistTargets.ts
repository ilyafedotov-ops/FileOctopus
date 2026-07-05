import type {
  FavoriteEntryDto,
  FileEntryDto,
  NetworkConnectionStatusDto,
  NetworkProfileDto,
  RecentEntryDto,
  StandardLocationDto,
  StarredEntryDto,
} from "@fileoctopus/ts-api";
import { homeUri } from "../panelStore";
import { localPathFromUri } from "../utils/paneUtils";
import {
  buildDriveTargets,
  networkDriveHotlistTitle,
  type PaneLocationTargetAction,
} from "../navigation/driveTargets";

export type HotlistTargetKind =
  "parent" | "home" | "volume" | "network" | "favorite" | "starred" | "recent";

export interface HotlistTarget {
  id: string;
  kind: HotlistTargetKind;
  label: string;
  uri: string;
  glyph: string;
  title: string;
  action: PaneLocationTargetAction;
}

export interface HotlistTargetsInput {
  activeUri: string;
  parentUri: string | null;
  locations: StandardLocationDto[];
  networkQuickEntries?: FileEntryDto[];
  networkProfiles?: NetworkProfileDto[];
  networkStatuses?: NetworkConnectionStatusDto[];
  favorites: FavoriteEntryDto[];
  starred?: StarredEntryDto[];
  recentToday: RecentEntryDto[];
  recentWeek: RecentEntryDto[];
  maxVisible?: number;
}

export interface HotlistTargetsResult {
  visible: HotlistTarget[];
  overflow: HotlistTarget[];
}

function locationName(uri: string): string {
  const path = localPathFromUri(uri).replace(/\/+$/, "");
  const parts = path.split("/").filter(Boolean);
  const name = parts[parts.length - 1];
  return name || path || uri;
}

function addStructuralTarget(
  targets: HotlistTarget[],
  seen: Set<string>,
  target: HotlistTarget,
) {
  if (seen.has(target.uri)) {
    return;
  }
  targets.push(target);
}

function addTarget(
  targets: HotlistTarget[],
  seen: Set<string>,
  target: HotlistTarget,
) {
  if (seen.has(target.uri)) {
    return;
  }
  seen.add(target.uri);
  targets.push(target);
}

export function buildHotlistTargets({
  activeUri,
  parentUri: upUri,
  locations,
  networkQuickEntries = [],
  networkProfiles = [],
  networkStatuses = [],
  favorites,
  starred = [],
  recentToday,
  recentWeek,
  maxVisible = 10,
}: HotlistTargetsInput): HotlistTargetsResult {
  const seen = new Set<string>([activeUri]);
  const targets: HotlistTarget[] = [];
  const homeLocation =
    locations.find((location) => location.id === "home") ??
    locations.find(
      (location) =>
        location.section === "Favorites" &&
        location.name.toLowerCase() === "home",
    );
  const resolvedHomeUri = homeLocation?.uri ?? homeUri();
  const resolvedHomeLabel = homeLocation?.name ?? "Home";

  if (upUri) {
    addStructuralTarget(targets, seen, {
      id: "parent",
      kind: "parent",
      label: "..",
      uri: upUri,
      glyph: "↑",
      title: localPathFromUri(upUri),
      action: { type: "navigate", uri: upUri },
    });
  }

  addStructuralTarget(targets, seen, {
    id: "home",
    kind: "home",
    label: resolvedHomeLabel,
    uri: resolvedHomeUri,
    glyph: "~",
    title: localPathFromUri(resolvedHomeUri),
    action: { type: "navigate", uri: resolvedHomeUri },
  });

  buildDriveTargets(
    locations,
    networkProfiles,
    networkStatuses,
    networkQuickEntries,
  ).forEach((target) => {
    if (target.kind === "local") {
      addTarget(targets, seen, {
        id: `volume-${target.id}`,
        kind: "volume",
        label: target.label,
        uri: target.uri,
        glyph: "▣",
        title: localPathFromUri(target.uri),
        action: target.action,
      });
      return;
    }

    if (target.kind === "cloud") {
      addTarget(targets, seen, {
        id: `cloud-${target.id}`,
        kind: "network",
        label: target.label,
        uri: target.uri,
        glyph: "☁",
        title: localPathFromUri(target.uri),
        action: target.action,
      });
      return;
    }

    addTarget(targets, seen, {
      id: `network-${target.id}`,
      kind: "network",
      label: target.label,
      uri: target.uri,
      glyph: "⇄",
      title: networkDriveHotlistTitle(target.profile),
      action: target.action,
    });
  });

  favorites.forEach((favorite) =>
    addTarget(targets, seen, {
      id: `favorite-${favorite.id}`,
      kind: "favorite",
      label: favorite.label || locationName(favorite.uri),
      uri: favorite.uri,
      glyph: "★",
      title: localPathFromUri(favorite.uri),
      action: { type: "navigate", uri: favorite.uri },
    }),
  );

  starred.forEach((entry, index) =>
    addTarget(targets, seen, {
      id: `starred-${index}-${entry.uri}`,
      kind: "starred",
      label: entry.label || locationName(entry.uri),
      uri: entry.uri,
      glyph: "☆",
      title: localPathFromUri(entry.uri),
      action: { type: "navigate", uri: entry.uri },
    }),
  );

  [...recentToday, ...recentWeek].forEach((recent, index) =>
    addTarget(targets, seen, {
      id: `recent-${index}-${recent.uri}`,
      kind: "recent",
      label: recent.label || locationName(recent.uri),
      uri: recent.uri,
      glyph: "◷",
      title: localPathFromUri(recent.uri),
      action: { type: "navigate", uri: recent.uri },
    }),
  );

  return {
    visible: targets.slice(0, maxVisible),
    overflow: targets.slice(maxVisible),
  };
}
