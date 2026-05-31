use super::*;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StandardLocationDto {
    pub id: String,
    pub name: String,
    pub uri: String,
    pub section: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StandardLocationsResponse {
    pub locations: Vec<StandardLocationDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VolumeDto {
    pub name: String,
    pub mount_uri: String,
    pub total_bytes: Option<u64>,
    pub available_bytes: Option<u64>,
    pub file_system_type: Option<String>,
    pub is_removable: bool,
    pub is_network: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoverVolumesResponse {
    pub volumes: Vec<VolumeDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EjectVolumeRequest {
    pub mount_point: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EjectVolumeResponse {
    pub success: bool,
}
