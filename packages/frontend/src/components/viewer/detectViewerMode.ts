import type { FileEntryDto } from "@fileoctopus/ts-api";
import { isImagePreviewable, isTextPreviewable } from "../PreviewPanel";

export type ViewerMode = "text" | "hex" | "image" | "media";

const AUDIO_EXTENSIONS = new Set([
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

const VIDEO_EXTENSIONS = new Set([
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

function getExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

export function isMediaPreviewable(entry: FileEntryDto | null): boolean {
  if (!entry || entry.kind === "directory") return false;
  const ext = getExtension(entry.name);
  return AUDIO_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext);
}

export function isAudioEntry(entry: FileEntryDto): boolean {
  const ext = getExtension(entry.name);
  return AUDIO_EXTENSIONS.has(ext);
}

export function detectViewerMode(entry: FileEntryDto | null): ViewerMode {
  if (!entry) return "text";
  if (isImagePreviewable(entry)) return "image";
  if (isMediaPreviewable(entry)) return "media";
  if (isTextPreviewable(entry)) return "text";
  return "hex";
}
