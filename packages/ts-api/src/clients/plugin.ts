import type { IpcTransport } from "../types";
import type {
  PluginListResponse,
  PluginInstallRequest,
  PluginInstallResponse,
  PluginUninstallRequest,
  PluginToggleRequest,
  PluginToggleResponse,
} from "../types";

export class PluginClient {
  constructor(private readonly transport: IpcTransport) {}

  list(): Promise<PluginListResponse> {
    return this.transport.invoke<PluginListResponse>("plugin.list");
  }

  install(request: PluginInstallRequest): Promise<PluginInstallResponse> {
    return this.transport.invoke<PluginInstallResponse>("plugin.install", {
      request,
    });
  }

  uninstall(request: PluginUninstallRequest): Promise<{ ok: boolean }> {
    return this.transport.invoke<{ ok: boolean }>("plugin.uninstall", {
      request,
    });
  }

  toggle(request: PluginToggleRequest): Promise<PluginToggleResponse> {
    return this.transport.invoke<PluginToggleResponse>("plugin.toggle", {
      request,
    });
  }
}
