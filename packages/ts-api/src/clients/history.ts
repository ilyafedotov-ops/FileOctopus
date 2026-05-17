import type {
  IpcTransport,
  ListRecentOperationsRequest,
  ListRecentOperationsResponse,
  ClearOperationHistoryResponse,
} from "../types";
import { normalizeIpcError } from "../normalizeError";

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

  async clearOperationHistory(): Promise<ClearOperationHistoryResponse> {
    try {
      return await this.transport.invoke<ClearOperationHistoryResponse>(
        "operationHistory.clear",
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }
}
