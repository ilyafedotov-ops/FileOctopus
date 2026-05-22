import type {
  IpcTransport,
  NetworkConnectionStatusResponse,
  NetworkProfileActionRequest,
  NetworkProfileAddRequest,
  NetworkProfileDeleteRequest,
  NetworkProfileResponse,
  NetworkProfileSetSecretRequest,
  NetworkProfileUpdateRequest,
  NetworkProfilesListResponse,
  NetworkStatusEvent,
  OkResponse,
} from "../types";
import { NETWORK_STATUS_EVENT } from "../events";
import { normalizeIpcError } from "../normalizeError";
import { requireListen } from "../requireListen";

export class NetworkClient {
  constructor(private readonly transport: IpcTransport) {}

  async listProfiles(): Promise<NetworkProfilesListResponse> {
    try {
      return await this.transport.invoke("network.profilesList");
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async addProfile(
    request: NetworkProfileAddRequest,
  ): Promise<NetworkProfileResponse> {
    try {
      return await this.transport.invoke("network.profileAdd", { request });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async updateProfile(
    request: NetworkProfileUpdateRequest,
  ): Promise<NetworkProfileResponse> {
    try {
      return await this.transport.invoke("network.profileUpdate", { request });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async deleteProfile(
    request: NetworkProfileDeleteRequest,
  ): Promise<OkResponse> {
    try {
      return await this.transport.invoke("network.profileDelete", { request });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async setSecret(
    request: NetworkProfileSetSecretRequest,
  ): Promise<OkResponse> {
    try {
      return await this.transport.invoke("network.profileSetSecret", {
        request,
      });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async connect(request: NetworkProfileActionRequest): Promise<OkResponse> {
    try {
      return await this.transport.invoke("network.connect", { request });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async disconnect(request: NetworkProfileActionRequest): Promise<OkResponse> {
    try {
      return await this.transport.invoke("network.disconnect", { request });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async connectionStatus(): Promise<NetworkConnectionStatusResponse> {
    try {
      return await this.transport.invoke("network.connectionStatus");
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async validateUri(uri: string): Promise<OkResponse> {
    try {
      return await this.transport.invoke("network.validateUri", { uri });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async subscribeStatusEvents(
    listener: (event: NetworkStatusEvent) => void,
  ): Promise<() => void> {
    return requireListen(this.transport, NETWORK_STATUS_EVENT, listener);
  }

  async forgetFingerprint(
    request: NetworkProfileActionRequest,
  ): Promise<OkResponse> {
    try {
      return await this.transport.invoke("network.profileForgetFingerprint", {
        request,
      });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }
}
