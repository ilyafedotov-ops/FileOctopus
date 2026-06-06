use super::*;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/NetworkProfileDto.ts"))]
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
    #[cfg_attr(feature = "ts", ts(as = "i32"))]
    pub sort_order: i64,
    pub last_connected_at: Option<String>,
    pub last_error: Option<String>,
    pub has_stored_secret: bool,
    pub options: NetworkProtocolOptionsDto,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NetworkProtocolOptionsDto.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProtocolOptionsDto {
    #[serde(default)]
    pub ssh: SshProtocolOptionsDto,
    #[serde(default)]
    pub smb: SmbProtocolOptionsDto,
    #[serde(default)]
    pub s3: S3ProtocolOptionsDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/SshProtocolOptionsDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct SshProtocolOptionsDto {
    pub use_agent: Option<bool>,
    pub ssh_config_host: Option<String>,
    pub proxy_jump: Option<String>,
    pub proxy_command: Option<String>,
    pub keepalive_secs: Option<u32>,
    pub compression: Option<bool>,
    pub address_family: Option<String>,
    pub terminal_initial_command: Option<String>,
    #[serde(default)]
    pub terminal_env: Vec<NetworkEnvVarDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/SmbProtocolOptionsDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct SmbProtocolOptionsDto {
    pub workgroup: Option<String>,
    pub min_protocol: Option<String>,
    pub signing_mode: Option<String>,
    pub share_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/S3ProtocolOptionsDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct S3ProtocolOptionsDto {
    pub region: Option<String>,
    pub use_tls: Option<bool>,
    pub path_style: Option<bool>,
    pub root_prefix: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/NetworkEnvVarDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct NetworkEnvVarDto {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NetworkConnectionStatusDto.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NetworkConnectionStatusDto {
    pub profile_id: String,
    pub status: String,
    pub message: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(feature = "ts", ts(export, export_to = "ipc/NetworkStatusEventDto.ts"))]
#[serde(rename_all = "camelCase")]
pub struct NetworkStatusEventDto {
    pub profile_id: String,
    pub status: String,
    pub message: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NetworkProfilesListResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProfilesListResponse {
    pub profiles: Vec<NetworkProfileDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NetworkProviderCapabilityDto.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProviderCapabilityDto {
    pub scheme: String,
    pub label: String,
    pub category: String,
    pub default_port: Option<u16>,
    pub auth_kinds: Vec<String>,
    pub file_capable: bool,
    pub terminal_capable: bool,
    pub status: String,
    pub missing_dependency: Option<String>,
    pub supported_options: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NetworkProvidersListResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProvidersListResponse {
    pub providers: Vec<NetworkProviderCapabilityDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NetworkProfileAddRequest.ts")
)]
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
    #[serde(default)]
    pub options: NetworkProtocolOptionsDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NetworkProfileUpdateRequest.ts")
)]
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
    #[serde(default)]
    pub options: NetworkProtocolOptionsDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NetworkProfileDraftDto.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProfileDraftDto {
    pub label: String,
    pub scheme: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_kind: String,
    pub private_key_path: Option<String>,
    pub default_path: String,
    #[serde(default)]
    pub options: NetworkProtocolOptionsDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NetworkProfileTestRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProfileTestRequest {
    pub id: Option<String>,
    pub draft: Option<NetworkProfileDraftDto>,
    pub password: Option<String>,
    pub passphrase: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NetworkProfileTestResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProfileTestResponse {
    pub ok: bool,
    pub status: String,
    pub message: String,
    pub duration_ms: u128,
    pub resolved_uri: Option<String>,
    pub observed_fingerprint: Option<String>,
    pub trust_state: String,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NetworkProfileResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProfileResponse {
    pub profile: NetworkProfileDto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NetworkProfileDeleteRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProfileDeleteRequest {
    pub id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NetworkProfileSetSecretRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProfileSetSecretRequest {
    pub id: String,
    pub secret_kind: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NetworkProfileTrustFingerprintRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProfileTrustFingerprintRequest {
    pub id: String,
    pub fingerprint: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NetworkProfileActionRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NetworkProfileActionRequest {
    pub id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NetworkConnectionStatusResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NetworkConnectionStatusResponse {
    pub statuses: Vec<NetworkConnectionStatusDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NetworkNeighborhoodRequest.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NetworkNeighborhoodRequest {
    pub uri: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts", derive(ts_rs::TS))]
#[cfg_attr(
    feature = "ts",
    ts(export, export_to = "ipc/NetworkNeighborhoodResponse.ts")
)]
#[serde(rename_all = "camelCase")]
pub struct NetworkNeighborhoodResponse {
    pub uri: String,
    pub entries: Vec<FileEntryDto>,
}

impl From<config::NetworkProtocolOptions> for NetworkProtocolOptionsDto {
    fn from(options: config::NetworkProtocolOptions) -> Self {
        Self {
            ssh: options.ssh.into(),
            smb: options.smb.into(),
            s3: options.s3.into(),
        }
    }
}

impl From<NetworkProtocolOptionsDto> for config::NetworkProtocolOptions {
    fn from(options: NetworkProtocolOptionsDto) -> Self {
        Self {
            ssh: options.ssh.into(),
            smb: options.smb.into(),
            s3: options.s3.into(),
        }
    }
}

impl From<config::SshProtocolOptions> for SshProtocolOptionsDto {
    fn from(options: config::SshProtocolOptions) -> Self {
        Self {
            use_agent: options.use_agent,
            ssh_config_host: options.ssh_config_host,
            proxy_jump: options.proxy_jump,
            proxy_command: options.proxy_command,
            keepalive_secs: options.keepalive_secs,
            compression: options.compression,
            address_family: options.address_family,
            terminal_initial_command: options.terminal_initial_command,
            terminal_env: options.terminal_env.into_iter().map(Into::into).collect(),
        }
    }
}

impl From<SshProtocolOptionsDto> for config::SshProtocolOptions {
    fn from(options: SshProtocolOptionsDto) -> Self {
        Self {
            use_agent: options.use_agent,
            ssh_config_host: options.ssh_config_host,
            proxy_jump: options.proxy_jump,
            proxy_command: options.proxy_command,
            keepalive_secs: options.keepalive_secs,
            compression: options.compression,
            address_family: options.address_family,
            terminal_initial_command: options.terminal_initial_command,
            terminal_env: options.terminal_env.into_iter().map(Into::into).collect(),
        }
    }
}

impl From<config::SmbProtocolOptions> for SmbProtocolOptionsDto {
    fn from(options: config::SmbProtocolOptions) -> Self {
        Self {
            workgroup: options.workgroup,
            min_protocol: options.min_protocol,
            signing_mode: options.signing_mode,
            share_path: options.share_path,
        }
    }
}

impl From<SmbProtocolOptionsDto> for config::SmbProtocolOptions {
    fn from(options: SmbProtocolOptionsDto) -> Self {
        Self {
            workgroup: options.workgroup,
            min_protocol: options.min_protocol,
            signing_mode: options.signing_mode,
            share_path: options.share_path,
        }
    }
}

impl From<config::S3ProtocolOptions> for S3ProtocolOptionsDto {
    fn from(options: config::S3ProtocolOptions) -> Self {
        Self {
            region: options.region,
            use_tls: options.use_tls,
            path_style: options.path_style,
            root_prefix: options.root_prefix,
        }
    }
}

impl From<S3ProtocolOptionsDto> for config::S3ProtocolOptions {
    fn from(options: S3ProtocolOptionsDto) -> Self {
        Self {
            region: options.region,
            use_tls: options.use_tls,
            path_style: options.path_style,
            root_prefix: options.root_prefix,
        }
    }
}

impl From<config::NetworkEnvVar> for NetworkEnvVarDto {
    fn from(value: config::NetworkEnvVar) -> Self {
        Self {
            name: value.name,
            value: value.value,
        }
    }
}

impl From<NetworkEnvVarDto> for config::NetworkEnvVar {
    fn from(value: NetworkEnvVarDto) -> Self {
        Self {
            name: value.name,
            value: value.value,
        }
    }
}
