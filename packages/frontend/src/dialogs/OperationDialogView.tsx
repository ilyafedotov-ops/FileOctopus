import { useState } from "react";
import {
  selectedItemText,
  operationDialogHeading,
  OperationItemList,
} from "./operationDialogParts";
import {
  ConflictPolicy,
  FileEntryDto,
  FsClient,
  FileOperationPlanDto,
  PathPropertiesDto,
} from "@fileoctopus/ts-api";
import type {
  StandardLocationDto,
  FavoriteEntryDto,
  RecentEntryDto,
  NetworkProfileDto,
} from "@fileoctopus/ts-api";
import type { PanelId } from "../panelStore";
import { parentUri } from "../panelStore";
import { Button } from "@fileoctopus/ui";
import { DialogShell } from "../components/DialogShell";
import { PropertiesDialog } from "../components/dialogs/PropertiesDialog";
import { SelectionPropertiesDialog } from "../components/dialogs/SelectionPropertiesDialog";
import { ConflictResolutionDialog } from "../components/dialogs/ConflictResolutionDialog";
import { DestinationChooser, localPathFromUri } from "./DestinationChooser";

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
      pendingConflictPolicy?: ConflictPolicy;
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
      focusPermissions?: boolean;
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
  const [browseOpen, setBrowseOpen] = useState(false);

  if (!dialog) {
    return null;
  }

  const heading = operationDialogHeading(dialog);
  const isProperties =
    dialog.type === "properties" || dialog.type === "selectionProperties";
  const className = [
    "fo-operation-dialog",
    isProperties ? "fo-properties-dialog" : "",
    dialog.type === "copyMove" ? "fo-operation-dialog--copy" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const hasDestinationChooser = Boolean(
    fs ||
    (locations && locations.length > 0) ||
    (favorites && favorites.length > 0) ||
    (recentDestinations && recentDestinations.length > 0) ||
    (networkProfiles && networkProfiles.length > 0),
  );
  const displayDestination =
    dialog.type === "copyMove" ? localPathFromUri(dialog.destination) : "";
  const sourceFolder =
    dialog.type === "copyMove"
      ? localPathFromUri(parentUri(dialog.entries[0]?.uri ?? "") ?? "")
      : "";
  const targetPreview =
    dialog.type === "copyMove" && dialog.entries.length === 1
      ? `${displayDestination.replace(/\/$/, "")}/${dialog.entries[0].name}`
      : "";

  return (
    <DialogShell
      open
      onClose={onClose}
      title={heading.title}
      titleId={heading.titleId}
      subtitle={heading.subtitle}
      closeOnBackdrop={false}
      className={className}
    >
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
            busy={dialog.planning}
            onBack={() => onUpdate({ ...dialog, step: "review" })}
            onResolve={(result) => {
              void onSubmitCopyMove({
                ...dialog,
                conflictPolicy: result.action,
                pendingConflictPolicy: result.action,
              });
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
            <div className="fo-copy-dialog-content">
              <div className="fo-copy-source">
                {sourceFolder ? (
                  <span className="fo-copy-source-path">
                    From {sourceFolder}
                  </span>
                ) : null}
                <OperationItemList entries={dialog.entries.slice(0, 5)} />
              </div>
              <div className="fo-destination-layout">
                <label className="fo-dialog-field fo-destination-field">
                  <span>Destination</span>
                  <input
                    aria-label="Destination URI"
                    value={displayDestination}
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
                {hasDestinationChooser ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-expanded={browseOpen}
                    onClick={() => setBrowseOpen((current) => !current)}
                  >
                    Browse…
                  </Button>
                ) : null}
              </div>
              {targetPreview ? (
                <div className="fo-copy-target-preview">
                  Target {targetPreview}
                </div>
              ) : null}
              {browseOpen && hasDestinationChooser ? (
                <div className="fo-destination-sidebar">
                  <DestinationChooser
                    locations={locations ?? []}
                    favorites={favorites ?? []}
                    recent={recentDestinations ?? []}
                    networkProfiles={networkProfiles ?? []}
                    fs={fs}
                    onSelect={(uri) => {
                      onUpdate({
                        ...dialog,
                        destination: uri,
                        plan: null,
                        error: null,
                      });
                      setBrowseOpen(false);
                    }}
                  />
                </div>
              ) : null}
              <div className="fo-destination-main">
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
                        <option value="skip">Skip existing destinations</option>
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
                {dialog.entries.some((e) => e.isSymlink) ? (
                  <div className="fo-dialog-callout fo-symlink-warning">
                    <span>
                      Includes{" "}
                      {dialog.entries.filter((e) => e.isSymlink).length}{" "}
                      symlink(s) — the link target will be copied, not the link
                      itself
                    </span>
                  </div>
                ) : null}
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
              </div>
            </div>
            <div className="fo-dialog-footer">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
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
            <strong>
              Move {selectedItemText(dialog.entries.length)} to Trash
            </strong>
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
              Permanently delete {selectedItemText(dialog.entries.length)}
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
          focusPermissions={dialog.focusPermissions}
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
    </DialogShell>
  );
}

import { operationWarningMessage } from "./operationJobState";
export * from "./operationJobState";
