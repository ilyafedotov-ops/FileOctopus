import type { SortState } from "./panelStore";

export function storedShowHidden(): boolean {
  return readValue("fileoctopus.showHidden") === "true";
}

export function storedSort(): SortState {
  const value = readJson<Partial<SortState>>("fileoctopus.sort");
  const field = value?.field;
  const direction = value?.direction;

  return {
    field:
      field === "type" ||
      field === "size" ||
      field === "modified" ||
      field === "created" ||
      field === "extension" ||
      field === "permissions" ||
      field === "owner"
        ? field
        : "name",
    direction: direction === "desc" ? "desc" : "asc",
    directoriesFirst: true,
  };
}

function readValue(key: string): string | null {
  const storage = globalThis.localStorage;

  return storage && typeof storage.getItem === "function"
    ? storage.getItem(key)
    : null;
}

function readJson<T>(key: string): T | null {
  const value = readValue(key);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function homeUri(): string {
  const home = readValue("fileoctopus.homeUri");

  if (home) return home;

  const platform = typeof navigator !== "undefined" ? navigator.platform : "";
  if (platform.startsWith("Win")) {
    return "local://C:/";
  }
  return "local:///";
}

export function documentsUri(): string {
  const home = homeUri();
  return home.endsWith("/") ? home : `${home}/Documents`;
}
