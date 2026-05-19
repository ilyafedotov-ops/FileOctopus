import type {
  FavoriteEntryDto,
  NetworkConnectionStatusDto,
  NetworkProfileDto,
  RecentEntryDto,
  StandardLocationDto,
} from "@fileoctopus/ts-api";
import { homeUri } from "../panelStore";
import { localPathFromUri } from "../utils/paneUtils";
import {
  buildDriveTargets,
  networkDriveHotlistTitle,
} from "../navigation/driveTargets";

export type HotlistTargetKind =
  | "parent"
  | "home"
  | "volume"
  | "network"
  | "favorite"
  | "recent";

export interface HotlistTarget {
  id: string;
  kind: HotlistTargetKind;
  label: string;
  uri: string;
  glyph: string;
  title: string;
}

export interface HotlistTargetsInput {
  activeUri: string;
  parentUri: string | null;
  locations: StandardLocationDto[];
  networkProfiles?: NetworkProfileDto[];
  networkStatuses?: NetworkConnectionStatusDto[];
  favorites: FavoriteEntryDto[];
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
  networkProfiles = [],
  networkStatuses = [],
  favorites,
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
    addTarget(targets, seen, {
      id: "parent",
      kind: "parent",
      label: "..",
      uri: upUri,
      glyph: "↑",
      title: localPathFromUri(upUri),
    });
  }

  addTarget(targets, seen, {
    id: "home",
    kind: "home",
    label: resolvedHomeLabel,
    uri: resolvedHomeUri,
    glyph: "~",
    title: localPathFromUri(resolvedHomeUri),
  });

  buildDriveTargets(locations, networkProfiles, networkStatuses).forEach(
    (target) => {
      if (target.kind === "local") {
        addTarget(targets, seen, {
          id: `volume-${target.id}`,
          kind: "volume",
          label: target.label,
          uri: target.uri,
          glyph: "▣",
          title: localPathFromUri(target.uri),
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
      });
    },
  );

  favorites.forEach((favorite) =>
    addTarget(targets, seen, {
      id: `favorite-${favorite.id}`,
      kind: "favorite",
      label: favorite.label || locationName(favorite.uri),
      uri: favorite.uri,
      glyph: "★",
      title: localPathFromUri(favorite.uri),
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
    }),
  );

  return {
    visible: targets.slice(0, maxVisible),
    overflow: targets.slice(maxVisible),
  };
}
