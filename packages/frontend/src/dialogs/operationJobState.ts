import {
  FILE_OPERATION_WARNING_CODES,
  IPC_ERROR_CODES,
  type KnownFileOperationWarningCode,
  type KnownIpcErrorCode,
  JobSnapshot,
  JobStartedEvent,
  JobProgressEvent,
  JobCompletedEvent,
  JobFailedEvent,
  JobCancelledEvent,
  JobPausedEvent,
  JobResumedEvent,
} from "@fileoctopus/ts-api";

export function jobIdValue(jobId: JobSnapshot["jobId"]): string {
  return jobId;
}

export function snapshotFromStarted(event: JobStartedEvent): JobSnapshot {
  const now = event.startedAt;

  return {
    jobId: event.jobId,
    operationKind: event.operationKind,
    status: "running",
    currentItem: null,
    completedItems: 0,
    totalItems: event.totalItems,
    completedBytes: 0,
    totalBytes: event.totalBytes,
    errorCode: null,
    message: null,
    startedAt: now,
    updatedAt: now,
  };
}

export function mergeProgress(
  current: Record<string, JobSnapshot>,
  event: JobProgressEvent,
): JobSnapshot {
  const existing =
    current[jobIdValue(event.jobId)] ??
    snapshotFromStarted({
      jobId: event.jobId,
      operationKind: event.operationKind,
      totalItems: event.totalItems,
      totalBytes: event.totalBytes,
      startedAt: event.updatedAt,
    });

  return {
    ...existing,
    status: "running",
    currentItem: event.currentItem,
    completedItems: event.completedItems,
    totalItems: event.totalItems,
    completedBytes: event.completedBytes,
    totalBytes: event.totalBytes,
    updatedAt: event.updatedAt,
  };
}

export function mergeCompleted(
  current: Record<string, JobSnapshot>,
  event: JobCompletedEvent,
): JobSnapshot {
  const existing =
    current[jobIdValue(event.jobId)] ??
    snapshotFromStarted({
      jobId: event.jobId,
      operationKind: event.operationKind,
      totalItems: event.completedItems,
      totalBytes: event.completedBytes,
      startedAt: event.completedAt,
    });

  return {
    ...existing,
    status: "completed",
    completedItems: event.completedItems,
    completedBytes: event.completedBytes,
    updatedAt: event.completedAt,
  };
}

export function mergeFailed(
  current: Record<string, JobSnapshot>,
  event: JobFailedEvent,
): JobSnapshot {
  const existing =
    current[jobIdValue(event.jobId)] ??
    snapshotFromStarted({
      jobId: event.jobId,
      operationKind: event.operationKind,
      totalItems: 0,
      totalBytes: 0,
      startedAt: event.failedAt,
    });

  return {
    ...existing,
    status: "failed",
    errorCode: event.errorCode,
    message: event.message,
    updatedAt: event.failedAt,
  };
}

export function mergeCancelled(
  current: Record<string, JobSnapshot>,
  event: JobCancelledEvent,
): JobSnapshot {
  const existing =
    current[jobIdValue(event.jobId)] ??
    snapshotFromStarted({
      jobId: event.jobId,
      operationKind: event.operationKind,
      totalItems: 0,
      totalBytes: 0,
      startedAt: event.cancelledAt,
    });

  return {
    ...existing,
    status: "cancelled",
    updatedAt: event.cancelledAt,
  };
}

export function mergePaused(
  current: Record<string, JobSnapshot>,
  event: JobPausedEvent,
): JobSnapshot {
  const existing =
    current[jobIdValue(event.jobId)] ??
    snapshotFromStarted({
      jobId: event.jobId,
      operationKind: event.operationKind,
      totalItems: 0,
      totalBytes: 0,
      startedAt: event.pausedAt,
    });

  return {
    ...existing,
    status: "paused",
    updatedAt: event.pausedAt,
  };
}

export function mergeResumed(
  current: Record<string, JobSnapshot>,
  event: JobResumedEvent,
): JobSnapshot {
  const existing =
    current[jobIdValue(event.jobId)] ??
    snapshotFromStarted({
      jobId: event.jobId,
      operationKind: event.operationKind,
      totalItems: 0,
      totalBytes: 0,
      startedAt: event.resumedAt,
    });

  return {
    ...existing,
    status: "running",
    updatedAt: event.resumedAt,
  };
}

export function joinLocalUri(parent: string, name: string): string {
  return `${parent.replace(/\/$/, "")}/${name}`;
}

export function isValidName(name: string): boolean {
  return Boolean(name.trim()) && !/[\\/]/.test(name) && !name.includes("\0");
}

export function operationErrorMessage(code: string, fallback: string): string {
  const messages: Partial<Record<KnownIpcErrorCode | "interrupted", string>> = {
    [IPC_ERROR_CODES.PERMISSION_DENIED]:
      "Permission denied for this operation.",
    [IPC_ERROR_CODES.NOT_FOUND]:
      "The selected file or folder no longer exists.",
    [IPC_ERROR_CODES.DESTINATION_MISSING]:
      "The destination folder no longer exists.",
    [IPC_ERROR_CODES.DESTINATION_CONFLICT]:
      "A destination item already exists.",
    [IPC_ERROR_CODES.INVALID_NAME]:
      "Enter a valid name without path separators.",
    [IPC_ERROR_CODES.UNSUPPORTED_SYMLINK]:
      "Symlink file operations are not supported in this MVP.",
    [IPC_ERROR_CODES.UNSUPPORTED_TRASH]:
      "Move to Trash is not supported on this platform.",
    [IPC_ERROR_CODES.CANCELLED]: "Operation cancelled.",
    interrupted: "Operation interrupted by app shutdown.",
    [IPC_ERROR_CODES.TIMEOUT]: "Directory listing timed out.",
    [IPC_ERROR_CODES.CONNECTION_REQUIRED]:
      "Connect to this server before browsing remote files.",
    [IPC_ERROR_CODES.AUTHENTICATION_FAILED]:
      "Authentication failed. Edit the server credentials and try again.",
    [IPC_ERROR_CODES.CONNECTION_LOST]:
      "The connection was lost. Reconnect from the Network section.",
    [IPC_ERROR_CODES.NETWORK_ERROR]: "A network error occurred.",
    [IPC_ERROR_CODES.UNSUPPORTED_PROVIDER]:
      "This action isn't available for files on this kind of location yet.",
  };
  const key = code as KnownIpcErrorCode | "interrupted";

  return messages[key] ?? fallback;
}

export function operationWarningMessage(
  code: string,
  fallback: string,
): string {
  const messages: Partial<Record<KnownFileOperationWarningCode, string>> = {
    [FILE_OPERATION_WARNING_CODES.METADATA_FAILED]:
      "Some items could not be inspected and were skipped during planning.",
  };
  const key = code as KnownFileOperationWarningCode;

  return messages[key] ?? fallback;
}
