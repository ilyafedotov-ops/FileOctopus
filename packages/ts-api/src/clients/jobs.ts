import type { IpcTransport } from "../types";
import type {
  CancelJobRequest,
  JobStatusRequest,
  JobStatusResponse,
  PauseJobRequest,
  ResumeJobRequest,
} from "../generated/ipc";

export class JobsClient {
  constructor(private readonly transport: IpcTransport) {}

  async cancelJob(request: CancelJobRequest): Promise<JobStatusResponse> {
    return this.transport.invoke<JobStatusResponse>("job.cancel", {
      request,
    });
  }

  async pauseJob(request: PauseJobRequest): Promise<JobStatusResponse> {
    return this.transport.invoke<JobStatusResponse>("job.pause", {
      request,
    });
  }

  async resumeJob(request: ResumeJobRequest): Promise<JobStatusResponse> {
    return this.transport.invoke<JobStatusResponse>("job.resume", {
      request,
    });
  }

  async getJobStatus(request: JobStatusRequest): Promise<JobStatusResponse> {
    return this.transport.invoke<JobStatusResponse>("job.status", {
      request,
    });
  }
}
