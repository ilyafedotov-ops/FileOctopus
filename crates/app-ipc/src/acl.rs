use super::*;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/GetAclRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct GetAclRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/AclEntry.ts"))]
#[serde(rename_all = "camelCase")]
pub struct AclEntry {
    pub principal: String,
    pub read: bool,
    pub write: bool,
    pub execute: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/GetAclResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct GetAclResponse {
    pub owner: Option<String>,
    pub group: Option<String>,
    pub entries: Vec<AclEntry>,
    pub octal: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/SetAclRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct SetAclRequest {
    pub uri: String,
    pub octal: String,
    pub recursive: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/SetAclResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct SetAclResponse {
    pub success: bool,
}
