import type { AppInfoResponse, IpcTransport } from "./types";

export class FileOctopusClient {
  constructor(private readonly transport: IpcTransport) {}

  getAppInfo(): Promise<AppInfoResponse> {
    return this.transport.invoke<AppInfoResponse>("app.get_info");
  }
}

