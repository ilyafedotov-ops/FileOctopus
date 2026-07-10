import type { IpcTransport, UnlistenFn } from "./types";
import type {
  AppInfoResponse,
  NativeMenuCommandEventDto,
} from "./generated/ipc";
import { AutostartClient } from "./clients/autostart";
import { DiagnosticsClient } from "./clients/diagnostics";
import { FileOperationsClient } from "./clients/fileOperations";
import { FsClient } from "./clients/fs";
import { GitClient } from "./clients/git";
import { JobsClient } from "./clients/jobs";
import { NetworkClient } from "./clients/network";
import { OperationHistoryClient } from "./clients/history";
import { NavigationClient } from "./clients/navigation";
import { PreferencesClient } from "./clients/preferences";
import { TerminalClient } from "./clients/terminal";
import { PluginClient } from "./clients/plugin";
import { createPreviewTransport } from "./transports/preview";
import { createTauriTransport, isTauriRuntime } from "./transports/tauri";
import { requireListen } from "./requireListen";
import { normalizeTransport } from "./normalizeError";
import { NATIVE_MENU_COMMAND_EVENT } from "./events";

export * from "./events";
export { normalizeIpcError } from "./normalizeError";

export class FileOctopusClient {
  readonly fs: FsClient;
  readonly git: GitClient;
  readonly fileOperations: FileOperationsClient;
  readonly jobs: JobsClient;
  readonly operationHistory: OperationHistoryClient;
  readonly diagnostics: DiagnosticsClient;
  readonly preferences: PreferencesClient;
  readonly navigation: NavigationClient;
  readonly network: NetworkClient;
  readonly autostart: AutostartClient;
  readonly terminal: TerminalClient;
  readonly plugin: PluginClient;

  private readonly transport: IpcTransport;

  constructor(transport: IpcTransport) {
    // Normalise IPC errors centrally so individual client methods don't each
    // need their own try/catch around `transport.invoke`.
    const normalized = normalizeTransport(transport);
    this.transport = normalized;
    this.fs = new FsClient(normalized);
    this.git = new GitClient(normalized);
    this.fileOperations = new FileOperationsClient(normalized);
    this.jobs = new JobsClient(normalized);
    this.operationHistory = new OperationHistoryClient(normalized);
    this.diagnostics = new DiagnosticsClient(normalized);
    this.preferences = new PreferencesClient(normalized);
    this.navigation = new NavigationClient(normalized);
    this.network = new NetworkClient(normalized);
    this.autostart = new AutostartClient(normalized);
    this.terminal = new TerminalClient(normalized);
    this.plugin = new PluginClient(normalized);
  }

  getAppInfo(): Promise<AppInfoResponse> {
    return this.transport.invoke<AppInfoResponse>("app.get_info");
  }

  onNativeMenuCommand(
    handler: (event: NativeMenuCommandEventDto) => void,
  ): Promise<UnlistenFn> {
    return requireListen(this.transport, NATIVE_MENU_COMMAND_EVENT, handler);
  }
}

export function createFileOctopusClient(transport?: IpcTransport) {
  let resolved = transport;
  if (!resolved) {
    resolved = isTauriRuntime()
      ? createTauriTransport()
      : createPreviewTransport();
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
export { GitClient } from "./clients/git";
export { TerminalClient } from "./clients/terminal";
export { PluginClient } from "./clients/plugin";
export * from "./uri";
export { createTauriTransport, isTauriRuntime } from "./transports/tauri";
export { createPreviewTransport } from "./transports/preview";
