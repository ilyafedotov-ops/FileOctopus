use std::fs::File;
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::Arc;

use std::sync::atomic::Ordering;

use app_core::{AppPaths, AppState, OperationHistoryRecord};
use app_ipc::{
    error_codes, AppDataHealthResponse, ExportDiagnosticsBundleRequest,
    ExportDiagnosticsBundleResponse, IpcError, LogRecordDto, DIAGNOSTICS_LOG_EVENT,
};
use tauri::{AppHandle, State};
use tokio::sync::broadcast::error::RecvError;
use vfs::ResourceUri;
use zip::write::SimpleFileOptions;

use crate::commands::app_info::app_info_for_paths;
use crate::emit::emit_event;
use crate::state::LogStreamState;

#[tauri::command]
pub async fn diagnostics_app_data_health(
    state: State<'_, Arc<AppState>>,
) -> Result<AppDataHealthResponse, IpcError> {
    let health = state.app_data_health();

    Ok(AppDataHealthResponse {
        config_dir: redact_home(&health.config_dir),
        data_dir: redact_home(&health.data_dir),
        log_dir: redact_home(&health.log_dir),
        database_path: redact_home(&health.database_path),
        database_exists: health.database_exists,
        schema_version: health.schema_version,
        missing_directories: health.missing_directories,
        startup_recovery_count: health.startup_recovery_count,
    })
}

/// Begin streaming backend log records to the UI. Enables the telemetry
/// broadcast layer and lazily spawns a single forwarding task that relays each
/// record to the frontend via the `DIAGNOSTICS_LOG_EVENT` Tauri event.
#[tauri::command]
pub async fn diagnostics_start_log_stream(
    app: AppHandle,
    log_stream: State<'_, LogStreamState>,
) -> Result<(), IpcError> {
    telemetry::set_streaming(true);

    if log_stream
        .task_started
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_ok()
    {
        let mut receiver = telemetry::subscribe();
        tauri::async_runtime::spawn(async move {
            loop {
                match receiver.recv().await {
                    Ok(record) => {
                        if !telemetry::streaming_enabled() {
                            continue;
                        }
                        emit_event(
                            &app,
                            DIAGNOSTICS_LOG_EVENT,
                            LogRecordDto {
                                level: record.level,
                                target: record.target,
                                message: record.message,
                                timestamp_ms: record.timestamp_ms,
                            },
                        );
                    }
                    Err(RecvError::Lagged(_)) => continue,
                    Err(RecvError::Closed) => break,
                }
            }
        });
    }

    Ok(())
}

/// Stop producing backend log records. The forwarding task stays parked on the
/// channel, ready to resume when streaming is re-enabled.
#[tauri::command]
pub async fn diagnostics_stop_log_stream(
    _log_stream: State<'_, LogStreamState>,
) -> Result<(), IpcError> {
    telemetry::set_streaming(false);
    Ok(())
}

#[tauri::command]
pub async fn export_diagnostics_bundle(
    request: ExportDiagnosticsBundleRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<ExportDiagnosticsBundleResponse, IpcError> {
    let destination = resolve_diagnostics_destination(&request.destination, state.paths())?;
    let files = write_diagnostics_bundle(&destination, &state)?;

    Ok(ExportDiagnosticsBundleResponse {
        path: destination.to_string_lossy().to_string(),
        files,
    })
}

/// Validate and contain an IPC-supplied diagnostics destination before it is
/// turned into a filesystem write. Enforces the `local://` boundary contract
/// (ADR-0003): the path must be an absolute local path, free of `..` segments,
/// named as a `.zip` bundle, and contained within a known-safe export root.
pub(crate) fn resolve_diagnostics_destination(
    raw: &str,
    paths: &AppPaths,
) -> Result<PathBuf, IpcError> {
    let trimmed = raw.trim();
    let destination_raw = if trimmed.is_empty() {
        config::default_diagnostics_export_path()
    } else {
        trimmed.to_string()
    };
    let uri = ResourceUri::from_local_path(Path::new(&destination_raw)).map_err(|_| {
        IpcError::new(
            error_codes::INVALID_PATH,
            "Diagnostics destination must be an absolute local path.",
        )
    })?;
    let destination = uri.to_local_path().map_err(|_| {
        IpcError::new(
            error_codes::INVALID_PATH,
            "Diagnostics destination must be a local path.",
        )
    })?;

    if destination
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err(IpcError::new(
            error_codes::INVALID_PATH,
            "Diagnostics destination must not contain '..' segments.",
        ));
    }

    let is_zip = destination
        .extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("zip"));
    if !is_zip {
        return Err(IpcError::new(
            error_codes::INVALID_PATH,
            "Diagnostics destination must be a .zip file.",
        ));
    }

    if !is_within_allowed_root(&destination, paths) {
        return Err(IpcError::new(
            error_codes::INVALID_PATH,
            "Diagnostics destination is outside the allowed export locations.",
        ));
    }

    Ok(destination)
}

fn is_within_allowed_root(destination: &Path, paths: &AppPaths) -> bool {
    allowed_export_roots(paths)
        .iter()
        .any(|root| destination.starts_with(root))
}

fn allowed_export_roots(paths: &AppPaths) -> Vec<PathBuf> {
    let mut roots = vec![
        std::env::temp_dir(),
        paths.data_dir.clone(),
        paths.config_dir.clone(),
    ];
    #[cfg(unix)]
    roots.push(PathBuf::from("/tmp"));
    if let Some(home) = home_dir() {
        roots.push(home);
    }
    roots
}

pub(crate) fn write_diagnostics_bundle(
    destination: &Path,
    state: &AppState,
) -> Result<Vec<String>, IpcError> {
    if let Some(parent) = destination.parent() {
        std::fs::create_dir_all(parent).map_err(|error| {
            IpcError::internal(&format!("failed to create diagnostics directory: {error}"))
        })?;
    }

    let file = File::create(destination).map_err(|error| {
        IpcError::internal(&format!("failed to create diagnostics bundle: {error}"))
    })?;
    let mut archive = zip::ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    let mut files = Vec::new();
    let app_info = serde_json::to_vec_pretty(&app_info_for_paths(state.paths()))
        .map_err(|error| IpcError::internal(&format!("failed to serialize app info: {error}")))?;
    let health = state.app_data_health();
    let health = serde_json::json!({
        "configDir": redact_home(&health.config_dir),
        "dataDir": redact_home(&health.data_dir),
        "logDir": redact_home(&health.log_dir),
        "databasePath": redact_home(&health.database_path),
        "databaseExists": health.database_exists,
        "schemaVersion": health.schema_version,
        "missingDirectories": health.missing_directories,
        "startupRecoveryCount": health.startup_recovery_count
    });
    let history = state
        .operations()
        .recent_history(50)
        .into_iter()
        .map(redact_history_record)
        .collect::<Vec<_>>();
    let log_excerpt = redact_diagnostics_text(&read_recent_log_excerpt(&state.paths().log_dir));

    add_archive_file(
        &mut archive,
        options,
        "app-info.json",
        &app_info,
        &mut files,
    )?;
    add_archive_file(
        &mut archive,
        options,
        "app-data-health.json",
        &serde_json::to_vec_pretty(&health)
            .map_err(|error| IpcError::internal(&format!("failed to serialize health: {error}")))?,
        &mut files,
    )?;
    add_archive_file(
        &mut archive,
        options,
        "operation-history.json",
        &serde_json::to_vec_pretty(&history).map_err(|error| {
            IpcError::internal(&format!("failed to serialize history: {error}"))
        })?,
        &mut files,
    )?;
    add_archive_file(
        &mut archive,
        options,
        "recent-log.txt",
        log_excerpt.as_bytes(),
        &mut files,
    )?;
    archive.finish().map_err(|error| {
        IpcError::internal(&format!("failed to finish diagnostics bundle: {error}"))
    })?;

    Ok(files)
}

fn add_archive_file(
    archive: &mut zip::ZipWriter<File>,
    options: SimpleFileOptions,
    name: &str,
    contents: &[u8],
    files: &mut Vec<String>,
) -> Result<(), IpcError> {
    archive
        .start_file(name, options)
        .map_err(|error| IpcError::internal(&format!("failed to add diagnostics file: {error}")))?;
    archive.write_all(contents).map_err(|error| {
        IpcError::internal(&format!("failed to write diagnostics file: {error}"))
    })?;
    files.push(name.to_string());

    Ok(())
}

fn redact_history_record(record: OperationHistoryRecord) -> serde_json::Value {
    serde_json::json!({
        "jobId": record.job_id,
        "operationKind": record.operation_kind,
        "sourceCount": record.source_count,
        "representativeSourcePath": record.representative_source_path.map(|path| redact_diagnostics_history_path(&path)),
        "destinationPath": record.destination_path.map(|path| redact_diagnostics_history_path(&path)),
        "status": record.status,
        "startedAt": record.started_at,
        "completedAt": record.completed_at,
        "errorCode": record.error_code
    })
}

fn read_recent_log_excerpt(log_dir: &Path) -> String {
    let Some(path) = latest_log_file(log_dir) else {
        return "No log file found.".to_string();
    };
    let Ok(mut file) = File::open(path) else {
        return "Log file could not be opened.".to_string();
    };
    let mut contents = Vec::new();

    if file.read_to_end(&mut contents).is_err() {
        return "Log file could not be read.".to_string();
    }

    let start = contents.len().saturating_sub(64 * 1024);
    String::from_utf8_lossy(&contents[start..]).to_string()
}

fn latest_log_file(log_dir: &Path) -> Option<PathBuf> {
    std::fs::read_dir(log_dir)
        .ok()?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let metadata = entry.metadata().ok()?;

            metadata
                .modified()
                .ok()
                .map(|modified| (modified, entry.path()))
        })
        .max_by_key(|(modified, _)| *modified)
        .map(|(_, path)| path)
}

pub(crate) fn redact_home(value: &str) -> String {
    let Some(home) = home_dir() else {
        return value.to_string();
    };
    let home = home.to_string_lossy();

    value.replace(home.as_ref(), "~")
}

pub(crate) fn redact_diagnostics_history_path(value: &str) -> String {
    let basename = Path::new(value)
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .filter(|name| !name.is_empty());
    let redacted = redact_home(value);
    let Some(basename) = basename else {
        return redacted;
    };

    if redacted.starts_with("~/") || redacted == "~" {
        format!("~/…/{basename}")
    } else if Path::new(value).is_absolute() {
        format!("…/{basename}")
    } else {
        basename
    }
}

pub(crate) fn redact_diagnostics_text(value: &str) -> String {
    let value = redact_home(value);
    let mut redacted = String::with_capacity(value.len());
    let mut token = String::new();

    for ch in value.chars() {
        if ch.is_whitespace() {
            if !token.is_empty() {
                redacted.push_str(&redact_diagnostics_token(&token));
                token.clear();
            }
            redacted.push(ch);
        } else {
            token.push(ch);
        }
    }

    if !token.is_empty() {
        redacted.push_str(&redact_diagnostics_token(&token));
    }

    redacted
}

fn redact_diagnostics_token(token: &str) -> String {
    let Some((key, value)) = token.split_once('=') else {
        return token.to_string();
    };
    let normalized = key
        .trim_matches(|ch: char| !ch.is_ascii_alphanumeric() && ch != '_' && ch != '-')
        .to_ascii_lowercase();
    let sensitive = matches!(
        normalized.as_str(),
        "host"
            | "hostname"
            | "password"
            | "passphrase"
            | "token"
            | "access_token"
            | "refresh_token"
            | "privatekeypath"
            | "private_key_path"
            | "private-key-path"
    );
    if sensitive || value.contains("/.ssh/") || value.contains("\\.ssh\\") {
        format!("{key}=<redacted>")
    } else {
        token.to_string()
    }
}

pub(crate) fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_sensitive_diagnostics_values() {
        let input = "connecting to host=prod.example.com token=abc123 password=hunter2 privateKeyPath=/home/ilya/.ssh/id_ed25519";
        let redacted = redact_diagnostics_text(input);

        assert!(!redacted.contains("abc123"));
        assert!(!redacted.contains("hunter2"));
        assert!(!redacted.contains("prod.example.com"));
        assert!(!redacted.contains("/home/ilya/.ssh/id_ed25519"));
    }
}
