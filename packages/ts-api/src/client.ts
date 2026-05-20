import type { AppInfoResponse, IpcTransport } from "./types";
import { AutostartClient } from "./clients/autostart";
import { DiagnosticsClient } from "./clients/diagnostics";
import { FileOperationsClient } from "./clients/fileOperations";
import { FsClient } from "./clients/fs";
import { JobsClient } from "./clients/jobs";
import { NetworkClient } from "./clients/network";
import { OperationHistoryClient } from "./clients/history";
import { NavigationClient } from "./clients/navigation";
import { PreferencesClient } from "./clients/preferences";
import { TerminalClient } from "./clients/terminal";
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
  readonly network: NetworkClient;
  readonly autostart: AutostartClient;
  readonly terminal: TerminalClient;

  constructor(private readonly transport: IpcTransport) {
    this.fs = new FsClient(transport);
    this.fileOperations = new FileOperationsClient(transport);
    this.jobs = new JobsClient(transport);
    this.operationHistory = new OperationHistoryClient(transport);
    this.diagnostics = new DiagnosticsClient(transport);
    this.preferences = new PreferencesClient(transport);
    this.navigation = new NavigationClient(transport);
    this.network = new NetworkClient(transport);
    this.autostart = new AutostartClient(transport);
    this.terminal = new TerminalClient(transport);
  }

  getAppInfo(): Promise<AppInfoResponse> {
    return this.transport.invoke<AppInfoResponse>("app.get_info");
  }
}

export function createFileOctopusClient(transport?: IpcTransport) {
  let resolved = transport;
  if (!resolved) {
    const inTauri = isTauriRuntime();
    const globalRecord = globalThis as Record<string, unknown>;
    console.warn(
      `[fileoctopus:client] transport selection: tauri=${inTauri} hasInternals=${"__TAURI_INTERNALS__" in globalRecord} keys=${
        Object.keys(globalRecord)
          .filter((k) => k.startsWith("__TAURI"))
          .join(",") || "(none)"
      }`,
    );
    resolved = inTauri ? createTauriTransport() : createPreviewTransport();
  }
  return new FileOctopusClient(resolved);
}

export { FileOperationsClient } from "./clients/fileOperations";
export { JobsClient } from "./clients/jobs";
export { OperationHistoryClient } from "./clients/history";
export { DiagnosticsClient } from "./clients/diagnostics";
export { PreferencesClient } from "./clients/preferences";
export { AutostartClient } from "./clients/autostart";
export { NavigationClient } from "./clients/navigation";
export { NetworkClient } from "./clients/network";
export { FsClient } from "./clients/fs";
export { TerminalClient } from "./clients/terminal";
export * from "./uri";
export { createTauriTransport, isTauriRuntime } from "./transports/tauri";
export { createPreviewTransport } from "./transports/preview";
