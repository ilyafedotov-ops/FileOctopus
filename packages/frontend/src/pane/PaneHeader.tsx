import type { MouseEvent } from "react";
import { useMemo, useState } from "react";
import { DropdownMenu, Icons } from "@fileoctopus/ui";
import { PathBar } from "./PanePathBar";
import {
  selectActivePaneLocationTarget,
  type PaneLocationTarget,
} from "../navigation/driveTargets";

interface PaneHeaderProps {
  uri: string;
  pathError: string | null;
  pathFocusToken: number;
  onNavigate: (uri: string) => void;
  onActivate?: () => void;
  onBreadcrumbContextMenu?: (path: string, event: MouseEvent) => void;
  gitBranch?: string | null;
  gitDirty?: boolean;
  locationTargets?: PaneLocationTarget[];
}

export function PaneHeader({
  uri,
  pathError,
  pathFocusToken,
  onNavigate,
  onActivate,
  onBreadcrumbContextMenu,
  gitBranch,
  gitDirty = false,
  locationTargets = [],
}: PaneHeaderProps) {
  const [locationsOpen, setLocationsOpen] = useState(false);
  const activeLocation = selectActivePaneLocationTarget(locationTargets, uri);
  const locationLabel = activeLocation?.label ?? "Location";
  const locationItems = useMemo(
    () =>
      locationTargets.map((target, index) => ({
        id: target.id,
        label: target.label,
        icon: locationTargetIcon(target),
        checked: target.uri === activeLocation?.uri,
        separatorBefore:
          index > 0 && target.section !== locationTargets[index - 1]?.section,
        onSelect: () => {
          onActivate?.();
          onNavigate(target.uri);
        },
      })),
    [activeLocation?.uri, locationTargets, onActivate, onNavigate],
  );

  return (
    <header className="fo-panel-header">
      <div className="fo-panel-title-row">
        {locationItems.length > 0 ? (
          <DropdownMenu
            label="Location"
            triggerAriaLabel={`Location: ${locationLabel}`}
            open={locationsOpen}
            onOpenChange={setLocationsOpen}
            triggerClassName="fo-pane-location-trigger"
            align="start"
            items={locationItems}
          >
            <span className="fo-pane-location-icon" aria-hidden="true">
              {activeLocation
                ? locationTargetIcon(activeLocation)
                : Icons.folder()}
            </span>
            <span className="fo-pane-location-label">{locationLabel}</span>
            {Icons.chevronDown()}
          </DropdownMenu>
        ) : null}
        <PathBar
          value={uri}
          error={pathError}
          focusToken={pathFocusToken}
          onSubmit={onNavigate}
          onBreadcrumbContextMenu={onBreadcrumbContextMenu}
        />
        {gitBranch ? (
          <span
            className={
              gitDirty ? "fo-git-branch fo-git-branch-dirty" : "fo-git-branch"
            }
            aria-label={`Git branch ${gitBranch}${gitDirty ? " with changes" : ""}`}
            title={`Git branch ${gitBranch}${gitDirty ? " with changes" : ""}`}
          >
            <span className="fo-git-branch-mark" aria-hidden="true">
              git
            </span>
            <span className="fo-git-branch-name">{gitBranch}</span>
          </span>
        ) : null}
      </div>
    </header>
  );
}

function locationTargetIcon(target: PaneLocationTarget) {
  if (target.kind === "network" || target.kind === "networkRoot") {
    return Icons.server();
  }
  if (target.kind === "volume") {
    return Icons.volume();
  }
  if (target.kind === "favorite") {
    return Icons.pin();
  }
  if (target.kind === "starred") {
    return Icons.star();
  }
  if (target.kind === "recent") {
    return Icons.recent();
  }
  return Icons.folder();
}
