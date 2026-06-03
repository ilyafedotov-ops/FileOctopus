import type {
  IpcTransport,
  AppDataHealthResponse,
  ExportDiagnosticsBundleRequest,
  ExportDiagnosticsBundleResponse,
  LogRecordDto,
  UnlistenFn,
} from "../types";
import { DIAGNOSTICS_LOG_EVENT } from "../events";
import { requireListen } from "../requireListen";

export class DiagnosticsClient {
  constructor(private readonly transport: IpcTransport) {}

  async appDataHealth(): Promise<AppDataHealthResponse> {
    return this.transport.invoke<AppDataHealthResponse>(
      "diagnostics.appDataHealth",
    );
  }

  async exportBundle(
    request: ExportDiagnosticsBundleRequest,
  ): Promise<ExportDiagnosticsBundleResponse> {
    return this.transport.invoke<ExportDiagnosticsBundleResponse>(
      "diagnostics.exportBundle",
      { request },
    );
  }

  async startLogStream(): Promise<void> {
    await this.transport.invoke<void>("diagnostics.startLogStream");
  }

  async stopLogStream(): Promise<void> {
    await this.transport.invoke<void>("diagnostics.stopLogStream");
  }

  onLogRecord(handler: (record: LogRecordDto) => void): Promise<UnlistenFn> {
    return requireListen<LogRecordDto>(
      this.transport,
      DIAGNOSTICS_LOG_EVENT,
      handler,
    );
  }
}
