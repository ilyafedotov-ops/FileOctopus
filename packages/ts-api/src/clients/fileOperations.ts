import type { IpcTransport, UnlistenFn } from "../types";
import type {
  PlanFileOperationResponse,
  StartFileOperationRequest,
  StartFileOperationResponse,
} from "../generated/ipc";
import type {
  JobCancelledEvent,
  JobCompletedEvent,
  JobFailedEvent,
  JobPausedEvent,
  JobProgressEvent,
  JobResumedEvent,
  JobStartedEvent,
} from "../generated/jobs";
import type { PlanFileOperationInput } from "../input";
import {
  JOB_CANCELLED_EVENT,
  JOB_COMPLETED_EVENT,
  JOB_FAILED_EVENT,
  JOB_PAUSED_EVENT,
  JOB_PROGRESS_EVENT,
  JOB_RESUMED_EVENT,
  JOB_STARTED_EVENT,
} from "../events";
import { requireListen } from "../requireListen";

export class FileOperationsClient {
  constructor(private readonly transport: IpcTransport) {}

  async planFileOperation(
    request: PlanFileOperationInput,
  ): Promise<PlanFileOperationResponse> {
    return this.transport.invoke<PlanFileOperationResponse>(
      "fileOperation.plan",
      { request },
    );
  }

  async startFileOperation(
    request: StartFileOperationRequest,
  ): Promise<StartFileOperationResponse> {
    return this.transport.invoke<StartFileOperationResponse>(
      "fileOperation.start",
      { request },
    );
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

  onJobPaused(handler: (event: JobPausedEvent) => void): Promise<UnlistenFn> {
    return requireListen(this.transport, JOB_PAUSED_EVENT, handler);
  }

  onJobResumed(handler: (event: JobResumedEvent) => void): Promise<UnlistenFn> {
    return requireListen(this.transport, JOB_RESUMED_EVENT, handler);
  }
}
