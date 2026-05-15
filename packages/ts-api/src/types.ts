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
  buildProfile: string;
  commitSha?: string | null;
  targetOs: string;
}

export interface AppDataHealthResponse {
  configDir: string;
  dataDir: string;
  logDir: string;
  databasePath: string;
  databaseExists: boolean;
  schemaVersion: number;
  missingDirectories: string[];
  startupRecoveryCount: number;
}

export interface ExportDiagnosticsBundleRequest {
  destination: string;
}

export interface ExportDiagnosticsBundleResponse {
  path: string;
  files: string[];
}

export interface ClearOperationHistoryResponse {
  deletedCount: number;
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
  requestId: string;
  panelId?: string;
  batchSize?: number;
  includeHidden?: boolean;
}

export interface ListStartResponse {
  sessionId: string;
  requestId: string;
}

export interface UserPreferencesDto {
  theme: string;
  density: string;
  defaultViewMode: string;
  showHiddenFiles: boolean;
  sidebarWidth: number;
  splitRatio: number;
}

export interface GetPreferencesResponse {
  preferences: UserPreferencesDto;
}

export interface SetPreferenceRequest {
  key: string;
  value: string;
}

export interface SetPreferenceResponse {
  preferences: UserPreferencesDto;
}

export interface StandardLocationDto {
  id: string;
  name: string;
  uri: string;
  section: string;
}

export interface StandardLocationsResponse {
  locations: StandardLocationDto[];
}

export interface PathRequest {
  uri: string;
}

export interface DeletePermanentlyRequest {
  uris: string[];
}

export interface OkResponse {
  ok: boolean;
}

export interface CreateFileRequest {
  uri: string;
}

export interface CreateFileResponse {
  entry: FileEntryDto;
}

export interface PathPropertiesRequest {
  uri: string;
  includeFolderSummary?: boolean;
}

export interface PathPropertiesDto {
  uri: string;
  name: string;
  kind: FileKind;
  size?: number | null;
  totalSize?: number | null;
  itemCount?: number | null;
  fileCount?: number | null;
  directoryCount?: number | null;
  modifiedAt?: string | null;
  createdAt?: string | null;
  accessedAt?: string | null;
  isHidden: boolean;
  isSymlink: boolean;
  symlinkTarget?: string | null;
  readonly: boolean;
  warnings: string[];
}

export interface PathPropertiesResponse {
  properties: PathPropertiesDto;
}

export interface FolderSizeRequest {
  uri: string;
}

export interface FolderSizeSummaryDto {
  totalSize: number;
  itemCount: number;
  fileCount: number;
  directoryCount: number;
  warnings: string[];
  incomplete: boolean;
}

export interface FolderSizeResponse {
  summary: FolderSizeSummaryDto;
}

export interface FolderSizeJobResponse {
  job: JobSnapshot;
}

export interface FolderSizeCompletedEventDto {
  jobId: string;
  uri: string;
  summary: FolderSizeSummaryDto;
}

export interface RecursiveSearchRequest {
  uri: string;
  query: string;
  limit?: number;
}

export interface SearchMatchDto {
  uri: string;
  parentUri: string;
  name: string;
  kind: FileKind;
  size?: number | null;
  modifiedAt?: string | null;
}

export interface RecursiveSearchResultDto {
  matches: SearchMatchDto[];
  warnings: string[];
  incomplete: boolean;
}

export interface RecursiveSearchResponse {
  result: RecursiveSearchResultDto;
}

export interface RecursiveSearchJobResponse {
  job: JobSnapshot;
}

export interface RecursiveSearchMatchEventDto {
  jobId: string;
  uri: string;
  query: string;
  item: SearchMatchDto;
}

export interface RecursiveSearchCompletedEventDto {
  jobId: string;
  uri: string;
  query: string;
  result: RecursiveSearchResultDto;
}

export interface WatchStartRequest {
  uri: string;
}

export interface WatchEventDto {
  uri: string;
  changedAt: string;
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
  requestId: string;
  uri: string;
  entries: FileEntryDto[];
  batchIndex: number;
  isComplete: boolean;
  totalHint?: number | null;
  error?: IpcError | null;
}

export type FileOperationKind =
  | "copy"
  | "move"
  | "rename"
  | "deleteToTrash"
  | "createDirectory"
  | "folderSize"
  | "recursiveSearch";

export type ConflictPolicy =
  | "fail"
  | "skip"
  | "overwrite"
  | "renameNew"
  | "renameExisting";

export type JobStatus =
  | "queued"
  | "running"
  | "paused"
  | "cancelled"
  | "completed"
  | "failed";

export interface FileOperationRequestDto {
  kind: FileOperationKind;
  sources: string[];
  destination?: string | null;
  newName?: string | null;
  conflictPolicy?: ConflictPolicy | null;
}

export interface PlanFileOperationRequest {
  operation: FileOperationRequestDto;
}

export interface PlanFileOperationResponse {
  plan: FileOperationPlanDto;
}

export interface StartFileOperationRequest {
  plan: FileOperationPlanDto;
}

export interface StartFileOperationResponse {
  job: JobSnapshot;
}

export interface CancelJobRequest {
  jobId: string;
}

export interface JobStatusRequest {
  jobId: string;
}

export interface JobStatusResponse {
  job: JobSnapshot;
}

export interface ListRecentOperationsRequest {
  limit?: number;
}

export interface ListRecentOperationsResponse {
  operations: OperationHistoryRecordDto[];
}

export interface FileOperationPlanDto {
  operationId: string;
  kind: FileOperationKind;
  sources: string[];
  destination?: string | null;
  newName?: string | null;
  conflictPolicy: ConflictPolicy;
  items: FileOperationItemDto[];
  conflicts: FileOperationConflictDto[];
  warnings: FileOperationWarningDto[];
  totalItems: number;
  totalBytes?: number | null;
}

export interface FileOperationItemDto {
  source?: string | null;
  destination?: string | null;
  kind: FileKind;
  size?: number | null;
  recursive: boolean;
}

export interface FileOperationConflictDto {
  source: string;
  destination: string;
}

export interface FileOperationWarningDto {
  code: string;
  message: string;
  uri?: string | null;
}

export interface JobId {
  value?: string;
}

export interface JobSnapshot {
  jobId: string | JobId;
  operationKind: FileOperationKind;
  status: JobStatus;
  currentItem?: string | null;
  completedItems: number;
  totalItems: number;
  completedBytes: number;
  totalBytes?: number | null;
  errorCode?: string | null;
  message?: string | null;
  startedAt: string;
  updatedAt: string;
}

export interface JobStartedEvent {
  jobId: string | JobId;
  operationKind: FileOperationKind;
  totalItems: number;
  totalBytes?: number | null;
  startedAt: string;
}

export interface JobProgressEvent {
  jobId: string | JobId;
  operationKind: FileOperationKind;
  currentItem?: string | null;
  completedItems: number;
  totalItems: number;
  completedBytes: number;
  totalBytes?: number | null;
  updatedAt: string;
}

export interface JobCompletedEvent {
  jobId: string | JobId;
  operationKind: FileOperationKind;
  completedItems: number;
  completedBytes: number;
  completedAt: string;
}

export interface JobFailedEvent {
  jobId: string | JobId;
  operationKind: FileOperationKind;
  errorCode: string;
  message: string;
  failedAt: string;
}

export interface JobCancelledEvent {
  jobId: string | JobId;
  operationKind: FileOperationKind;
  cancelledAt: string;
}

export interface OperationHistoryRecordDto {
  jobId: string;
  operationKind: string;
  sourceCount: number;
  representativeSourcePath?: string | null;
  destinationPath?: string | null;
  status: string;
  startedAt: string;
  completedAt?: string | null;
  errorCode?: string | null;
}
