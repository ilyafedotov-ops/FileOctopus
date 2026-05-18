export type ColumnId = "name" | "extension" | "size" | "modified" | "kind";

export type ColumnWidths = Record<ColumnId, number>;

export const COLUMN_ORDER: readonly ColumnId[] = [
  "name",
  "extension",
  "size",
  "modified",
  "kind",
] as const;

export const DEFAULT_COLUMN_WIDTHS: ColumnWidths = {
  name: 220,
  extension: 52,
  size: 78,
  modified: 126,
  kind: 110,
};

const MIN_WIDTHS: ColumnWidths = {
  name: 80,
  extension: 30,
  size: 30,
  modified: 30,
  kind: 30,
};

const STORAGE_KEY = "fileoctopus.columnWidths";

export function buildGridTemplate(widths: ColumnWidths): string {
  return COLUMN_ORDER.map((id) => {
    const w = widths[id];
    return id === "name" ? `minmax(${w}px, 1fr)` : `${w}px`;
  }).join(" ");
}

export function buildHeaderGridTemplate(widths: ColumnWidths): string {
  const parts: string[] = [];
  for (let i = 0; i < COLUMN_ORDER.length; i++) {
    const id = COLUMN_ORDER[i];
    const w = widths[id];
    parts.push(id === "name" ? `minmax(${w}px, 1fr)` : `${w}px`);
    if (i < COLUMN_ORDER.length - 1) {
      parts.push("5px");
    }
  }
  return parts.join(" ");
}

export function storedColumnWidths(): ColumnWidths {
  const raw = readStorage(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_COLUMN_WIDTHS };

  try {
    const parsed = JSON.parse(raw) as Partial<ColumnWidths>;
    if (!isValidWidths(parsed)) return { ...DEFAULT_COLUMN_WIDTHS };
    return clampWidths(parsed as ColumnWidths);
  } catch {
    return { ...DEFAULT_COLUMN_WIDTHS };
  }
}

export function persistColumnWidths(widths: ColumnWidths): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
  } catch {
    // quota or security errors — silently ignore
  }
}

function isValidWidths(value: Partial<ColumnWidths>): boolean {
  for (const id of COLUMN_ORDER) {
    if (typeof (value as Record<string, unknown>)[id] !== "number") {
      return false;
    }
  }
  return true;
}

function clampWidths(widths: ColumnWidths): ColumnWidths {
  const result: ColumnWidths = { ...DEFAULT_COLUMN_WIDTHS };
  for (const id of COLUMN_ORDER) {
    const min = MIN_WIDTHS[id];
    result[id] = Math.max(min, widths[id]);
  }
  return result;
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
