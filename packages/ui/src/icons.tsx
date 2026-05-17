import type { LucideIcon } from "lucide-react";
import {
  ArrowRightLeft,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Ellipsis,
  File,
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  HardDrive,
  Home,
  Image,
  Monitor,
  Music,
  Pencil,
  Pin,
  RefreshCw,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";

export const iconSize: string | number = "var(--fo-icon-size)";

export function renderIcon(Icon: LucideIcon, className?: string): ReactNode {
  return (
    <Icon
      size={iconSize}
      strokeWidth={1.75}
      className={className}
      aria-hidden
    />
  );
}

export const Icons = {
  chevronLeft: () => renderIcon(ChevronLeft, "fo-ui-icon"),
  chevronRight: () => renderIcon(ChevronRight, "fo-ui-icon"),
  chevronDown: () => renderIcon(ChevronDown, "fo-ui-icon"),
  arrowUp: () => renderIcon(ArrowUp, "fo-ui-icon"),
  folderPlus: () => renderIcon(FolderPlus, "fo-ui-icon"),
  filePlus: () => renderIcon(FilePlus, "fo-ui-icon"),
  pencil: () => renderIcon(Pencil, "fo-ui-icon"),
  copy: () => renderIcon(Copy, "fo-ui-icon"),
  move: () => renderIcon(ArrowRightLeft, "fo-ui-icon"),
  trash: () => renderIcon(Trash2, "fo-ui-icon"),
  refresh: () => renderIcon(RefreshCw, "fo-ui-icon"),
  more: () => renderIcon(Ellipsis, "fo-ui-icon"),
  home: () => renderIcon(Home, "fo-ui-icon"),
  documents: () => renderIcon(FileText, "fo-ui-icon"),
  desktop: () => renderIcon(Monitor, "fo-ui-icon"),
  downloads: () => renderIcon(Download, "fo-ui-icon"),
  pictures: () => renderIcon(Image, "fo-ui-icon"),
  music: () => renderIcon(Music, "fo-ui-icon"),
  volume: () => renderIcon(HardDrive, "fo-ui-icon"),
  recent: () => renderIcon(Clock, "fo-ui-icon"),
  pin: () => renderIcon(Pin, "fo-ui-icon"),
  star: () => renderIcon(Star, "fo-ui-icon"),
  folder: () => renderIcon(Folder, "fo-ui-icon"),
  file: () => renderIcon(File, "fo-ui-icon"),
  search: () => renderIcon(Search, "fo-ui-icon"),
};

export function fileEntryIcon(
  entry: Pick<
    { kind: string; extension?: string | null; name: string },
    "kind" | "extension" | "name"
  >,
): ReactNode {
  if (entry.kind === "directory") {
    return Icons.folder();
  }

  const extension = (
    entry.extension ??
    entry.name.split(".").pop() ??
    ""
  ).toLowerCase();

  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension)) {
    return Icons.pictures();
  }

  if (["mp3", "wav", "flac", "aac"].includes(extension)) {
    return Icons.music();
  }

  if (["pdf", "doc", "docx", "txt", "md"].includes(extension)) {
    return Icons.documents();
  }

  return Icons.file();
}
