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
  onOpenProfileTerminal?: (
    profile: import("@fileoctopus/ts-api").NetworkProfileDto,
  ) => void;
  onAddServer?: () => void;
  onActivate?: () => void;
  onBreadcrumbContextMenu?: (path: string, event: MouseEvent) => void;
  gitBranch?: string | null;
  gitDirty?: boolean;
  onOpenGitReview?: () => void;
  locationTargets?: PaneLocationTarget[];
}

export function PaneHeader({
  uri,
  pathError,
  pathFocusToken,
  onNavigate,
  onOpenProfileTerminal,
  onAddServer,
  onActivate,
  onBreadcrumbContextMenu,
  gitBranch,
  gitDirty = false,
  onOpenGitReview,
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
          if (target.action.type === "openTerminal") {
            onOpenProfileTerminal?.(target.action.profile);
            return;
          }
          if (target.action.type === "addServer") {
            onAddServer?.();
            return;
          }
          onNavigate(target.action.uri);
        },
      })),
    [
      activeLocation?.uri,
      locationTargets,
      onActivate,
      onAddServer,
      onNavigate,
      onOpenProfileTerminal,
    ],
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
          <button
            type="button"
            onClick={onOpenGitReview}
            className={
              gitDirty ? "fo-git-branch fo-git-branch-dirty" : "fo-git-branch"
            }
            aria-label={`Git branch ${gitBranch}${gitDirty ? " with changes" : ""}`}
            title={`Review Git changes for ${gitBranch}`}
          >
            <span className="fo-git-branch-mark" aria-hidden="true">
              git
            </span>
            <span className="fo-git-branch-name">{gitBranch}</span>
          </button>
        ) : null}
      </div>
    </header>
  );
}

function locationTargetIcon(target: PaneLocationTarget) {
  if (
    target.kind === "network" ||
    target.kind === "networkRoot" ||
    target.kind === "addServer"
  ) {
    return Icons.server();
  }
  if (target.kind === "cloud") {
    return Icons.folder();
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
