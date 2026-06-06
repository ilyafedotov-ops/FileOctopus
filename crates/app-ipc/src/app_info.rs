use super::*;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/AppInfoResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct AppInfoResponse {
    pub name: String,
    pub version: String,
    pub build_profile: String,
    pub commit_sha: Option<String>,
    pub target_os: String,
    pub data_dir: String,
    pub network_enabled: bool,
}
