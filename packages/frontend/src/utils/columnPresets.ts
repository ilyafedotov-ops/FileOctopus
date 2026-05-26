import type { ColumnWidths, VisibleColumns } from "../pane/columnWidths";
import {
  DEFAULT_COLUMN_WIDTHS,
  DEFAULT_VISIBLE_COLUMNS,
} from "../pane/columnWidths";

export interface ColumnPreset {
  id: string;
  name: string;
  visibleColumns: VisibleColumns;
  columnWidths: ColumnWidths;
}

export const DEFAULT_COLUMN_PRESETS: ColumnPreset[] = [
  {
    id: "default",
    name: "Default",
    visibleColumns: [...DEFAULT_VISIBLE_COLUMNS],
    columnWidths: { ...DEFAULT_COLUMN_WIDTHS },
  },
  {
    id: "code",
    name: "Code",
    visibleColumns: ["name", "extension", "size", "modified"],
    columnWidths: {
      name: 280,
      extension: 60,
      size: 80,
      modified: 140,
      kind: 110,
    },
  },
  {
    id: "minimal",
    name: "Minimal",
    visibleColumns: ["name", "size"],
    columnWidths: {
      name: 400,
      extension: 52,
      size: 100,
      modified: 126,
      kind: 110,
    },
  },
  {
    id: "detailed",
    name: "Detailed",
    visibleColumns: ["name", "extension", "size", "modified", "kind"],
    columnWidths: {
      name: 200,
      extension: 70,
      size: 90,
      modified: 150,
      kind: 120,
    },
  },
];

export function captureColumnPreset(
  name: string,
  visibleColumns: VisibleColumns,
  columnWidths: ColumnWidths,
): ColumnPreset {
  return {
    id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name,
    visibleColumns: [...visibleColumns],
    columnWidths: { ...columnWidths },
  };
}

export function parseColumnPresets(json: string): ColumnPreset[] {
  if (!json) return DEFAULT_COLUMN_PRESETS;
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return DEFAULT_COLUMN_PRESETS;
    return parsed.filter(isValidColumnPreset);
  } catch {
    return DEFAULT_COLUMN_PRESETS;
  }
}

export function serializeColumnPresets(presets: ColumnPreset[]): string {
  return JSON.stringify(presets);
}

function isValidColumnPreset(obj: unknown): obj is ColumnPreset {
  if (typeof obj !== "object" || obj === null) return false;
  const p = obj as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.name === "string" &&
    Array.isArray(p.visibleColumns) &&
    typeof p.columnWidths === "object" &&
    p.columnWidths !== null
  );
}
