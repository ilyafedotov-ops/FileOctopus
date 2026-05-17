import type {
  IpcTransport,
  JobCancelledEvent,
  JobCompletedEvent,
  JobFailedEvent,
  JobProgressEvent,
  JobStartedEvent,
  PlanFileOperationRequest,
  PlanFileOperationResponse,
  StartFileOperationRequest,
  StartFileOperationResponse,
  UnlistenFn,
} from "../types";
import {
  JOB_CANCELLED_EVENT,
  JOB_COMPLETED_EVENT,
  JOB_FAILED_EVENT,
  JOB_PROGRESS_EVENT,
  JOB_STARTED_EVENT,
} from "../events";
import { normalizeIpcError } from "../normalizeError";
import { requireListen } from "../requireListen";

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
