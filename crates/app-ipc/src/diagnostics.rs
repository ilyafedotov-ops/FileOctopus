use super::*;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/AppDataHealthResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct AppDataHealthResponse {
    pub config_dir: String,
    pub data_dir: String,
    pub log_dir: String,
    pub database_path: String,
    pub database_exists: bool,
    pub schema_version: u32,
    pub missing_directories: Vec<String>,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub startup_recovery_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/ExportDiagnosticsBundleRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct ExportDiagnosticsBundleRequest {
    pub destination: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/ExportDiagnosticsBundleResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct ExportDiagnosticsBundleResponse {
    pub path: String,
    pub files: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NativeMenuCommandEventDto.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NativeMenuCommandEventDto {
    pub command_id: String,
    pub sort_field: Option<String>,
    pub preference_value: Option<String>,
}

/// A single backend log record streamed to the diagnostics console while live
/// log streaming is enabled.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/LogRecordDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct LogRecordDto {
    pub level: String,
    pub target: String,
    pub message: String,
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub timestamp_ms: u64,
}
