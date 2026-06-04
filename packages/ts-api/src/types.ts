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
  TERMINAL_SPAWN_FAILED: "terminal_spawn_failed",
  TERMINAL_NOT_FOUND: "terminal_not_found",
  INVALID_TERMINAL_SIZE: "invalid_terminal_size",
  TERMINAL_SESSION_EXITED: "terminal_session_exited",
  AUTOSTART_UNAVAILABLE: "autostart_unavailable",
  NETWORK_DISABLED: "network_disabled",
  NAVIGATION_ERROR: "navigation_error",
  NETWORK_ERROR: "network_error",
  CONNECTION_REQUIRED: "connection_required",
  AUTHENTICATION_FAILED: "authentication_failed",
  CONNECTION_LOST: "connection_lost",
  FOLDER_NOT_FOUND: "folder_not_found",
  GIT_COMMAND_FAILED: "git_command_failed",
  UNKNOWN: "unknown",
  TAURI_UNAVAILABLE: "tauri_unavailable",
  UNSUPPORTED_TRANSPORT: "unsupported_transport",
  DEVICE_UNAVAILABLE: "device_unavailable",
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
  dataDir: string;
  networkEnabled: boolean;
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

export interface NativeMenuCommandEventDto {
  commandId: string;
  sortField?: string | null;
  preferenceValue?: string | null;
}

export interface LogRecordDto {
  level: string;
  target: string;
  message: string;
  timestampMs: number;
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

export interface ReadFileAsDataUriRequest {
  uri: string;
  maxBytes?: number;
}

export interface ReadFileAsDataUriResponse {
  dataUri: string;
  byteSize: number;
  mimeType: string;
}

export interface ReadFileRangeRequest {
  uri: string;
  offset: number;
  length: number;
}

export interface ReadFileRangeResponse {
  bytesBase64: string;
  bytesRead: number;
  byteSize: number;
  eof: boolean;
}

export interface WriteTextFileRequest {
  uri: string;
  content: string;
  maxBytes?: number;
}

export interface WriteTextFileResponse {
  byteSize: number;
  job: JobSnapshot;
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

export interface GetAclRequest {
  uri: string;
}

export interface AclEntry {
  principal: string;
  read: boolean;
  write: boolean;
  execute: boolean;
}

export interface GetAclResponse {
  owner: string | null;
  group: string | null;
  entries: AclEntry[];
  octal: string;
}

export interface SetAclRequest {
  uri: string;
  octal: string;
  recursive: boolean;
}

export interface SetAclResponse {
  success: boolean;
}

export interface DiffTextRequest {
  leftUri: string;
  rightUri: string;
  maxBytes?: number;
}

export interface DiffLine {
  kind: "equal" | "delete" | "insert";
  content: string;
  oldLine?: number | null;
  newLine?: number | null;
}

export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

export interface DiffTextResponse {
  hunks: DiffHunk[];
  leftLineCount: number;
  rightLineCount: number;
  leftTruncated: boolean;
  rightTruncated: boolean;
}

export interface GitDiscoverRequest {
  uri: string;
}

export interface GitRepoInfoDto {
  rootUri: string;
  branch?: string | null;
  headShort?: string | null;
  isDirty: boolean;
}

export interface GitDiscoverResponse {
  repo?: GitRepoInfoDto | null;
}

export type GitFileStatusDto =
  | "clean"
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "untracked"
  | "ignored"
  | "conflicted"
  | "unknown";

export interface GitStatusForDirectoryRequest {
  uri: string;
}

export interface GitStatusForDirectoryResponse {
  repo?: GitRepoInfoDto | null;
  entries: Record<string, GitFileStatusDto>;
}

export interface TerminalSpawnRequest {
  uri?: string | null;
  profileId?: string | null;
  terminalProfileId?: string | null;
  cols: number;
  rows: number;
  shell?: string | null;
  args?: string[] | null;
  env?: TerminalEnvVarDto[] | null;
  initialCommand?: string | null;
  title?: string | null;
}

export interface TerminalSpawnResponse {
  sessionId: string;
}

export interface TerminalWriteRequest {
  sessionId: string;
  data: string;
}

export interface TerminalResizeRequest {
  sessionId: string;
  cols: number;
  rows: number;
}

export interface TerminalKillRequest {
  sessionId: string;
}

export interface TerminalOkResponse {
  success: boolean;
}

export interface TerminalEnvVarDto {
  key: string;
  value: string;
}

export interface TerminalOutputEvent {
  sessionId: string;
  data: string;
}

export interface TerminalExitEvent {
  sessionId: string;
  exitCode?: number | null;
}

export type TerminalProfileScopeDto = "local" | "ssh";

export interface TerminalProfileInputDto {
  name: string;
  scope: TerminalProfileScopeDto;
  shell: string;
  args: string;
  env: string;
  workingDirectoryMode: string;
  customCwdUri: string;
  networkProfileId?: string | null;
  remoteCwd: string;
  initialCommand: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  cursorStyle: string;
  cursorBlink: boolean;
  scrollback: number;
  themeId: string;
  themeOverrides: string;
  copyOnSelect: boolean;
  rightClickAction: string;
  pasteConfirmation: boolean;
  linkHandling: string;
}

export interface TerminalProfileDto extends TerminalProfileInputDto {
  id: string;
  sortOrder: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TerminalProfilesListResponse {
  profiles: TerminalProfileDto[];
  defaultProfileId?: string | null;
}

export interface TerminalProfileResponse {
  profile: TerminalProfileDto;
}

export interface TerminalProfileAddRequest {
  profile: TerminalProfileInputDto;
}

export interface TerminalProfileUpdateRequest {
  id: string;
  profile: TerminalProfileInputDto;
}

export interface TerminalProfileActionRequest {
  id: string;
}

export interface TerminalCapabilitiesResponse {
  defaultShell: string;
  defaultArgs: string[];
  discoveredShells: string[];
  supportsSsh: boolean;
  cursorStyles: string[];
  themeIds: string[];
}

export type TerminalSessionStatusDto = "starting" | "running" | "exited";

export interface TerminalSessionDto {
  sessionId: string;
  status: TerminalSessionStatusDto;
  title: string;
  cwdUri?: string | null;
  terminalProfileId?: string | null;
  transport: string;
  cols: number;
  rows: number;
  exitCode?: number | null;
}

export interface TerminalSessionsListResponse {
  sessions: TerminalSessionDto[];
}

export interface TerminalSendTextRequest {
  sessionId: string;
  text: string;
}

export interface TerminalRunCommandRequest {
  sessionId: string;
  command: string;
  appendNewline: boolean;
  focus: boolean;
}

export interface TerminalSpawnAndRunRequest {
  uri?: string | null;
  profileId?: string | null;
  terminalProfileId?: string | null;
  cols: number;
  rows: number;
  command: string;
  title?: string | null;
}

export interface TerminalSessionEventDto extends TerminalSessionDto {
  kind: string;
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
  toolbarEntries: string;
  popupNotifications?: boolean;
  paneMode: string;
  paneDirection: string;
  jobDrawerBehavior: string;
  showAdvancedCopyOptions: boolean;
  paneTerminalHeightLeft: number;
  paneTerminalHeightRight: number;
  paneTerminalDefaultOpen: boolean;
  terminalCdOnNavigate: boolean;
  confirmClosePaneWithTerminal: boolean;
  terminalShell: string;
  terminalArgs: string;
  rememberLastUsedPanes: boolean;
  diagnosticsExportPath: string;
  customShortcuts: string;
  fileTypeColorRules: string;
  layoutProfiles: string;
  columnPresets: string;
  tabSessions: string;
  hotlistEntries: string;
  leftDefaultViewMode: string;
  rightDefaultViewMode: string;
  leftDefaultSortField: string;
  rightDefaultSortField: string;
  logLevel: string;
  experimentalFeatures: boolean;
  cacheSizeLimit: number;
  fileOperationThreads: number;
  operationIdleTimeoutSecs: number;
  networkConnectionTimeout: number;
  networkAutoReconnect: boolean;
  networkDefaultProtocol: string;
  networkSshKeyPath: string;
  networkUseSshAgent: boolean;
  editorFontFamily: string;
  editorFontSize: number;
  editorTabSize: number;
  editorWordWrap: boolean;
  editorAutoSave: boolean;
  editorSyntaxHighlighting: boolean;
  editorLineNumbers: boolean;
  viewerDefaultViewMode: string;
  viewerImageZoom: string;
  viewerMediaAutoplay: boolean;
  viewerMaxPreviewSize: number;
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

export interface NavigationRemoveRecentRequest {
  uri: string;
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

export interface VolumeDto {
  name: string;
  mountUri: string;
  totalBytes: number | null;
  availableBytes: number | null;
  fileSystemType: string | null;
  isRemovable: boolean;
  isNetwork: boolean;
}

export interface DiscoverVolumesResponse {
  volumes: VolumeDto[];
}

export interface EjectVolumeRequest {
  mountPoint: string;
}

export interface EjectVolumeResponse {
  success: boolean;
}

export interface NetworkProfileDto {
  id: string;
  label: string;
  scheme: string;
  host: string;
  port: number;
  username: string;
  authKind: string;
  privateKeyPath: string | null;
  defaultPath: string;
  defaultUri: string;
  hostKeyFingerprint: string | null;
  sortOrder: number;
  lastConnectedAt: string | null;
  lastError: string | null;
  hasStoredSecret: boolean;
  options: NetworkProtocolOptionsDto;
  createdAt: string;
  updatedAt: string;
}

export interface NetworkProtocolOptionsDto {
  ssh?: SshProtocolOptionsDto;
  smb?: SmbProtocolOptionsDto;
  s3?: S3ProtocolOptionsDto;
}

export interface SshProtocolOptionsDto {
  useAgent?: boolean | null;
  sshConfigHost?: string | null;
  proxyJump?: string | null;
  proxyCommand?: string | null;
  keepaliveSecs?: number | null;
  compression?: boolean | null;
  addressFamily?: "auto" | "ipv4" | "ipv6" | string | null;
  terminalInitialCommand?: string | null;
  terminalEnv?: NetworkEnvVarDto[];
}

export interface SmbProtocolOptionsDto {
  workgroup?: string | null;
  minProtocol?: string | null;
  signingMode?: "default" | "required" | "disabled" | string | null;
  sharePath?: string | null;
}

export interface S3ProtocolOptionsDto {
  region?: string | null;
  useTls?: boolean | null;
  pathStyle?: boolean | null;
  rootPrefix?: string | null;
}

export interface NetworkEnvVarDto {
  name: string;
  value: string;
}

export interface NetworkConnectionStatusDto {
  profileId: string;
  status: "connected" | "disconnected" | "error";
  message: string | null;
}

export interface NetworkStatusEvent {
  profileId: string;
  status: "connected" | "disconnected" | "error";
  message: string | null;
}

export interface NetworkProfilesListResponse {
  profiles: NetworkProfileDto[];
}

export interface NetworkProfileAddRequest {
  label: string;
  scheme: string;
  host: string;
  port: number;
  username: string;
  authKind: string;
  privateKeyPath?: string | null;
  defaultPath: string;
  options?: NetworkProtocolOptionsDto;
}

export interface NetworkProfileUpdateRequest {
  id: string;
  label: string;
  host: string;
  port: number;
  username: string;
  authKind: string;
  privateKeyPath?: string | null;
  defaultPath: string;
  options?: NetworkProtocolOptionsDto;
}

export interface NetworkProfileResponse {
  profile: NetworkProfileDto;
}

export interface NetworkProfileDeleteRequest {
  id: string;
}

export interface NetworkProfileSetSecretRequest {
  id: string;
  secretKind: "password" | "passphrase";
  value: string;
}

export interface NetworkProfileTrustFingerprintRequest {
  id: string;
  fingerprint: string;
}

export interface NetworkConnectionDraftDto {
  scheme?: string | null;
  host?: string | null;
  label?: string | null;
  defaultPath?: string | null;
}

export interface NetworkProfileDraftDto {
  label: string;
  scheme: string;
  host: string;
  port: number;
  username: string;
  authKind: string;
  privateKeyPath?: string | null;
  defaultPath: string;
  options?: NetworkProtocolOptionsDto;
}

export interface NetworkProfileTestRequest {
  id?: string;
  draft?: NetworkProfileDraftDto;
  password?: string;
  passphrase?: string;
}

export interface NetworkProfileTestResponse {
  ok: boolean;
  status: "success" | "warning" | "error";
  message: string;
  durationMs: number;
  resolvedUri: string | null;
  observedFingerprint: string | null;
  trustState: "trusted" | "untrusted" | "mismatch" | "notApplicable";
  warnings: string[];
}

export interface NetworkProviderCapabilityDto {
  scheme: string;
  label: string;
  category: "server" | "cloud" | "virtual";
  defaultPort: number | null;
  authKinds: string[];
  fileCapable: boolean;
  terminalCapable: boolean;
  status: "available" | "unavailable";
  missingDependency: string | null;
  supportedOptions: string[];
}

export interface NetworkProvidersListResponse {
  providers: NetworkProviderCapabilityDto[];
}

export interface NetworkProfileActionRequest {
  id: string;
}

export interface NetworkConnectionStatusResponse {
  statuses: NetworkConnectionStatusDto[];
}

export interface NetworkNeighborhoodRequest {
  uri: string;
}

export interface NetworkNeighborhoodResponse {
  uri: string;
  entries: FileEntryDto[];
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

export interface ContentSearchRequest {
  uri: string;
  query: string;
  limit?: number;
  case_sensitive?: boolean;
  use_regex?: boolean;
  file_pattern?: string;
}

export interface ContentSearchMatchDto {
  uri: string;
  parentUri: string;
  name: string;
  kind: FileKind;
  size?: number | null;
  modifiedAt?: string | null;
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
}

export interface ContentSearchResultDto {
  matches: ContentSearchMatchDto[];
  warnings: string[];
  incomplete: boolean;
}

export interface ContentSearchResponse {
  result: ContentSearchResultDto;
}

export interface ContentSearchJobResponse {
  job: JobSnapshot;
}

export interface ContentSearchMatchEventDto {
  jobId: string;
  uri: string;
  query: string;
  item: ContentSearchMatchDto;
}

export interface ContentSearchCompletedEventDto {
  jobId: string;
  uri: string;
  query: string;
  result: ContentSearchResultDto;
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
  targetUri?: string | null;
  virtualKind?: string | null;
  protocol?: string | null;
  status?: string | null;
  description?: string | null;
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

export interface ListDirectoriesRequest {
  uri: string;
}

export interface DirectoryEntryDto {
  name: string;
  uri: string;
}

export interface ListDirectoriesResponse {
  directories: DirectoryEntryDto[];
}

export interface ListArchiveRequest {
  uri: string;
}

export interface ListArchiveResponse {
  entries: FileEntryDto[];
}

export type FileOperationKind =
  | "copy"
  | "move"
  | "rename"
  | "deleteToTrash"
  | "createDirectory"
  | "createFile"
  | "writeTextFile"
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

export interface PauseJobRequest {
  jobId: string;
}

export interface ResumeJobRequest {
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

export interface JobPausedEvent {
  jobId: string;
  operationKind: FileOperationKind;
  pausedAt: string;
}

export interface JobResumedEvent {
  jobId: string;
  operationKind: FileOperationKind;
  resumedAt: string;
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

export interface PluginManifestDto {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  entryPoint: string;
  permissions: string[];
  minAppVersion?: string | null;
}

export interface InstalledPluginDto {
  manifest: PluginManifestDto;
  installPath: string;
  enabled: boolean;
}

export interface PluginListResponse {
  plugins: InstalledPluginDto[];
}

export interface PluginInstallRequest {
  sourcePath: string;
}

export interface PluginInstallResponse {
  plugin: InstalledPluginDto;
}

export interface PluginUninstallRequest {
  pluginId: string;
}

export interface PluginToggleRequest {
  pluginId: string;
  enabled: boolean;
}

export interface PluginToggleResponse {
  plugin: InstalledPluginDto;
}

export interface CompareFilesRequest {
  leftUri: string;
  rightUri: string;
  mode: string;
}

export interface DiffLineDto {
  lineNumberLeft: number | null;
  lineNumberRight: number | null;
  content: string;
  lineType: string;
}

export interface DiffHunkDto {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLineDto[];
}

export interface ByteDifferenceDto {
  offset: number;
  leftByte: number;
  rightByte: number;
}

export interface CompareFilesResponse {
  identical: boolean;
  hunks: DiffHunkDto[];
  byteDifferences: ByteDifferenceDto[];
}

// ── Directory Sync ──────────────────────────────────────────────

export interface SyncDirectoriesRequest {
  leftUri: string;
  rightUri: string;
  comparison: "name" | "size" | "date";
  recursive: boolean;
}

export interface SyncEntryDto {
  name: string;
  leftUri: string | null;
  rightUri: string | null;
  leftSize: number | null;
  rightSize: number | null;
  leftModified: string | null;
  rightModified: string | null;
  leftIsDir: boolean;
  rightIsDir: boolean;
  status: string;
}

export interface SyncDirectoriesResponse {
  leftUri: string;
  rightUri: string;
  entries: SyncEntryDto[];
  recursive: boolean;
}
