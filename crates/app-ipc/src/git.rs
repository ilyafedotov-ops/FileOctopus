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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/GitHistoryRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct GitHistoryRequest {
    pub uri: String,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub max_count: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/GitCommitDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct GitCommitDto {
    pub hash: String,
    pub short_hash: String,
    pub parents: Vec<String>,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub parent_count: u64,
    pub author_name: String,
    pub author_email: String,
    pub authored_at: String,
    pub subject: String,
    pub body: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/GitHistoryResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct GitHistoryResponse {
    pub repo: Option<GitRepoInfoDto>,
    pub commits: Vec<GitCommitDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/GitBranchesRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct GitBranchesRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/GitBranchDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct GitBranchDto {
    pub full_name: String,
    pub name: String,
    pub kind: String,
    pub is_current: bool,
    pub head: String,
    pub upstream: Option<String>,
    pub last_commit_at: Option<String>,
    pub subject: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/GitBranchesResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct GitBranchesResponse {
    pub repo: Option<GitRepoInfoDto>,
    pub branches: Vec<GitBranchDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/GitWorktreesRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct GitWorktreesRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/GitWorktreeDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct GitWorktreeDto {
    pub path_uri: String,
    pub branch: Option<String>,
    pub head: Option<String>,
    pub detached: bool,
    pub bare: bool,
    pub prunable: bool,
    pub prunable_reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/GitWorktreesResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct GitWorktreesResponse {
    pub repo: Option<GitRepoInfoDto>,
    pub worktrees: Vec<GitWorktreeDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/GitRevisionDiffRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct GitRevisionDiffRequest {
    pub uri: String,
    pub base: String,
    pub head: String,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub max_bytes: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/GitRevisionDiffResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct GitRevisionDiffResponse {
    pub repo: Option<GitRepoInfoDto>,
    pub base: String,
    pub head: String,
    pub files: Vec<GitDiffFileResponse>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/GitRevisionFilesRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct GitRevisionFilesRequest {
    pub uri: String,
    pub revision: Option<String>,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub max_count: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/GitRevisionFileDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct GitRevisionFileDto {
    pub uri: String,
    pub repo_relative_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/GitRevisionFilesResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct GitRevisionFilesResponse {
    pub repo: Option<GitRepoInfoDto>,
    pub revision: String,
    pub files: Vec<GitRevisionFileDto>,
}
