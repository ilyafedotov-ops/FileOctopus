import { IPC_ERROR_CODES } from "./types";
import type { IpcError, IpcTransport, UnlistenFn } from "./types";

export function requireListen<TPayload>(
  transport: IpcTransport,
  event: string,
  handler: (payload: TPayload) => void,
): Promise<UnlistenFn> {
  if (!transport.listen) {
    return Promise.reject({
      code: IPC_ERROR_CODES.UNSUPPORTED_TRANSPORT,
      message: "Transport does not support event subscriptions",
    } satisfies IpcError);
  }

  return transport.listen<TPayload>(event, handler);
}
