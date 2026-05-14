export interface IpcTransport {
  invoke<TResponse>(command: string, args?: Record<string, unknown>): Promise<TResponse>;
}

export interface AppInfoResponse {
  name: string;
  version: string;
}

