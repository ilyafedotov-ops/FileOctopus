export type ColumnId = "name" | "extension" | "size" | "modified" | "kind";

export type ColumnWidths = Record<ColumnId, number>;

export type VisibleColumns = ColumnId[];

export const COLUMN_ORDER: readonly ColumnId[] = [
  "name",
  "extension",
  "size",
  "modified",
  "kind",
] as const;

export const ALL_COLUMNS: readonly ColumnId[] = COLUMN_ORDER;

export const DEFAULT_COLUMN_WIDTHS: ColumnWidths = {
  name: 220,
  extension: 52,
  size: 78,
  modified: 126,
  kind: 110,
};

export const DEFAULT_VISIBLE_COLUMNS: VisibleColumns = [
  "name",
  "extension",
  "size",
  "modified",
  "kind",
];

const MIN_WIDTHS: ColumnWidths = {
  name: 80,
  extension: 30,
  size: 30,
  modified: 30,
  kind: 30,
};

const STORAGE_KEY = "fileoctopus.columnWidths";
const VISIBLE_STORAGE_KEY = "fileoctopus.visibleColumns";

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

export function buildVisibleGridTemplate(
  widths: ColumnWidths,
  visible: VisibleColumns,
): string {
  // Use the visible array order directly (supports user-defined column reorder)
  const ordered = visible.filter((id) => COLUMN_ORDER.indexOf(id) !== -1);
  return ordered
    .map((id) => {
      const w = widths[id];
      return id === "name" ? `minmax(${w}px, 1fr)` : `${w}px`;
    })
    .join(" ");
}

export function buildVisibleHeaderGridTemplate(
  widths: ColumnWidths,
  visible: VisibleColumns,
): string {
  // Use the visible array order directly (supports user-defined column reorder)
  const ordered = visible.filter((id) => COLUMN_ORDER.indexOf(id) !== -1);
  const parts: string[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const id = ordered[i];
    const w = widths[id];
    parts.push(id === "name" ? `minmax(${w}px, 1fr)` : `${w}px`);
    if (i < ordered.length - 1) {
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

export function isValidVisibleColumns(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return false;
  if (value.indexOf("name") === -1) return false;
  for (const id of value) {
    if (COLUMN_ORDER.indexOf(id as ColumnId) === -1) return false;
  }
  return true;
}

export function storedVisibleColumns(): VisibleColumns {
  const raw = readStorage(VISIBLE_STORAGE_KEY);
  if (!raw) return [...DEFAULT_VISIBLE_COLUMNS];

  try {
    const parsed = JSON.parse(raw);
    if (!isValidVisibleColumns(parsed)) return [...DEFAULT_VISIBLE_COLUMNS];
    const cols = parsed as VisibleColumns;
    // Ensure name is always first
    if (cols.indexOf("name") !== 0) {
      const filtered = cols.filter((c) => c !== "name");
      return ["name", ...filtered];
    }
    return cols;
  } catch {
    return [...DEFAULT_VISIBLE_COLUMNS];
  }
}

export function persistVisibleColumns(visible: VisibleColumns): void {
  try {
    localStorage.setItem(VISIBLE_STORAGE_KEY, JSON.stringify(visible));
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
