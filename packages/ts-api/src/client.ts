import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen } from "@tauri-apps/api/event";
import type {
  AppInfoResponse,
  CancelJobRequest,
  DirectoryBatchEventDto,
  JobCancelledEvent,
  JobCompletedEvent,
  JobFailedEvent,
  JobProgressEvent,
  JobStartedEvent,
  JobStatusRequest,
  JobStatusResponse,
  IpcError,
  IpcTransport,
  ListRecentOperationsRequest,
  ListRecentOperationsResponse,
  ListStartRequest,
  ListStartResponse,
  PlanFileOperationRequest,
  PlanFileOperationResponse,
  StatRequest,
  StatResponse,
  StartFileOperationRequest,
  StartFileOperationResponse,
  UnlistenFn,
} from "./types";

export const DIRECTORY_BATCH_EVENT = "directory.batch";
export const JOB_STARTED_EVENT = "fileOperation.job.started";
export const JOB_PROGRESS_EVENT = "fileOperation.job.progress";
export const JOB_COMPLETED_EVENT = "fileOperation.job.completed";
export const JOB_FAILED_EVENT = "fileOperation.job.failed";
export const JOB_CANCELLED_EVENT = "fileOperation.job.cancelled";

const commandMap: Record<string, string> = {
  "app.get_info": "app_get_info",
  "fs.stat": "fs_stat",
  "fs.list_start": "fs_list_start",
  "fileOperation.plan": "plan_file_operation",
  "fileOperation.start": "start_file_operation",
  "job.cancel": "cancel_job",
  "job.status": "get_job_status",
  "operationHistory.listRecent": "list_recent_operations",
};

export class FileOctopusClient {
  readonly fs: FsClient;
  readonly fileOperations: FileOperationsClient;
  readonly jobs: JobsClient;
  readonly operationHistory: OperationHistoryClient;

  constructor(private readonly transport: IpcTransport) {
    this.fs = new FsClient(transport);
    this.fileOperations = new FileOperationsClient(transport);
    this.jobs = new JobsClient(transport);
    this.operationHistory = new OperationHistoryClient(transport);
  }

  getAppInfo(): Promise<AppInfoResponse> {
    return this.transport.invoke<AppInfoResponse>("app.get_info");
  }
}

export class FileOperationsClient {
  constructor(private readonly transport: IpcTransport) {}

  async planFileOperation(
    request: PlanFileOperationRequest,
  ): Promise<PlanFileOperationResponse> {
    try {
      return await this.transport.invoke<PlanFileOperationResponse>(
        "fileOperation.plan",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async startFileOperation(
    request: StartFileOperationRequest,
  ): Promise<StartFileOperationResponse> {
    try {
      return await this.transport.invoke<StartFileOperationResponse>(
        "fileOperation.start",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  onJobStarted(handler: (event: JobStartedEvent) => void): Promise<UnlistenFn> {
    return requireListen(this.transport, JOB_STARTED_EVENT, handler);
  }

  onJobProgress(
    handler: (event: JobProgressEvent) => void,
  ): Promise<UnlistenFn> {
    return requireListen(this.transport, JOB_PROGRESS_EVENT, handler);
  }

  onJobCompleted(
    handler: (event: JobCompletedEvent) => void,
  ): Promise<UnlistenFn> {
    return requireListen(this.transport, JOB_COMPLETED_EVENT, handler);
  }

  onJobFailed(handler: (event: JobFailedEvent) => void): Promise<UnlistenFn> {
    return requireListen(this.transport, JOB_FAILED_EVENT, handler);
  }

  onJobCancelled(
    handler: (event: JobCancelledEvent) => void,
  ): Promise<UnlistenFn> {
    return requireListen(this.transport, JOB_CANCELLED_EVENT, handler);
  }
}

export class JobsClient {
  constructor(private readonly transport: IpcTransport) {}

  async cancelJob(request: CancelJobRequest): Promise<JobStatusResponse> {
    try {
      return await this.transport.invoke<JobStatusResponse>("job.cancel", {
        request,
      });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async getJobStatus(request: JobStatusRequest): Promise<JobStatusResponse> {
    try {
      return await this.transport.invoke<JobStatusResponse>("job.status", {
        request,
      });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }
}

export class OperationHistoryClient {
  constructor(private readonly transport: IpcTransport) {}

  async listRecentOperations(
    request: ListRecentOperationsRequest = {},
  ): Promise<ListRecentOperationsResponse> {
    try {
      return await this.transport.invoke<ListRecentOperationsResponse>(
        "operationHistory.listRecent",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }
}

export class FsClient {
  constructor(private readonly transport: IpcTransport) {}

  async stat(request: StatRequest): Promise<StatResponse> {
    try {
      return await this.transport.invoke<StatResponse>("fs.stat", { request });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async listStart(request: ListStartRequest): Promise<ListStartResponse> {
    try {
      return await this.transport.invoke<ListStartResponse>("fs.list_start", {
        request,
      });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  onDirectoryBatch(
    handler: (event: DirectoryBatchEventDto) => void,
  ): Promise<UnlistenFn> {
    if (!this.transport.listen) {
      return Promise.reject({
        code: "unsupported_transport",
        message: "Transport does not support event subscriptions",
      } satisfies IpcError);
    }

    return this.transport.listen<DirectoryBatchEventDto>(
      DIRECTORY_BATCH_EVENT,
      handler,
    );
  }
}

export function createTauriTransport(): IpcTransport {
  return {
    invoke<TResponse>(command: string, args?: Record<string, unknown>) {
      return tauriInvoke<TResponse>(commandMap[command] ?? command, args);
    },
    async listen<TPayload>(
      event: string,
      handler: (payload: TPayload) => void,
    ) {
      return tauriListen<TPayload>(event, (tauriEvent) =>
        handler(tauriEvent.payload),
      );
    },
  };
}

export function createPreviewTransport(): IpcTransport {
  let sessionIndex = 0;
  const batchHandlers = new Set<(payload: DirectoryBatchEventDto) => void>();

  return {
    async invoke<TResponse>(command: string, args?: Record<string, unknown>) {
      if (command === "app.get_info") {
        return { name: "FileOctopus", version: "0.1.0" } as TResponse;
      }

      if (command === "fs.list_start") {
        sessionIndex += 1;
        const sessionId = `preview-${sessionIndex}`;
        const request = args?.request as Partial<ListStartRequest> | undefined;

        globalThis.setTimeout(() => {
          for (const handler of batchHandlers) {
            handler({
              sessionId,
              uri: request?.uri ?? "local:///",
              entries: [],
              batchIndex: 0,
              isComplete: true,
              totalHint: 0,
              error: null,
            });
          }
        }, 0);

        return { sessionId } as TResponse;
      }

      throw {
        code: "tauri_unavailable",
        message: "Tauri IPC is unavailable in browser preview",
      } satisfies IpcError;
    },
    async listen<TPayload>(
      event: string,
      handler: (payload: TPayload) => void,
    ) {
      if (event !== DIRECTORY_BATCH_EVENT) {
        return () => undefined;
      }

      const typedHandler = handler as (payload: DirectoryBatchEventDto) => void;

      batchHandlers.add(typedHandler);

      return () => batchHandlers.delete(typedHandler);
    },
  };
}

function requireListen<TPayload>(
  transport: IpcTransport,
  event: string,
  handler: (payload: TPayload) => void,
): Promise<UnlistenFn> {
  if (!transport.listen) {
    return Promise.reject({
      code: "unsupported_transport",
      message: "Transport does not support event subscriptions",
    } satisfies IpcError);
  }

  return transport.listen<TPayload>(event, handler);
}

export function createFileOctopusClient(
  transport: IpcTransport = isTauriRuntime()
    ? createTauriTransport()
    : createPreviewTransport(),
) {
  return new FileOctopusClient(transport);
}

export function normalizeIpcError(error: unknown): IpcError {
  if (isIpcError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return {
      code: "unknown",
      message: error.message,
    };
  }

  if (typeof error === "string") {
    return {
      code: "unknown",
      message: error,
    };
  }

  return {
    code: "unknown",
    message: "Unexpected IPC error",
  };
}

function isIpcError(error: unknown): error is IpcError {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as Partial<IpcError>;

  return (
    typeof candidate.code === "string" && typeof candidate.message === "string"
  );
}

function isTauriRuntime(): boolean {
  return typeof globalThis === "object" && "__TAURI_INTERNALS__" in globalThis;
}
