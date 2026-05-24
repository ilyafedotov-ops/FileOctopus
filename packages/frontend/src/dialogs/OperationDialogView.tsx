import {
  FILE_OPERATION_WARNING_CODES,
  IPC_ERROR_CODES,
  type KnownFileOperationWarningCode,
  type KnownIpcErrorCode,
  ConflictPolicy,
  FileEntryDto,
  FsClient,
  FileOperationPlanDto,
  PathPropertiesDto,
  JobSnapshot,
  JobStartedEvent,
  JobProgressEvent,
  JobCompletedEvent,
  JobFailedEvent,
  JobCancelledEvent,
} from "@fileoctopus/ts-api";
import type {
  StandardLocationDto,
  FavoriteEntryDto,
  RecentEntryDto,
  NetworkProfileDto,
} from "@fileoctopus/ts-api";
import type { PanelId } from "../panelStore";
import { useRef } from "react";
import { Button } from "@fileoctopus/ui";
import { useDialogEscape } from "../hooks/useDialogEscape";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { PropertiesDialog } from "../components/dialogs/PropertiesDialog";
import { SelectionPropertiesDialog } from "../components/dialogs/SelectionPropertiesDialog";
import { ConflictResolutionDialog } from "../components/dialogs/ConflictResolutionDialog";
import { DestinationChooser } from "./DestinationChooser";

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
      advancedOptions: boolean;
      planningEnabled: boolean;
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
    }
  | {
      type: "selectionProperties";
      panelId: PanelId;
      entries: FileEntryDto[];
      totalSize: number | null;
      calculatingSize: boolean;
      folderSizeJobIds: string[];
      pendingFolderSizeJobs: number;
      folderSizeBytes: number;
      fileSizeBaseline: number;
      error: string | null;
    };

export interface OperationDialogViewProps {
  dialog: OperationDialog | null;
  fs?: FsClient;
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
  onCopySelectionPaths: (panelId: PanelId) => void;
  onReveal: (panelId: PanelId, entry: FileEntryDto | null) => void;
  onCalculateSelectionSize: (
    dialog: Extract<OperationDialog, { type: "selectionProperties" }>,
  ) => void;
  locations?: StandardLocationDto[];
  favorites?: FavoriteEntryDto[];
  recentDestinations?: RecentEntryDto[];
  networkProfiles?: NetworkProfileDto[];
}

function selectedItemText(count: number) {
  return `${count} selected item${count === 1 ? "" : "s"}`;
}

function operationDialogHeading(dialog: OperationDialog): {
  title: string;
  subtitle: string;
  titleId?: string;
} {
  switch (dialog.type) {
    case "createFolder":
      return {
        title: "Create Folder",
        subtitle: "Add a new folder in the current directory",
      };
    case "createFile":
      return {
        title: "Create File",
        subtitle: "Add a new empty file in the current directory",
      };
    case "rename":
      return {
        title: "Rename",
        subtitle: dialog.entry.name,
      };
    case "copyMove":
      return {
        title: dialog.kind === "copy" ? "Copy" : "Move",
        subtitle: selectedItemText(dialog.entries.length),
      };
    case "trash":
      return {
        title: "Move to Trash",
        subtitle: selectedItemText(dialog.entries.length),
      };
    case "permanentDelete":
      return {
        title: "Delete Permanently",
        subtitle: "This action cannot be undone",
      };
    case "properties":
      return {
        title: "Properties",
        subtitle:
          dialog.properties?.name ??
          dialog.entry?.name ??
          (dialog.loading ? "Loading metadata…" : "Item metadata"),
        titleId: "properties-dialog-title",
      };
    case "selectionProperties":
      return {
        title: "Selection Properties",
        subtitle: selectedItemText(dialog.entries.length),
        titleId: "selection-properties-dialog-title",
      };
  }
}

function OperationItemList({ entries }: { entries: FileEntryDto[] }) {
  return (
    <ul className="fo-dialog-item-list">
      {entries.map((entry) => (
        <li key={entry.uri}>{entry.name}</li>
      ))}
    </ul>
  );
}

export function OperationDialogView({
  dialog,
  fs,
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
  onCopySelectionPaths,
  onReveal,
  onCalculateSelectionSize,
  locations,
  favorites,
  recentDestinations,
  networkProfiles,
}: OperationDialogViewProps) {
  const dialogRef = useRef<HTMLElement>(null);
  useDialogEscape(Boolean(dialog), onClose);
  useFocusTrap(dialogRef, Boolean(dialog));

  if (!dialog) {
    return null;
  }

  const heading = operationDialogHeading(dialog);
  const isProperties =
    dialog.type === "properties" || dialog.type === "selectionProperties";

  return (
    <div className="fo-dialog-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className={`fo-dialog fo-operation-dialog${isProperties ? " fo-properties-dialog" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={heading.titleId}
        aria-label={heading.titleId ? undefined : heading.title}
      >
        <header className="fo-dialog-header">
          <div>
            <h2 id={heading.titleId}>{heading.title}</h2>
            <p>{heading.subtitle}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>
        {dialog.type === "createFolder" ? (
          <form
            className="fo-dialog-form"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitCreateFolder(dialog);
            }}
          >
            <label className="fo-dialog-field">
              <span>Folder name</span>
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
            <div className="fo-dialog-footer">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Create
              </Button>
            </div>
          </form>
        ) : null}
        {dialog.type === "createFile" ? (
          <form
            className="fo-dialog-form"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitCreateFile(dialog);
            }}
          >
            <label className="fo-dialog-field">
              <span>File name</span>
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
            <div className="fo-dialog-footer">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Create
              </Button>
            </div>
          </form>
        ) : null}
        {dialog.type === "rename" ? (
          <form
            className="fo-dialog-form"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitRename(dialog);
            }}
          >
            <label className="fo-dialog-field">
              <span>New name</span>
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
            <div className="fo-dialog-footer">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Rename
              </Button>
            </div>
          </form>
        ) : null}
        {dialog.type === "copyMove" ? (
          dialog.step === "confirm-overwrite" ? (
            <ConflictResolutionDialog
              conflicts={dialog.plan?.conflicts ?? []}
              entries={dialog.entries}
              fs={fs}
              onBack={() => onUpdate({ ...dialog, step: "review" })}
              onResolve={(result) => {
                if (result.action === "overwrite") {
                  void onSubmitCopyMove(dialog);
                } else {
                  onUpdate({ ...dialog, step: "review" });
                }
              }}
            />
          ) : (
            <form
              className={`fo-dialog-form fo-copy-dialog-form${dialog.advancedOptions ? " fo-copy-dialog-form--advanced" : ""}`}
              onSubmit={(event) => {
                event.preventDefault();
                onSubmitCopyMove(dialog);
              }}
            >
              <div className="fo-destination-layout">
                <div className="fo-destination-main">
                  <label className="fo-dialog-field">
                    <span>Destination</span>
                    <input
                      aria-label="Destination URI"
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
                  {dialog.advancedOptions ? (
                    <>
                      <label className="fo-dialog-field">
                        <span>Conflict policy</span>
                        <select
                          aria-label="Conflict policy"
                          value={dialog.conflictPolicy}
                          onChange={(event) =>
                            onUpdate({
                              ...dialog,
                              conflictPolicy: event.target
                                .value as ConflictPolicy,
                              plan: null,
                              error: null,
                            })
                          }
                        >
                          <option value="fail">Fail without changes</option>
                          <option value="skip">
                            Skip existing destinations
                          </option>
                          <option value="overwrite">
                            Overwrite existing destinations
                          </option>
                          <option value="renameNew">Rename new items</option>
                          <option value="renameExisting">
                            Rename existing items
                          </option>
                        </select>
                      </label>
                      <label className="fo-dialog-checkbox">
                        <input
                          type="checkbox"
                          checked={dialog.planningEnabled}
                          onChange={(event) =>
                            onUpdate({
                              ...dialog,
                              planningEnabled: event.target.checked,
                              plan: null,
                              error: null,
                            })
                          }
                        />
                        <span>Preview operation plan before copying</span>
                      </label>
                    </>
                  ) : null}
                  <div className="fo-dialog-callout fo-copy-selection">
                    <strong>{selectedItemText(dialog.entries.length)}</strong>
                    <OperationItemList entries={dialog.entries.slice(0, 5)} />
                  </div>
                  {dialog.advancedOptions &&
                  dialog.planningEnabled &&
                  dialog.plan ? (
                    <div className="fo-dialog-callout">
                      <strong>
                        {dialog.plan.totalItems} planned item
                        {dialog.plan.totalItems === 1 ? "" : "s"},{" "}
                        {dialog.plan.conflicts.length} conflict
                        {dialog.plan.conflicts.length === 1 ? "" : "s"}
                      </strong>
                      {dialog.plan.conflicts.slice(0, 3).map((conflict) => (
                        <span
                          key={`${conflict.source}-${conflict.destination}`}
                        >
                          {conflict.destination}
                        </span>
                      ))}
                      {dialog.plan.warnings.slice(0, 3).map((warning) => (
                        <span key={`${warning.code}-${warning.uri ?? ""}`}>
                          {operationWarningMessage(
                            warning.code,
                            warning.message,
                          )}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {dialog.error ? (
                    <div className="fo-operation-error">{dialog.error}</div>
                  ) : null}
                </div>
                {fs ||
                (locations && locations.length > 0) ||
                (favorites && favorites.length > 0) ||
                (recentDestinations && recentDestinations.length > 0) ||
                (networkProfiles && networkProfiles.length > 0) ? (
                  <div className="fo-destination-sidebar">
                    <DestinationChooser
                      locations={locations ?? []}
                      favorites={favorites ?? []}
                      recent={recentDestinations ?? []}
                      networkProfiles={networkProfiles ?? []}
                      fs={fs}
                      onSelect={(uri) =>
                        onUpdate({
                          ...dialog,
                          destination: uri,
                          plan: null,
                          error: null,
                        })
                      }
                    />
                  </div>
                ) : null}
              </div>
              <div className="fo-dialog-footer">
                {dialog.advancedOptions && dialog.planningEnabled ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={dialog.planning}
                    onClick={() => onReviewCopyMove(dialog)}
                  >
                    {dialog.planning ? "Planning" : "Plan"}
                  </Button>
                ) : null}
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={
                    dialog.planning || (dialog.planningEnabled && !dialog.plan)
                  }
                >
                  {dialog.planning
                    ? "Planning"
                    : dialog.kind === "copy"
                      ? "Copy"
                      : "Move"}
                </Button>
              </div>
            </form>
          )
        ) : null}
        {dialog.type === "trash" ? (
          <form
            className="fo-dialog-form"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitTrash(dialog);
            }}
          >
            <div className="fo-dialog-callout">
              <strong>Move {dialog.entries.length} item(s) to Trash</strong>
              <OperationItemList entries={dialog.entries.slice(0, 5)} />
            </div>
            {dialog.error ? (
              <div className="fo-operation-error">{dialog.error}</div>
            ) : null}
            <label className="fo-dialog-checkbox">
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
            <div className="fo-dialog-footer">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Move to Trash
              </Button>
            </div>
          </form>
        ) : null}
        {dialog.type === "permanentDelete" ? (
          <form
            className="fo-dialog-form"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitPermanentDelete(dialog);
            }}
          >
            <div className="fo-dialog-callout fo-dialog-callout--danger">
              <strong>
                Permanently delete {dialog.entries.length} item(s)
              </strong>
              <OperationItemList entries={dialog.entries.slice(0, 5)} />
            </div>
            {dialog.error ? (
              <div className="fo-operation-error">{dialog.error}</div>
            ) : null}
            <div className="fo-dialog-footer">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" size="sm">
                Delete Permanently
              </Button>
            </div>
          </form>
        ) : null}
        {dialog.type === "properties" ? (
          <PropertiesDialog
            open
            fs={fs}
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
        {dialog.type === "selectionProperties" ? (
          <>
            {dialog.error ? (
              <div className="fo-operation-error">{dialog.error}</div>
            ) : null}
            <SelectionPropertiesDialog
              open
              entries={dialog.entries}
              totalSize={dialog.totalSize}
              calculatingSize={dialog.calculatingSize}
              onClose={onClose}
              onCopyPaths={() => onCopySelectionPaths(dialog.panelId)}
              onCalculateSize={() => onCalculateSelectionSize(dialog)}
            />
          </>
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
