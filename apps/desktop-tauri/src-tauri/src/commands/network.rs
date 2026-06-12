use std::sync::Arc;
use std::time::Instant;

use app_core::{is_network_enabled, AppState};
use app_ipc::{
    FileEntryDto, IpcError, NetworkConnectionStatusDto, NetworkConnectionStatusResponse,
    NetworkNeighborhoodRequest, NetworkNeighborhoodResponse, NetworkProfileActionRequest,
    NetworkProfileAddRequest, NetworkProfileDeleteRequest, NetworkProfileDraftDto,
    NetworkProfileDto, NetworkProfileResponse, NetworkProfileSetSecretRequest,
    NetworkProfileTestRequest, NetworkProfileTestResponse, NetworkProfileTrustFingerprintRequest,
    NetworkProfileUpdateRequest, NetworkProfilesListResponse, NetworkProviderCapabilityDto,
    NetworkProvidersListResponse, OkResponse,
};
use config::{AuthKind, NewNetworkProfile, UpdateNetworkProfile};
use platform::SecretStore;
use remote_core::{neighborhood, ConnectionStatus};
use tauri::State;
use vfs::{FileKind, ResourceUri};

fn network_error(error: config::NetworkError) -> IpcError {
    match error {
        config::NetworkError::ProfileNotFound => {
            IpcError::new(app_ipc::error_codes::NOT_FOUND, "network profile not found")
        }
        config::NetworkError::InvalidValue { field, reason } => IpcError::new(
            app_ipc::error_codes::INVALID_REQUEST,
            format!("invalid {field}: {reason}"),
        ),
        other => IpcError::network_error(other.to_string()),
    }
}

fn remote_error(error: remote_core::RemoteError) -> IpcError {
    match error {
        remote_core::RemoteError::SecretStore(platform::SecretStoreError::NotFound) => {
            IpcError::new(
                app_ipc::error_codes::AUTHENTICATION_FAILED,
                remote_core::MISSING_STORED_PASSWORD,
            )
        }
        other => IpcError::new(other.code(), other.to_string()),
    }
}

fn profile_to_dto(profile: config::NetworkProfile) -> NetworkProfileDto {
    let mut dto = NetworkProfileDto::from(profile.clone());
    dto.has_stored_secret = remote_core::AuthSecrets::profile_has_stored_secret(&profile);
    dto
}

fn secret_error(error: platform::SecretStoreError) -> IpcError {
    IpcError::network_error(error.to_string())
}

fn network_disabled_error() -> IpcError {
    IpcError::new(
        app_ipc::error_codes::NETWORK_DISABLED,
        "network features are disabled; set FILEOCTOPUS_ENABLE_NETWORK=1 to enable them",
    )
}

fn ensure_network_enabled() -> Result<(), IpcError> {
    if is_network_enabled() {
        Ok(())
    } else {
        Err(network_disabled_error())
    }
}

fn status_to_dto(profile_id: &str, status: ConnectionStatus) -> NetworkConnectionStatusDto {
    match status {
        ConnectionStatus::Connected => NetworkConnectionStatusDto {
            profile_id: profile_id.to_string(),
            status: "connected".to_string(),
            message: None,
        },
        ConnectionStatus::Disconnected => NetworkConnectionStatusDto {
            profile_id: profile_id.to_string(),
            status: "disconnected".to_string(),
            message: None,
        },
        ConnectionStatus::Error { message } => NetworkConnectionStatusDto {
            profile_id: profile_id.to_string(),
            status: "error".to_string(),
            message: Some(message),
        },
    }
}

#[allow(clippy::too_many_arguments)]
fn provider_capability(
    scheme: &str,
    label: &str,
    default_port: Option<u16>,
    auth_kinds: &[&str],
    file_capable: bool,
    terminal_capable: bool,
    status: &str,
    missing_dependency: Option<&str>,
    supported_options: &[&str],
) -> NetworkProviderCapabilityDto {
    NetworkProviderCapabilityDto {
        scheme: scheme.to_string(),
        label: label.to_string(),
        category: "server".to_string(),
        default_port,
        auth_kinds: auth_kinds
            .iter()
            .map(|value| (*value).to_string())
            .collect(),
        file_capable,
        terminal_capable,
        status: status.to_string(),
        missing_dependency: missing_dependency.map(str::to_string),
        supported_options: supported_options
            .iter()
            .map(|value| (*value).to_string())
            .collect(),
    }
}

fn network_provider_catalog() -> Vec<NetworkProviderCapabilityDto> {
    let network_enabled = is_network_enabled();
    let disabled_reason = (!network_enabled).then_some(
        "network features are disabled; set FILEOCTOPUS_ENABLE_NETWORK=1 to enable them",
    );
    let enabled_status = if network_enabled {
        "available"
    } else {
        "unavailable"
    };

    vec![
        provider_capability(
            "sftp",
            "SFTP",
            Some(22),
            &["password", "privateKey"],
            network_enabled,
            network_enabled,
            enabled_status,
            disabled_reason,
            &[
                "useAgent",
                "sshConfigHost",
                "proxyJump",
                "proxyCommand",
                "keepaliveSecs",
                "compression",
                "addressFamily",
            ],
        ),
        provider_capability(
            "ssh",
            "SSH",
            Some(22),
            &["password", "privateKey"],
            false,
            network_enabled,
            enabled_status,
            disabled_reason,
            &[
                "useAgent",
                "sshConfigHost",
                "proxyJump",
                "proxyCommand",
                "keepaliveSecs",
                "compression",
                "addressFamily",
                "terminalInitialCommand",
                "terminalEnv",
            ],
        ),
        provider_capability(
            "smb",
            "SMB / CIFS",
            Some(445),
            &["password"],
            network_enabled,
            false,
            enabled_status,
            disabled_reason,
            &["workgroup", "minProtocol", "signingMode", "sharePath"],
        ),
        provider_capability(
            "s3",
            "S3",
            Some(443),
            &["accessKey"],
            network_enabled,
            false,
            enabled_status,
            disabled_reason,
            &["region", "useTls", "pathStyle", "rootPrefix"],
        ),
        provider_capability(
            "webdav",
            "WebDAV",
            Some(443),
            &["password"],
            false,
            false,
            "unavailable",
            Some("WebDAV provider is not registered yet."),
            &[],
        ),
    ]
}

fn neighborhood_entry_to_dto(entry: neighborhood::NeighborhoodEntry) -> FileEntryDto {
    let can_list = entry.kind == FileKind::Directory;
    FileEntryDto {
        uri: entry.uri,
        name: entry.name,
        extension: None,
        kind: entry.kind,
        size: None,
        modified_at: None,
        created_at: None,
        accessed_at: None,
        is_hidden: false,
        is_symlink: false,
        is_placeholder: false,
        symlink_target: None,
        provider_id: "network".to_string(),
        can_read: entry.target_uri.is_some(),
        can_list,
        can_write: false,
        can_delete: false,
        can_rename: false,
        permissions: None,
        owner: None,
        target_uri: entry.target_uri,
        virtual_kind: Some(entry.virtual_kind),
        protocol: entry.protocol,
        status: entry.status,
        description: entry.description,
    }
}

fn neighborhood_entries_to_dtos(
    entries: Vec<neighborhood::NeighborhoodEntry>,
) -> Vec<FileEntryDto> {
    entries.into_iter().map(neighborhood_entry_to_dto).collect()
}

fn saved_connection_entries(state: &AppState) -> Vec<FileEntryDto> {
    if !is_network_enabled() {
        return Vec::new();
    }
    state
        .network()
        .list()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|profile| {
            let dto = profile_to_dto(profile);
            if dto.default_uri.is_empty() {
                return None;
            }
            Some(neighborhood_entry_to_dto(neighborhood::virtual_entry(
                format!("network:///saved/{}", dto.id),
                dto.label,
                FileKind::Directory,
                Some(dto.default_uri),
                "savedConnection",
                Some(dto.scheme.as_str()),
                Some(if dto.has_stored_secret {
                    "saved"
                } else {
                    "credentialsRequired"
                }),
                dto.last_error,
            )))
        })
        .collect()
}

#[tauri::command]
pub async fn network_profiles_list(
    state: State<'_, Arc<AppState>>,
) -> Result<NetworkProfilesListResponse, IpcError> {
    if !is_network_enabled() {
        return Ok(NetworkProfilesListResponse { profiles: vec![] });
    }

    let profiles = state
        .network()
        .list()
        .map_err(network_error)?
        .into_iter()
        .map(profile_to_dto)
        .collect();

    Ok(NetworkProfilesListResponse { profiles })
}

#[tauri::command]
pub fn network_providers_list() -> Result<NetworkProvidersListResponse, IpcError> {
    Ok(NetworkProvidersListResponse {
        providers: network_provider_catalog(),
    })
}

fn draft_resolved_uri(draft: &NetworkProfileDraftDto) -> Option<String> {
    if matches!(draft.scheme.as_str(), "sftp" | "smb" | "s3" | "webdav") {
        return ResourceUri::from_remote_profile(&draft.scheme, "preview", &draft.default_path)
            .ok()
            .map(|uri| uri.as_str().to_string());
    }
    None
}

fn validate_profile_draft(draft: &NetworkProfileDraftDto) -> Result<(), IpcError> {
    if !matches!(
        draft.scheme.as_str(),
        "sftp" | "ssh" | "smb" | "s3" | "webdav"
    ) {
        return Err(IpcError::new(
            app_ipc::error_codes::INVALID_REQUEST,
            format!("unsupported scheme `{}`", draft.scheme),
        ));
    }
    if draft.scheme == "webdav" {
        return Err(IpcError::new(
            app_ipc::error_codes::UNSUPPORTED_PROVIDER,
            "WebDAV provider is not registered yet.",
        ));
    }
    if draft.host.trim().is_empty()
        || draft.host != draft.host.trim()
        || draft
            .host
            .chars()
            .any(|ch| ch.is_whitespace() || ch.is_control())
    {
        return Err(IpcError::new(
            app_ipc::error_codes::INVALID_REQUEST,
            "host is required and must not contain whitespace",
        ));
    }
    if draft.username.trim().is_empty() {
        return Err(IpcError::new(
            app_ipc::error_codes::INVALID_REQUEST,
            "username is required",
        ));
    }
    if draft.port == 0 {
        return Err(IpcError::new(
            app_ipc::error_codes::INVALID_REQUEST,
            "port must be in range 1..=65535",
        ));
    }
    AuthKind::parse(&draft.auth_kind).map_err(network_error)?;
    if draft.auth_kind == "privateKey" && draft.private_key_path.as_deref().unwrap_or("").is_empty()
    {
        return Err(IpcError::new(
            app_ipc::error_codes::INVALID_REQUEST,
            "private key path is required",
        ));
    }
    Ok(())
}

#[tauri::command]
pub async fn network_profile_test(
    request: NetworkProfileTestRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<NetworkProfileTestResponse, IpcError> {
    let started = Instant::now();
    let has_id = request.id.as_ref().is_some_and(|id| !id.trim().is_empty());
    let has_draft = request.draft.is_some();
    if has_id == has_draft {
        return Err(IpcError::new(
            app_ipc::error_codes::INVALID_REQUEST,
            "provide exactly one of id or draft",
        ));
    }

    if let Some(id) = request.id {
        ensure_network_enabled()?;
        state.sessions().connect(&id).await.map_err(remote_error)?;
        let profile = state.network().get(&id).map_err(network_error)?;
        let fingerprint = profile.host_key_fingerprint.clone();
        let observed_fingerprint = state.sessions().observed_host_key_fingerprint(&id).await;
        let resolved_uri = profile_to_dto(profile.clone()).default_uri;
        let ssh_like = matches!(profile.scheme.as_str(), "sftp" | "ssh");
        return Ok(NetworkProfileTestResponse {
            ok: true,
            status: "success".to_string(),
            message: "Connection test succeeded.".to_string(),
            duration_ms: started.elapsed().as_millis(),
            resolved_uri: (!resolved_uri.is_empty()).then_some(resolved_uri),
            observed_fingerprint,
            trust_state: if ssh_like {
                if fingerprint.is_some() {
                    "trusted"
                } else {
                    "untrusted"
                }
            } else {
                "notApplicable"
            }
            .to_string(),
            warnings: Vec::new(),
        });
    }

    let draft = request.draft.expect("draft checked above");
    validate_profile_draft(&draft)?;
    let ssh_like = matches!(draft.scheme.as_str(), "sftp" | "ssh");
    Ok(NetworkProfileTestResponse {
        ok: true,
        status: "warning".to_string(),
        message: "Profile details are valid. Save the profile to run a live authentication test."
            .to_string(),
        duration_ms: started.elapsed().as_millis(),
        resolved_uri: draft_resolved_uri(&draft),
        observed_fingerprint: None,
        trust_state: if ssh_like {
            "untrusted"
        } else {
            "notApplicable"
        }
        .to_string(),
        warnings: vec!["Draft tests do not persist or use transient secrets yet.".to_string()],
    })
}

#[tauri::command]
pub fn network_profile_add(
    request: NetworkProfileAddRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<NetworkProfileResponse, IpcError> {
    ensure_network_enabled()?;
    let profile = state
        .network()
        .add(NewNetworkProfile {
            label: request.label,
            scheme: request.scheme,
            host: request.host,
            port: request.port,
            username: request.username,
            auth_kind: AuthKind::parse(&request.auth_kind).map_err(network_error)?,
            private_key_path: request.private_key_path,
            default_path: request.default_path,
            options: request.options.into(),
        })
        .map_err(network_error)?;

    Ok(NetworkProfileResponse {
        profile: profile_to_dto(profile),
    })
}

#[tauri::command]
pub fn network_profile_update(
    request: NetworkProfileUpdateRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<NetworkProfileResponse, IpcError> {
    ensure_network_enabled()?;
    let profile = state
        .network()
        .update(
            &request.id,
            UpdateNetworkProfile {
                label: request.label,
                host: request.host,
                port: request.port,
                username: request.username,
                auth_kind: AuthKind::parse(&request.auth_kind).map_err(network_error)?,
                private_key_path: request.private_key_path,
                default_path: request.default_path,
                options: request.options.into(),
            },
        )
        .map_err(network_error)?;

    Ok(NetworkProfileResponse {
        profile: profile_to_dto(profile),
    })
}

#[tauri::command]
pub async fn network_profile_delete(
    request: NetworkProfileDeleteRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<OkResponse, IpcError> {
    ensure_network_enabled()?;
    let _ = state.sessions().disconnect(&request.id).await;

    state.network().delete(&request.id).map_err(network_error)?;
    let _ = state
        .secrets()
        .delete(&SecretStore::network_password_key(&request.id));
    let _ = state
        .secrets()
        .delete(&SecretStore::network_passphrase_key(&request.id));

    Ok(OkResponse { ok: true })
}

#[tauri::command]
pub fn network_profile_set_secret(
    request: NetworkProfileSetSecretRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<OkResponse, IpcError> {
    ensure_network_enabled()?;
    let profile = state.network().get(&request.id).map_err(network_error)?;
    let key = match request.secret_kind.as_str() {
        "password" => SecretStore::network_password_key(&request.id),
        "passphrase" => SecretStore::network_passphrase_key(&request.id),
        other => {
            return Err(IpcError::new(
                app_ipc::error_codes::INVALID_REQUEST,
                format!("unsupported secret kind `{other}`"),
            ))
        }
    };

    state
        .secrets()
        .set(&key, &request.value)
        .map_err(secret_error)?;

    if request.secret_kind == "password" {
        state
            .network()
            .set_has_stored_secret(&request.id, true)
            .map_err(network_error)?;
    }

    if request.secret_kind == "passphrase" && profile.auth_kind == AuthKind::PrivateKey {
        let _ = state.network().set_has_stored_secret(&request.id, true);
    }

    Ok(OkResponse { ok: true })
}

#[tauri::command]
pub async fn network_connect(
    request: NetworkProfileActionRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<OkResponse, IpcError> {
    ensure_network_enabled()?;
    state
        .sessions()
        .connect(&request.id)
        .await
        .map_err(remote_error)?;

    Ok(OkResponse { ok: true })
}

#[tauri::command]
pub async fn network_disconnect(
    request: NetworkProfileActionRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<OkResponse, IpcError> {
    ensure_network_enabled()?;
    state
        .sessions()
        .disconnect(&request.id)
        .await
        .map_err(remote_error)?;

    Ok(OkResponse { ok: true })
}

#[tauri::command]
pub async fn network_connection_status(
    state: State<'_, Arc<AppState>>,
) -> Result<NetworkConnectionStatusResponse, IpcError> {
    if !is_network_enabled() {
        return Ok(NetworkConnectionStatusResponse { statuses: vec![] });
    }

    let profiles = state.network().list().map_err(network_error)?;
    let mut statuses = Vec::with_capacity(profiles.len());

    for profile in profiles {
        let status = state.sessions().connection_status(&profile.id).await;
        statuses.push(status_to_dto(&profile.id, status));
    }

    Ok(NetworkConnectionStatusResponse { statuses })
}

fn neighborhood_normalize(uri: &str) -> Option<String> {
    if !uri.starts_with("network:///") {
        return None;
    }
    if uri == "network:///" {
        Some("network:///".to_string())
    } else {
        Some(uri.trim_end_matches('/').to_string())
    }
}

fn neighborhood_entries_for(normalized: &str, state: &AppState) -> Vec<FileEntryDto> {
    match normalized {
        "network:///" => neighborhood_entries_to_dtos(neighborhood::group_entries()),
        "network:///cloud" => neighborhood_entries_to_dtos(neighborhood::cloud_entries()),
        "network:///lan" => neighborhood_entries_to_dtos(neighborhood::lan_entries()),
        "network:///saved" => saved_connection_entries(state),
        "network:///add" => Vec::new(),
        _ => Vec::new(),
    }
}

#[tauri::command]
pub async fn network_discover_neighborhood(
    request: NetworkNeighborhoodRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<NetworkNeighborhoodResponse, IpcError> {
    let normalized = neighborhood_normalize(&request.uri).ok_or_else(|| {
        IpcError::new(
            app_ipc::error_codes::INVALID_URI,
            "network neighborhood URI must start with network:///",
        )
    })?;
    let entries = neighborhood_entries_for(&normalized, &state);

    Ok(NetworkNeighborhoodResponse {
        uri: request.uri,
        entries,
    })
}

#[tauri::command]
pub fn network_profile_forget_fingerprint(
    request: NetworkProfileActionRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<OkResponse, IpcError> {
    ensure_network_enabled()?;
    state
        .network()
        .clear_host_key_fingerprint(&request.id)
        .map_err(network_error)?;
    Ok(OkResponse { ok: true })
}

#[tauri::command]
pub fn network_profile_trust_fingerprint(
    request: NetworkProfileTrustFingerprintRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<OkResponse, IpcError> {
    ensure_network_enabled()?;
    let fingerprint = request.fingerprint.trim();
    if fingerprint.is_empty() || !fingerprint.starts_with("SHA256:") {
        return Err(IpcError::new(
            app_ipc::error_codes::INVALID_REQUEST,
            "host key fingerprint must be an OpenSSH-style SHA256 fingerprint",
        ));
    }
    state
        .network()
        .set_host_key_fingerprint(&request.id, fingerprint)
        .map_err(network_error)?;
    Ok(OkResponse { ok: true })
}

#[tauri::command]
pub fn network_validate_uri(uri: String) -> Result<OkResponse, IpcError> {
    ensure_network_enabled()?;
    ResourceUri::parse(&uri).map_err(IpcError::from)?;
    Ok(OkResponse { ok: true })
}

#[cfg(test)]
mod tests {
    use super::*;
    use app_core::AppPaths;
    use tempfile::tempdir;

    fn isolated_app_state(root: &std::path::Path) -> Arc<AppState> {
        let paths = AppPaths {
            config_dir: root.join("config"),
            data_dir: root.to_path_buf(),
            log_dir: root.join("logs"),
            history_db: root.join("history.sqlite"),
            preferences_db: root.join("preferences.sqlite"),
            navigation_db: root.join("navigation.sqlite"),
            network_db: root.join("network.sqlite"),
            terminal_db: root.join("terminal.sqlite"),
        };
        app_core::AppCore::boot_with_paths(paths).expect("boot AppCore for test")
    }

    #[test]
    fn neighborhood_normalize_accepts_root_and_trims_trailing_slashes() {
        assert_eq!(
            neighborhood_normalize("network:///").as_deref(),
            Some("network:///")
        );
        assert_eq!(
            neighborhood_normalize("network:///cloud/").as_deref(),
            Some("network:///cloud")
        );
        assert_eq!(
            neighborhood_normalize("network:///saved").as_deref(),
            Some("network:///saved")
        );
    }

    #[test]
    fn neighborhood_normalize_rejects_non_network_uris() {
        assert!(neighborhood_normalize("local:///").is_none());
        assert!(neighborhood_normalize("network://").is_none());
        assert!(neighborhood_normalize("network:/").is_none());
        assert!(neighborhood_normalize("").is_none());
    }

    #[test]
    fn neighborhood_entries_for_root_returns_four_groups_with_expected_uris() {
        let dir = tempdir().unwrap();
        let state = isolated_app_state(dir.path());
        let entries = neighborhood_entries_for("network:///", &state);
        let uris: Vec<&str> = entries.iter().map(|entry| entry.uri.as_str()).collect();

        assert_eq!(
            uris,
            vec![
                "network:///cloud",
                "network:///lan",
                "network:///saved",
                "network:///add",
            ]
        );
        assert_eq!(
            entries[0..3]
                .iter()
                .map(|entry| entry.virtual_kind.as_deref().unwrap())
                .collect::<Vec<_>>(),
            vec!["group", "group", "group"]
        );
        assert_eq!(entries[3].virtual_kind.as_deref(), Some("addConnection"));
        assert_eq!(entries[3].kind, FileKind::Virtual);
    }

    #[test]
    fn neighborhood_entries_for_unknown_uri_is_empty() {
        let dir = tempdir().unwrap();
        let state = isolated_app_state(dir.path());

        let entries = neighborhood_entries_for("network:///unknown", &state);

        assert!(entries.is_empty());
    }

    #[test]
    fn neighborhood_entries_for_add_is_empty() {
        let dir = tempdir().unwrap();
        let state = isolated_app_state(dir.path());

        let entries = neighborhood_entries_for("network:///add", &state);

        assert!(entries.is_empty());
    }

    #[test]
    fn neighborhood_entries_for_root_matches_root_helper() {
        let dir = tempdir().unwrap();
        let state = isolated_app_state(dir.path());

        let dispatched = neighborhood_entries_for("network:///", &state);

        assert_eq!(
            dispatched
                .iter()
                .map(|e| e.uri.as_str())
                .collect::<Vec<_>>(),
            vec![
                "network:///cloud",
                "network:///lan",
                "network:///saved",
                "network:///add",
            ],
        );
    }

    #[test]
    fn neighborhood_entries_for_saved_returns_empty_for_fresh_state() {
        let dir = tempdir().unwrap();
        let state = isolated_app_state(dir.path());

        let entries = neighborhood_entries_for("network:///saved", &state);

        assert!(entries.is_empty());
    }
}
