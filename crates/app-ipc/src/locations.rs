use super::*;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/StandardLocationDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct StandardLocationDto {
    pub id: String,
    pub name: String,
    pub uri: String,
    pub section: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/StandardLocationsResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct StandardLocationsResponse {
    pub locations: Vec<StandardLocationDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/VolumeDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct VolumeDto {
    pub name: String,
    pub mount_uri: String,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub total_bytes: Option<u64>,
    #[cfg_attr(feature = "ts", ts(as = "Option<i32>"))]
    pub available_bytes: Option<u64>,
    pub file_system_type: Option<String>,
    pub is_removable: bool,
    pub is_network: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/DiscoverVolumesResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct DiscoverVolumesResponse {
    pub volumes: Vec<VolumeDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/EjectVolumeRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct EjectVolumeRequest {
    pub mount_point: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/EjectVolumeResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct EjectVolumeResponse {
    pub success: bool,
}
