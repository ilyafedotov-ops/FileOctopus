use super::*;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/PluginManifestDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct PluginManifestDto {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub entry_point: String,
    pub permissions: Vec<String>,
    pub min_app_version: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/InstalledPluginDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct InstalledPluginDto {
    pub manifest: PluginManifestDto,
    pub install_path: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/PluginListResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct PluginListResponse {
    pub plugins: Vec<InstalledPluginDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/PluginInstallRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct PluginInstallRequest {
    pub source_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/PluginInstallResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct PluginInstallResponse {
    pub plugin: InstalledPluginDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/PluginUninstallRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct PluginUninstallRequest {
    pub plugin_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/PluginToggleRequest.ts"))]
#[serde(rename_all = "camelCase")]
pub struct PluginToggleRequest {
    pub plugin_id: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/PluginToggleResponse.ts"))]
#[serde(rename_all = "camelCase")]
pub struct PluginToggleResponse {
    pub plugin: InstalledPluginDto,
}
