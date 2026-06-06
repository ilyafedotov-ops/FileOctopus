use super::*;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/PathRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct PathRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/OkResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct OkResponse {
    pub ok: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/PathPropertiesRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct PathPropertiesRequest {
    pub uri: String,
    pub include_folder_summary: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/PathPropertiesDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct PathPropertiesDto {
    pub uri: String,
    pub name: String,
    pub kind: FileKind,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub size: Option<u64>,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub total_size: Option<u64>,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub item_count: Option<u64>,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub file_count: Option<u64>,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
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
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/PathPropertiesResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct PathPropertiesResponse {
    pub properties: PathPropertiesDto,
}
