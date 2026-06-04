import type {
  IpcTransport,
  NetworkConnectionStatusResponse,
  NetworkNeighborhoodRequest,
  NetworkNeighborhoodResponse,
  NetworkProfileTestRequest,
  NetworkProfileTestResponse,
  NetworkProfileActionRequest,
  NetworkProfileAddRequest,
  NetworkProfileDeleteRequest,
  NetworkProfileResponse,
  NetworkProfileSetSecretRequest,
  NetworkProfileUpdateRequest,
  NetworkProfileTrustFingerprintRequest,
  NetworkProvidersListResponse,
  NetworkProfilesListResponse,
  NetworkStatusEvent,
  OkResponse,
} from "../types";
import { NETWORK_STATUS_EVENT } from "../events";
import { requireListen } from "../requireListen";

export class NetworkClient {
  constructor(private readonly transport: IpcTransport) {}

  async listProfiles(): Promise<NetworkProfilesListResponse> {
    return this.transport.invoke("network.profilesList");
  }

  async listProviders(): Promise<NetworkProvidersListResponse> {
    return this.transport.invoke("network.providersList");
  }

  async addProfile(
    request: NetworkProfileAddRequest,
  ): Promise<NetworkProfileResponse> {
    return this.transport.invoke("network.profileAdd", { request });
  }

  async updateProfile(
    request: NetworkProfileUpdateRequest,
  ): Promise<NetworkProfileResponse> {
    return this.transport.invoke("network.profileUpdate", { request });
  }

  async deleteProfile(
    request: NetworkProfileDeleteRequest,
  ): Promise<OkResponse> {
    return this.transport.invoke("network.profileDelete", { request });
  }

  async setSecret(
    request: NetworkProfileSetSecretRequest,
  ): Promise<OkResponse> {
    return this.transport.invoke("network.profileSetSecret", {
      request,
    });
  }

  async connect(request: NetworkProfileActionRequest): Promise<OkResponse> {
    return this.transport.invoke("network.connect", { request });
  }

  async disconnect(request: NetworkProfileActionRequest): Promise<OkResponse> {
    return this.transport.invoke("network.disconnect", { request });
  }

  async connectionStatus(): Promise<NetworkConnectionStatusResponse> {
    return this.transport.invoke("network.connectionStatus");
  }

  async testProfile(
    request: NetworkProfileTestRequest,
  ): Promise<NetworkProfileTestResponse> {
    return this.transport.invoke("network.profileTest", { request });
  }

  async discoverNeighborhood(
    request: NetworkNeighborhoodRequest,
  ): Promise<NetworkNeighborhoodResponse> {
    return this.transport.invoke("network.discoverNeighborhood", {
      request,
    });
  }

  async validateUri(uri: string): Promise<OkResponse> {
    return this.transport.invoke("network.validateUri", { uri });
  }

  async subscribeStatusEvents(
    listener: (event: NetworkStatusEvent) => void,
  ): Promise<() => void> {
    return requireListen(this.transport, NETWORK_STATUS_EVENT, listener);
  }

  async forgetFingerprint(
    request: NetworkProfileActionRequest,
  ): Promise<OkResponse> {
    return this.transport.invoke("network.profileForgetFingerprint", {
      request,
    });
  }

  async trustFingerprint(
    request: NetworkProfileTrustFingerprintRequest,
  ): Promise<OkResponse> {
    return this.transport.invoke("network.profileTrustFingerprint", {
      request,
    });
  }
}
