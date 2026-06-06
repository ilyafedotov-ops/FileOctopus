use super::*;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/DiffTextRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct DiffTextRequest {
    pub left_uri: String,
    pub right_uri: String,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub max_bytes: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/DiffLine.ts"))]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    pub kind: String,
    pub content: String,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub old_line: Option<u64>,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub new_line: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/DiffHunk.ts"))]
#[serde(rename_all = "camelCase")]
pub struct DiffHunk {
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub old_start: u64,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub old_count: u64,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub new_start: u64,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub new_count: u64,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/DiffTextResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct DiffTextResponse {
    pub hunks: Vec<DiffHunk>,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub left_line_count: u64,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub right_line_count: u64,
    pub left_truncated: bool,
    pub right_truncated: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/CompareFilesRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct CompareFilesRequest {
    pub left_uri: String,
    pub right_uri: String,
    pub mode: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/DiffLineDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct DiffLineDto {
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub line_number_left: Option<usize>,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub line_number_right: Option<usize>,
    pub content: String,
    pub line_type: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/DiffHunkDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct DiffHunkDto {
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub old_start: usize,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub old_count: usize,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub new_start: usize,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub new_count: usize,
    pub lines: Vec<DiffLineDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/ByteDifferenceDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct ByteDifferenceDto {
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub offset: usize,
    pub left_byte: u8,
    pub right_byte: u8,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/CompareFilesResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct CompareFilesResponse {
    pub identical: bool,
    pub hunks: Vec<DiffHunkDto>,
    pub byte_differences: Vec<ByteDifferenceDto>,
}
