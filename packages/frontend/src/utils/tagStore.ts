export type TagColor =
  | "red"
  | "orange"
  | "amber"
  | "yellow"
  | "green"
  | "teal"
  | "blue"
  | "indigo"
  | "violet"
  | "pink";

export const tagColorValues: TagColor[] = [
  "red",
  "orange",
  "amber",
  "yellow",
  "green",
  "teal",
  "blue",
  "indigo",
  "violet",
  "pink",
];

export interface FileTag {
  uri: string;
  color: TagColor;
  label: string;
}

export function isValidTagColor(color: string): color is TagColor {
  return tagColorValues.indexOf(color as TagColor) !== -1;
}

export function addTagToEntry(tags: FileTag[], tag: FileTag): FileTag[] {
  const exists = tags.some((t) => t.uri === tag.uri && t.color === tag.color);
  if (exists) {
    return tags;
  }
  return [...tags, tag];
}

export function removeTagFromEntry(
  tags: FileTag[],
  uri: string,
  color: TagColor,
): FileTag[] {
  return tags.filter((t) => !(t.uri === uri && t.color === color));
}

export function getTagColorsForEntry(tags: FileTag[], uri: string): TagColor[] {
  return tags.filter((t) => t.uri === uri).map((t) => t.color);
}

export function getEntriesWithTag(tags: FileTag[], color: TagColor): string[] {
  return tags.filter((t) => t.color === color).map((t) => t.uri);
}

const STORAGE_KEY = "fo-file-tags";

export function loadTags(): FileTag[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t: unknown) =>
        typeof t === "object" &&
        t !== null &&
        typeof (t as FileTag).uri === "string" &&
        isValidTagColor((t as FileTag).color) &&
        typeof (t as FileTag).label === "string",
    );
  } catch {
    return [];
  }
}

export function saveTags(tags: FileTag[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tags));
}
