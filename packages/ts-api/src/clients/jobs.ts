import type {
  IpcTransport,
  CancelJobRequest,
  JobStatusRequest,
  JobStatusResponse,
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
