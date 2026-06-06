use super::*;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/FolderSizeRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct FolderSizeRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/FolderSizeSummaryDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct FolderSizeSummaryDto {
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub total_size: u64,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub item_count: u64,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub file_count: u64,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub directory_count: u64,
    pub warnings: Vec<String>,
    pub incomplete: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/FolderSizeResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct FolderSizeResponse {
    pub summary: FolderSizeSummaryDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/FolderSizeJobResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct FolderSizeJobResponse {
    pub job: JobSnapshot,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/FolderSizeCompletedEventDto.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct FolderSizeCompletedEventDto {
    pub job_id: String,
    pub uri: String,
    pub summary: FolderSizeSummaryDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/RecursiveSearchRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct RecursiveSearchRequest {
    pub uri: String,
    pub query: String,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/SearchMatchDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct SearchMatchDto {
    pub uri: String,
    pub parent_uri: String,
    pub name: String,
    pub kind: FileKind,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub size: Option<u64>,
    pub modified_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/RecursiveSearchResultDto.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct RecursiveSearchResultDto {
    pub matches: Vec<SearchMatchDto>,
    pub warnings: Vec<String>,
    pub incomplete: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/RecursiveSearchResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct RecursiveSearchResponse {
    pub result: RecursiveSearchResultDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/RecursiveSearchJobResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct RecursiveSearchJobResponse {
    pub job: JobSnapshot,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/RecursiveSearchMatchEventDto.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct RecursiveSearchMatchEventDto {
    pub job_id: String,
    pub uri: String,
    pub query: String,
    pub item: SearchMatchDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/RecursiveSearchCompletedEventDto.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct RecursiveSearchCompletedEventDto {
    pub job_id: String,
    pub uri: String,
    pub query: String,
    pub result: RecursiveSearchResultDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/ContentSearchRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct ContentSearchRequest {
    pub uri: String,
    pub query: String,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub limit: Option<usize>,
    pub case_sensitive: Option<bool>,
    pub use_regex: Option<bool>,
    pub file_pattern: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/ContentSearchMatchDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct ContentSearchMatchDto {
    pub uri: String,
    pub parent_uri: String,
    pub name: String,
    pub kind: FileKind,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub size: Option<u64>,
    pub modified_at: Option<DateTime<Utc>>,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub line_number: usize,
    pub line_content: String,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub match_start: usize,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub match_end: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/ContentSearchResultDto.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct ContentSearchResultDto {
    pub matches: Vec<ContentSearchMatchDto>,
    pub warnings: Vec<String>,
    pub incomplete: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/ContentSearchResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct ContentSearchResponse {
    pub result: ContentSearchResultDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/ContentSearchJobResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct ContentSearchJobResponse {
    pub job: JobSnapshot,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/ContentSearchMatchEventDto.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct ContentSearchMatchEventDto {
    pub job_id: String,
    pub uri: String,
    pub query: String,
    pub item: ContentSearchMatchDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/ContentSearchCompletedEventDto.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct ContentSearchCompletedEventDto {
    pub job_id: String,
    pub uri: String,
    pub query: String,
    pub result: ContentSearchResultDto,
}
