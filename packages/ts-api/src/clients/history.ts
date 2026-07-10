import type { IpcTransport } from "../types";
import type {
  ListRecentOperationsRequest,
  ListRecentOperationsResponse,
  ClearOperationHistoryResponse,
} from "../generated/ipc";
import type { IpcInput } from "../input";

export class OperationHistoryClient {
  constructor(private readonly transport: IpcTransport) {}

  async listRecentOperations(
    request: IpcInput<ListRecentOperationsRequest> = {},
  ): Promise<ListRecentOperationsResponse> {
    return this.transport.invoke<ListRecentOperationsResponse>(
      "operationHistory.listRecent",
      { request },
    );
  }

  async clearOperationHistory(): Promise<ClearOperationHistoryResponse> {
    return this.transport.invoke<ClearOperationHistoryResponse>(
      "operationHistory.clear",
    );
  }
}
