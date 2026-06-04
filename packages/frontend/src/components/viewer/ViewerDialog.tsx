import { useEffect, useMemo, useState } from "react";
import type { FileEntryDto, FsClient } from "@fileoctopus/ts-api";
import { detectViewerMode, type ViewerMode } from "./detectViewerMode";
import { ViewerTextMode } from "./ViewerTextMode";
import { ViewerHexMode } from "./ViewerHexMode";
import { ViewerImageMode } from "./ViewerImageMode";
import { ViewerMediaMode } from "./ViewerMediaMode";
import { ViewerPdfMode } from "./ViewerPdfMode";

interface ViewerDialogProps {
  open: boolean;
  entry: FileEntryDto | null;
  fs: FsClient;
  onClose: () => void;
  siblings?: FileEntryDto[];
  onNavigate?: (entry: FileEntryDto) => void;
}

export function ViewerDialog({
  open,
  entry,
  fs,
  onClose,
  siblings,
  onNavigate,
}: ViewerDialogProps) {
  const initialMode = useMemo(() => detectViewerMode(entry), [entry]);
  const [mode, setMode] = useState<ViewerMode>(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open, onClose]);

  // Gallery navigation helpers
  const currentIndex = useMemo(() => {
    if (!entry || !siblings) return -1;
    return siblings.findIndex((s) => s.uri === entry.uri);
  }, [entry, siblings]);

  const hasPrev = currentIndex > 0;
  const hasNext =
    siblings && currentIndex >= 0 && currentIndex < siblings.length - 1;

  if (!open || !entry) return null;

  return (
    <div
      className="fo-viewer-backdrop"
      role="dialog"
      aria-label="File viewer"
      aria-modal="true"
    >
      <div className="fo-viewer-modal">
        <ViewerContent
          entry={entry}
          fs={fs}
          mode={mode}
          onModeChange={setMode}
          onClose={onClose}
          siblings={siblings}
          currentIndex={currentIndex}
          hasPrev={hasPrev}
          hasNext={Boolean(hasNext)}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
}

interface ViewerContentProps {
  entry: FileEntryDto;
  fs: FsClient;
  mode: ViewerMode;
  onModeChange: (mode: ViewerMode) => void;
  onClose?: () => void;
  siblings?: FileEntryDto[];
  currentIndex?: number;
  hasPrev?: boolean;
  hasNext?: boolean;
  onNavigate?: (entry: FileEntryDto) => void;
}

export function ViewerContent({
  entry,
  fs,
  mode,
  onModeChange,
  onClose,
  siblings,
  currentIndex = -1,
  hasPrev = false,
  hasNext = false,
  onNavigate,
}: ViewerContentProps) {
  return (
    <>
      <div className="fo-viewer-header">
        <span className="fo-viewer-title">{entry.name}</span>
        <div className="fo-viewer-modes" role="tablist">
          <button
            role="tab"
            aria-selected={mode === "text"}
            onClick={() => onModeChange("text")}
            className="fo-viewer-mode-tab"
          >
            Text
          </button>
          <button
            role="tab"
            aria-selected={mode === "hex"}
            onClick={() => onModeChange("hex")}
            className="fo-viewer-mode-tab"
          >
            Hex
          </button>
          <button
            role="tab"
            aria-selected={mode === "pdf"}
            onClick={() => onModeChange("pdf")}
            className="fo-viewer-mode-tab"
          >
            PDF
          </button>
          <button
            role="tab"
            aria-selected={mode === "image"}
            onClick={() => onModeChange("image")}
            className="fo-viewer-mode-tab"
          >
            Image
          </button>
          <button
            role="tab"
            aria-selected={mode === "media"}
            onClick={() => onModeChange("media")}
            className="fo-viewer-mode-tab"
          >
            Media
          </button>
        </div>
        {siblings && siblings.length > 1 && (
          <div className="fo-viewer-gallery-nav">
            <button
              className="fo-viewer-nav-btn"
              aria-label="Previous image"
              disabled={!hasPrev}
              onClick={() => {
                if (hasPrev && onNavigate) {
                  onNavigate(siblings[currentIndex - 1]);
                }
              }}
            >
              ‹
            </button>
            <span className="fo-viewer-gallery-counter">
              {currentIndex + 1} / {siblings.length}
            </span>
            <button
              className="fo-viewer-nav-btn"
              aria-label="Next image"
              disabled={!hasNext}
              onClick={() => {
                if (hasNext && onNavigate) {
                  onNavigate(siblings[currentIndex + 1]);
                }
              }}
            >
              ›
            </button>
          </div>
        )}
        {onClose ? (
          <button
            className="fo-viewer-close"
            onClick={onClose}
            title="Close viewer (Esc)"
            aria-label="Close viewer"
          >
            ✕
          </button>
        ) : null}
      </div>
      <div className="fo-viewer-body" data-mode={mode}>
        <ViewerBody mode={mode} entry={entry} fs={fs} />
      </div>
    </>
  );
}

function ViewerBody({
  mode,
  entry,
  fs,
}: {
  mode: ViewerMode;
  entry: FileEntryDto;
  fs: FsClient;
}) {
  if (mode === "text") return <ViewerTextMode entry={entry} fs={fs} />;
  if (mode === "hex") return <ViewerHexMode entry={entry} fs={fs} />;
  if (mode === "pdf") return <ViewerPdfMode entry={entry} fs={fs} />;
  if (mode === "image") return <ViewerImageMode entry={entry} fs={fs} />;
  if (mode === "media") return <ViewerMediaMode entry={entry} fs={fs} />;
  return null;
}
