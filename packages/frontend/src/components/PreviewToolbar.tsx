import { IconButton, Icons } from "@fileoctopus/ui";

interface PreviewToolbarProps {
  mode: "image" | "text" | "pdf" | "media" | "unknown";
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onActualSize: () => void;
  onCopyContent?: () => void;
  onOpenExternally?: () => void;
  onCopyPath?: () => void;
}

export function PreviewToolbar({
  mode,
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
  onActualSize,
  onCopyContent,
  onOpenExternally,
  onCopyPath,
}: PreviewToolbarProps) {
  return (
    <div
      className="fo-preview-toolbar"
      role="toolbar"
      aria-label="Preview controls"
    >
      {mode === "image" && (
        <>
          <IconButton size="sm" label="Zoom out" onClick={onZoomOut}>
            {Icons.minus()}
          </IconButton>
          <span className="fo-preview-zoom-label">
            {Math.round(zoom * 100)}%
          </span>
          <IconButton size="sm" label="Zoom in" onClick={onZoomIn}>
            {Icons.plus()}
          </IconButton>
          <IconButton size="sm" label="Fit to panel" onClick={onFit}>
            {Icons.maximize()}
          </IconButton>
          <IconButton size="sm" label="Actual size" onClick={onActualSize}>
            {Icons.actualSize()}
          </IconButton>
        </>
      )}
      {mode === "text" && onCopyContent && (
        <IconButton size="sm" label="Copy content" onClick={onCopyContent}>
          {Icons.clipboardCopy()}
        </IconButton>
      )}
      <span className="fo-preview-toolbar-spacer" />
      {onOpenExternally && (
        <IconButton
          size="sm"
          label="Open externally"
          onClick={onOpenExternally}
        >
          {Icons.externalLink()}
        </IconButton>
      )}
      {onCopyPath && (
        <IconButton size="sm" label="Copy path" onClick={onCopyPath}>
          {Icons.copy()}
        </IconButton>
      )}
    </div>
  );
}
