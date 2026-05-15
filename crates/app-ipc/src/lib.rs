use chrono::{DateTime, Utc};
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
pub const WATCH_CHANGED_EVENT: &str = "fs:watch:changed";
pub const FOLDER_SIZE_COMPLETED_EVENT: &str = "fs:folderSize:completed";
pub const RECURSIVE_SEARCH_MATCH_EVENT: &str = "fs:recursiveSearch:match";
pub const RECURSIVE_SEARCH_COMPLETED_EVENT: &str = "fs:recursiveSearch:completed";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfoResponse {
    pub name: String,
    pub version: String,
    pub build_profile: String,
    pub commit_sha: Option<String>,
    pub target_os: String,
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
pub struct PathRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletePermanentlyRequest {
    pub uris: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OkResponse {
    pub ok: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFileRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFileResponse {
    pub entry: FileEntryDto,
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
    pub plan: FileOperationPlanDto,
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IpcError {
    pub code: String,
    pub message: String,
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
    }
}

pub fn job_event_payload(event: JobEvent) -> serde_json::Value {
    match event {
        JobEvent::Started(event) => serde_json::to_value(event).unwrap_or_default(),
        JobEvent::Progress(event) => serde_json::to_value(event).unwrap_or_default(),
        JobEvent::Completed(event) => serde_json::to_value(event).unwrap_or_default(),
        JobEvent::Failed(event) => serde_json::to_value(event).unwrap_or_default(),
        JobEvent::Cancelled(event) => serde_json::to_value(event).unwrap_or_default(),
    }
}

impl IpcError {
    pub fn internal(message: &str) -> Self {
        Self {
            code: "internal".to_string(),
            message: message.to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
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
            }),
        };

        let encoded = serde_json::to_string(&response).unwrap();
        let decoded: StatResponse = serde_json::from_str(&encoded).unwrap();

        assert_eq!(decoded.entry.uri, "local:///tmp/file.txt");
        assert_eq!(decoded.entry.kind, FileKind::File);
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
    fn maps_vfs_error_to_ipc_error() {
        let error = IpcError::from(VfsError::invalid_uri("bad", "missing scheme"));

        assert_eq!(error.code, "invalid_uri");
        assert!(error.message.contains("missing scheme"));
    }
}
