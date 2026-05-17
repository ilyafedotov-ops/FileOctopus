import { Button } from "./Button";
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
}

export function BreadcrumbPath({
  segments,
  onNavigate,
  onEditPath,
  onSegmentContextMenu,
}: BreadcrumbPathProps) {
  return (
    <div className="fo-breadcrumb">
      <div className="fo-breadcrumb-segments">
        {segments.map((segment, index) => (
          <Button
            key={segment.path}
            type="button"
            variant="ghost"
            size="sm"
            className={
              index === segments.length - 1
                ? "fo-breadcrumb-current"
                : undefined
            }
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
        ))}
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
