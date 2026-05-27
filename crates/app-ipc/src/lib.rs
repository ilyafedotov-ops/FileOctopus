use std::collections::HashMap;

use chrono::{DateTime, Utc};
use git_intel::{GitDirectoryStatus, GitError, GitFileStatus, GitRepoInfo};
use jobs::{JobEvent, JobSnapshot};
use serde::{Deserialize, Serialize};
use vfs::{
    ConflictPolicy, DirectoryBatch, FileEntry, FileKind, FileOperationConflict, FileOperationError,
    FileOperationItem, FileOperationKind, FileOperationPlan, FileOperationRequest,
    FileOperationWarning, ResourceUri, VfsError,
};

pub const DIRECTORY_BATCH_EVENT: &str = "directory:batch";
pub const JOB_STARTED_EVENT: &str = "fileOperation:job:started";
pub const JOB_PROGRESS_EVENT: &str = "fileOperation:job:progress";
pub const JOB_COMPLETED_EVENT: &str = "fileOperation:job:completed";
pub const JOB_FAILED_EVENT: &str = "fileOperation:job:failed";
pub const JOB_CANCELLED_EVENT: &str = "fileOperation:job:cancelled";
pub const JOB_PAUSED_EVENT: &str = "fileOperation:job:paused";
pub const JOB_RESUMED_EVENT: &str = "fileOperation:job:resumed";
pub const WATCH_CHANGED_EVENT: &str = "fs:watch:changed";
pub const NETWORK_STATUS_EVENT: &str = "network:status";
pub const FOLDER_SIZE_COMPLETED_EVENT: &str = "fs:folderSize:completed";
pub const RECURSIVE_SEARCH_MATCH_EVENT: &str = "fs:recursiveSearch:match";
pub const RECURSIVE_SEARCH_COMPLETED_EVENT: &str = "fs:recursiveSearch:completed";
pub const TERMINAL_OUTPUT_EVENT: &str = "terminal:output";
pub const TERMINAL_EXIT_EVENT: &str = "terminal:exit";
pub const NATIVE_MENU_COMMAND_EVENT: &str = "nativeMenu:command";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfoResponse {
    pub name: String,
    pub version: String,
    pub build_profile: String,
    pub commit_sha: Option<String>,
    pub target_os: String,
    pub data_dir: String,
    pub network_enabled: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserPreferencesDto {
    pub theme: String,
    pub density: String,
    pub default_view_mode: String,
    pub show_hidden_files: bool,
    pub sidebar_width: u32,
    pub split_ratio: f64,
    pub activity_panel_visible: bool,
    pub activity_panel_width: u32,
    pub confirm_delete: bool,
    pub confirm_permanent_delete: bool,
    pub use_trash_by_default: bool,
    pub default_conflict_policy: String,
    pub accent_color: String,
    pub font_scale: String,
    pub icon_scale: String,
    pub confirm_overwrite: bool,
    pub sidebar_visible: bool,
    pub status_bar_visible: bool,
    pub toolbar_visible: bool,
    #[serde(default)]
    pub toolbar_entries: String,
    pub pane_mode: String,
    pub pane_direction: String,
    pub job_drawer_behavior: String,
    pub show_advanced_copy_options: bool,
    pub pane_terminal_height_left: f64,
    pub pane_terminal_height_right: f64,
    pub pane_terminal_default_open: bool,
    pub terminal_cd_on_navigate: bool,
    pub confirm_close_pane_with_terminal: bool,
    pub terminal_shell: String,
    pub terminal_args: String,
    pub remember_last_used_panes: bool,
    pub diagnostics_export_path: String,
    #[serde(default)]
    pub custom_shortcuts: String,
    #[serde(default)]
    pub file_type_color_rules: String,
    #[serde(default)]
    pub layout_profiles: String,
    #[serde(default)]
    pub column_presets: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutostartStatusDto {
    pub enabled: bool,
    pub supported: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FavoriteEntryDto {
    pub id: u64,
    pub uri: String,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentEntryDto {
    pub uri: String,
    pub label: String,
    pub visited_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StarredEntryDto {
    pub uri: String,
    pub label: String,
    pub starred_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NavigationRecordVisitRequest {
    pub uri: String,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NavigationListFavoritesResponse {
    pub favorites: Vec<FavoriteEntryDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NavigationAddFavoriteRequest {
    pub uri: String,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NavigationFavoriteResponse {
    pub favorite: FavoriteEntryDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NavigationRemoveFavoriteRequest {
    pub id: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NavigationRenameFavoriteRequest {
    pub id: u64,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NavigationListRecentRequest {
    pub bucket: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NavigationListRecentResponse {
    pub entries: Vec<RecentEntryDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NavigationListStarredResponse {
    pub entries: Vec<StarredEntryDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NavigationToggleStarredRequest {
    pub uri: String,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NavigationToggleStarredResponse {
    pub starred: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NavigationIsStarredRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NavigationRemoveRecentRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NavigationIsStarredResponse {
    pub starred: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetPreferencesResponse {
    pub preferences: UserPreferencesDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetPreferenceRequest {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetPreferenceResponse {
    pub preferences: UserPreferencesDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppDataHealthResponse {
    pub config_dir: String,
    pub data_dir: String,
    pub log_dir: String,
    pub database_path: String,
    pub database_exists: bool,
    pub schema_version: u32,
    pub missing_directories: Vec<String>,
    pub startup_recovery_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportDiagnosticsBundleRequest {
    pub destination: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportDiagnosticsBundleResponse {
    pub path: String,
    pub files: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeMenuCommandEventDto {
    pub command_id: String,
    pub sort_field: Option<String>,
    pub preference_value: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearOperationHistoryResponse {
    pub deleted_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatResponse {
    pub entry: FileEntryDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadTextFileRequest {
    pub uri: String,
    pub max_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadTextFileResponse {
    pub content: String,
    pub truncated: bool,
    pub byte_size: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadImageAsDataUriRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadImageAsDataUriResponse {
    pub data_uri: String,
    pub byte_size: u64,
    pub mime_type: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadFileAsDataUriRequest {
    pub uri: String,
    pub max_bytes: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadFileAsDataUriResponse {
    pub data_uri: String,
    pub byte_size: u64,
    pub mime_type: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadFileRangeRequest {
    pub uri: String,
    pub offset: u64,
    pub length: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadFileRangeResponse {
    /// base64-encoded bytes (safe for arbitrary binary payloads over IPC)
    pub bytes_base64: String,
    pub bytes_read: u64,
    pub byte_size: u64,
    pub eof: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteTextFileRequest {
    pub uri: String,
    pub content: String,
    /// Optional safety cap on encoded UTF-8 byte length. When omitted, the
    /// handler enforces a default 10 MB cap.
    pub max_bytes: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteTextFileResponse {
    pub byte_size: u64,
    pub job: JobSnapshot,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComputeHashRequest {
    pub uri: String,
    pub algorithm: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComputeHashResponse {
    pub hash: String,
    pub algorithm: String,
    pub byte_size: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenTerminalRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenTerminalResponse {
    pub success: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitDiscoverRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRepoInfoDto {
    pub root_uri: String,
    pub branch: Option<String>,
    pub head_short: Option<String>,
    pub is_dirty: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitDiscoverResponse {
    pub repo: Option<GitRepoInfoDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusForDirectoryRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusForDirectoryResponse {
    pub repo: Option<GitRepoInfoDto>,
    pub entries: HashMap<String, GitFileStatus>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSpawnRequest {
    #[serde(default)]
    pub uri: Option<String>,
    #[serde(default)]
    pub profile_id: Option<String>,
    pub cols: u16,
    pub rows: u16,
    #[serde(default)]
    pub shell: Option<String>,
    #[serde(default)]
    pub args: Option<Vec<String>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSpawnResponse {
    pub session_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalWriteRequest {
    pub session_id: String,
    pub data: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalResizeRequest {
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalKillRequest {
    pub session_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalOkResponse {
    pub success: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalOutputEventDto {
    pub session_id: String,
    pub data: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalExitEventDto {
    pub session_id: String,
    pub exit_code: Option<i32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListStartRequest {
    pub uri: String,
    pub request_id: String,
    pub panel_id: Option<String>,
    pub batch_size: Option<usize>,
    pub include_hidden: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListStartResponse {
    pub session_id: String,
    pub request_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StandardLocationDto {
    pub id: String,
    pub name: String,
    pub uri: String,
    pub section: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StandardLocationsResponse {
    pub locations: Vec<StandardLocationDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VolumeDto {
    pub name: String,
    pub mount_uri: String,
    pub total_bytes: Option<u64>,
    pub available_bytes: Option<u64>,
    pub file_system_type: Option<String>,
    pub is_removable: bool,
    pub is_network: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoverVolumesResponse {
    pub volumes: Vec<VolumeDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EjectVolumeRequest {
    pub mount_point: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EjectVolumeResponse {
    pub success: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProfileDto {
    pub id: String,
    pub label: String,
    pub scheme: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_kind: String,
    pub private_key_path: Option<String>,
    pub default_path: String,
    pub default_uri: String,
    pub host_key_fingerprint: Option<String>,
    pub sort_order: i64,
    pub last_connected_at: Option<String>,
    pub last_error: Option<String>,
    pub has_stored_secret: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkConnectionStatusDto {
    pub profile_id: String,
    pub status: String,
    pub message: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkStatusEventDto {
    pub profile_id: String,
    pub status: String,
    pub message: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProfilesListResponse {
    pub profiles: Vec<NetworkProfileDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProfileAddRequest {
    pub label: String,
    pub scheme: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_kind: String,
    pub private_key_path: Option<String>,
    pub default_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProfileUpdateRequest {
    pub id: String,
    pub label: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_kind: String,
    pub private_key_path: Option<String>,
    pub default_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProfileResponse {
    pub profile: NetworkProfileDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProfileDeleteRequest {
    pub id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProfileSetSecretRequest {
    pub id: String,
    pub secret_kind: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProfileActionRequest {
    pub id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkConnectionStatusResponse {
    pub statuses: Vec<NetworkConnectionStatusDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkNeighborhoodRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkNeighborhoodResponse {
    pub uri: String,
    pub entries: Vec<FileEntryDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OkResponse {
    pub ok: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathPropertiesRequest {
    pub uri: String,
    pub include_folder_summary: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathPropertiesDto {
    pub uri: String,
    pub name: String,
    pub kind: FileKind,
    pub size: Option<u64>,
    pub total_size: Option<u64>,
    pub item_count: Option<u64>,
    pub file_count: Option<u64>,
    pub directory_count: Option<u64>,
    pub modified_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub accessed_at: Option<DateTime<Utc>>,
    pub is_hidden: bool,
    pub is_symlink: bool,
    pub symlink_target: Option<String>,
    pub readonly: bool,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathPropertiesResponse {
    pub properties: PathPropertiesDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderSizeRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderSizeSummaryDto {
    pub total_size: u64,
    pub item_count: u64,
    pub file_count: u64,
    pub directory_count: u64,
    pub warnings: Vec<String>,
    pub incomplete: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderSizeResponse {
    pub summary: FolderSizeSummaryDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderSizeJobResponse {
    pub job: JobSnapshot,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderSizeCompletedEventDto {
    pub job_id: String,
    pub uri: String,
    pub summary: FolderSizeSummaryDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecursiveSearchRequest {
    pub uri: String,
    pub query: String,
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatchDto {
    pub uri: String,
    pub parent_uri: String,
    pub name: String,
    pub kind: FileKind,
    pub size: Option<u64>,
    pub modified_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecursiveSearchResultDto {
    pub matches: Vec<SearchMatchDto>,
    pub warnings: Vec<String>,
    pub incomplete: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecursiveSearchResponse {
    pub result: RecursiveSearchResultDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecursiveSearchJobResponse {
    pub job: JobSnapshot,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecursiveSearchMatchEventDto {
    pub job_id: String,
    pub uri: String,
    pub query: String,
    pub item: SearchMatchDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecursiveSearchCompletedEventDto {
    pub job_id: String,
    pub uri: String,
    pub query: String,
    pub result: RecursiveSearchResultDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchStartRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchEventDto {
    pub uri: String,
    pub changed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntryDto {
    pub uri: String,
    pub name: String,
    pub extension: Option<String>,
    pub kind: FileKind,
    pub size: Option<u64>,
    pub modified_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub accessed_at: Option<DateTime<Utc>>,
    pub is_hidden: bool,
    pub is_symlink: bool,
    pub symlink_target: Option<String>,
    pub provider_id: String,
    pub can_read: bool,
    pub can_list: bool,
    pub can_write: bool,
    pub can_delete: bool,
    pub can_rename: bool,
    pub permissions: Option<String>,
    pub owner: Option<String>,
    #[serde(default)]
    pub target_uri: Option<String>,
    #[serde(default)]
    pub virtual_kind: Option<String>,
    #[serde(default)]
    pub protocol: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryBatchEventDto {
    pub session_id: String,
    pub request_id: String,
    pub uri: String,
    pub entries: Vec<FileEntryDto>,
    pub batch_index: u64,
    pub is_complete: bool,
    pub total_hint: Option<u64>,
    pub error: Option<IpcError>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListDirectoriesRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryEntryDto {
    pub name: String,
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListDirectoriesResponse {
    pub directories: Vec<DirectoryEntryDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationRequestDto {
    pub kind: FileOperationKind,
    pub sources: Vec<String>,
    pub destination: Option<String>,
    pub new_name: Option<String>,
    pub conflict_policy: Option<ConflictPolicy>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanFileOperationRequest {
    pub operation: FileOperationRequestDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanFileOperationResponse {
    pub plan: FileOperationPlanDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartFileOperationRequest {
    pub operation_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartFileOperationResponse {
    pub job: JobSnapshot,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelJobRequest {
    pub job_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PauseJobRequest {
    pub job_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResumeJobRequest {
    pub job_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobStatusRequest {
    pub job_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobStatusResponse {
    pub job: JobSnapshot,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListRecentOperationsRequest {
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListRecentOperationsResponse {
    pub operations: Vec<OperationHistoryRecordDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationHistoryRecordDto {
    pub job_id: String,
    pub operation_kind: String,
    pub source_count: u64,
    pub representative_source_path: Option<String>,
    pub destination_path: Option<String>,
    pub status: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub error_code: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationPlanDto {
    pub operation_id: String,
    pub kind: FileOperationKind,
    pub sources: Vec<String>,
    pub destination: Option<String>,
    pub new_name: Option<String>,
    pub conflict_policy: ConflictPolicy,
    pub items: Vec<FileOperationItemDto>,
    pub conflicts: Vec<FileOperationConflictDto>,
    pub warnings: Vec<FileOperationWarningDto>,
    pub total_items: u64,
    pub total_bytes: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationItemDto {
    pub source: Option<String>,
    pub destination: Option<String>,
    pub kind: FileKind,
    pub size: Option<u64>,
    pub recursive: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationConflictDto {
    pub source: String,
    pub destination: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationWarningDto {
    pub code: String,
    pub message: String,
    pub uri: Option<String>,
}

pub mod error_codes {
    pub const INVALID_URI: &str = "invalid_uri";
    pub const UNSUPPORTED_PROVIDER: &str = "unsupported_provider";
    pub const DUPLICATE_PROVIDER: &str = "duplicate_provider";
    pub const NOT_FOUND: &str = "not_found";
    pub const PERMISSION_DENIED: &str = "permission_denied";
    pub const DEVICE_UNAVAILABLE: &str = "device_unavailable";
    pub const TIMEOUT: &str = "timeout";
    pub const CANCELLED: &str = "cancelled";
    pub const PREFERENCES_ERROR: &str = "preferences_error";
    pub const INVALID_REQUEST: &str = "invalid_request";
    pub const INVALID_NAME: &str = "invalid_name";
    pub const INVALID_PATH: &str = "invalid_path";
    pub const DESTINATION_MISSING: &str = "destination_missing";
    pub const DESTINATION_CONFLICT: &str = "destination_conflict";
    pub const RECURSIVE_OPERATION: &str = "recursive_operation";
    pub const UNSUPPORTED_SYMLINK: &str = "unsupported_symlink";
    pub const UNSUPPORTED_TRASH: &str = "unsupported_trash";
    pub const IO_ERROR: &str = "io_error";
    pub const INTERNAL: &str = "internal";
    pub const IS_DIRECTORY: &str = "is_directory";
    pub const FILE_TOO_LARGE: &str = "file_too_large";
    pub const UNSUPPORTED_ALGORITHM: &str = "unsupported_algorithm";
    pub const SPAWN_ERROR: &str = "spawn_error";
    pub const NO_TERMINAL: &str = "no_terminal";
    pub const TERMINAL_SPAWN_FAILED: &str = "terminal_spawn_failed";
    pub const TERMINAL_NOT_FOUND: &str = "terminal_not_found";
    pub const INVALID_TERMINAL_SIZE: &str = "invalid_terminal_size";
    pub const TERMINAL_SESSION_EXITED: &str = "terminal_session_exited";
    pub const AUTOSTART_UNAVAILABLE: &str = "autostart_unavailable";
    pub const NETWORK_DISABLED: &str = "network_disabled";
    pub const NAVIGATION_ERROR: &str = "navigation_error";
    pub const NETWORK_ERROR: &str = "network_error";
    pub const CONNECTION_REQUIRED: &str = "connection_required";
    pub const AUTHENTICATION_FAILED: &str = "authentication_failed";
    pub const CONNECTION_LOST: &str = "connection_lost";
    pub const FOLDER_NOT_FOUND: &str = "folder_not_found";
    pub const GIT_COMMAND_FAILED: &str = "git_command_failed";
    pub const UNKNOWN: &str = "unknown";
    pub const TAURI_UNAVAILABLE: &str = "tauri_unavailable";
    pub const UNSUPPORTED_TRANSPORT: &str = "unsupported_transport";

    pub const ALL: &[&str] = &[
        INVALID_URI,
        UNSUPPORTED_PROVIDER,
        DUPLICATE_PROVIDER,
        NOT_FOUND,
        PERMISSION_DENIED,
        DEVICE_UNAVAILABLE,
        TIMEOUT,
        CANCELLED,
        PREFERENCES_ERROR,
        INVALID_REQUEST,
        INVALID_NAME,
        INVALID_PATH,
        DESTINATION_MISSING,
        DESTINATION_CONFLICT,
        RECURSIVE_OPERATION,
        UNSUPPORTED_SYMLINK,
        UNSUPPORTED_TRASH,
        IO_ERROR,
        INTERNAL,
        IS_DIRECTORY,
        FILE_TOO_LARGE,
        UNSUPPORTED_ALGORITHM,
        SPAWN_ERROR,
        NO_TERMINAL,
        TERMINAL_SPAWN_FAILED,
        TERMINAL_NOT_FOUND,
        INVALID_TERMINAL_SIZE,
        TERMINAL_SESSION_EXITED,
        AUTOSTART_UNAVAILABLE,
        NETWORK_DISABLED,
        NAVIGATION_ERROR,
        NETWORK_ERROR,
        CONNECTION_REQUIRED,
        AUTHENTICATION_FAILED,
        CONNECTION_LOST,
        FOLDER_NOT_FOUND,
        GIT_COMMAND_FAILED,
        UNKNOWN,
        TAURI_UNAVAILABLE,
        UNSUPPORTED_TRANSPORT,
    ];
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IpcError {
    pub code: String,
    pub message: String,
}

impl From<config::NetworkProfile> for NetworkProfileDto {
    fn from(profile: config::NetworkProfile) -> Self {
        let default_uri = if matches!(profile.scheme.as_str(), "sftp" | "smb" | "s3" | "webdav") {
            ResourceUri::from_remote_profile(&profile.scheme, &profile.id, &profile.default_path)
                .map(|uri| uri.as_str().to_string())
                .unwrap_or_default()
        } else {
            String::new()
        };

        Self {
            id: profile.id,
            label: profile.label,
            scheme: profile.scheme,
            host: profile.host,
            port: profile.port,
            username: profile.username,
            auth_kind: profile.auth_kind.as_str().to_string(),
            private_key_path: profile.private_key_path,
            default_path: profile.default_path,
            default_uri,
            host_key_fingerprint: profile.host_key_fingerprint,
            sort_order: profile.sort_order,
            last_connected_at: profile.last_connected_at,
            last_error: profile.last_error,
            has_stored_secret: profile.has_stored_secret,
            created_at: profile.created_at,
            updated_at: profile.updated_at,
        }
    }
}

impl From<FileEntry> for FileEntryDto {
    fn from(entry: FileEntry) -> Self {
        Self {
            uri: entry.uri.as_str().to_string(),
            name: entry.name,
            extension: entry.extension,
            kind: entry.kind,
            size: entry.size,
            modified_at: entry.modified_at,
            created_at: entry.created_at,
            accessed_at: entry.accessed_at,
            is_hidden: entry.is_hidden,
            is_symlink: entry.is_symlink,
            symlink_target: entry.symlink_target.map(|uri| uri.as_str().to_string()),
            provider_id: entry.provider_id.as_str().to_string(),
            can_read: entry.capabilities.can_read,
            can_list: entry.capabilities.can_list,
            can_write: entry.capabilities.can_write,
            can_delete: entry.capabilities.can_delete,
            can_rename: entry.capabilities.can_rename,
            permissions: entry.permissions,
            owner: entry.owner,
            target_uri: None,
            virtual_kind: None,
            protocol: None,
            status: None,
            description: None,
        }
    }
}

impl From<GitRepoInfo> for GitRepoInfoDto {
    fn from(repo: GitRepoInfo) -> Self {
        Self {
            root_uri: repo.root_uri.as_str().to_string(),
            branch: repo.branch,
            head_short: repo.head_short,
            is_dirty: repo.is_dirty,
        }
    }
}

impl From<GitDirectoryStatus> for GitStatusForDirectoryResponse {
    fn from(status: GitDirectoryStatus) -> Self {
        Self {
            repo: status.repo.map(Into::into),
            entries: status
                .entries
                .into_iter()
                .map(|(uri, status)| (uri.as_str().to_string(), status))
                .collect(),
        }
    }
}

impl From<DirectoryBatch> for DirectoryBatchEventDto {
    fn from(batch: DirectoryBatch) -> Self {
        Self {
            session_id: batch.session_id.as_str().to_string(),
            request_id: batch.request_id,
            uri: batch.uri.as_str().to_string(),
            entries: batch.entries.into_iter().map(Into::into).collect(),
            batch_index: batch.batch_index,
            is_complete: batch.is_complete,
            total_hint: batch.total_hint,
            error: None,
        }
    }
}

impl From<config::UserPreferences> for UserPreferencesDto {
    fn from(value: config::UserPreferences) -> Self {
        Self {
            theme: value.theme,
            density: value.density,
            default_view_mode: value.default_view_mode,
            show_hidden_files: value.show_hidden_files,
            sidebar_width: value.sidebar_width,
            split_ratio: value.split_ratio,
            activity_panel_visible: value.activity_panel_visible,
            activity_panel_width: value.activity_panel_width,
            confirm_delete: value.confirm_delete,
            confirm_permanent_delete: value.confirm_permanent_delete,
            use_trash_by_default: value.use_trash_by_default,
            default_conflict_policy: value.default_conflict_policy,
            accent_color: value.accent_color,
            font_scale: value.font_scale,
            icon_scale: value.icon_scale,
            confirm_overwrite: value.confirm_overwrite,
            sidebar_visible: value.sidebar_visible,
            status_bar_visible: value.status_bar_visible,
            toolbar_visible: value.toolbar_visible,
            toolbar_entries: value.toolbar_entries,
            pane_mode: value.pane_mode,
            pane_direction: value.pane_direction,
            job_drawer_behavior: value.job_drawer_behavior,
            show_advanced_copy_options: value.show_advanced_copy_options,
            pane_terminal_height_left: value.pane_terminal_height_left,
            pane_terminal_height_right: value.pane_terminal_height_right,
            pane_terminal_default_open: value.pane_terminal_default_open,
            terminal_cd_on_navigate: value.terminal_cd_on_navigate,
            confirm_close_pane_with_terminal: value.confirm_close_pane_with_terminal,
            terminal_shell: value.terminal_shell,
            terminal_args: value.terminal_args,
            remember_last_used_panes: value.remember_last_used_panes,
            diagnostics_export_path: value.diagnostics_export_path,
            custom_shortcuts: value.custom_shortcuts,
            file_type_color_rules: value.file_type_color_rules,
            layout_profiles: value.layout_profiles,
            column_presets: value.column_presets,
        }
    }
}

impl From<config::FavoriteEntry> for FavoriteEntryDto {
    fn from(value: config::FavoriteEntry) -> Self {
        Self {
            id: value.id,
            uri: value.uri,
            label: value.label,
        }
    }
}

impl From<config::RecentEntry> for RecentEntryDto {
    fn from(value: config::RecentEntry) -> Self {
        Self {
            uri: value.uri,
            label: value.label,
            visited_at: value.visited_at,
        }
    }
}

impl From<config::StarredEntry> for StarredEntryDto {
    fn from(value: config::StarredEntry) -> Self {
        Self {
            uri: value.uri,
            label: value.label,
            starred_at: value.starred_at,
        }
    }
}

impl TryFrom<FileOperationRequestDto> for FileOperationRequest {
    type Error = IpcError;

    fn try_from(value: FileOperationRequestDto) -> Result<Self, Self::Error> {
        Ok(Self {
            kind: value.kind,
            sources: value
                .sources
                .iter()
                .map(|uri| ResourceUri::parse(uri).map_err(IpcError::from))
                .collect::<Result<Vec<_>, _>>()?,
            destination: value
                .destination
                .as_deref()
                .map(ResourceUri::parse)
                .transpose()
                .map_err(IpcError::from)?,
            new_name: value.new_name,
            conflict_policy: value.conflict_policy.unwrap_or(ConflictPolicy::Fail),
        })
    }
}

impl From<FileOperationPlan> for FileOperationPlanDto {
    fn from(plan: FileOperationPlan) -> Self {
        Self {
            operation_id: plan.operation_id,
            kind: plan.kind,
            sources: plan
                .sources
                .into_iter()
                .map(|uri| uri.as_str().to_string())
                .collect(),
            destination: plan.destination.map(|uri| uri.as_str().to_string()),
            new_name: plan.new_name,
            conflict_policy: plan.conflict_policy,
            items: plan.items.into_iter().map(Into::into).collect(),
            conflicts: plan.conflicts.into_iter().map(Into::into).collect(),
            warnings: plan.warnings.into_iter().map(Into::into).collect(),
            total_items: plan.total_items,
            total_bytes: plan.total_bytes,
        }
    }
}

impl TryFrom<FileOperationPlanDto> for FileOperationPlan {
    type Error = IpcError;

    fn try_from(value: FileOperationPlanDto) -> Result<Self, Self::Error> {
        Ok(Self {
            operation_id: value.operation_id,
            kind: value.kind,
            sources: value
                .sources
                .iter()
                .map(|uri| ResourceUri::parse(uri).map_err(IpcError::from))
                .collect::<Result<Vec<_>, _>>()?,
            destination: value
                .destination
                .as_deref()
                .map(ResourceUri::parse)
                .transpose()
                .map_err(IpcError::from)?,
            new_name: value.new_name,
            conflict_policy: value.conflict_policy,
            items: value
                .items
                .into_iter()
                .map(TryInto::try_into)
                .collect::<Result<Vec<_>, _>>()?,
            conflicts: value
                .conflicts
                .into_iter()
                .map(TryInto::try_into)
                .collect::<Result<Vec<_>, _>>()?,
            warnings: value.warnings.into_iter().map(Into::into).collect(),
            total_items: value.total_items,
            total_bytes: value.total_bytes,
        })
    }
}

impl From<FileOperationItem> for FileOperationItemDto {
    fn from(item: FileOperationItem) -> Self {
        Self {
            source: item.source.map(|uri| uri.as_str().to_string()),
            destination: item.destination.map(|uri| uri.as_str().to_string()),
            kind: item.kind,
            size: item.size,
            recursive: item.recursive,
        }
    }
}

impl TryFrom<FileOperationItemDto> for FileOperationItem {
    type Error = IpcError;

    fn try_from(value: FileOperationItemDto) -> Result<Self, Self::Error> {
        Ok(Self {
            source: value
                .source
                .as_deref()
                .map(ResourceUri::parse)
                .transpose()
                .map_err(IpcError::from)?,
            destination: value
                .destination
                .as_deref()
                .map(ResourceUri::parse)
                .transpose()
                .map_err(IpcError::from)?,
            kind: value.kind,
            size: value.size,
            recursive: value.recursive,
        })
    }
}

impl From<FileOperationConflict> for FileOperationConflictDto {
    fn from(conflict: FileOperationConflict) -> Self {
        Self {
            source: conflict.source.as_str().to_string(),
            destination: conflict.destination.as_str().to_string(),
        }
    }
}

impl TryFrom<FileOperationConflictDto> for FileOperationConflict {
    type Error = IpcError;

    fn try_from(value: FileOperationConflictDto) -> Result<Self, Self::Error> {
        Ok(Self {
            source: ResourceUri::parse(&value.source).map_err(IpcError::from)?,
            destination: ResourceUri::parse(&value.destination).map_err(IpcError::from)?,
        })
    }
}

impl From<FileOperationWarning> for FileOperationWarningDto {
    fn from(warning: FileOperationWarning) -> Self {
        Self {
            code: warning.code,
            message: warning.message,
            uri: warning.uri.map(|uri| uri.as_str().to_string()),
        }
    }
}

impl From<FileOperationWarningDto> for FileOperationWarning {
    fn from(warning: FileOperationWarningDto) -> Self {
        Self {
            code: warning.code,
            message: warning.message,
            uri: warning.uri.and_then(|uri| ResourceUri::parse(&uri).ok()),
        }
    }
}

impl From<VfsError> for IpcError {
    fn from(error: VfsError) -> Self {
        Self {
            code: error.code().to_string(),
            message: error.to_string(),
        }
    }
}

impl From<FileOperationError> for IpcError {
    fn from(error: FileOperationError) -> Self {
        Self {
            code: error.code().to_string(),
            message: error.user_message(),
        }
    }
}

impl From<GitError> for IpcError {
    fn from(error: GitError) -> Self {
        Self {
            code: error.code().to_string(),
            message: error.to_string(),
        }
    }
}

impl From<app_core_history::Record> for OperationHistoryRecordDto {
    fn from(record: app_core_history::Record) -> Self {
        Self {
            job_id: record.job_id,
            operation_kind: record.operation_kind,
            source_count: record.source_count,
            representative_source_path: record.representative_source_path,
            destination_path: record.destination_path,
            status: record.status,
            started_at: record.started_at,
            completed_at: record.completed_at,
            error_code: record.error_code,
        }
    }
}

pub mod app_core_history {
    pub struct Record {
        pub job_id: String,
        pub operation_kind: String,
        pub source_count: u64,
        pub representative_source_path: Option<String>,
        pub destination_path: Option<String>,
        pub status: String,
        pub started_at: String,
        pub completed_at: Option<String>,
        pub error_code: Option<String>,
    }
}

pub fn job_event_name(event: &JobEvent) -> &'static str {
    match event {
        JobEvent::Started(_) => JOB_STARTED_EVENT,
        JobEvent::Progress(_) => JOB_PROGRESS_EVENT,
        JobEvent::Completed(_) => JOB_COMPLETED_EVENT,
        JobEvent::Failed(_) => JOB_FAILED_EVENT,
        JobEvent::Cancelled(_) => JOB_CANCELLED_EVENT,
        JobEvent::Paused(_) => JOB_PAUSED_EVENT,
        JobEvent::Resumed(_) => JOB_RESUMED_EVENT,
    }
}

pub fn job_event_payload(event: JobEvent) -> serde_json::Value {
    match event {
        JobEvent::Started(event) => serde_json::to_value(event).unwrap_or_default(),
        JobEvent::Progress(event) => serde_json::to_value(event).unwrap_or_default(),
        JobEvent::Completed(event) => serde_json::to_value(event).unwrap_or_default(),
        JobEvent::Failed(event) => serde_json::to_value(event).unwrap_or_default(),
        JobEvent::Cancelled(event) => serde_json::to_value(event).unwrap_or_default(),
        JobEvent::Paused(event) => serde_json::to_value(event).unwrap_or_default(),
        JobEvent::Resumed(event) => serde_json::to_value(event).unwrap_or_default(),
    }
}

impl IpcError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code: code.to_string(),
            message: message.into(),
        }
    }

    pub fn internal(message: &str) -> Self {
        Self::new(error_codes::INTERNAL, message)
    }

    pub fn io(message: impl Into<String>) -> Self {
        Self::new(error_codes::IO_ERROR, message)
    }

    pub fn is_directory(message: impl Into<String>) -> Self {
        Self::new(error_codes::IS_DIRECTORY, message)
    }

    pub fn file_too_large(message: impl Into<String>) -> Self {
        Self::new(error_codes::FILE_TOO_LARGE, message)
    }

    pub fn unsupported_algorithm(message: impl Into<String>) -> Self {
        Self::new(error_codes::UNSUPPORTED_ALGORITHM, message)
    }

    pub fn spawn_error(message: impl Into<String>) -> Self {
        Self::new(error_codes::SPAWN_ERROR, message)
    }

    pub fn no_terminal(message: impl Into<String>) -> Self {
        Self::new(error_codes::NO_TERMINAL, message)
    }

    pub fn terminal_spawn_failed(message: impl Into<String>) -> Self {
        Self::new(error_codes::TERMINAL_SPAWN_FAILED, message)
    }

    pub fn terminal_not_found(message: impl Into<String>) -> Self {
        Self::new(error_codes::TERMINAL_NOT_FOUND, message)
    }

    pub fn invalid_terminal_size(message: impl Into<String>) -> Self {
        Self::new(error_codes::INVALID_TERMINAL_SIZE, message)
    }

    pub fn terminal_session_exited(message: impl Into<String>) -> Self {
        Self::new(error_codes::TERMINAL_SESSION_EXITED, message)
    }

    pub fn preferences_error(message: impl Into<String>) -> Self {
        Self::new(error_codes::PREFERENCES_ERROR, message)
    }

    pub fn autostart_unavailable(message: impl Into<String>) -> Self {
        Self::new(error_codes::AUTOSTART_UNAVAILABLE, message)
    }

    pub fn navigation_error(message: impl Into<String>) -> Self {
        Self::new(error_codes::NAVIGATION_ERROR, message)
    }

    pub fn network_error(message: impl Into<String>) -> Self {
        Self::new(error_codes::NETWORK_ERROR, message)
    }

    pub fn folder_not_found(message: impl Into<String>) -> Self {
        Self::new(error_codes::FOLDER_NOT_FOUND, message)
    }

    pub fn git_command_failed(message: impl Into<String>) -> Self {
        Self::new(error_codes::GIT_COMMAND_FAILED, message)
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(error_codes::NOT_FOUND, message)
    }

    pub fn invalid_request(message: impl Into<String>) -> Self {
        Self::new(error_codes::INVALID_REQUEST, message)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListArchiveRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListArchiveResponse {
    pub entries: Vec<FileEntryDto>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use git_intel::{GitDirectoryStatus, GitFileStatus, GitRepoInfo};
    use std::collections::{HashMap, HashSet};
    use vfs::{EntryCapabilities, ListSessionId, ProviderId, ResourceUri};

    #[test]
    fn serializes_stat_response() {
        let response = StatResponse {
            entry: FileEntryDto::from(FileEntry {
                uri: ResourceUri::parse("local:///tmp/file.txt").unwrap(),
                name: "file.txt".to_string(),
                extension: Some("txt".to_string()),
                kind: FileKind::File,
                size: Some(42),
                modified_at: None,
                created_at: None,
                accessed_at: None,
                is_hidden: false,
                is_symlink: false,
                symlink_target: None,
                provider_id: ProviderId::new("local"),
                capabilities: EntryCapabilities::read_only_file(),
                permissions: None,
                owner: None,
            }),
        };

        let encoded = serde_json::to_string(&response).unwrap();
        let decoded: StatResponse = serde_json::from_str(&encoded).unwrap();

        assert_eq!(decoded.entry.uri, "local:///tmp/file.txt");
        assert_eq!(decoded.entry.kind, FileKind::File);
    }

    #[test]
    fn network_profile_dto_builds_default_uri_for_each_remote_scheme() {
        for scheme in ["sftp", "smb", "s3", "webdav"] {
            let profile = config::NetworkProfile {
                id: "550e8400-e29b-41d4-a716-446655440000".to_string(),
                label: format!("{scheme} test"),
                scheme: scheme.to_string(),
                host: "example.com".to_string(),
                port: 22,
                username: "deploy".to_string(),
                auth_kind: config::AuthKind::Password,
                private_key_path: None,
                default_path: "/share".to_string(),
                host_key_fingerprint: None,
                sort_order: 0,
                last_connected_at: None,
                last_error: None,
                has_stored_secret: false,
                created_at: "1970-01-01T00:00:00Z".to_string(),
                updated_at: "1970-01-01T00:00:00Z".to_string(),
            };

            let dto = NetworkProfileDto::from(profile);

            assert_eq!(
                dto.default_uri,
                format!("{scheme}://550e8400-e29b-41d4-a716-446655440000/share"),
                "scheme = {scheme}"
            );
        }
    }

    #[test]
    fn network_profile_dto_leaves_default_uri_empty_for_ssh_only_profiles() {
        let profile = config::NetworkProfile {
            id: "550e8400-e29b-41d4-a716-446655440000".to_string(),
            label: "Bastion".to_string(),
            scheme: "ssh".to_string(),
            host: "example.com".to_string(),
            port: 22,
            username: "deploy".to_string(),
            auth_kind: config::AuthKind::Password,
            private_key_path: None,
            default_path: "".to_string(),
            host_key_fingerprint: None,
            sort_order: 0,
            last_connected_at: None,
            last_error: None,
            has_stored_secret: false,
            created_at: "1970-01-01T00:00:00Z".to_string(),
            updated_at: "1970-01-01T00:00:00Z".to_string(),
        };

        let dto = NetworkProfileDto::from(profile);

        assert_eq!(dto.default_uri, "");
    }

    #[test]
    fn neighborhood_request_and_response_round_trip_as_camel_case() {
        let request = NetworkNeighborhoodRequest {
            uri: "network:///cloud".to_string(),
        };
        let encoded = serde_json::to_value(&request).unwrap();
        assert_eq!(encoded["uri"], "network:///cloud");
        let decoded: NetworkNeighborhoodRequest = serde_json::from_value(encoded).unwrap();
        assert_eq!(decoded, request);

        let entry = FileEntryDto {
            uri: "network:///cloud/icloud".to_string(),
            name: "iCloud Drive".to_string(),
            extension: None,
            kind: FileKind::Directory,
            size: None,
            modified_at: None,
            created_at: None,
            accessed_at: None,
            is_hidden: false,
            is_symlink: false,
            symlink_target: None,
            provider_id: "network".to_string(),
            can_read: true,
            can_list: true,
            can_write: false,
            can_delete: false,
            can_rename: false,
            permissions: None,
            owner: None,
            target_uri: Some("local:///iCloud".to_string()),
            virtual_kind: Some("cloudDrive".to_string()),
            protocol: Some("cloud".to_string()),
            status: Some("available".to_string()),
            description: None,
        };
        let response = NetworkNeighborhoodResponse {
            uri: "network:///cloud".to_string(),
            entries: vec![entry.clone()],
        };
        let encoded = serde_json::to_value(&response).unwrap();
        assert_eq!(encoded["uri"], "network:///cloud");
        assert_eq!(encoded["entries"][0]["targetUri"], "local:///iCloud");
        let decoded: NetworkNeighborhoodResponse = serde_json::from_value(encoded).unwrap();
        assert_eq!(decoded.entries[0], entry);
    }

    #[test]
    fn file_entry_dto_defaults_virtual_fields_to_none_when_deserialised_legacy() {
        // The new optional virtual-entry fields all use #[serde(default)] so a
        // legacy payload without them must still deserialise.
        let legacy = serde_json::json!({
            "uri": "local:///tmp/file.txt",
            "name": "file.txt",
            "extension": "txt",
            "kind": "file",
            "size": null,
            "modifiedAt": null,
            "createdAt": null,
            "accessedAt": null,
            "isHidden": false,
            "isSymlink": false,
            "symlinkTarget": null,
            "providerId": "local",
            "canRead": true,
            "canList": false,
            "canWrite": false,
            "canDelete": false,
            "canRename": false,
            "permissions": null,
            "owner": null
        });

        let entry: FileEntryDto = serde_json::from_value(legacy).unwrap();

        assert_eq!(entry.target_uri, None);
        assert_eq!(entry.virtual_kind, None);
        assert_eq!(entry.protocol, None);
        assert_eq!(entry.status, None);
        assert_eq!(entry.description, None);
    }

    #[test]
    fn serializes_virtual_entry_metadata() {
        let entry = FileEntryDto {
            uri: "network:///cloud".to_string(),
            name: "Cloud Storage".to_string(),
            extension: None,
            kind: FileKind::Directory,
            size: None,
            modified_at: None,
            created_at: None,
            accessed_at: None,
            is_hidden: false,
            is_symlink: false,
            symlink_target: None,
            provider_id: "network".to_string(),
            can_read: false,
            can_list: true,
            can_write: false,
            can_delete: false,
            can_rename: false,
            permissions: None,
            owner: None,
            target_uri: Some(
                "local:///Users/ilya/Library/CloudStorage/OneDrive-Personal".to_string(),
            ),
            virtual_kind: Some("cloudDrive".to_string()),
            protocol: Some("cloud".to_string()),
            status: Some("available".to_string()),
            description: Some("OneDrive local sync folder".to_string()),
        };

        let encoded = serde_json::to_value(&entry).unwrap();

        assert_eq!(
            encoded["targetUri"],
            "local:///Users/ilya/Library/CloudStorage/OneDrive-Personal"
        );
        assert_eq!(encoded["virtualKind"], "cloudDrive");
        assert_eq!(encoded["protocol"], "cloud");
        assert_eq!(encoded["status"], "available");
        assert_eq!(encoded["description"], "OneDrive local sync folder");
    }

    #[test]
    fn maps_directory_batch_request_id_to_event_dto() {
        let batch = DirectoryBatch {
            session_id: ListSessionId::new("session-1"),
            request_id: "request-1".to_string(),
            uri: ResourceUri::parse("local:///tmp").unwrap(),
            entries: Vec::new(),
            batch_index: 0,
            is_complete: true,
            total_hint: None,
        };

        let event = DirectoryBatchEventDto::from(batch);

        assert_eq!(event.request_id, "request-1");
        assert_eq!(event.session_id, "session-1");
    }

    #[test]
    fn serializes_directory_batch_event() {
        let event = DirectoryBatchEventDto {
            session_id: "session-1".to_string(),
            request_id: "request-1".to_string(),
            uri: "local:///tmp".to_string(),
            entries: Vec::new(),
            batch_index: 0,
            is_complete: true,
            total_hint: None,
            error: None,
        };

        let encoded = serde_json::to_string(&event).unwrap();
        let decoded: DirectoryBatchEventDto = serde_json::from_str(&encoded).unwrap();

        assert_eq!(decoded.session_id, "session-1");
        assert!(decoded.is_complete);
    }

    #[test]
    fn serializes_git_status_response_with_resource_uri_keys() {
        let root_uri = ResourceUri::parse("local:///tmp/repo").unwrap();
        let changed_uri = ResourceUri::parse("local:///tmp/repo/changed.txt").unwrap();
        let status = GitDirectoryStatus {
            repo: Some(GitRepoInfo {
                root_uri: root_uri.clone(),
                branch: Some("main".to_string()),
                head_short: Some("abcdef1".to_string()),
                is_dirty: true,
            }),
            entries: HashMap::from([(changed_uri, GitFileStatus::Modified)]),
        };

        let response = GitStatusForDirectoryResponse::from(status);
        let encoded = serde_json::to_value(&response).unwrap();

        assert_eq!(encoded["repo"]["rootUri"], "local:///tmp/repo");
        assert_eq!(encoded["repo"]["branch"], "main");
        assert_eq!(encoded["repo"]["headShort"], "abcdef1");
        assert_eq!(encoded["repo"]["isDirty"], true);
        assert_eq!(
            encoded["entries"]["local:///tmp/repo/changed.txt"],
            "modified"
        );
    }

    #[test]
    fn maps_vfs_error_to_ipc_error() {
        let error = IpcError::from(VfsError::invalid_uri("bad", "missing scheme"));

        assert_eq!(error.code, error_codes::INVALID_URI);
        assert!(error.message.contains("missing scheme"));
    }

    #[test]
    fn ipc_error_catalog_has_unique_codes() {
        let unique = error_codes::ALL.iter().copied().collect::<HashSet<_>>();

        assert_eq!(unique.len(), error_codes::ALL.len());
    }

    #[test]
    fn ipc_error_helpers_use_catalog_codes() {
        assert_eq!(IpcError::internal("x").code, error_codes::INTERNAL);
        assert_eq!(IpcError::io("x").code, error_codes::IO_ERROR);
        assert_eq!(IpcError::is_directory("x").code, error_codes::IS_DIRECTORY);
        assert_eq!(
            IpcError::file_too_large("x").code,
            error_codes::FILE_TOO_LARGE
        );
        assert_eq!(
            IpcError::unsupported_algorithm("x").code,
            error_codes::UNSUPPORTED_ALGORITHM
        );
        assert_eq!(IpcError::spawn_error("x").code, error_codes::SPAWN_ERROR);
        assert_eq!(IpcError::no_terminal("x").code, error_codes::NO_TERMINAL);
        assert_eq!(
            IpcError::preferences_error("x").code,
            error_codes::PREFERENCES_ERROR
        );
        assert_eq!(
            IpcError::autostart_unavailable("x").code,
            error_codes::AUTOSTART_UNAVAILABLE
        );
        assert_eq!(
            IpcError::navigation_error("x").code,
            error_codes::NAVIGATION_ERROR
        );
        assert_eq!(
            IpcError::folder_not_found("x").code,
            error_codes::FOLDER_NOT_FOUND
        );
        assert_eq!(
            IpcError::git_command_failed("x").code,
            error_codes::GIT_COMMAND_FAILED
        );
    }

    #[test]
    fn vfs_and_file_operation_error_codes_stay_in_catalog() {
        let errors = [
            IpcError::from(VfsError::invalid_uri("bad", "bad")),
            IpcError::from(VfsError::UnsupportedProvider {
                scheme: "ftp".to_string(),
            }),
            IpcError::from(VfsError::DuplicateProvider {
                scheme: "local".to_string(),
            }),
            IpcError::from(VfsError::Internal {
                message: "boom".to_string(),
            }),
            IpcError::from(FileOperationError::InvalidRequest {
                message: "bad".to_string(),
            }),
            IpcError::from(FileOperationError::DestinationConflict {
                uri: "local:///tmp/a".to_string(),
            }),
            IpcError::from(FileOperationError::UnsupportedTrash {
                message: "no trash".to_string(),
            }),
            IpcError::from(GitError::CommandFailed("git failed".to_string())),
        ];

        for error in errors {
            assert!(error_codes::ALL.contains(&error.code.as_str()));
        }
    }
}
