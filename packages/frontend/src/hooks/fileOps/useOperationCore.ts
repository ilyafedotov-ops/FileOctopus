import { useRef } from "react";
import type {
  BatchRenameItemDto,
  ConflictPolicy,
  FileEntryDto,
  FileOperationKind,
  FileOperationPlanDto,
  JobSnapshot,
} from "@fileoctopus/ts-api";
import { normalizeIpcError } from "@fileoctopus/ts-api";
import type { PanelId } from "../../panelStore";
import { activeTab, normalizeLocalInput } from "../../panelStore";
import { isParentDirectoryUri } from "../../utils/parentEntry";
import {
  jobIdValue,
  mergeJobSnapshot,
  operationErrorMessage,
} from "../../dialogs/OperationDialogView";
import type { OperationDialog } from "../../dialogs/OperationDialogView";
import type { UseFileOpHandlersDeps } from "./types";

function promoteQueuedJob(job: JobSnapshot): JobSnapshot {
  return job.status === "queued" ? { ...job, status: "running" } : job;
}

export function useOperationCore(deps: UseFileOpHandlersDeps) {
  const {
    client,
    state,
    setDialog,
    setJobs,
    setOperationError,
    registerOperationRefresh,
  } = deps;
  const startingOperationIdsRef = useRef(new Set<string>());

  async function planOperation(
    kind: FileOperationKind,
    sources: string[],
    destination?: string,
    newName?: string,
    conflictPolicy: ConflictPolicy = "fail",
    batchRenames?: BatchRenameItemDto[],
  ) {
    return client.fileOperations.planFileOperation({
      operation: {
        kind,
        sources,
        destination,
        newName,
        conflictPolicy,
        batchRenames,
      },
    });
  }

  async function startPlannedOperation(
    plan: FileOperationPlanDto,
  ): Promise<boolean> {
    if (startingOperationIdsRef.current.has(plan.operationId)) {
      return false;
    }
    startingOperationIdsRef.current.add(plan.operationId);

    try {
      const started = await client.fileOperations.startFileOperation({
        operationId: plan.operationId,
      });
      const jobId = jobIdValue(started.job.jobId);
      const snapshot = promoteQueuedJob(started.job);

      setJobs((current) => ({
        ...current,
        [jobId]: mergeJobSnapshot(current, snapshot),
      }));
      registerOperationRefresh?.(started.job.jobId, plan);

      if (started.job.status === "queued") {
        void client.jobs
          .getJobStatus({ jobId })
          .then((response) => {
            setJobs((current) => {
              const existing = current[jobId];
              if (!existing || existing.status !== "queued") {
                return current;
              }
              return {
                ...current,
                [jobId]: mergeJobSnapshot(
                  current,
                  promoteQueuedJob(response.job),
                ),
              };
            });
          })
          .catch(() => undefined);
      }

      return true;
    } catch (error) {
      const normalized = normalizeIpcError(error);
      setOperationError(
        operationErrorMessage(normalized.code, normalized.message),
      );
      return false;
    } finally {
      startingOperationIdsRef.current.delete(plan.operationId);
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
