import type { MouseEvent } from "react";
import { PathBar } from "./PanePathBar";

interface PaneHeaderProps {
  uri: string;
  pathError: string | null;
  pathFocusToken: number;
  onNavigate: (uri: string) => void;
  onBreadcrumbContextMenu?: (path: string, event: MouseEvent) => void;
}

export function PaneHeader({
  uri,
  pathError,
  pathFocusToken,
  onNavigate,
  onBreadcrumbContextMenu,
}: PaneHeaderProps) {
  return (
    <header className="fo-panel-header">
      <div className="fo-panel-title-row">
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
