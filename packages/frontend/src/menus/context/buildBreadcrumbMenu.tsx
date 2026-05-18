import type { ReactNode } from "react";
import type { PanelId } from "../../panelStore";
import { ContextMenuItem, ContextMenuSeparator } from "./ContextMenuPrimitives";

interface BreadcrumbMenuParams {
  panelId: PanelId;
  breadcrumbPath: string;
  run: (action: () => void) => void;
  onNavigateTo: (panelId: PanelId, uri: string) => void;
  onNavigateOtherPane: (uri: string) => void;
  onCopyBreadcrumbPath: (path: string) => void;
  onRevealBreadcrumb: (path: string) => void;
  onAddFavorite: (uri: string) => void;
}

export function buildBreadcrumbMenu({
  panelId,
  breadcrumbPath,
  run,
  onNavigateTo,
  onNavigateOtherPane,
  onCopyBreadcrumbPath,
  onRevealBreadcrumb,
  onAddFavorite,
}: BreadcrumbMenuParams): ReactNode {
  return (
    <>
      <ContextMenuItem
        onClick={() => run(() => onNavigateTo(panelId, breadcrumbPath))}
      >
        Open This Location
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => run(() => onNavigateOtherPane(breadcrumbPath))}
      >
        Open in Other Pane
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={() => run(() => onCopyBreadcrumbPath(breadcrumbPath))}
      >
        Copy Path
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => run(() => onRevealBreadcrumb(breadcrumbPath))}
      >
        Reveal in File Manager
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => run(() => onAddFavorite(breadcrumbPath))}>
        Add to Favorites
      </ContextMenuItem>
    </>
  );
}
