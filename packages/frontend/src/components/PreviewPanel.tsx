import { useEffect, useState, useCallback } from "react";
import type { FsClient } from "@fileoctopus/ts-api";
import type { FileEntryDto } from "@fileoctopus/ts-api";
import {
  IPC_ERROR_CODES,
  isRemoteUri,
  normalizeIpcError,
} from "@fileoctopus/ts-api";
import { operationErrorMessage } from "../dialogs/OperationDialogView";

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

export function isMediaPreviewable(entry: FileEntryDto | null): boolean {
  if (!entry || entry.kind === "directory") return false;
  const ext = getExtension(entry.name);
  return MEDIA_EXTENSIONS.has(ext);
}

export function isPreviewable(entry: FileEntryDto | null): boolean {
  return (
    isTextPreviewable(entry) ||
    isImagePreviewable(entry) ||
    isMediaPreviewable(entry)
  );
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
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  const [mediaDataUri, setMediaDataUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [byteSize, setByteSize] = useState(0);

  const loadContent = useCallback(async () => {
    if (!entry) return;
    setLoading(true);
    setError(null);
    try {
      if (isImagePreviewable(entry)) {
        const resp = await fs.readImageAsDataUri({ uri: entry.uri });
        setImageDataUri(resp.dataUri);
        setByteSize(resp.byteSize);
      } else if (isMediaPreviewable(entry)) {
        const resp = await fs.readImageAsDataUri({ uri: entry.uri });
        setMediaDataUri(resp.dataUri);
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
    setImageDataUri(null);
    setMediaDataUri(null);
    setError(null);
    setTruncated(false);
    setByteSize(0);
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
  const isMedia = isMediaPreviewable(entry);

  const formatBytes = (b: number): string => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fo-preview-panel">
      <div className="fo-preview-header">
        <span className="fo-preview-title">{entry.name}</span>
        <span className="fo-preview-meta">
          {loading ? "Loading..." : error ? "Error" : formatBytes(byteSize)}
          {!isImage && !isMedia && truncated && " (truncated)"}
        </span>
        <button
          className="fo-preview-close"
          onClick={onClose}
          title="Close preview (Esc)"
        >
          ✕
        </button>
      </div>
      <div className="fo-preview-content">
        {loading && <div className="fo-preview-loading">Loading...</div>}
        {error && <div className="fo-preview-error">{error}</div>}
        {isImage && imageDataUri && !loading && (
          <img
            className="fo-preview-image"
            src={imageDataUri}
            alt={entry.name}
          />
        )}
        {isMedia && mediaDataUri && !loading && (
          <div className="fo-preview-media">
            {isAudioEntry(entry) ? (
              <audio
                className="fo-preview-audio"
                src={mediaDataUri}
                controls
                autoPlay
              />
            ) : (
              <video
                className="fo-preview-video"
                src={mediaDataUri}
                controls
                autoPlay
              />
            )}
          </div>
        )}
        {!isImage && !isMedia && textContent !== null && !loading && (
          <pre className="fo-preview-code">{textContent}</pre>
        )}
      </div>
    </div>
  );
}
