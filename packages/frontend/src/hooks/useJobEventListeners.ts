import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import {
  normalizeIpcError,
  type FileOctopusClient,
  type FileOperationKind,
  type JobSnapshot,
  type UserPreferencesDto,
} from "@fileoctopus/ts-api";
import type { ToastMessage } from "../components/ToastStack";
import type { OperationDialog } from "../dialogs/OperationDialogView";
import type { JobMetrics } from "../app/providers/JobsProvider";
import type { PanelAction } from "../panelStore";
import type { SearchState } from "../pane/PaneFilterBar";
import { formatSize } from "../pane/fileTableUtils";
import {
  jobIdValue,
  mergeCancelled,
  mergeCompleted,
  mergeFailed,
  mergePaused,
  mergeProgress,
  mergeResumed,
  snapshotFromStarted,
} from "../dialogs/OperationDialogView";

function shouldPopupOperationCompleted(kind: FileOperationKind): boolean {
  return (
    kind !== "rename" &&
    kind !== "createFile" &&
    kind !== "createDirectory" &&
    kind !== "deleteToTrash" &&
    kind !== "deletePermanently" &&
    kind !== "writeTextFile"
  );
}

export function shouldRefreshOperationCompleted(
  kind: FileOperationKind,
): boolean {
  return kind !== "rename";
}

export interface UseJobEventListenersParams {
  client: FileOctopusClient;
  leftUri: string;
  rightUri: string;
  preferencesRef: MutableRefObject<UserPreferencesDto | null>;
  setJobs: Dispatch<SetStateAction<Record<string, JobSnapshot>>>;
  setJobMetrics: Dispatch<SetStateAction<Record<string, JobMetrics>>>;
  setActivityCollapsed: Dispatch<SetStateAction<boolean>>;
  updatePreference: (key: string, value: string) => Promise<void>;
  pushToast: (toast: Omit<ToastMessage, "id">) => void;
  takeOperationRefreshTargets: (jobId: string) => {
    folderUris: string[];
    removedEntryUris: string[];
  } | null;
  dispatch: Dispatch<PanelAction>;
  refreshOperationTargets: (
    targets: string[] | null,
    options?: { fullReload?: boolean },
  ) => void;
  refreshHistory: () => Promise<void>;
  setOperationError: Dispatch<SetStateAction<string | null>>;
  setSearch: Dispatch<SetStateAction<SearchState | null>>;
  setDialog: Dispatch<SetStateAction<OperationDialog | null>>;
}

export function useJobEventListeners({
  client,
  leftUri,
  rightUri,
  preferencesRef,
  setJobs,
  setJobMetrics,
  setActivityCollapsed,
  updatePreference,
  pushToast,
  takeOperationRefreshTargets,
  dispatch,
  refreshOperationTargets,
  refreshHistory,
  setOperationError,
  setSearch,
  setDialog,
}: UseJobEventListenersParams) {
  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    let disposed = false;
    const remember = (event: JobSnapshot) =>
      setJobs((current) => ({
        ...current,
        [jobIdValue(event.jobId)]: event,
      }));

    Promise.all([
      client.fileOperations.onJobStarted((event) => {
        remember(snapshotFromStarted(event));
        if (preferencesRef.current?.jobDrawerBehavior === "openOnStart") {
          setActivityCollapsed(false);
          void updatePreference("activityPanelVisible", "true");
        }
      }),
      client.fileOperations.onJobProgress((event) => {
        setJobs((current) => ({
          ...current,
          [jobIdValue(event.jobId)]: mergeProgress(current, event),
        }));
        setJobMetrics((current) => {
          const id = jobIdValue(event.jobId);
          const previous = current[id];
          const now = Date.now();
          const deltaBytes = previous
            ? event.completedBytes - previous.lastBytes
            : 0;
          const deltaMs = previous ? now - previous.lastAt : 0;
          let speedLabel: string | null = null;
          let etaLabel: string | null = null;

          if (deltaMs > 0 && deltaBytes > 0) {
            const bytesPerSecond = (deltaBytes * 1000) / deltaMs;
            speedLabel = `${formatSize(bytesPerSecond)}/s`;
            const totalBytes = event.totalBytes ?? 0;
            const remaining = totalBytes - event.completedBytes;
            if (remaining > 0 && bytesPerSecond > 0 && totalBytes > 0) {
              const seconds = Math.round(remaining / bytesPerSecond);
              etaLabel = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")} left`;
            }
          }

          return {
            ...current,
            [id]: {
              speedLabel,
              etaLabel,
              lastBytes: event.completedBytes,
              lastAt: now,
            },
          };
        });
      }),
      client.fileOperations.onJobCompleted((event) => {
        setJobs((current) => ({
          ...current,
          [jobIdValue(event.jobId)]: mergeCompleted(current, event),
        }));
        pushToast({
          tone: "success",
          title: "Operation completed",
          detail: event.operationKind,
          popup: shouldPopupOperationCompleted(event.operationKind),
        });
        if (shouldRefreshOperationCompleted(event.operationKind)) {
          const refreshPlan = takeOperationRefreshTargets(event.jobId);
          if (refreshPlan?.removedEntryUris.length) {
            dispatch({
              type: "removeEntries",
              uris: refreshPlan.removedEntryUris,
            });
          }
          refreshOperationTargets(
            refreshPlan?.folderUris.length ? refreshPlan.folderUris : null,
            {
              fullReload:
                event.operationKind === "deleteToTrash" ||
                event.operationKind === "deletePermanently",
            },
          );
        }
        void refreshHistory();
      }),
      client.fileOperations.onJobFailed((event) => {
        setJobs((current) => ({
          ...current,
          [jobIdValue(event.jobId)]: mergeFailed(current, event),
        }));
        pushToast({
          tone: "error",
          title: "Operation failed",
          detail: event.message,
          actionLabel: "View details",
          onAction: () => setOperationError(event.message),
        });
        if (preferencesRef.current?.jobDrawerBehavior === "openOnError") {
          setActivityCollapsed(false);
          void updatePreference("activityPanelVisible", "true");
        }
        setSearch((current) =>
          current?.jobId === jobIdValue(event.jobId)
            ? { ...current, running: false, error: event.message }
            : current,
        );
        setDialog((current) => {
          const jobId = jobIdValue(event.jobId);
          if (
            current?.type === "selectionProperties" &&
            current.folderSizeJobIds.includes(jobId)
          ) {
            const pendingFolderSizeJobs = current.pendingFolderSizeJobs - 1;
            if (pendingFolderSizeJobs > 0) {
              return {
                ...current,
                pendingFolderSizeJobs,
                error: event.message,
              };
            }
            return {
              ...current,
              pendingFolderSizeJobs: 0,
              calculatingSize: false,
              error: event.message,
            };
          }
          if (
            current?.type === "properties" &&
            current.folderSizeJobId === jobId
          ) {
            return { ...current, loading: false, error: event.message };
          }
          return current;
        });
        const refreshPlan = takeOperationRefreshTargets(event.jobId);
        refreshOperationTargets(
          refreshPlan?.folderUris.length ? refreshPlan.folderUris : null,
        );
        void refreshHistory();
      }),
      client.fileOperations.onJobCancelled((event) => {
        setJobs((current) => ({
          ...current,
          [jobIdValue(event.jobId)]: mergeCancelled(current, event),
        }));
        pushToast({
          tone: "info",
          title: "Operation cancelled",
          detail: event.operationKind,
        });
        setSearch((current) =>
          current?.jobId === jobIdValue(event.jobId)
            ? { ...current, running: false, error: "Operation cancelled." }
            : current,
        );
        setDialog((current) => {
          const jobId = jobIdValue(event.jobId);
          if (
            current?.type === "selectionProperties" &&
            current.folderSizeJobIds.includes(jobId)
          ) {
            const pendingFolderSizeJobs = current.pendingFolderSizeJobs - 1;
            if (pendingFolderSizeJobs > 0) {
              return { ...current, pendingFolderSizeJobs };
            }
            return {
              ...current,
              pendingFolderSizeJobs: 0,
              calculatingSize: false,
              totalSize:
                current.folderSizeBytes > 0
                  ? current.fileSizeBaseline + current.folderSizeBytes
                  : current.totalSize,
            };
          }
          if (
            current?.type === "properties" &&
            current.folderSizeJobId === jobId
          ) {
            return { ...current, loading: false };
          }
          return current;
        });
        const cancelledRefreshPlan = takeOperationRefreshTargets(event.jobId);
        refreshOperationTargets(
          cancelledRefreshPlan?.folderUris.length
            ? cancelledRefreshPlan.folderUris
            : null,
        );
        void refreshHistory();
      }),
      client.fileOperations.onJobPaused((event) => {
        setJobs((current) => ({
          ...current,
          [jobIdValue(event.jobId)]: mergePaused(current, event),
        }));
      }),
      client.fileOperations.onJobResumed((event) => {
        setJobs((current) => ({
          ...current,
          [jobIdValue(event.jobId)]: mergeResumed(current, event),
        }));
      }),
    ])
      .then((items) => {
        if (disposed) {
          for (const unlisten of items) {
            unlisten();
          }
          return;
        }
        unlisteners.push(...items);
      })
      .catch((error) => {
        setOperationError(normalizeIpcError(error).message);
      });

    return () => {
      disposed = true;
      for (const unlisten of unlisteners) {
        unlisten();
      }
    };
  }, [client, leftUri, rightUri]);
}
