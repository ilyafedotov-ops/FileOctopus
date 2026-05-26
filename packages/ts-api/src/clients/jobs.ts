import type {
  IpcTransport,
  CancelJobRequest,
  JobStatusRequest,
  JobStatusResponse,
  PauseJobRequest,
  ResumeJobRequest,
} from "../types";
import { normalizeIpcError } from "../normalizeError";

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

  async pauseJob(request: PauseJobRequest): Promise<JobStatusResponse> {
    try {
      return await this.transport.invoke<JobStatusResponse>("job.pause", {
        request,
      });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async resumeJob(request: ResumeJobRequest): Promise<JobStatusResponse> {
    try {
      return await this.transport.invoke<JobStatusResponse>("job.resume", {
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
