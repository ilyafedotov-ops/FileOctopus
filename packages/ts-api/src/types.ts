export type FileKind =
  | "file"
  | "directory"
  | "symlink"
  | "archive"
  | "virtual"
  | "unknown";

export interface IpcTransport {
  invoke<TResponse>(
    command: string,
    args?: Record<string, unknown>,
  ): Promise<TResponse>;
  listen?<TPayload>(
    event: string,
    handler: (payload: TPayload) => void,
  ): Promise<UnlistenFn>;
}

export type UnlistenFn = () => void;

export interface AppInfoResponse {
  name: string;
  version: string;
}

export interface IpcError {
  code: string;
  message: string;
}

export interface StatRequest {
  uri: string;
}

export interface StatResponse {
  entry: FileEntryDto;
}

export interface ListStartRequest {
  uri: string;
  batchSize?: number;
  includeHidden?: boolean;
}

export interface ListStartResponse {
  sessionId: string;
}

export interface FileEntryDto {
  uri: string;
  name: string;
  extension?: string | null;
  kind: FileKind;
  size?: number | null;
  modifiedAt?: string | null;
  createdAt?: string | null;
  accessedAt?: string | null;
  isHidden: boolean;
  isSymlink: boolean;
  symlinkTarget?: string | null;
  providerId: string;
  canRead: boolean;
  canList: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canRename: boolean;
}

export interface DirectoryBatchEventDto {
  sessionId: string;
  uri: string;
  entries: FileEntryDto[];
  batchIndex: number;
  isComplete: boolean;
  totalHint?: number | null;
  error?: IpcError | null;
}
