use super::*;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/BatchRenameItemDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct BatchRenameItemDto {
    pub source: String,
    pub new_name: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/ClearOperationHistoryResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct ClearOperationHistoryResponse {
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub deleted_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/FileOperationRequestDto.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationRequestDto {
    pub kind: FileOperationKind,
    pub sources: Vec<String>,
    pub destination: Option<String>,
    pub new_name: Option<String>,
    pub conflict_policy: Option<ConflictPolicy>,
    #[serde(default)]
    pub batch_renames: Vec<BatchRenameItemDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/PlanFileOperationRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct PlanFileOperationRequest {
    pub operation: FileOperationRequestDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/PlanFileOperationResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct PlanFileOperationResponse {
    pub plan: FileOperationPlanDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/StartFileOperationRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct StartFileOperationRequest {
    pub operation_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/StartFileOperationResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct StartFileOperationResponse {
    pub job: JobSnapshot,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/CancelJobRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct CancelJobRequest {
    pub job_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/PauseJobRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct PauseJobRequest {
    pub job_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/ResumeJobRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct ResumeJobRequest {
    pub job_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/JobStatusRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct JobStatusRequest {
    pub job_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/JobStatusResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct JobStatusResponse {
    pub job: JobSnapshot,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/ListRecentOperationsRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct ListRecentOperationsRequest {
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/ListRecentOperationsResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct ListRecentOperationsResponse {
    pub operations: Vec<OperationHistoryRecordDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/OperationHistoryRecordDto.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct OperationHistoryRecordDto {
    pub job_id: String,
    pub operation_kind: String,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub source_count: u64,
    pub representative_source_path: Option<String>,
    pub destination_path: Option<String>,
    pub status: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub error_code: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/FileOperationPlanDto.ts"))]
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
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub total_items: u64,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub total_bytes: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/FileOperationItemDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct FileOperationItemDto {
    pub source: Option<String>,
    pub destination: Option<String>,
    pub kind: FileKind,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub size: Option<u64>,
    pub recursive: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/FileOperationConflictDto.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationConflictDto {
    pub source: String,
    pub destination: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/FileOperationWarningDto.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationWarningDto {
    pub code: String,
    pub message: String,
    pub uri: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/ListArchiveRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct ListArchiveRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/ListArchiveResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct ListArchiveResponse {
    pub entries: Vec<FileEntryDto>,
}
