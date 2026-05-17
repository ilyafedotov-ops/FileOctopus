import type { MouseEvent } from "react";
import { PathBar } from "./PanePathBar";

interface PaneHeaderProps {
  title: string;
  active: boolean;
  uri: string;
  pathError: string | null;
  pathFocusToken: number;
  onNavigate: (uri: string) => void;
  onBreadcrumbContextMenu?: (path: string, event: MouseEvent) => void;
}

export function PaneHeader({
  title,
  active,
  uri,
  pathError,
  pathFocusToken,
  onNavigate,
  onBreadcrumbContextMenu,
}: PaneHeaderProps) {
  const locationName =
    uri
      .replace(/^local:\/\//, "")
      .split("/")
      .pop() || title;

  return (
    <header className="fo-panel-header">
      <div className="fo-panel-title-row">
        <span className="fo-pane-badge">{title}</span>
        {active ? (
          <span className="fo-pane-active-label" aria-label="Active pane">
            Active
          </span>
        ) : null}
        <span className="fo-pane-location-name" title={uri}>
          {locationName}
        </span>
        <PathBar
          value={uri}
          error={pathError}
          focusToken={pathFocusToken}
          onSubmit={onNavigate}
          onBreadcrumbContextMenu={onBreadcrumbContextMenu}
        />
      </div>
    </header>
  );
}
