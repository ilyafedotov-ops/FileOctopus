import { open, save } from "@tauri-apps/plugin-dialog";
import type { FileEntryDto, FsClient } from "@fileoctopus/ts-api";

export interface LocalPathPickerFilter {
  name: string;
  extensions: string[];
}

export interface LocalPathPickerOptions {
  kind: "file" | "directory" | "save";
  title: string;
  currentPath?: string;
  filters?: LocalPathPickerFilter[];
}

export type LocalPathPicker = (
  options: LocalPathPickerOptions,
) => Promise<string | null>;

export const SSH_KEY_FILTERS: LocalPathPickerFilter[] = [
  { name: "SSH keys", extensions: ["pem", "key"] },
];

export const pickLocalPath: LocalPathPicker = async ({
  kind,
  title,
  currentPath,
  filters,
}) => {
  const defaultPath = currentPath?.trim() || undefined;
  try {
    if (kind === "save") {
      return await save({
        title,
        defaultPath,
        filters,
      });
    }

    const selected = await open({
      title,
      defaultPath,
      filters,
      multiple: false,
      directory: kind === "directory",
    });

    return typeof selected === "string" ? selected : null;
  } catch {
    return null;
  }
};

export function localPathToResourceUri(path: string): string {
  const trimmed = path.trim();
  if (trimmed.includes("://")) return trimmed;
  if (trimmed.startsWith("/")) return `local://${trimmed}`;
  if (/^[A-Za-z]:[\\/]/.test(trimmed)) {
    return `local://${trimmed.replace(/\\/g, "/")}`;
  }
  return `local://${trimmed}`;
}

export async function pickLocalFileEntry({
  fs,
  title,
  currentPath,
  pickLocalPath: picker = pickLocalPath,
}: {
  fs: FsClient;
  title: string;
  currentPath?: string;
  pickLocalPath?: LocalPathPicker;
}): Promise<FileEntryDto | null> {
  const selected = await picker({ kind: "file", title, currentPath });
  if (!selected) return null;
  const uri = localPathToResourceUri(selected);
  const response = await fs.stat({ uri });
  if (response.entry.kind === "directory") {
    throw new Error("Choose a file, not a folder.");
  }
  return response.entry;
}
