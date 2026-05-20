import type { FileEntryDto } from "@fileoctopus/ts-api";
import { isImagePreviewable, isTextPreviewable } from "../PreviewPanel";

export type ViewerMode = "text" | "hex" | "image";

export function detectViewerMode(entry: FileEntryDto | null): ViewerMode {
  if (!entry) return "text";
  if (isImagePreviewable(entry)) return "image";
  if (isTextPreviewable(entry)) return "text";
  return "hex";
}
