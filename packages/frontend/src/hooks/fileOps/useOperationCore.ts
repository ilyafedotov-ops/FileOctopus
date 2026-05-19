import type {
  ConflictPolicy,
  FileEntryDto,
  FileOperationKind,
  FileOperationPlanDto,
} from "@fileoctopus/ts-api";
import { normalizeIpcError } from "@fileoctopus/ts-api";
import type { PanelId } from "../../panelStore";
import { activeTab, normalizeLocalInput } from "../../panelStore";
import { isParentDirectoryUri } from "../../utils/parentEntry";
import {
  jobIdValue,
  operationErrorMessage,
} from "../../dialogs/OperationDialogView";
import type { OperationDialog } from "../../dialogs/OperationDialogView";
import type { UseFileOpHandlersDeps } from "./types";

export function useOperationCore(deps: UseFileOpHandlersDeps) {
  const { client, state, setDialog, setJobs, setOperationError } = deps;

  async function planOperation(
    kind: FileOperationKind,
    sources: string[],
    destination?: string,
    newName?: string,
    conflictPolicy: ConflictPolicy = "fail",
  ) {
    return client.fileOperations.planFileOperation({
      operation: {
        kind,
        sources,
        destination,
        newName,
        conflictPolicy,
      },
    });
  }

  async function startPlannedOperation(
    plan: FileOperationPlanDto,
  ): Promise<boolean> {
    try {
      const started = await client.fileOperations.startFileOperation({
        operationId: plan.operationId,
      });

      setJobs((current) => ({
        ...current,
        [jobIdValue(started.job.jobId)]: started.job,
      }));
      return true;
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setOperationError(
        operationErrorMessage(normalized.code, normalized.message),
      );
      return false;
    }
  }

  async function startOperation(
    kind: FileOperationKind,
    sources: string[],
    destination?: string,
    newName?: string,
    conflictPolicy: ConflictPolicy = "fail",
  ): Promise<boolean> {
    setOperationError(null);

    try {
      const planResponse = await planOperation(
        kind,
        sources,
        destination,
        newName,
        conflictPolicy,
      );

      return startPlannedOperation(planResponse.plan);
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setOperationError(
        operationErrorMessage(normalized.code, normalized.message),
      );
      return false;
    }
  }

  async function reviewCopyMoveDialog(
    current: Extract<OperationDialog, { type: "copyMove" }>,
  ): Promise<FileOperationPlanDto | null> {
    setOperationError(null);
    setDialog({ ...current, planning: true, error: null });

    try {
      const planResponse = await planOperation(
        current.kind,
        current.entries.map((entry) => entry.uri),
        normalizeLocalInput(current.destination),
        undefined,
        current.conflictPolicy,
      );

      setDialog({ ...current, plan: planResponse.plan, planning: false });
      return planResponse.plan;
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setDialog({
        ...current,
        planning: false,
        error: operationErrorMessage(normalized.code, normalized.message),
      });
      return null;
    }
  }

  function selectedEntries(panelId: PanelId): FileEntryDto[] {
    const tab = activeTab(state.panels[panelId]);
    const entries = tab.selectedIds
      .map((id) => tab.entriesById[id])
      .filter((entry): entry is FileEntryDto => Boolean(entry));

    if (
      entries.length === 0 &&
      tab.selectedIds.some((id) => isParentDirectoryUri(id, tab.uri))
    ) {
      setOperationError(
        "This action does not apply to the parent folder entry.",
      );
    }

    return entries;
  }

  return {
    planOperation,
    startPlannedOperation,
    startOperation,
    reviewCopyMoveDialog,
    selectedEntries,
  };
}

export type OperationCore = ReturnType<typeof useOperationCore>;
