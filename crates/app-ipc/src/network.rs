use super::*;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProfileDto {
    pub id: String,
    pub label: String,
    pub scheme: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_kind: String,
    pub private_key_path: Option<String>,
    pub default_path: String,
    pub default_uri: String,
    pub host_key_fingerprint: Option<String>,
    pub sort_order: i64,
    pub last_connected_at: Option<String>,
    pub last_error: Option<String>,
    pub has_stored_secret: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkConnectionStatusDto {
    pub profile_id: String,
    pub status: String,
    pub message: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkStatusEventDto {
    pub profile_id: String,
    pub status: String,
    pub message: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProfilesListResponse {
    pub profiles: Vec<NetworkProfileDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProfileAddRequest {
    pub label: String,
    pub scheme: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_kind: String,
    pub private_key_path: Option<String>,
    pub default_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProfileUpdateRequest {
    pub id: String,
    pub label: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_kind: String,
    pub private_key_path: Option<String>,
    pub default_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProfileResponse {
    pub profile: NetworkProfileDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProfileDeleteRequest {
    pub id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProfileSetSecretRequest {
    pub id: String,
    pub secret_kind: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProfileActionRequest {
    pub id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkConnectionStatusResponse {
    pub statuses: Vec<NetworkConnectionStatusDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkNeighborhoodRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkNeighborhoodResponse {
    pub uri: String,
    pub entries: Vec<FileEntryDto>,
}
