import type { IpcTransport, UnlistenFn } from "../types";
import type {
  TerminalCapabilitiesResponse,
  TerminalExitEventDto,
  TerminalKillRequest,
  TerminalOkResponse,
  TerminalProfileActionRequest,
  TerminalOutputEventDto,
  TerminalProfileResponse,
  TerminalProfilesListResponse,
  TerminalResizeRequest,
  TerminalRunCommandRequest,
  TerminalSendTextRequest,
  TerminalSessionEventDto,
  TerminalSessionsListResponse,
  TerminalSpawnRequest,
  TerminalSpawnResponse,
  TerminalWriteRequest,
} from "../generated/ipc";
import type {
  TerminalProfileAddInput,
  TerminalProfileUpdateInput,
  TerminalSpawnAndRunInput,
} from "../input";
import {
  TERMINAL_EXIT_EVENT,
  TERMINAL_OUTPUT_EVENT,
  TERMINAL_SESSION_EVENT,
} from "../events";
import { requireListen } from "../requireListen";

export class TerminalClient {
  constructor(private readonly transport: IpcTransport) {}

  async spawn(request: TerminalSpawnRequest): Promise<TerminalSpawnResponse> {
    return this.transport.invoke<TerminalSpawnResponse>("terminal.spawn", {
      request,
    });
  }

  async write(request: TerminalWriteRequest): Promise<TerminalOkResponse> {
    return this.transport.invoke<TerminalOkResponse>("terminal.write", {
      request,
    });
  }

  async resize(request: TerminalResizeRequest): Promise<TerminalOkResponse> {
    return this.transport.invoke<TerminalOkResponse>("terminal.resize", {
      request,
    });
  }

  async kill(request: TerminalKillRequest): Promise<TerminalOkResponse> {
    return this.transport.invoke<TerminalOkResponse>("terminal.kill", {
      request,
    });
  }

  async capabilities(): Promise<TerminalCapabilitiesResponse> {
    return this.transport.invoke<TerminalCapabilitiesResponse>(
      "terminal.capabilities",
    );
  }

  async listProfiles(): Promise<TerminalProfilesListResponse> {
    return this.transport.invoke<TerminalProfilesListResponse>(
      "terminal.profilesList",
    );
  }

  async addProfile(
    request: TerminalProfileAddInput,
  ): Promise<TerminalProfileResponse> {
    return this.transport.invoke<TerminalProfileResponse>(
      "terminal.profileAdd",
      { request },
    );
  }

  async updateProfile(
    request: TerminalProfileUpdateInput,
  ): Promise<TerminalProfileResponse> {
    return this.transport.invoke<TerminalProfileResponse>(
      "terminal.profileUpdate",
      { request },
    );
  }

  async deleteProfile(
    request: TerminalProfileActionRequest,
  ): Promise<TerminalOkResponse> {
    return this.transport.invoke<TerminalOkResponse>("terminal.profileDelete", {
      request,
    });
  }

  async setDefaultProfile(
    request: TerminalProfileActionRequest,
  ): Promise<TerminalProfileResponse> {
    return this.transport.invoke<TerminalProfileResponse>(
      "terminal.profileSetDefault",
      { request },
    );
  }

  async listSessions(): Promise<TerminalSessionsListResponse> {
    return this.transport.invoke<TerminalSessionsListResponse>(
      "terminal.sessionsList",
    );
  }

  async sendText(
    request: TerminalSendTextRequest,
  ): Promise<TerminalOkResponse> {
    return this.transport.invoke<TerminalOkResponse>("terminal.sendText", {
      request,
    });
  }

  async runCommand(
    request: TerminalRunCommandRequest,
  ): Promise<TerminalOkResponse> {
    return this.transport.invoke<TerminalOkResponse>("terminal.runCommand", {
      request,
    });
  }

  async spawnAndRun(
    request: TerminalSpawnAndRunInput,
  ): Promise<TerminalSpawnResponse> {
    return this.transport.invoke<TerminalSpawnResponse>(
      "terminal.spawnAndRun",
      { request },
    );
  }

  onOutput(
    handler: (event: TerminalOutputEventDto) => void,
  ): Promise<UnlistenFn> {
    return requireListen(this.transport, TERMINAL_OUTPUT_EVENT, handler);
  }

  onExit(handler: (event: TerminalExitEventDto) => void): Promise<UnlistenFn> {
    return requireListen(this.transport, TERMINAL_EXIT_EVENT, handler);
  }

  onSession(
    handler: (event: TerminalSessionEventDto) => void,
  ): Promise<UnlistenFn> {
    return requireListen(this.transport, TERMINAL_SESSION_EVENT, handler);
  }
}
