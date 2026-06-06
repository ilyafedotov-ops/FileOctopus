use super::*;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/StatRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct StatRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/StatResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct StatResponse {
    pub entry: FileEntryDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/ReadTextFileRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct ReadTextFileRequest {
    pub uri: String,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub max_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/ReadTextFileResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct ReadTextFileResponse {
    pub content: String,
    pub truncated: bool,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub byte_size: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/ReadImageAsDataUriRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct ReadImageAsDataUriRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/ReadImageAsDataUriResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct ReadImageAsDataUriResponse {
    pub data_uri: String,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub byte_size: u64,
    pub mime_type: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/ReadFileAsDataUriRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct ReadFileAsDataUriRequest {
    pub uri: String,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub max_bytes: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/ReadFileAsDataUriResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct ReadFileAsDataUriResponse {
    pub data_uri: String,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub byte_size: u64,
    pub mime_type: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/ReadFileRangeRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct ReadFileRangeRequest {
    pub uri: String,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub offset: u64,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub length: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/ReadFileRangeResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct ReadFileRangeResponse {
    /// base64-encoded bytes (safe for arbitrary binary payloads over IPC)
    pub bytes_base64: String,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub bytes_read: u64,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub byte_size: u64,
    pub eof: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/WriteTextFileRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct WriteTextFileRequest {
    pub uri: String,
    pub content: String,
    /// Optional safety cap on encoded UTF-8 byte length. When omitted, the
    /// handler enforces a default 10 MB cap.
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub max_bytes: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/WriteTextFileResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct WriteTextFileResponse {
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub byte_size: u64,
    pub job: JobSnapshot,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/ComputeHashRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct ComputeHashRequest {
    pub uri: String,
    pub algorithm: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/ComputeHashResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct ComputeHashResponse {
    pub hash: String,
    pub algorithm: String,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub byte_size: u64,
}
