import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRightLeft,
  ArrowUp,
  Archive,
  Calculator,
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
  Hash,
  Home,
  Image,
  Info,
  LogOut,
  Maximize2,
  Minimize2,
  Monitor,
  Music,
  Pencil,
  Pin,
  RefreshCw,
  Search,
  Server,
  Settings,
  Star,
  Terminal,
  Trash2,
  Video,
  X,
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
  video: () => renderIcon(Video, "fo-ui-icon"),
  volume: () => renderIcon(HardDrive, "fo-ui-icon"),
  server: () => renderIcon(Server, "fo-ui-icon"),
  recent: () => renderIcon(Clock, "fo-ui-icon"),
  pin: () => renderIcon(Pin, "fo-ui-icon"),
  star: () => renderIcon(Star, "fo-ui-icon"),
  folder: () => renderIcon(Folder, "fo-ui-icon"),
  file: () => renderIcon(File, "fo-ui-icon"),
  search: () => renderIcon(Search, "fo-ui-icon"),
  activity: () => renderIcon(Activity, "fo-ui-icon"),
  info: () => renderIcon(Info, "fo-ui-icon"),
  settings: () => renderIcon(Settings, "fo-ui-icon"),
  logOut: () => renderIcon(LogOut, "fo-ui-icon"),
  maximize: () => renderIcon(Maximize2, "fo-ui-icon"),
  minimize: () => renderIcon(Minimize2, "fo-ui-icon"),
  archive: () => renderIcon(Archive, "fo-ui-icon"),
  calculator: () => renderIcon(Calculator, "fo-ui-icon"),
  hash: () => renderIcon(Hash, "fo-ui-icon"),
  terminal: () => renderIcon(Terminal, "fo-ui-icon"),
  x: () => renderIcon(X, "fo-ui-icon"),
};

function classicFolderIcon(): ReactNode {
  return (
    <svg
      viewBox="0 0 32 32"
      width={iconSize}
      height={iconSize}
      className="fo-ui-icon fo-classic-icon fo-classic-folder-icon"
      aria-hidden
    >
      <path fill="#0f172a" d="M3 9h10l3 3h13v15H3z" />
      <path fill="#d79a18" d="M4 8h9l3 3h12v3H4z" />
      <path fill="#f5c84b" d="M4 12h24v14H4z" />
      <path fill="#ffe28a" d="M6 14h20v3H6z" />
      <path fill="#7a520f" d="M3 8h10l3 3h13v16H3zm2 6v11h22V13H15l-3-3H5z" />
      <path fill="#2563eb" d="M5 25h22v2H5z" opacity="0.5" />
    </svg>
  );
}

function classicFileIcon(
  kind: "generic" | "document" | "image" | "audio",
): ReactNode {
  const detail =
    kind === "image" ? (
      <>
        <path fill="#37a169" d="M9 23l4-5 3 3 2-3 5 5z" />
        <rect width="3" height="3" x="18" y="13" fill="#2563eb" />
      </>
    ) : kind === "audio" ? (
      <>
        <path fill="#2563eb" d="M13 14h4v9h-4z" />
        <path fill="#2563eb" d="M16 14l6-2v4l-6 2z" />
        <circle cx="12" cy="23" r="3" fill="#2563eb" />
      </>
    ) : kind === "document" ? (
      <>
        <rect width="13" height="2" x="9" y="14" fill="#2563eb" />
        <rect width="13" height="2" x="9" y="18" fill="#2563eb" />
        <rect width="9" height="2" x="9" y="22" fill="#2563eb" />
      </>
    ) : (
      <rect width="11" height="2" x="9" y="19" fill="#94a3b8" />
    );

  return (
    <svg
      viewBox="0 0 32 32"
      width={iconSize}
      height={iconSize}
      className={`fo-ui-icon fo-classic-icon fo-classic-${kind}-icon`}
      aria-hidden
    >
      <path fill="#0f172a" d="M7 3h13l6 6v20H7z" />
      <path fill="#f8fafc" d="M8 2h12l6 6v20H8z" />
      <path fill="#dbeafe" d="M20 2v7h6z" />
      <path fill="#64748b" d="M7 2h13l7 7v20H7zm2 2v23h16V10h-6V4z" />
      {detail}
    </svg>
  );
}

function classicParentFolderIcon(): ReactNode {
  return (
    <svg
      viewBox="0 0 32 32"
      width={iconSize}
      height={iconSize}
      className="fo-ui-icon fo-classic-icon fo-classic-parent-folder-icon"
      aria-hidden
    >
      <path fill="#0f172a" d="M3 9h10l3 3h13v15H3z" />
      <path fill="#94a3b8" d="M4 8h9l3 3h12v3H4z" />
      <path fill="#cbd5e1" d="M4 12h24v14H4z" />
      <path fill="#64748b" d="M3 8h10l3 3h13v16H3zm2 6v11h22V13H15l-3-3H5z" />
      <path fill="#2563eb" d="M16 7l-4 4h3v6h2v-6h3z" />
    </svg>
  );
}

export function fileEntryIcon(
  entry: Pick<
    { kind: string; extension?: string | null; name: string },
    "kind" | "extension" | "name"
  >,
): ReactNode {
  if (entry.name === "..") {
    return classicParentFolderIcon();
  }

  if (entry.kind === "directory") {
    return classicFolderIcon();
  }

  const extension = (
    entry.extension ??
    entry.name.split(".").pop() ??
    ""
  ).toLowerCase();

  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension)) {
    return classicFileIcon("image");
  }

  if (["mp3", "wav", "flac", "aac"].includes(extension)) {
    return classicFileIcon("audio");
  }

  if (["pdf", "doc", "docx", "txt", "md"].includes(extension)) {
    return classicFileIcon("document");
  }

  return classicFileIcon("generic");
}
