use std::sync::Arc;

use app_core::AppState;
use app_ipc::{
    error_codes, IpcError, TerminalExitEventDto, TerminalKillRequest, TerminalOkResponse,
    TerminalOutputEventDto, TerminalResizeRequest, TerminalSpawnRequest, TerminalSpawnResponse,
    TerminalWriteRequest, TERMINAL_EXIT_EVENT, TERMINAL_OUTPUT_EVENT,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use tauri::{AppHandle, State, Window};
use terminal_core::{SpawnTerminalRequest, TerminalError, TerminalId, TerminalSize};
use vfs::ResourceUri;

fn terminal_ipc_error(error: TerminalError) -> IpcError {
    let code = match error.code {
        terminal_core::TerminalErrorCode::SpawnFailed => error_codes::TERMINAL_SPAWN_FAILED,
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

fn debug_hex_prefix(data: &[u8]) -> String {
    data.iter()
        .take(32)
        .map(|byte| format!("{byte:02x}"))
        .collect::<Vec<_>>()
        .join(" ")
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

#[tauri::command]
pub async fn terminal_spawn(
    request: TerminalSpawnRequest,
    window: Window,
    state: State<'_, Arc<AppState>>,
) -> Result<TerminalSpawnResponse, IpcError> {
    let cwd = local_directory(&request.uri)?;
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
    if data.iter().any(|b| *b < 0x20 || *b == 0x7f) {
        telemetry::info(&format!(
            "terminal.write session={} owner={} bytes={} hex={}",
            id,
            owner,
            data.len(),
            debug_hex_prefix(&data)
        ));
    }
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
    use super::local_directory;

    #[test]
    fn local_directory_rejects_non_local_scheme() {
        let result = local_directory("sftp://profile/home");
        assert!(result.is_err());
    }
}
