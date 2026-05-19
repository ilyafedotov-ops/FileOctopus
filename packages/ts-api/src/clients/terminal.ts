import type {
  IpcTransport,
  TerminalExitEvent,
  TerminalKillRequest,
  TerminalOkResponse,
  TerminalOutputEvent,
  TerminalResizeRequest,
  TerminalSpawnRequest,
  TerminalSpawnResponse,
  TerminalWriteRequest,
  UnlistenFn,
} from "../types";
import { TERMINAL_EXIT_EVENT, TERMINAL_OUTPUT_EVENT } from "../events";
import { normalizeIpcError } from "../normalizeError";
import { requireListen } from "../requireListen";

export class TerminalClient {
  constructor(private readonly transport: IpcTransport) {}

  async spawn(request: TerminalSpawnRequest): Promise<TerminalSpawnResponse> {
    try {
      return await this.transport.invoke<TerminalSpawnResponse>(
        "terminal.spawn",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async write(request: TerminalWriteRequest): Promise<TerminalOkResponse> {
    try {
      return await this.transport.invoke<TerminalOkResponse>("terminal.write", {
        request,
      });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async resize(request: TerminalResizeRequest): Promise<TerminalOkResponse> {
    try {
      return await this.transport.invoke<TerminalOkResponse>(
        "terminal.resize",
        { request },
      );
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async kill(request: TerminalKillRequest): Promise<TerminalOkResponse> {
    try {
      return await this.transport.invoke<TerminalOkResponse>("terminal.kill", {
        request,
      });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  onOutput(handler: (event: TerminalOutputEvent) => void): Promise<UnlistenFn> {
    return requireListen(this.transport, TERMINAL_OUTPUT_EVENT, handler);
  }

  onExit(handler: (event: TerminalExitEvent) => void): Promise<UnlistenFn> {
    return requireListen(this.transport, TERMINAL_EXIT_EVENT, handler);
  }
}
