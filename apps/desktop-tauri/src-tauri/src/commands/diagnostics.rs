use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use app_core::{AppState, OperationHistoryRecord};
use app_ipc::{
    AppDataHealthResponse, ExportDiagnosticsBundleRequest, ExportDiagnosticsBundleResponse,
    IpcError,
};
use tauri::State;
use zip::write::FileOptions;

use crate::commands::app_info::app_get_info;

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

#[tauri::command]
pub async fn export_diagnostics_bundle(
    request: ExportDiagnosticsBundleRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<ExportDiagnosticsBundleResponse, IpcError> {
    let destination = PathBuf::from(request.destination);
    let files = write_diagnostics_bundle(&destination, &state)?;

    Ok(ExportDiagnosticsBundleResponse {
        path: destination.to_string_lossy().to_string(),
        files,
    })
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
    let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    let mut files = Vec::new();
    let app_info = serde_json::to_vec_pretty(&app_get_info())
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
    let log_excerpt = read_recent_log_excerpt(&state.paths().log_dir);

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
    options: FileOptions,
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
        "representativeSourcePath": record.representative_source_path.map(|path| redact_home(&path)),
        "destinationPath": record.destination_path.map(|path| redact_home(&path)),
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

pub(crate) fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}
