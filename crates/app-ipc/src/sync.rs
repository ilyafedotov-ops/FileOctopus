use super::*;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/SyncDirectoriesRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct SyncDirectoriesRequest {
    pub left_uri: String,
    pub right_uri: String,
    pub comparison: String,
    pub recursive: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/SyncEntryDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct SyncEntryDto {
    pub name: String,
    pub left_uri: Option<String>,
    pub right_uri: Option<String>,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub left_size: Option<u64>,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub right_size: Option<u64>,
    pub left_modified: Option<String>,
    pub right_modified: Option<String>,
    pub left_is_dir: bool,
    pub right_is_dir: bool,
    pub status: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/SyncDirectoriesResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct SyncDirectoriesResponse {
    pub left_uri: String,
    pub right_uri: String,
    pub entries: Vec<SyncEntryDto>,
    pub recursive: bool,
}
