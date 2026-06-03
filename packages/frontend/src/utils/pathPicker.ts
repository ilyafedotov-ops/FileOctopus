import { open, save } from "@tauri-apps/plugin-dialog";

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
