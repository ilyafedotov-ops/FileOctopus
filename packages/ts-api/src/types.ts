export type FileKind =
  | "file"
  | "directory"
  | "symlink"
  | "archive"
  | "virtual"
  | "unknown";

export const IPC_ERROR_CODES = {
  INVALID_URI: "invalid_uri",
  UNSUPPORTED_PROVIDER: "unsupported_provider",
  DUPLICATE_PROVIDER: "duplicate_provider",
  NOT_FOUND: "not_found",
  PERMISSION_DENIED: "permission_denied",
  TIMEOUT: "timeout",
  CANCELLED: "cancelled",
  PREFERENCES_ERROR: "preferences_error",
  INVALID_REQUEST: "invalid_request",
  INVALID_NAME: "invalid_name",
  INVALID_PATH: "invalid_path",
  DESTINATION_MISSING: "destination_missing",
  DESTINATION_CONFLICT: "destination_conflict",
  RECURSIVE_OPERATION: "recursive_operation",
  UNSUPPORTED_SYMLINK: "unsupported_symlink",
  UNSUPPORTED_TRASH: "unsupported_trash",
  IO_ERROR: "io_error",
  INTERNAL: "internal",
  IS_DIRECTORY: "is_directory",
  FILE_TOO_LARGE: "file_too_large",
  UNSUPPORTED_ALGORITHM: "unsupported_algorithm",
  SPAWN_ERROR: "spawn_error",
  NO_TERMINAL: "no_terminal",
  AUTOSTART_UNAVAILABLE: "autostart_unavailable",
  NAVIGATION_ERROR: "navigation_error",
  FOLDER_NOT_FOUND: "folder_not_found",
  UNKNOWN: "unknown",
  TAURI_UNAVAILABLE: "tauri_unavailable",
  UNSUPPORTED_TRANSPORT: "unsupported_transport",
} as const;

export type KnownIpcErrorCode =
  (typeof IPC_ERROR_CODES)[keyof typeof IPC_ERROR_CODES];
export type IpcErrorCode = KnownIpcErrorCode | (string & {});

export const FILE_OPERATION_WARNING_CODES = {
  METADATA_FAILED: "metadata_failed",
} as const;

export type KnownFileOperationWarningCode =
  (typeof FILE_OPERATION_WARNING_CODES)[keyof typeof FILE_OPERATION_WARNING_CODES];
export type FileOperationWarningCode =
  | KnownFileOperationWarningCode
  | (string & {});

export function isKnownIpcErrorCode(code: string): code is KnownIpcErrorCode {
  return Object.values(IPC_ERROR_CODES).includes(code as KnownIpcErrorCode);
}

export function isKnownFileOperationWarningCode(
  code: string,
): code is KnownFileOperationWarningCode {
  return Object.values(FILE_OPERATION_WARNING_CODES).includes(
    code as KnownFileOperationWarningCode,
  );
}

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
  code: IpcErrorCode;
  message: string;
}

export interface StatRequest {
  uri: string;
}

export interface StatResponse {
  entry: FileEntryDto;
}

export interface ReadTextFileRequest {
  uri: string;
  maxBytes?: number;
}

export interface ReadTextFileResponse {
  content: string;
  truncated: boolean;
  byteSize: number;
}

export interface ReadImageAsDataUriRequest {
  uri: string;
}

export interface ReadImageAsDataUriResponse {
  dataUri: string;
  byteSize: number;
  mimeType: string;
}

export interface ComputeHashRequest {
  uri: string;
  algorithm: string;
}

export interface ComputeHashResponse {
  hash: string;
  algorithm: string;
  byteSize: number;
}

export interface OpenTerminalRequest {
  uri: string;
}

export interface OpenTerminalResponse {
  success: boolean;
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
  activityPanelVisible: boolean;
  activityPanelWidth: number;
  confirmDelete: boolean;
  confirmPermanentDelete: boolean;
  useTrashByDefault: boolean;
  defaultConflictPolicy: string;
  accentColor: string;
  fontScale: string;
  iconScale: string;
  confirmOverwrite: boolean;
  sidebarVisible: boolean;
  statusBarVisible: boolean;
  toolbarVisible: boolean;
  paneMode: string;
  jobDrawerBehavior: string;
}

export interface AutostartStatusDto {
  enabled: boolean;
  supported: boolean;
}

export interface FavoriteEntryDto {
  id: number;
  uri: string;
  label: string;
}

export interface RecentEntryDto {
  uri: string;
  label: string;
  visitedAt: string;
}

export interface StarredEntryDto {
  uri: string;
  label: string;
  starredAt: string;
}

export interface NavigationRecordVisitRequest {
  uri: string;
  label: string;
}

export interface NavigationListFavoritesResponse {
  favorites: FavoriteEntryDto[];
}

export interface NavigationAddFavoriteRequest {
  uri: string;
  label: string;
}

export interface NavigationFavoriteResponse {
  favorite: FavoriteEntryDto;
}

export interface NavigationRemoveFavoriteRequest {
  id: number;
}

export interface NavigationRenameFavoriteRequest {
  id: number;
  label: string;
}

export interface NavigationListRecentRequest {
  bucket: "today" | "thisWeek";
}

export interface NavigationListRecentResponse {
  entries: RecentEntryDto[];
}

export interface NavigationListStarredResponse {
  entries: StarredEntryDto[];
}

export interface NavigationToggleStarredRequest {
  uri: string;
  label: string;
}

export interface NavigationToggleStarredResponse {
  starred: boolean;
}

export interface NavigationIsStarredRequest {
  uri: string;
}

export interface NavigationIsStarredResponse {
  starred: boolean;
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

export interface OkResponse {
  ok: boolean;
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
  permissions?: string | null;
  owner?: string | null;
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
  | "createFile"
  | "deletePermanently"
  | "createArchive"
  | "extractArchive"
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
  operationId: string;
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
  code: FileOperationWarningCode;
  message: string;
  uri?: string | null;
}

export interface JobSnapshot {
  jobId: string;
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
  jobId: string;
  operationKind: FileOperationKind;
  totalItems: number;
  totalBytes?: number | null;
  startedAt: string;
}

export interface JobProgressEvent {
  jobId: string;
  operationKind: FileOperationKind;
  currentItem?: string | null;
  completedItems: number;
  totalItems: number;
  completedBytes: number;
  totalBytes?: number | null;
  updatedAt: string;
}

export interface JobCompletedEvent {
  jobId: string;
  operationKind: FileOperationKind;
  completedItems: number;
  completedBytes: number;
  completedAt: string;
}

export interface JobFailedEvent {
  jobId: string;
  operationKind: FileOperationKind;
  errorCode: string;
  message: string;
  failedAt: string;
}

export interface JobCancelledEvent {
  jobId: string;
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
