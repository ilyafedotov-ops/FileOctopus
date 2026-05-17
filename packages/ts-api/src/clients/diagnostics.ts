import type {
  IpcTransport,
  AppDataHealthResponse,
  ExportDiagnosticsBundleRequest,
  ExportDiagnosticsBundleResponse,
} from "../types";
import { normalizeIpcError } from "../normalizeError";

export class DiagnosticsClient {
  constructor(private readonly transport: IpcTransport) {}

  async appDataHealth(): Promise<AppDataHealthResponse> {
    try {
      return await this.transport.invoke<AppDataHealthResponse>(
        "diagnostics.appDataHealth",
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async exportBundle(
    request: ExportDiagnosticsBundleRequest,
  ): Promise<ExportDiagnosticsBundleResponse> {
    try {
      return await this.transport.invoke<ExportDiagnosticsBundleResponse>(
        "diagnostics.exportBundle",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }
}
