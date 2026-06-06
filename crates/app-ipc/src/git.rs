use super::*;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/GitDiscoverRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct GitDiscoverRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/GitRepoInfoDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct GitRepoInfoDto {
    pub root_uri: String,
    pub branch: Option<String>,
    pub head_short: Option<String>,
    pub is_dirty: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/GitDiscoverResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct GitDiscoverResponse {
    pub repo: Option<GitRepoInfoDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/GitStatusForDirectoryRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusForDirectoryRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/GitStatusForDirectoryResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusForDirectoryResponse {
    pub repo: Option<GitRepoInfoDto>,
    pub entries: HashMap<String, GitFileStatus>,
}
