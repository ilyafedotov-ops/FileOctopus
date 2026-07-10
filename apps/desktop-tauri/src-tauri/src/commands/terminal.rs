use std::sync::Arc;

use app_core::AppState;
use app_ipc::{
    error_codes, IpcError, TerminalCapabilitiesResponse, TerminalExitEventDto, TerminalKillRequest,
    TerminalOkResponse, TerminalOutputEventDto, TerminalProfileActionRequest,
    TerminalProfileAddRequest, TerminalProfileResponse, TerminalProfileUpdateRequest,
    TerminalProfilesListResponse, TerminalResizeRequest, TerminalRunCommandRequest,
    TerminalSendTextRequest, TerminalSessionDto, TerminalSessionEventDto, TerminalSessionStatusDto,
    TerminalSessionsListResponse, TerminalSpawnAndRunRequest, TerminalSpawnRequest,
    TerminalSpawnResponse, TerminalWriteRequest, TERMINAL_EXIT_EVENT, TERMINAL_OUTPUT_EVENT,
    TERMINAL_SESSION_EVENT,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use config::AuthKind;
use tauri::{AppHandle, State, Window};
use terminal_core::{
    RemoteTerminalAuth, SpawnRemoteTerminalRequest, SpawnTerminalRequest, TerminalError,
    TerminalId, TerminalSessionSnapshot, TerminalSessionStatus, TerminalSize,
};
use vfs::ResourceUri;

fn terminal_ipc_error(error: TerminalError) -> IpcError {
    let code = match error.code {
        terminal_core::TerminalErrorCode::SpawnFailed => error_codes::TERMINAL_SPAWN_FAILED,
        terminal_core::TerminalErrorCode::AuthenticationFailed => {
            error_codes::AUTHENTICATION_FAILED
        }
        terminal_core::TerminalErrorCode::HostKeyUntrusted => error_codes::HOST_KEY_UNTRUSTED,
        terminal_core::TerminalErrorCode::HostKeyMismatch => error_codes::HOST_KEY_MISMATCH,
        terminal_core::TerminalErrorCode::NotFound => error_codes::TERMINAL_NOT_FOUND,
        terminal_core::TerminalErrorCode::InvalidSize => error_codes::INVALID_TERMINAL_SIZE,
        terminal_core::TerminalErrorCode::Io => error_codes::IO_ERROR,
        terminal_core::TerminalErrorCode::SessionExited => error_codes::TERMINAL_SESSION_EXITED,
    };
    IpcError::new(code, error.message)
}

fn terminal_profile_error(error: config::TerminalProfileError) -> IpcError {
    match error {
        config::TerminalProfileError::ProfileNotFound => {
            IpcError::new(error_codes::NOT_FOUND, "terminal profile not found")
        }
        config::TerminalProfileError::CannotDeleteDefault => IpcError::new(
            error_codes::INVALID_REQUEST,
            "cannot delete the default terminal profile",
        ),
        config::TerminalProfileError::InvalidValue { field, reason } => IpcError::new(
            error_codes::INVALID_REQUEST,
            format!("invalid terminal profile {field}: {reason}"),
        ),
        other => IpcError::new(error_codes::PREFERENCES_ERROR, other.to_string()),
    }
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

fn home_local_uri() -> Option<String> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .and_then(|value| {
            let path = std::path::PathBuf::from(value);
            ResourceUri::from_local_path(&path).ok()
        })
        .map(|uri| uri.as_str().to_string())
}

fn terminal_session_status_to_dto(status: TerminalSessionStatus) -> TerminalSessionStatusDto {
    match status {
        TerminalSessionStatus::Starting => TerminalSessionStatusDto::Starting,
        TerminalSessionStatus::Running => TerminalSessionStatusDto::Running,
        TerminalSessionStatus::Exited => TerminalSessionStatusDto::Exited,
    }
}

fn terminal_session_to_dto(snapshot: TerminalSessionSnapshot) -> TerminalSessionDto {
    TerminalSessionDto {
        session_id: snapshot.id.to_string(),
        status: terminal_session_status_to_dto(snapshot.status),
        title: snapshot.title,
        cwd_uri: snapshot.cwd_uri,
        terminal_profile_id: snapshot.terminal_profile_id,
        transport: snapshot.transport,
        cols: snapshot.cols,
        rows: snapshot.rows,
        exit_code: snapshot.exit_code,
    }
}

fn terminal_session_event_to_dto(
    kind: &str,
    snapshot: TerminalSessionSnapshot,
) -> TerminalSessionEventDto {
    TerminalSessionEventDto {
        kind: kind.to_string(),
        session_id: snapshot.id.to_string(),
        status: terminal_session_status_to_dto(snapshot.status),
        title: snapshot.title,
        cwd_uri: snapshot.cwd_uri,
        terminal_profile_id: snapshot.terminal_profile_id,
        transport: snapshot.transport,
        cols: snapshot.cols,
        rows: snapshot.rows,
        exit_code: snapshot.exit_code,
    }
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
    let terminal_profile = match request.terminal_profile_id.as_deref() {
        Some(id) => Some(
            state
                .terminal_profiles()
                .get(id)
                .map_err(terminal_profile_error)?,
        ),
        None => state.terminal_profiles().default_profile().ok(),
    };

    let profile_network_id = terminal_profile
        .as_ref()
        .and_then(|profile| profile.network_profile_id.as_deref())
        .filter(|value| !value.trim().is_empty());

    if let Some(profile_id) = request.profile_id.as_deref() {
        return terminal_spawn_ssh(
            profile_id,
            terminal_profile.as_ref(),
            &request,
            window,
            state,
        )
        .await;
    }

    if let Some(profile_id) = profile_network_id {
        return terminal_spawn_ssh(
            profile_id,
            terminal_profile.as_ref(),
            &request,
            window,
            state,
        )
        .await;
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
        .or_else(|| {
            terminal_profile
                .as_ref()
                .and_then(|profile| non_empty_string(profile.shell.clone()))
        })
        .or_else(|| non_empty_string(preferences.terminal_shell));
    let args = request
        .args
        .or_else(|| {
            terminal_profile
                .as_ref()
                .and_then(|profile| non_empty_args(profile.args.clone()))
        })
        .or_else(|| non_empty_args(preferences.terminal_args));
    let mut env = terminal_profile
        .as_ref()
        .map(|profile| parse_env_lines(&profile.env))
        .transpose()?
        .unwrap_or_default();
    if let Some(request_env) = request.env.clone() {
        env.extend(request_env.into_iter().map(|item| (item.key, item.value)));
    }
    let owner = window.label().to_string();
    let id = state
        .terminals()
        .spawn(SpawnTerminalRequest {
            cwd,
            cwd_uri: request.uri.clone(),
            cols: request.cols,
            rows: request.rows,
            shell,
            args,
            env,
            terminal_profile_id: terminal_profile.as_ref().map(|profile| profile.id.clone()),
            title: request.title.clone().or_else(|| {
                terminal_profile
                    .as_ref()
                    .map(|profile| profile.name.clone())
            }),
            owner,
        })
        .map_err(terminal_ipc_error)?;
    let initial_command = request
        .initial_command
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            terminal_profile
                .as_ref()
                .map(|profile| profile.initial_command.as_str())
                .filter(|value| !value.trim().is_empty())
        });
    if let Some(command) = initial_command {
        state
            .terminals()
            .run_command(id, window.label(), command, true)
            .map_err(terminal_ipc_error)?;
    }
    Ok(TerminalSpawnResponse {
        session_id: id.to_string(),
    })
}

async fn terminal_spawn_ssh(
    profile_id: &str,
    terminal_profile: Option<&config::TerminalProfile>,
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

    state
        .sessions()
        .verify_profile_host_key(profile_id)
        .await
        .map_err(|error| IpcError::new(error.code(), error.to_string()))?;
    let expected_host_key_fingerprint = profile.host_key_fingerprint.clone().ok_or_else(|| {
        IpcError::new(
            error_codes::HOST_KEY_UNTRUSTED,
            "SSH host key must be confirmed before starting a terminal",
        )
    })?;

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
        expected_host_key_fingerprint,
        cols: request.cols,
        rows: request.rows,
        cwd_uri: request.uri.clone(),
        terminal_profile_id: terminal_profile.map(|profile| profile.id.clone()),
        title: request
            .title
            .clone()
            .or_else(|| terminal_profile.map(|profile| profile.name.clone())),
        owner,
    };
    let spawned = tauri::async_runtime::spawn_blocking(move || terminals.spawn_ssh(remote_request))
        .await
        .map_err(|error| IpcError::terminal_spawn_failed(error.to_string()))?
        .map_err(terminal_ipc_error)?;

    let initial_command = request
        .initial_command
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            terminal_profile
                .map(|profile| profile.initial_command.as_str())
                .filter(|value| !value.trim().is_empty())
        });
    if let Some(command) = initial_command {
        state
            .terminals()
            .run_command(spawned.id, window.label(), command, true)
            .map_err(terminal_ipc_error)?;
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

fn parse_env_lines(value: &str) -> Result<Vec<(String, String)>, IpcError> {
    let mut env = Vec::new();
    for line in value.lines().map(str::trim).filter(|line| !line.is_empty()) {
        let Some((key, value)) = line.split_once('=') else {
            return Err(IpcError::new(
                error_codes::INVALID_REQUEST,
                format!("invalid terminal environment line `{line}`"),
            ));
        };
        let key = key.trim();
        if key.is_empty() {
            return Err(IpcError::new(
                error_codes::INVALID_REQUEST,
                "terminal environment variable key must not be empty",
            ));
        }
        env.push((key.to_string(), value.to_string()));
    }
    Ok(env)
}

#[tauri::command]
pub async fn terminal_capabilities() -> Result<TerminalCapabilitiesResponse, IpcError> {
    let default_shell = terminal_core::default_shell();
    let default_args = terminal_core::shell_login_args(&default_shell);
    let discovered_shells = discover_shells(&default_shell);
    Ok(TerminalCapabilitiesResponse {
        default_shell,
        default_args,
        discovered_shells,
        supports_ssh: app_core::is_network_enabled(),
        cursor_styles: vec![
            "block".to_string(),
            "bar".to_string(),
            "underline".to_string(),
        ],
        theme_ids: vec![
            "system".to_string(),
            "dark".to_string(),
            "light".to_string(),
        ],
    })
}

fn discover_shells(default_shell: &str) -> Vec<String> {
    let mut shells = vec![default_shell.to_string()];
    for candidate in [
        "/bin/zsh",
        "/bin/bash",
        "/usr/bin/fish",
        "/usr/bin/pwsh",
        "cmd.exe",
        "powershell.exe",
        "pwsh",
    ] {
        let should_include = if candidate.contains('/') {
            std::path::Path::new(candidate).exists()
        } else {
            cfg!(target_os = "windows")
        };
        if should_include && !shells.iter().any(|shell| shell == candidate) {
            shells.push(candidate.to_string());
        }
    }
    shells
}

#[tauri::command]
pub async fn terminal_profiles_list(
    state: State<'_, Arc<AppState>>,
) -> Result<TerminalProfilesListResponse, IpcError> {
    let profiles = state
        .terminal_profiles()
        .list()
        .map_err(terminal_profile_error)?;
    let default_profile_id = profiles
        .iter()
        .find(|profile| profile.is_default)
        .map(|profile| profile.id.clone());
    Ok(TerminalProfilesListResponse {
        profiles: profiles.into_iter().map(Into::into).collect(),
        default_profile_id,
    })
}

#[tauri::command]
pub async fn terminal_profile_add(
    request: TerminalProfileAddRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<TerminalProfileResponse, IpcError> {
    let profile = state
        .terminal_profiles()
        .add(request.profile.into())
        .map_err(terminal_profile_error)?;
    Ok(TerminalProfileResponse {
        profile: profile.into(),
    })
}

#[tauri::command]
pub async fn terminal_profile_update(
    request: TerminalProfileUpdateRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<TerminalProfileResponse, IpcError> {
    let profile = state
        .terminal_profiles()
        .update(&request.id, request.profile.into())
        .map_err(terminal_profile_error)?;
    Ok(TerminalProfileResponse {
        profile: profile.into(),
    })
}

#[tauri::command]
pub async fn terminal_profile_delete(
    request: TerminalProfileActionRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<TerminalOkResponse, IpcError> {
    state
        .terminal_profiles()
        .delete(&request.id)
        .map_err(terminal_profile_error)?;
    Ok(TerminalOkResponse { success: true })
}

#[tauri::command]
pub async fn terminal_profile_set_default(
    request: TerminalProfileActionRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<TerminalProfileResponse, IpcError> {
    let profile = state
        .terminal_profiles()
        .set_default(&request.id)
        .map_err(terminal_profile_error)?;
    Ok(TerminalProfileResponse {
        profile: profile.into(),
    })
}

#[tauri::command]
pub async fn terminal_sessions_list(
    window: Window,
    state: State<'_, Arc<AppState>>,
) -> Result<TerminalSessionsListResponse, IpcError> {
    Ok(TerminalSessionsListResponse {
        sessions: state
            .terminals()
            .list_sessions(window.label())
            .into_iter()
            .map(terminal_session_to_dto)
            .collect(),
    })
}

#[tauri::command]
pub async fn terminal_send_text(
    request: TerminalSendTextRequest,
    window: Window,
    state: State<'_, Arc<AppState>>,
) -> Result<TerminalOkResponse, IpcError> {
    let id = parse_session_id(&request.session_id)?;
    state
        .terminals()
        .send_text(id, window.label(), &request.text)
        .map_err(terminal_ipc_error)?;
    Ok(TerminalOkResponse { success: true })
}

#[tauri::command]
pub async fn terminal_run_command(
    request: TerminalRunCommandRequest,
    window: Window,
    state: State<'_, Arc<AppState>>,
) -> Result<TerminalOkResponse, IpcError> {
    let id = parse_session_id(&request.session_id)?;
    state
        .terminals()
        .run_command(id, window.label(), &request.command, request.append_newline)
        .map_err(terminal_ipc_error)?;
    Ok(TerminalOkResponse { success: true })
}

#[tauri::command]
pub async fn terminal_spawn_and_run(
    request: TerminalSpawnAndRunRequest,
    window: Window,
    state: State<'_, Arc<AppState>>,
) -> Result<TerminalSpawnResponse, IpcError> {
    let spawn = TerminalSpawnRequest {
        uri: request.uri.or_else(home_local_uri),
        profile_id: request.profile_id,
        terminal_profile_id: request.terminal_profile_id,
        cols: request.cols,
        rows: request.rows,
        shell: None,
        args: None,
        env: None,
        initial_command: Some(request.command),
        title: request.title,
    };
    terminal_spawn(spawn, window, state).await
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
                    crate::emit::emit_event_to(
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
                    crate::emit::emit_event_to(
                        &app,
                        &owner,
                        TERMINAL_EXIT_EVENT,
                        TerminalExitEventDto {
                            session_id: id.to_string(),
                            exit_code,
                        },
                    );
                }
                terminal_core::TerminalEvent::Session { kind, snapshot } => {
                    let owner = snapshot.owner.clone();
                    crate::emit::emit_event_to(
                        &app,
                        &owner,
                        TERMINAL_SESSION_EVENT,
                        terminal_session_event_to_dto(kind, snapshot),
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
