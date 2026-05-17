import {
  IPC_ERROR_CODES,
  type DirectoryBatchEventDto,
  type IpcError,
} from "@fileoctopus/ts-api";

export type PaneLoadState =
  | "idle"
  | "loading"
  | "loaded"
  | "empty"
  | "error"
  | "notFound"
  | "permissionDenied"
  | "timeout";

export function createRequestId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function loadStateFromBatchError(
  error: IpcError | null | undefined,
): PaneLoadState {
  if (!error) {
    return "error";
  }

  if (error.code === IPC_ERROR_CODES.NOT_FOUND) {
    return "notFound";
  }

  if (error.code === IPC_ERROR_CODES.PERMISSION_DENIED) {
    return "permissionDenied";
  }

  if (error.code === IPC_ERROR_CODES.TIMEOUT) {
    return "timeout";
  }

  return "error";
}

export function terminalLoadState(
  entryCount: number,
  error: IpcError | null | undefined,
): PaneLoadState {
  if (error) {
    return loadStateFromBatchError(error);
  }

  return entryCount === 0 ? "empty" : "loaded";
}

export function isPaneLoading(loadState: PaneLoadState): boolean {
  return loadState === "loading";
}

export function paneStateLabel(loadState: PaneLoadState): string {
  switch (loadState) {
    case "idle":
      return "Idle";
    case "loading":
      return "Loading…";
    case "loaded":
      return "Ready";
    case "empty":
      return "Empty folder";
    case "error":
      return "Error";
    case "notFound":
      return "Not found";
    case "permissionDenied":
      return "Permission denied";
    case "timeout":
      return "Timed out";
    default:
      return "Unknown";
  }
}

export function shouldApplyBatch(
  tabRequestId: string | null,
  batch: DirectoryBatchEventDto,
): boolean {
  const batchRequestId = batch.requestId.trim();

  if (!tabRequestId) {
    return batchRequestId.length === 0;
  }

  if (batchRequestId.length === 0) {
    return false;
  }

  return tabRequestId === batchRequestId;
}
