use super::*;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/ListStartRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct ListStartRequest {
    pub uri: String,
    pub request_id: String,
    pub panel_id: Option<String>,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub batch_size: Option<usize>,
    pub include_hidden: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/ListStartResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct ListStartResponse {
    pub session_id: String,
    pub request_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/WatchStartRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct WatchStartRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/WatchEventDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct WatchEventDto {
    pub uri: String,
    pub changed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/FileEntryDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct FileEntryDto {
    pub uri: String,
    pub name: String,
    pub extension: Option<String>,
    pub kind: FileKind,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub size: Option<u64>,
    pub modified_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub accessed_at: Option<DateTime<Utc>>,
    pub is_hidden: bool,
    pub is_symlink: bool,
    #[serde(default)]
    pub is_placeholder: bool,
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
    #[cfg_attr(feature = "ts", ts(optional = nullable))]
    pub target_uri: Option<String>,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional = nullable))]
    pub virtual_kind: Option<String>,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional = nullable))]
    pub protocol: Option<String>,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional = nullable))]
    pub status: Option<String>,
    #[serde(default)]
    #[cfg_attr(feature = "ts", ts(optional = nullable))]
    pub description: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/DirectoryBatchEventDto.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryBatchEventDto {
    pub session_id: String,
    pub request_id: String,
    pub uri: String,
    pub entries: Vec<FileEntryDto>,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub batch_index: u64,
    pub is_complete: bool,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub total_hint: Option<u64>,
    pub error: Option<IpcError>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/ListDirectoriesRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct ListDirectoriesRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/DirectoryEntryDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct DirectoryEntryDto {
    pub name: String,
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/ListDirectoriesResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct ListDirectoriesResponse {
    pub directories: Vec<DirectoryEntryDto>,
}
