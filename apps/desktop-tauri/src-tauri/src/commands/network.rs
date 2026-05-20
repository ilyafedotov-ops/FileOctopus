use std::sync::Arc;

use app_core::{is_network_enabled, AppState};
use app_ipc::{
    IpcError, NetworkConnectionStatusDto, NetworkConnectionStatusResponse,
    NetworkProfileActionRequest, NetworkProfileAddRequest, NetworkProfileDeleteRequest,
    NetworkProfileDto, NetworkProfileResponse, NetworkProfileSetSecretRequest,
    NetworkProfileUpdateRequest, NetworkProfilesListResponse, OkResponse,
};
use config::{AuthKind, NewNetworkProfile, UpdateNetworkProfile};
use platform::SecretStore;
use remote_core::ConnectionStatus;
use tauri::State;
use vfs::ResourceUri;

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
pub fn network_validate_uri(uri: String) -> Result<OkResponse, IpcError> {
    ensure_network_enabled()?;
    ResourceUri::parse(&uri).map_err(IpcError::from)?;
    Ok(OkResponse { ok: true })
}
