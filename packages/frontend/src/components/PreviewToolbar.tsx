import { useState } from "react";
import {
  DropdownMenu,
  IconButton,
  Icons,
  type DropdownMenuItem,
} from "@fileoctopus/ui";

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
  onReveal?: () => void;
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
  onReveal,
}: PreviewToolbarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreItems: DropdownMenuItem[] = [
    {
      id: "copy-content",
      label: "Copy Content",
      disabled: !onCopyContent,
      onSelect: () => onCopyContent?.(),
    },
    {
      id: "copy-path",
      label: "Copy Path",
      disabled: !onCopyPath,
      onSelect: () => onCopyPath?.(),
    },
    {
      id: "open-externally",
      label: "Open Externally",
      separatorBefore: true,
      disabled: !onOpenExternally,
      onSelect: () => onOpenExternally?.(),
    },
    {
      id: "reveal",
      label: "Reveal in File Manager",
      disabled: !onReveal,
      onSelect: () => onReveal?.(),
    },
  ];

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
      {onCopyPath && (
        <IconButton size="sm" label="Copy path" onClick={onCopyPath}>
          {Icons.copy()}
        </IconButton>
      )}
      {onOpenExternally && (
        <IconButton
          size="sm"
          label="Open externally"
          onClick={onOpenExternally}
        >
          {Icons.externalLink()}
        </IconButton>
      )}
      <DropdownMenu
        label="More"
        open={moreOpen}
        items={moreItems}
        onOpenChange={setMoreOpen}
        triggerAriaLabel="More preview actions"
      >
        {Icons.more()}
      </DropdownMenu>
    </div>
  );
}
