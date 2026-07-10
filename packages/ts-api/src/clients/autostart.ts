import type { IpcTransport } from "../types";
import type { AutostartStatusDto } from "../generated/ipc";

export class AutostartClient {
  constructor(private readonly transport: IpcTransport) {}

  async get(): Promise<AutostartStatusDto> {
    return this.transport.invoke<AutostartStatusDto>("autostart.get");
  }

  async set(enabled: boolean): Promise<AutostartStatusDto> {
    return this.transport.invoke<AutostartStatusDto>("autostart.set", {
      enabled,
    });
  }
}
