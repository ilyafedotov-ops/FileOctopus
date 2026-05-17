import type { AppInfoResponse, IpcTransport } from "./types";
import { AutostartClient } from "./clients/autostart";
import { DiagnosticsClient } from "./clients/diagnostics";
import { FileOperationsClient } from "./clients/fileOperations";
import { FsClient } from "./clients/fs";
import { JobsClient } from "./clients/jobs";
import { OperationHistoryClient } from "./clients/history";
import { NavigationClient } from "./clients/navigation";
import { PreferencesClient } from "./clients/preferences";
import { createPreviewTransport } from "./transports/preview";
import { createTauriTransport, isTauriRuntime } from "./transports/tauri";

export * from "./events";
export { normalizeIpcError } from "./normalizeError";

export class FileOctopusClient {
  readonly fs: FsClient;
  readonly fileOperations: FileOperationsClient;
  readonly jobs: JobsClient;
  readonly operationHistory: OperationHistoryClient;
  readonly diagnostics: DiagnosticsClient;
  readonly preferences: PreferencesClient;
  readonly navigation: NavigationClient;
  readonly autostart: AutostartClient;

  constructor(private readonly transport: IpcTransport) {
    this.fs = new FsClient(transport);
    this.fileOperations = new FileOperationsClient(transport);
    this.jobs = new JobsClient(transport);
    this.operationHistory = new OperationHistoryClient(transport);
    this.diagnostics = new DiagnosticsClient(transport);
    this.preferences = new PreferencesClient(transport);
    this.navigation = new NavigationClient(transport);
    this.autostart = new AutostartClient(transport);
  }

  getAppInfo(): Promise<AppInfoResponse> {
    return this.transport.invoke<AppInfoResponse>("app.get_info");
  }
}

export function createFileOctopusClient(
  transport: IpcTransport = isTauriRuntime()
    ? createTauriTransport()
    : createPreviewTransport(),
) {
  return new FileOctopusClient(transport);
}

export { FileOperationsClient } from "./clients/fileOperations";
export { JobsClient } from "./clients/jobs";
export { OperationHistoryClient } from "./clients/history";
export { DiagnosticsClient } from "./clients/diagnostics";
export { PreferencesClient } from "./clients/preferences";
export { AutostartClient } from "./clients/autostart";
export { NavigationClient } from "./clients/navigation";
export { FsClient } from "./clients/fs";
export { createTauriTransport, isTauriRuntime } from "./transports/tauri";
export { createPreviewTransport } from "./transports/preview";
