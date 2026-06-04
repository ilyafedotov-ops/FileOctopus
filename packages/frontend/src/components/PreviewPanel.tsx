import { useEffect, useState, useCallback } from "react";
import type { FsClient } from "@fileoctopus/ts-api";
import type { FileEntryDto } from "@fileoctopus/ts-api";
import {
  IPC_ERROR_CODES,
  isRemoteUri,
  normalizeIpcError,
} from "@fileoctopus/ts-api";
import { operationErrorMessage } from "../dialogs/OperationDialogView";
import { PreviewToolbar } from "./PreviewToolbar";

/** Extensions considered safe for text preview */
const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".xml",
  ".csv",
  ".tsv",
  ".log",
  ".ini",
  ".cfg",
  ".conf",
  ".env",
  ".sh",
  ".bash",
  ".zsh",
  ".js",
  ".ts",
  ".tsx",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".rb",
  ".rs",
  ".go",
  ".java",
  ".kt",
  ".scala",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".swift",
  ".sql",
  ".graphql",
  ".proto",
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".less",
  ".svg",
  ".dockerfile",
  ".makefile",
  ".cmake",
  ".gitignore",
  ".gitattributes",
  ".editorconfig",
  ".lock",
  ".map",
]);

/** Extensions considered safe for image preview */
const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".webp",
  ".ico",
]);

const PDF_EXTENSIONS = new Set([".pdf"]);

/** Extensions for audio/video media preview */
const MEDIA_EXTENSIONS = new Set([
  ".mp3",
  ".ogg",
  ".wav",
  ".flac",
  ".aac",
  ".m4a",
  ".wma",
  ".opus",
  ".oga",
  ".mp4",
  ".webm",
  ".mkv",
  ".avi",
  ".mov",
  ".m4v",
  ".wmv",
  ".mpg",
  ".mpeg",
  ".3gp",
]);

const MAX_PREVIEW_BYTES = 512 * 1024; // 512 KB
const MAX_DATA_URI_PREVIEW_BYTES = 20 * 1024 * 1024; // 20 MB

function getExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

export function isTextPreviewable(entry: FileEntryDto | null): boolean {
  if (!entry || entry.kind === "directory") return false;
  const ext = getExtension(entry.name);
  if (TEXT_EXTENSIONS.has(ext)) return true;
  // Files without extension but common names
  const lower = entry.name.toLowerCase();
  if (
    [
      "makefile",
      "dockerfile",
      "readme",
      "license",
      "changelog",
      ".gitignore",
    ].includes(lower)
  )
    return true;
  // Small dotfiles
  if (lower.startsWith(".") && lower.length < 20 && !ext) return true;
  return false;
}

export function isImagePreviewable(entry: FileEntryDto | null): boolean {
  if (!entry || entry.kind === "directory") return false;
  const ext = getExtension(entry.name);
  return IMAGE_EXTENSIONS.has(ext);
}

export function isPdfPreviewable(entry: FileEntryDto | null): boolean {
  if (!entry || entry.kind === "directory") return false;
  const ext = getExtension(entry.name);
  return PDF_EXTENSIONS.has(ext);
}

export function isMediaPreviewable(entry: FileEntryDto | null): boolean {
  if (!entry || entry.kind === "directory") return false;
  const ext = getExtension(entry.name);
  return MEDIA_EXTENSIONS.has(ext);
}

export function isPreviewable(entry: FileEntryDto | null): boolean {
  return (
    isTextPreviewable(entry) ||
    isPdfPreviewable(entry) ||
    isImagePreviewable(entry) ||
    isMediaPreviewable(entry)
  );
}

type PreviewMode = "image" | "text" | "pdf" | "media" | "unknown";

function getPreviewMode(entry: FileEntryDto): PreviewMode {
  if (isImagePreviewable(entry)) return "image";
  if (isPdfPreviewable(entry)) return "pdf";
  if (isMediaPreviewable(entry)) return "media";
  if (isTextPreviewable(entry)) return "text";
  return "unknown";
}

interface PreviewPanelProps {
  entry: FileEntryDto | null;
  fs: FsClient;
  onClose: () => void;
}

const AUDIO_EXTENSIONS_SET = new Set([
  ".mp3",
  ".ogg",
  ".wav",
  ".flac",
  ".aac",
  ".m4a",
  ".wma",
  ".opus",
  ".oga",
]);

function isAudioEntry(entry: FileEntryDto): boolean {
  const dot = entry.name.lastIndexOf(".");
  const ext = dot >= 0 ? entry.name.slice(dot).toLowerCase() : "";
  return AUDIO_EXTENSIONS_SET.has(ext);
}

export function PreviewPanel({ entry, fs, onClose }: PreviewPanelProps) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [binaryDataUri, setBinaryDataUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [byteSize, setByteSize] = useState(0);
  const [zoom, setZoom] = useState(1);

  const loadContent = useCallback(async () => {
    if (!entry) return;
    setLoading(true);
    setError(null);
    try {
      if (
        isImagePreviewable(entry) ||
        isPdfPreviewable(entry) ||
        isMediaPreviewable(entry)
      ) {
        const resp = await fs.readFileAsDataUri({
          uri: entry.uri,
          maxBytes: MAX_DATA_URI_PREVIEW_BYTES,
        });
        setBinaryDataUri(resp.dataUri);
        setByteSize(resp.byteSize);
      } else {
        const resp = await fs.readTextFile({
          uri: entry.uri,
          maxBytes: MAX_PREVIEW_BYTES,
        });
        setTextContent(resp.content);
        setTruncated(resp.truncated);
        setByteSize(resp.byteSize);
      }
    } catch (err) {
      const normalized = normalizeIpcError(err);
      if (
        normalized.code === IPC_ERROR_CODES.UNSUPPORTED_PROVIDER &&
        isRemoteUri(entry.uri)
      ) {
        setError(`Cannot read this remote file: ${normalized.message}`);
      } else {
        setError(operationErrorMessage(normalized.code, normalized.message));
      }
    } finally {
      setLoading(false);
    }
  }, [entry, fs]);

  useEffect(() => {
    setTextContent(null);
    setBinaryDataUri(null);
    setError(null);
    setTruncated(false);
    setByteSize(0);
    setZoom(1);
    if (entry && isPreviewable(entry)) {
      void loadContent();
    }
  }, [entry, loadContent]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [onClose]);

  if (!entry) return null;
  if (!isPreviewable(entry)) return null;

  const isImage = isImagePreviewable(entry);
  const isPdf = isPdfPreviewable(entry);
  const isMedia = isMediaPreviewable(entry);
  const mode = getPreviewMode(entry);

  const formatBytes = (b: number): string => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z * 1.25, 10));
  const handleZoomOut = () => setZoom((z) => Math.max(z * 0.75, 0.1));
  const handleFit = () => setZoom(1);
  const handleActualSize = () => setZoom(1);

  const handleCopyContent = async () => {
    if (textContent == null) return;
    try {
      await navigator.clipboard.writeText(textContent);
    } catch {
      // Silently ignore clipboard errors
    }
  };

  const handleOpenExternally = () => {
    // TODO: integrate with Tauri shell.open(path) when available
  };

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(entry.uri);
    } catch {
      // Silently ignore clipboard errors
    }
  };

  return (
    <div className="fo-preview-panel">
      <div className="fo-preview-header">
        <span className="fo-preview-title">{entry.name}</span>
        <span className="fo-preview-meta">
          {loading ? "Loading..." : error ? "Error" : formatBytes(byteSize)}
          {!isImage && !isPdf && !isMedia && truncated && " (truncated)"}
        </span>
        <button
          className="fo-preview-close"
          onClick={onClose}
          title="Close preview (Esc)"
        >
          ✕
        </button>
      </div>
      <PreviewToolbar
        mode={mode}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFit={handleFit}
        onActualSize={handleActualSize}
        onCopyContent={handleCopyContent}
        onOpenExternally={handleOpenExternally}
        onCopyPath={handleCopyPath}
      />
      <div className="fo-preview-content">
        {loading && <div className="fo-preview-loading">Loading...</div>}
        {error && <div className="fo-preview-error">{error}</div>}
        {isImage && binaryDataUri && !loading && (
          <img
            className="fo-preview-image"
            src={binaryDataUri}
            alt={entry.name}
            style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
          />
        )}
        {isPdf && binaryDataUri && !loading && (
          <object
            className="fo-preview-pdf"
            data={binaryDataUri}
            type="application/pdf"
            title="PDF preview"
          />
        )}
        {isMedia && binaryDataUri && !loading && (
          <div className="fo-preview-media">
            {isAudioEntry(entry) ? (
              <audio
                className="fo-preview-audio"
                src={binaryDataUri}
                controls
                autoPlay
              />
            ) : (
              <video
                className="fo-preview-video"
                src={binaryDataUri}
                controls
                autoPlay
              />
            )}
          </div>
        )}
        {!isImage && !isPdf && !isMedia && textContent !== null && !loading && (
          <pre className="fo-preview-code">{textContent}</pre>
        )}
      </div>
    </div>
  );
}
