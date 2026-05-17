import { IPC_ERROR_CODES } from "./types";
import type { IpcError } from "./types";

export function normalizeIpcError(error: unknown): IpcError {
  if (isIpcError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return {
      code: IPC_ERROR_CODES.UNKNOWN,
      message: error.message,
    };
  }

  if (typeof error === "string") {
    return {
      code: IPC_ERROR_CODES.UNKNOWN,
      message: error,
    };
  }

  return {
    code: IPC_ERROR_CODES.UNKNOWN,
    message: "Unexpected IPC error",
  };
}

function isIpcError(error: unknown): error is IpcError {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as Partial<IpcError>;

  return (
    typeof candidate.code === "string" && typeof candidate.message === "string"
  );
}
