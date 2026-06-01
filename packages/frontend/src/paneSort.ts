import type { FileEntryDto } from "@fileoctopus/ts-api";
import type { SortField, SortState } from "./panelStore";

export function compareEntries(
  left: FileEntryDto,
  right: FileEntryDto,
  sort: SortState,
): number {
  if (sort.directoriesFirst && left.kind !== right.kind) {
    if (left.kind === "directory") {
      return -1;
    }

    if (right.kind === "directory") {
      return 1;
    }
  }

  const direction = sort.direction === "asc" ? 1 : -1;
  const result = compareField(left, right, sort.field);

  return result * direction;
}

function compareField(
  left: FileEntryDto,
  right: FileEntryDto,
  field: SortField,
): number {
  switch (field) {
    case "type":
      return (
        left.kind.localeCompare(right.kind) ||
        left.name.localeCompare(right.name)
      );
    case "size":
      return (
        (left.size ?? -1) - (right.size ?? -1) ||
        left.name.localeCompare(right.name)
      );
    case "modified":
      return (
        dateValue(left.modifiedAt) - dateValue(right.modifiedAt) ||
        left.name.localeCompare(right.name)
      );
    case "created":
      return (
        dateValue(left.createdAt) - dateValue(right.createdAt) ||
        left.name.localeCompare(right.name)
      );
    case "extension":
      return (
        (left.extension ?? "").localeCompare(right.extension ?? "") ||
        left.name.localeCompare(right.name)
      );
    case "permissions":
      return (
        (left.permissions ?? "").localeCompare(right.permissions ?? "") ||
        left.name.localeCompare(right.name)
      );
    case "owner":
      return (
        (left.owner ?? "").localeCompare(right.owner ?? "") ||
        left.name.localeCompare(right.name)
      );
    case "name":
    default:
      return left.name.localeCompare(right.name, undefined, {
        numeric: true,
        sensitivity: "base",
      });
  }
}

function dateValue(value?: string | null): number {
  return value ? Date.parse(value) || 0 : 0;
}
