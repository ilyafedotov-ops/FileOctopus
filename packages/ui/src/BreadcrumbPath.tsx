import { useState } from "react";
import { Button } from "./Button";
import { DropdownMenu, type DropdownMenuItem } from "./DropdownMenu";
import { Icons } from "./icons";

export interface BreadcrumbSegment {
  label: string;
  path: string;
}

export interface BreadcrumbPathProps {
  segments: BreadcrumbSegment[];
  onNavigate: (path: string) => void;
  onEditPath: () => void;
  onSegmentContextMenu?: (
    segment: BreadcrumbSegment,
    event: React.MouseEvent,
  ) => void;
  maxVisible?: number;
}

export function BreadcrumbPath({
  segments,
  onNavigate,
  onEditPath,
  onSegmentContextMenu,
  maxVisible,
}: BreadcrumbPathProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);

  const needsOverflow =
    maxVisible !== undefined && maxVisible >= 2 && segments.length > maxVisible;

  const visibleSegments = needsOverflow
    ? [segments[0], segments[segments.length - 1]]
    : segments;

  const hiddenSegments = needsOverflow
    ? segments.slice(1, segments.length - 1)
    : [];

  const overflowItems: DropdownMenuItem[] = hiddenSegments.map((seg) => ({
    id: seg.path,
    label: seg.label,
    onSelect: () => {
      setOverflowOpen(false);
      onNavigate(seg.path);
    },
  }));

  return (
    <div className="fo-breadcrumb">
      <div className="fo-breadcrumb-segments">
        <Button
          key={visibleSegments[0].path}
          type="button"
          variant="ghost"
          size="sm"
          title={visibleSegments[0].path}
          onClick={() => onNavigate(visibleSegments[0].path)}
          onContextMenu={
            onSegmentContextMenu
              ? (e) => onSegmentContextMenu(visibleSegments[0], e)
              : undefined
          }
        >
          {visibleSegments[0].label}
        </Button>

        {needsOverflow ? (
          <DropdownMenu
            label="…"
            open={overflowOpen}
            items={overflowItems}
            onOpenChange={setOverflowOpen}
            triggerClassName="fo-breadcrumb-overflow"
            triggerAriaLabel="More path segments"
            align="start"
          >
            {Icons.more()}
          </DropdownMenu>
        ) : null}

        {visibleSegments.length > 1
          ? visibleSegments.slice(1).map((segment) => (
              <Button
                key={segment.path}
                type="button"
                variant="ghost"
                size="sm"
                className="fo-breadcrumb-current"
                title={segment.path}
                onClick={() => onNavigate(segment.path)}
                onContextMenu={
                  onSegmentContextMenu
                    ? (e) => onSegmentContextMenu(segment, e)
                    : undefined
                }
              >
                {segment.label}
              </Button>
            ))
          : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="fo-breadcrumb-edit"
        aria-label="Edit current path"
        onClick={onEditPath}
      >
        {Icons.pencil()}
        <span>Edit</span>
      </Button>
    </div>
  );
}
