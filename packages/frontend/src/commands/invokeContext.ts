import type { FileEntryDto } from "@fileoctopus/ts-api";
import type { SortField } from "../panelStore";

export interface CommandInvokeContext {
  entry?: FileEntryDto | null;
  targetUri?: string;
  sortField?: SortField;
  sortAscending?: boolean;
  preferenceValue?: string;
}

export type CommandInvokeArg = CommandInvokeContext | FileEntryDto | null;

function isFileEntryDto(value: unknown): value is FileEntryDto {
  return (
    typeof value === "object" &&
    value !== null &&
    "uri" in value &&
    "kind" in value &&
    !("sortField" in value) &&
    !("preferenceValue" in value) &&
    !("targetUri" in value)
  );
}

export function normalizeCommandContext(
  context?: CommandInvokeArg,
): CommandInvokeContext | undefined {
  if (context === undefined) {
    return undefined;
  }

  if (context === null) {
    return { entry: null };
  }

  if (isFileEntryDto(context)) {
    return { entry: context };
  }

  return context;
}
