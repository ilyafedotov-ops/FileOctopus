use std::sync::Arc;

use app_core::AppState;
use app_ipc::{
    error_codes, IpcError, TerminalExitEventDto, TerminalKillRequest, TerminalOkResponse,
    TerminalOutputEventDto, TerminalResizeRequest, TerminalSpawnRequest, TerminalSpawnResponse,
    TerminalWriteRequest, TERMINAL_EXIT_EVENT, TERMINAL_OUTPUT_EVENT,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use config::AuthKind;
use tauri::{AppHandle, State, Window};
use terminal_core::{
    RemoteTerminalAuth, SpawnRemoteTerminalRequest, SpawnTerminalRequest, TerminalError,
    TerminalId, TerminalSize,
};
use vfs::ResourceUri;

fn terminal_ipc_error(error: TerminalError) -> IpcError {
    let code = match error.code {
        terminal_core::TerminalErrorCode::SpawnFailed => error_codes::TERMINAL_SPAWN_FAILED,
        terminal_core::TerminalErrorCode::AuthenticationFailed => {
            error_codes::AUTHENTICATION_FAILED
        }
        terminal_core::TerminalErrorCode::NotFound => error_codes::TERMINAL_NOT_FOUND,
        terminal_core::TerminalErrorCode::InvalidSize => error_codes::INVALID_TERMINAL_SIZE,
        terminal_core::TerminalErrorCode::Io => error_codes::IO_ERROR,
        terminal_core::TerminalErrorCode::SessionExited => error_codes::TERMINAL_SESSION_EXITED,
    };
    IpcError::new(code, error.message)
}

fn parse_session_id(value: &str) -> Result<TerminalId, IpcError> {
    TerminalId::parse(value).map_err(terminal_ipc_error)
}

fn local_directory(uri_str: &str) -> Result<std::path::PathBuf, IpcError> {
    let uri = ResourceUri::parse(uri_str).map_err(IpcError::from)?;
    let path = uri.to_local_path().map_err(IpcError::from)?;
    if !path.is_dir() {
        return Err(IpcError::new(
            error_codes::NOT_FOUND,
            format!("directory not found: {}", path.display()),
        ));
    }
    Ok(path)
}

fn validate_remote_terminal_spawn_preflight(
    profile_id: &str,
    network_enabled: bool,
) -> Result<(), IpcError> {
    if profile_id.trim().is_empty() {
        return Err(IpcError::new(
            error_codes::INVALID_REQUEST,
            "remote terminal spawn requires profileId",
        ));
    }
    if !network_enabled {
        return Err(IpcError::new(
            error_codes::NETWORK_DISABLED,
            "network features are disabled; set FILEOCTOPUS_ENABLE_NETWORK=1 to enable them",
        ));
    }
    Ok(())
}

#[tauri::command]
pub async fn terminal_spawn(
    request: TerminalSpawnRequest,
    window: Window,
    state: State<'_, Arc<AppState>>,
) -> Result<TerminalSpawnResponse, IpcError> {
    if let Some(profile_id) = request.profile_id.as_deref() {
        return terminal_spawn_ssh(profile_id, &request, window, state).await;
    }

    let uri = request.uri.as_deref().ok_or_else(|| {
        IpcError::new(
            error_codes::INVALID_REQUEST,
            "terminal spawn requires uri or profileId",
        )
    })?;
    let cwd = local_directory(uri)?;
    let preferences = state
        .preferences()
        .get_all()
        .map_err(|error| IpcError::new(error_codes::INVALID_REQUEST, error.to_string()))?;
    let shell = request
        .shell
        .or_else(|| non_empty_string(preferences.terminal_shell));
    let args = request
        .args
        .or_else(|| non_empty_args(preferences.terminal_args));
    let owner = window.label().to_string();
    let id = state
        .terminals()
        .spawn(SpawnTerminalRequest {
            cwd,
            cols: request.cols,
            rows: request.rows,
            shell,
            args,
            owner,
        })
        .map_err(terminal_ipc_error)?;
    Ok(TerminalSpawnResponse {
        session_id: id.to_string(),
    })
}

async fn terminal_spawn_ssh(
    profile_id: &str,
    request: &TerminalSpawnRequest,
    window: Window,
    state: State<'_, Arc<AppState>>,
) -> Result<TerminalSpawnResponse, IpcError> {
    validate_remote_terminal_spawn_preflight(profile_id, app_core::is_network_enabled())?;

    let profile = state.network().get(profile_id).map_err(|error| {
        IpcError::new(
            error_codes::NOT_FOUND,
            format!("network profile not found: {error}"),
        )
    })?;
    if !matches!(profile.scheme.as_str(), "sftp" | "ssh") {
        return Err(IpcError::new(
            error_codes::INVALID_REQUEST,
            format!("profile `{profile_id}` does not support SSH terminals"),
        ));
    }

    let secrets =
        remote_core::AuthSecrets::load(state.secrets(), &profile).map_err(|error| match error {
            platform::SecretStoreError::NotFound => IpcError::new(
                error_codes::AUTHENTICATION_FAILED,
                remote_core::MISSING_STORED_PASSWORD,
            ),
            other => IpcError::network_error(other.to_string()),
        })?;
    let auth = match profile.auth_kind {
        AuthKind::Password => RemoteTerminalAuth::Password {
            password: secrets.password.ok_or_else(|| {
                IpcError::new(
                    error_codes::AUTHENTICATION_FAILED,
                    remote_core::MISSING_STORED_PASSWORD,
                )
            })?,
        },
        AuthKind::PrivateKey => RemoteTerminalAuth::PrivateKey {
            private_key_path: profile.private_key_path.clone().ok_or_else(|| {
                IpcError::new(
                    error_codes::AUTHENTICATION_FAILED,
                    "missing private key path",
                )
            })?,
            passphrase: secrets.passphrase,
        },
        AuthKind::AccessKey => RemoteTerminalAuth::Password {
            password: secrets.password.ok_or_else(|| {
                IpcError::new(
                    error_codes::AUTHENTICATION_FAILED,
                    remote_core::MISSING_STORED_PASSWORD,
                )
            })?,
        },
        AuthKind::OAuth => {
            return Err(IpcError::new(
                error_codes::AUTHENTICATION_FAILED,
                "OAuth authentication is not supported for terminal connections",
            ));
        }
    };
    let owner = window.label().to_string();
    let terminals = state.terminals();
    let remote_request = SpawnRemoteTerminalRequest {
        host: profile.host.clone(),
        port: profile.port,
        username: profile.username.clone(),
        auth,
        expected_host_key_fingerprint: profile.host_key_fingerprint.clone(),
        cols: request.cols,
        rows: request.rows,
        owner,
    };
    let spawned = tauri::async_runtime::spawn_blocking(move || terminals.spawn_ssh(remote_request))
        .await
        .map_err(|error| IpcError::terminal_spawn_failed(error.to_string()))?
        .map_err(terminal_ipc_error)?;

    if let Some(observed) = spawned.observed_host_key_fingerprint.as_deref() {
        if profile.host_key_fingerprint.as_deref() != Some(observed) {
            let _ = state
                .network()
                .set_host_key_fingerprint(profile_id, observed);
        }
    }

    Ok(TerminalSpawnResponse {
        session_id: spawned.id.to_string(),
    })
}

fn non_empty_string(value: String) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn non_empty_args(value: String) -> Option<Vec<String>> {
    let args = value
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToString::to_string)
        .collect::<Vec<_>>();
    if args.is_empty() {
        None
    } else {
        Some(args)
    }
}

#[tauri::command]
pub async fn terminal_write(
    request: TerminalWriteRequest,
    window: Window,
    state: State<'_, Arc<AppState>>,
) -> Result<TerminalOkResponse, IpcError> {
    let id = parse_session_id(&request.session_id)?;
    let owner = window.label();
    let data = BASE64
        .decode(&request.data)
        .map_err(|error| IpcError::new(error_codes::INVALID_REQUEST, error.to_string()))?;
    match state.terminals().write(id, owner, &data) {
        Ok(()) => {}
        Err(error) => {
            telemetry::error(&format!(
                "terminal.write failed session={} owner={} code={:?} message={}",
                id, owner, error.code, error.message
            ));
            return Err(terminal_ipc_error(error));
        }
    }
    Ok(TerminalOkResponse { success: true })
}

#[tauri::command]
pub async fn terminal_resize(
    request: TerminalResizeRequest,
    window: Window,
    state: State<'_, Arc<AppState>>,
) -> Result<TerminalOkResponse, IpcError> {
    let id = parse_session_id(&request.session_id)?;
    let owner = window.label();
    state
        .terminals()
        .resize(
            id,
            owner,
            TerminalSize {
                cols: request.cols,
                rows: request.rows,
            },
        )
        .map_err(terminal_ipc_error)?;
    Ok(TerminalOkResponse { success: true })
}

#[tauri::command]
pub async fn terminal_kill(
    request: TerminalKillRequest,
    window: Window,
    state: State<'_, Arc<AppState>>,
) -> Result<TerminalOkResponse, IpcError> {
    let id = parse_session_id(&request.session_id)?;
    let owner = window.label();
    state
        .terminals()
        .kill(id, owner)
        .map_err(terminal_ipc_error)?;
    Ok(TerminalOkResponse { success: true })
}

pub fn start_terminal_event_bridge(app: AppHandle, state: Arc<AppState>) {
    let Some(rx) = state.terminals().take_event_receiver() else {
        telemetry::error("terminal event bridge: event receiver already taken");
        return;
    };

    std::thread::spawn(move || {
        while let Ok(event) = rx.recv() {
            match event {
                terminal_core::TerminalEvent::Output { id, owner, data } => {
                    crate::emit::emit_with_eval_to(
                        &app,
                        &owner,
                        TERMINAL_OUTPUT_EVENT,
                        TerminalOutputEventDto {
                            session_id: id.to_string(),
                            data: BASE64.encode(data),
                        },
                    );
                }
                terminal_core::TerminalEvent::Exit {
                    id,
                    owner,
                    exit_code,
                } => {
                    crate::emit::emit_with_eval_to(
                        &app,
                        &owner,
                        TERMINAL_EXIT_EVENT,
                        TerminalExitEventDto {
                            session_id: id.to_string(),
                            exit_code,
                        },
                    );
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::{local_directory, terminal_ipc_error, validate_remote_terminal_spawn_preflight};
    use app_ipc::error_codes;
    use terminal_core::TerminalError;

    #[test]
    fn local_directory_rejects_non_local_scheme() {
        let result = local_directory("sftp://profile/home");
        assert!(result.is_err());
    }

    #[test]
    fn terminal_authentication_errors_keep_auth_code() {
        let error = terminal_ipc_error(TerminalError::authentication_failed("bad credentials"));
        assert_eq!(error.code, error_codes::AUTHENTICATION_FAILED);
    }

    #[test]
    fn remote_terminal_preflight_rejects_disabled_network() {
        let error = validate_remote_terminal_spawn_preflight("profile-1", false).unwrap_err();
        assert_eq!(error.code, error_codes::NETWORK_DISABLED);
    }

    #[test]
    fn remote_terminal_preflight_rejects_empty_profile_id() {
        let error = validate_remote_terminal_spawn_preflight("  ", true).unwrap_err();
        assert_eq!(error.code, error_codes::INVALID_REQUEST);
    }
}
