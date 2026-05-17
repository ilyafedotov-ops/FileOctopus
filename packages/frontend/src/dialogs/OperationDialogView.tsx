import {
  FILE_OPERATION_WARNING_CODES,
  IPC_ERROR_CODES,
  type KnownFileOperationWarningCode,
  type KnownIpcErrorCode,
  ConflictPolicy,
  FileEntryDto,
  FileOperationPlanDto,
  PathPropertiesDto,
  JobSnapshot,
  JobStartedEvent,
  JobProgressEvent,
  JobCompletedEvent,
  JobFailedEvent,
  JobCancelledEvent,
} from "@fileoctopus/ts-api";
import type { PanelId } from "../panelStore";
import { Button } from "@fileoctopus/ui";
import { useDialogEscape } from "../hooks/useDialogEscape";
import { PropertiesDialog } from "../components/dialogs/PropertiesDialog";
import { ConflictResolutionDialog } from "../components/dialogs/ConflictResolutionDialog";

type CopyMoveKind = "copy" | "move";

export type OperationDialog =
  | {
      type: "createFolder";
      panelId: PanelId;
      name: string;
      error: string | null;
    }
  | {
      type: "createFile";
      panelId: PanelId;
      name: string;
      error: string | null;
    }
  | {
      type: "rename";
      panelId: PanelId;
      entry: FileEntryDto;
      name: string;
      error: string | null;
    }
  | {
      type: "copyMove";
      panelId: PanelId;
      kind: CopyMoveKind;
      entries: FileEntryDto[];
      destination: string;
      conflictPolicy: ConflictPolicy;
      plan: FileOperationPlanDto | null;
      planning: boolean;
      step: "review" | "confirm-overwrite";
      error: string | null;
    }
  | {
      type: "trash";
      panelId: PanelId;
      entries: FileEntryDto[];
      dontAskAgain: boolean;
      error: string | null;
    }
  | {
      type: "permanentDelete";
      panelId: PanelId;
      entries: FileEntryDto[];
      error: string | null;
    }
  | {
      type: "properties";
      panelId: PanelId;
      entry: FileEntryDto | null;
      properties: PathPropertiesDto | null;
      loading: boolean;
      folderSizeJobId: string | null;
      error: string | null;
    };

export interface OperationDialogViewProps {
  dialog: OperationDialog | null;
  onClose: () => void;
  onUpdate: (dialog: OperationDialog) => void;
  onReviewCopyMove: (
    dialog: Extract<OperationDialog, { type: "copyMove" }>,
  ) => void;
  onSubmitCreateFolder: (
    dialog: Extract<OperationDialog, { type: "createFolder" }>,
  ) => void;
  onSubmitCreateFile: (
    dialog: Extract<OperationDialog, { type: "createFile" }>,
  ) => void;
  onSubmitRename: (
    dialog: Extract<OperationDialog, { type: "rename" }>,
  ) => void;
  onSubmitCopyMove: (
    dialog: Extract<OperationDialog, { type: "copyMove" }>,
  ) => void;
  onSubmitTrash: (dialog: Extract<OperationDialog, { type: "trash" }>) => void;
  onSubmitPermanentDelete: (
    dialog: Extract<OperationDialog, { type: "permanentDelete" }>,
  ) => void;
  onCopyPath: (panelId: PanelId) => void;
  onReveal: (panelId: PanelId, entry: FileEntryDto | null) => void;
}

export function OperationDialogView({
  dialog,
  onClose,
  onUpdate,
  onReviewCopyMove,
  onSubmitCreateFolder,
  onSubmitCreateFile,
  onSubmitRename,
  onSubmitCopyMove,
  onSubmitTrash,
  onSubmitPermanentDelete,
  onCopyPath,
  onReveal,
}: OperationDialogViewProps) {
  useDialogEscape(Boolean(dialog), onClose);

  if (!dialog) {
    return null;
  }

  const title =
    dialog.type === "createFolder"
      ? "Create Folder"
      : dialog.type === "createFile"
        ? "Create File"
        : dialog.type === "rename"
          ? "Rename"
          : dialog.type === "properties"
            ? "Properties"
            : dialog.type === "permanentDelete"
              ? "Delete Permanently"
              : dialog.type === "trash"
                ? "Move to Trash"
                : dialog.kind === "copy"
                  ? "Copy"
                  : "Move";

  return (
    <div className="fo-dialog-backdrop" role="presentation">
      <section
        className="fo-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <strong>{title}</strong>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>
        {dialog.type === "createFolder" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitCreateFolder(dialog);
            }}
          >
            <label>
              Folder name
              <input
                aria-label="Folder name"
                value={dialog.name}
                onChange={(event) =>
                  onUpdate({ ...dialog, name: event.target.value, error: null })
                }
              />
            </label>
            {dialog.error ? (
              <div className="fo-operation-error">{dialog.error}</div>
            ) : null}
            <Button type="submit" variant="primary" size="sm">
              Create
            </Button>
          </form>
        ) : null}
        {dialog.type === "createFile" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitCreateFile(dialog);
            }}
          >
            <label>
              File name
              <input
                aria-label="File name"
                value={dialog.name}
                onChange={(event) =>
                  onUpdate({ ...dialog, name: event.target.value, error: null })
                }
              />
            </label>
            {dialog.error ? (
              <div className="fo-operation-error">{dialog.error}</div>
            ) : null}
            <Button type="submit" variant="primary" size="sm">
              Create
            </Button>
          </form>
        ) : null}
        {dialog.type === "rename" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitRename(dialog);
            }}
          >
            <label>
              New name
              <input
                aria-label="New name"
                value={dialog.name}
                onChange={(event) =>
                  onUpdate({ ...dialog, name: event.target.value, error: null })
                }
              />
            </label>
            {dialog.error ? (
              <div className="fo-operation-error">{dialog.error}</div>
            ) : null}
            <Button type="submit" variant="primary" size="sm">
              Rename
            </Button>
          </form>
        ) : null}
        {dialog.type === "copyMove" ? (
          dialog.step === "confirm-overwrite" ? (
            <ConflictResolutionDialog
              onBack={() => onUpdate({ ...dialog, step: "review" })}
              onOverwrite={() => void onSubmitCopyMove(dialog)}
            />
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onSubmitCopyMove(dialog);
              }}
            >
              <label>
                Destination local URI
                <input
                  aria-label="Destination local URI"
                  value={dialog.destination}
                  onChange={(event) =>
                    onUpdate({
                      ...dialog,
                      destination: event.target.value,
                      plan: null,
                      error: null,
                    })
                  }
                />
              </label>
              <label>
                Conflict policy
                <select
                  aria-label="Conflict policy"
                  value={dialog.conflictPolicy}
                  onChange={(event) =>
                    onUpdate({
                      ...dialog,
                      conflictPolicy: event.target.value as ConflictPolicy,
                      plan: null,
                      error: null,
                    })
                  }
                >
                  <option value="fail">Fail without changes</option>
                  <option value="skip">Skip existing destinations</option>
                  <option value="overwrite">
                    Overwrite existing destinations
                  </option>
                  <option value="renameNew">Rename new items</option>
                  <option value="renameExisting">Rename existing items</option>
                </select>
              </label>
              <div className="fo-dialog-summary">
                {dialog.entries.length} item(s) selected
              </div>
              {dialog.plan ? (
                <div className="fo-dialog-summary">
                  <span>
                    {dialog.plan.totalItems} planned item(s),{" "}
                    {dialog.plan.conflicts.length} conflict(s)
                  </span>
                  {dialog.plan.conflicts.slice(0, 3).map((conflict) => (
                    <span key={`${conflict.source}-${conflict.destination}`}>
                      {conflict.destination}
                    </span>
                  ))}
                  {dialog.plan.warnings.slice(0, 3).map((warning) => (
                    <span key={`${warning.code}-${warning.uri ?? ""}`}>
                      {operationWarningMessage(warning.code, warning.message)}
                    </span>
                  ))}
                </div>
              ) : null}
              {dialog.error ? (
                <div className="fo-operation-error">{dialog.error}</div>
              ) : null}
              <div className="fo-dialog-actions">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={dialog.planning}
                  onClick={() => onReviewCopyMove(dialog)}
                >
                  {dialog.planning ? "Planning" : "Plan"}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={dialog.planning || !dialog.plan}
                >
                  Start
                </Button>
              </div>
            </form>
          )
        ) : null}
        {dialog.type === "trash" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitTrash(dialog);
            }}
          >
            <div className="fo-dialog-summary">
              <span>Move {dialog.entries.length} item(s) to Trash</span>
              {dialog.entries.slice(0, 3).map((entry) => (
                <span key={entry.uri}>{entry.name}</span>
              ))}
            </div>
            {dialog.error ? (
              <div className="fo-operation-error">{dialog.error}</div>
            ) : null}
            <label className="fo-checkbox-label">
              <input
                type="checkbox"
                checked={dialog.dontAskAgain}
                onChange={(event) =>
                  onUpdate({
                    ...dialog,
                    dontAskAgain: event.target.checked,
                  })
                }
              />
              Don&apos;t ask again this session
            </label>
            <Button type="submit" variant="primary" size="sm">
              Move to Trash
            </Button>
          </form>
        ) : null}
        {dialog.type === "permanentDelete" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitPermanentDelete(dialog);
            }}
          >
            <div className="fo-dialog-summary">
              <span>Permanently delete {dialog.entries.length} item(s)</span>
              {dialog.entries.slice(0, 5).map((entry) => (
                <span key={entry.uri}>{entry.name}</span>
              ))}
            </div>
            {dialog.error ? (
              <div className="fo-operation-error">{dialog.error}</div>
            ) : null}
            <Button type="submit" variant="danger" size="sm">
              Delete Permanently
            </Button>
          </form>
        ) : null}
        {dialog.type === "properties" ? (
          <PropertiesDialog
            open
            state={{
              panelId: dialog.panelId,
              entry: dialog.entry,
              properties: dialog.properties,
              loading: dialog.loading,
              error: dialog.error,
            }}
            onCopyPath={() => onCopyPath(dialog.panelId)}
            onReveal={() => onReveal(dialog.panelId, dialog.entry)}
          />
        ) : null}
      </section>
    </div>
  );
}

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
