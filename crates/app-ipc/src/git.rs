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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/GitStatusForRepositoryRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusForRepositoryRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/GitChangedFileDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct GitChangedFileDto {
    pub uri: String,
    pub repo_relative_path: String,
    pub status: GitFileStatus,
    pub previous_uri: Option<String>,
    pub previous_repo_relative_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/GitStatusForRepositoryResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusForRepositoryResponse {
    pub repo: Option<GitRepoInfoDto>,
    pub files: Vec<GitChangedFileDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/GitDiffFileRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct GitDiffFileRequest {
    pub uri: String,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub max_bytes: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/GitDiffFileResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct GitDiffFileResponse {
    pub repo: Option<GitRepoInfoDto>,
    pub file: GitChangedFileDto,
    pub old_label: String,
    pub new_label: String,
    pub hunks: Vec<DiffHunk>,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub old_line_count: u64,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub new_line_count: u64,
    pub old_truncated: bool,
    pub new_truncated: bool,
    pub binary: bool,
    pub unsupported_reason: Option<String>,
}
