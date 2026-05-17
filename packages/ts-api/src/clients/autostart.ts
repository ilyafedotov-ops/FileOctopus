import type { IpcTransport, AutostartStatusDto } from "../types";
import { normalizeIpcError } from "../normalizeError";

export class AutostartClient {
  constructor(private readonly transport: IpcTransport) {}

  async get(): Promise<AutostartStatusDto> {
    try {
      return await this.transport.invoke<AutostartStatusDto>("autostart.get");
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async set(enabled: boolean): Promise<AutostartStatusDto> {
    try {
      return await this.transport.invoke<AutostartStatusDto>("autostart.set", {
        enabled,
      });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }
}
