import { useCallback, type Dispatch, type SetStateAction } from "react";
import { normalizeIpcError, type FileOctopusClient } from "@fileoctopus/ts-api";
import type { JobSnapshot } from "@fileoctopus/ts-api";
import { operationErrorMessage } from "../dialogs/operationJobState";

export interface UseCancelActiveJobParams {
  client: FileOctopusClient;
  setJobs: Dispatch<SetStateAction<Record<string, JobSnapshot>>>;
  setOperationError: Dispatch<SetStateAction<string | null>>;
}

export function useCancelActiveJob({
  client,
  setJobs,
  setOperationError,
}: UseCancelActiveJobParams) {
  return useCallback(
    (jobId: string) => {
      void (async () => {
        setOperationError(null);
        try {
          await client.jobs.cancelJob({ jobId });
          setJobs((current) => {
            const existing = current[jobId];
            if (!existing) {
              return current;
            }
            return {
              ...current,
              [jobId]: { ...existing, status: "cancelled" },
            };
          });
        } catch (error) {
          const normalized = normalizeIpcError(error);
          if (normalized.code === "not_found") {
            setJobs((current) => {
              const next = { ...current };
              delete next[jobId];
              return next;
            });
            return;
          }
          setOperationError(
            operationErrorMessage(normalized.code, normalized.message),
          );
        }
      })();
    },
    [client, setJobs, setOperationError],
  );
}
