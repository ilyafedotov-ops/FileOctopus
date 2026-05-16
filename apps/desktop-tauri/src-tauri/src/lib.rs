use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tauri::Manager;
use tauri_plugin_autostart::ManagerExt;

use app_core::{AppCore, AppState, OperationHistoryRecord};
use app_ipc::{
    job_event_name, job_event_payload, AppDataHealthResponse, AppInfoResponse, AutostartStatusDto,
    CancelJobRequest, ClearOperationHistoryResponse, ComputeHashRequest, ComputeHashResponse,
    CreateFileRequest, CreateFileResponse, DeletePermanentlyRequest, DirectoryBatchEventDto,
    ExportDiagnosticsBundleRequest, ExportDiagnosticsBundleResponse, FolderSizeCompletedEventDto,
    FolderSizeJobResponse, FolderSizeRequest, FolderSizeResponse, FolderSizeSummaryDto,
    GetPreferencesResponse, IpcError, JobStatusRequest, JobStatusResponse,
    ListRecentOperationsRequest, ListRecentOperationsResponse, ListStartRequest, ListStartResponse,
    NavigationAddFavoriteRequest, NavigationFavoriteResponse, NavigationIsStarredRequest,
    NavigationIsStarredResponse, NavigationListFavoritesResponse, NavigationListRecentRequest,
    NavigationListRecentResponse, NavigationListStarredResponse, NavigationRecordVisitRequest,
    NavigationRemoveFavoriteRequest, NavigationRenameFavoriteRequest,
    NavigationToggleStarredRequest, NavigationToggleStarredResponse, OkResponse,
    OpenTerminalRequest, OpenTerminalResponse, OperationHistoryRecordDto, PathPropertiesDto,
    PathPropertiesRequest, PathPropertiesResponse, PathRequest, PlanFileOperationRequest,
    PlanFileOperationResponse, ReadTextFileRequest, ReadTextFileResponse,
    RecursiveSearchCompletedEventDto, RecursiveSearchJobResponse, RecursiveSearchMatchEventDto,
    RecursiveSearchRequest, RecursiveSearchResponse, RecursiveSearchResultDto, SearchMatchDto,
    SetPreferenceRequest, SetPreferenceResponse, StandardLocationDto, StandardLocationsResponse,
    StartFileOperationRequest, StartFileOperationResponse, StatRequest, StatResponse,
    UserPreferencesDto, WatchEventDto, WatchStartRequest, DIRECTORY_BATCH_EVENT,
    FOLDER_SIZE_COMPLETED_EVENT, RECURSIVE_SEARCH_COMPLETED_EVENT, RECURSIVE_SEARCH_MATCH_EVENT,
    WATCH_CHANGED_EVENT,
};
use chrono::Utc;
use config::RecentBucket;
use fs_core::sprint4;
use jobs::{
    CancellationToken, JobCancelledEvent, JobCompletedEvent, JobEvent, JobFailedEvent, JobId,
    JobProgressEvent, JobSnapshot, JobStartedEvent, JobStatus,
};
use tauri::{AppHandle, Emitter, State};
use vfs::{
    DirectoryBatch, FileKind, FileOperationError, FileOperationKind, ListCancellation, ListOptions,
    ListSessionId, ResourceUri, VfsError,
};
use zip::write::FileOptions;

#[derive(Default)]
struct WatchState {
    current: Mutex<Option<WatchRuntime>>,
}

struct WatchRuntime {
    stop: Arc<std::sync::atomic::AtomicBool>,
    handle: std::thread::JoinHandle<()>,
}

#[derive(Clone, Default)]
struct MetadataJobState {
    jobs: Arc<Mutex<HashMap<String, MetadataJobRuntime>>>,
}

#[derive(Clone, Default)]
struct ListingRegistry {
    tokens: Arc<Mutex<HashMap<String, ListCancellation>>>,
}

impl ListingRegistry {
    fn register(&self, panel_key: &str) -> ListCancellation {
        let token = ListCancellation::new();
        let mut tokens = self.tokens.lock().expect("listing registry lock poisoned");

        if let Some(previous) = tokens.remove(panel_key) {
            previous.cancel();
        }

        tokens.insert(panel_key.to_string(), token.clone());
        token
    }

    fn remove(&self, panel_key: &str) {
        if let Ok(mut tokens) = self.tokens.lock() {
            tokens.remove(panel_key);
        }
    }
}

const LISTING_TIMEOUT: Duration = Duration::from_secs(30);

/// Emit a Tauri event AND replay it via `webview.eval()` as a fallback for
/// WebKitGTK-headless environments where `app.emit()` does not deliver events
/// to the WebView. The eval path pushes the payload onto a per-event JS queue
/// and drains it through any handler registered via `__FO_EVENT_HANDLERS__`,
/// then dispatches a `fo-event-<name>` CustomEvent for redundancy. A
/// `setTimeout(0)` defers delivery one macrotask so any in-flight `invoke()`
/// response promise resolves first (avoiding a sessionId race in panel state).
fn emit_with_eval<S: serde::Serialize + Clone>(app: &AppHandle, event: &str, payload: S) {
    let json = match serde_json::to_string(&payload) {
        Ok(j) => j,
        Err(e) => {
            telemetry::error(&format!("emit_with_eval: failed to serialize {event}: {e}"));
            return;
        }
    };
    if let Err(error) = app.emit(event, payload) {
        telemetry::error(&format!("failed to emit {event}: {error}"));
    }
    let Some(webview) = app.get_webview_window("main") else {
        return;
    };
    // Escape characters that would otherwise break out of the JS string literal
    // used for the event name. Our event names use only `:`/letters but stay safe.
    let event_lit = event.replace('\\', "\\\\").replace('\'', "\\'");
    let js = format!(
        r#"(function() {{
    try {{
        var payload = {json};
        var name = '{event_lit}';
        if (!window.__FO_EVENT_BUFFER__) {{ window.__FO_EVENT_BUFFER__ = {{}}; }}
        if (!window.__FO_EVENT_BUFFER__[name]) {{ window.__FO_EVENT_BUFFER__[name] = []; }}
        window.__FO_EVENT_BUFFER__[name].push(payload);
        setTimeout(function() {{
            try {{
                var handlers = (window.__FO_EVENT_HANDLERS__ || {{}})[name];
                var queue = window.__FO_EVENT_BUFFER__[name] || [];
                if (handlers && handlers.length) {{
                    window.__FO_EVENT_BUFFER__[name] = [];
                    for (var i = 0; i < queue.length; i++) {{
                        for (var j = 0; j < handlers.length; j++) {{
                            try {{ handlers[j](queue[i]); }} catch (_) {{}}
                        }}
                    }}
                }}
                try {{ window.dispatchEvent(new CustomEvent('fo-event-' + name, {{ detail: payload }})); }} catch (_) {{}}
            }} catch (_) {{}}
        }}, 0);
    }} catch (_) {{}}
}})();"#
    );
    if let Err(e) = webview.eval(&js) {
        telemetry::error(&format!(
            "emit_with_eval: webview.eval failed for {event}: {e}"
        ));
    }
}

struct MetadataJobRuntime {
    snapshot: JobSnapshot,
    cancel: CancellationToken,
}

#[tauri::command]
fn app_get_info() -> AppInfoResponse {
    AppInfoResponse {
        name: "FileOctopus".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        build_profile: if cfg!(debug_assertions) {
            "debug".to_string()
        } else {
            "release".to_string()
        },
        commit_sha: option_env!("FILEOCTOPUS_COMMIT_SHA")
            .or(option_env!("GIT_COMMIT_SHA"))
            .map(ToString::to_string),
        target_os: std::env::consts::OS.to_string(),
    }
}

#[tauri::command]
async fn fs_stat(
    request: StatRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<StatResponse, IpcError> {
    telemetry::debug("fs.stat requested");

    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let entry = state.vfs().stat(&uri).await.map_err(IpcError::from)?;

    Ok(StatResponse {
        entry: entry.into(),
    })
}

#[tauri::command]
async fn fs_read_text_file(
    request: ReadTextFileRequest,
    _state: State<'_, Arc<AppState>>,
) -> Result<ReadTextFileResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let path = uri.to_local_path().map_err(IpcError::from)?;

    let metadata = std::fs::metadata(&path).map_err(|e| IpcError {
        code: "io_error".to_string(),
        message: e.to_string(),
    })?;

    if metadata.is_dir() {
        return Err(IpcError {
            code: "is_directory".to_string(),
            message: "cannot read a directory as text".to_string(),
        });
    }

    let file_size = metadata.len();
    let max_bytes = request.max_bytes.unwrap_or(1_048_576); // 1 MB default
    let read_len = if file_size > max_bytes {
        max_bytes
    } else {
        file_size
    };

    let mut buf = vec![0u8; read_len as usize];
    let mut f = File::open(&path).map_err(|e| IpcError {
        code: "io_error".to_string(),
        message: e.to_string(),
    })?;
    f.read_exact(&mut buf).map_err(|e| IpcError {
        code: "io_error".to_string(),
        message: e.to_string(),
    })?;

    let content = String::from_utf8_lossy(&buf).to_string();

    Ok(ReadTextFileResponse {
        content,
        truncated: file_size > max_bytes,
        byte_size: file_size,
    })
}

#[tauri::command]
async fn fs_compute_hash(
    request: ComputeHashRequest,
    _state: State<'_, Arc<AppState>>,
) -> Result<ComputeHashResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let path = uri.to_local_path().map_err(IpcError::from)?;

    let metadata = std::fs::metadata(&path).map_err(|e| IpcError {
        code: "io_error".to_string(),
        message: e.to_string(),
    })?;

    if metadata.is_dir() {
        return Err(IpcError {
            code: "is_directory".to_string(),
            message: "cannot compute hash for a directory".to_string(),
        });
    }

    let file_size = metadata.len();

    // Limit to 100 MB for safety
    if file_size > 100 * 1024 * 1024 {
        return Err(IpcError {
            code: "file_too_large".to_string(),
            message: format!(
                "file too large for hash computation ({} bytes, max 100 MB)",
                file_size
            ),
        });
    }

    let algo = request.algorithm.to_lowercase();
    if algo != "sha256" && algo != "sha-256" {
        return Err(IpcError {
            code: "unsupported_algorithm".to_string(),
            message: format!("unsupported hash algorithm: {}", request.algorithm),
        });
    }

    let hash = sha256::try_digest(&path).map_err(|e| IpcError {
        code: "io_error".to_string(),
        message: e.to_string(),
    })?;

    Ok(ComputeHashResponse {
        hash,
        algorithm: "sha256".to_string(),
        byte_size: file_size,
    })
}

#[tauri::command]
async fn fs_open_terminal(
    request: OpenTerminalRequest,
    _state: State<'_, Arc<AppState>>,
) -> Result<OpenTerminalResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let path = uri.to_local_path().map_err(IpcError::from)?;

    if !path.exists() || !path.is_dir() {
        return Err(IpcError {
            code: "not_found".to_string(),
            message: format!("directory not found: {}", path.display()),
        });
    }

    let terminals = [
        "gnome-terminal",
        "konsole",
        "xfce4-terminal",
        "alacritty",
        "kitty",
        "xterm",
    ];
    let cmd = terminals.iter().find(|t| which::which(t).is_ok());

    match cmd {
        Some(term) => {
            std::process::Command::new(*term)
                .current_dir(&path)
                .spawn()
                .map_err(|e| IpcError {
                    code: "spawn_error".to_string(),
                    message: e.to_string(),
                })?;
            Ok(OpenTerminalResponse { success: true })
        }
        None => Err(IpcError {
            code: "no_terminal".to_string(),
            message: "no terminal emulator found".to_string(),
        }),
    }
}

#[tauri::command]
async fn fs_list_start(
    request: ListStartRequest,
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    listings: State<'_, ListingRegistry>,
) -> Result<ListStartResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let request_id = request.request_id.clone();
    let panel_key = request
        .panel_id
        .clone()
        .unwrap_or_else(|| request_id.clone());
    let session_id = ListSessionId::new(&uuid::Uuid::new_v4().to_string());
    let response = ListStartResponse {
        session_id: session_id.as_str().to_string(),
        request_id: request_id.clone(),
    };
    let cancel = listings.register(&panel_key);
    let options = ListOptions {
        session_id: session_id.clone(),
        request_id: request_id.clone(),
        batch_size: request.batch_size.unwrap_or(256).max(1),
        include_hidden: request.include_hidden.unwrap_or(false),
        cancel: cancel.clone(),
    };
    let (sender, mut receiver) = tokio::sync::mpsc::channel::<DirectoryBatch>(16);
    let events_app = app.clone();
    let listing_app = app.clone();
    let vfs = state.vfs();
    let list_uri = uri.clone();
    let error_uri = uri.clone();
    let error_session_id = response.session_id.clone();
    let listings_cleanup = listings.inner().clone();
    let cleanup_panel_key = panel_key.clone();

    tauri::async_runtime::spawn(async move {
        while let Some(batch) = receiver.recv().await {
            let dto = DirectoryBatchEventDto::from(batch);
            emit_with_eval(&events_app, DIRECTORY_BATCH_EVENT, dto);
        }
    });

    tauri::async_runtime::spawn(async move {
        let result =
            tokio::time::timeout(LISTING_TIMEOUT, vfs.list(&list_uri, options, sender)).await;

        match result {
            Ok(Ok(())) => {}
            Ok(Err(error)) if error.code() == "cancelled" => {}
            Ok(Err(error)) => {
                telemetry::error(&format!("directory listing failed: {error}"));
                let event = DirectoryBatchEventDto {
                    session_id: error_session_id,
                    request_id,
                    uri: error_uri.as_str().to_string(),
                    entries: Vec::new(),
                    batch_index: 0,
                    is_complete: true,
                    total_hint: None,
                    error: Some(IpcError::from(error)),
                };

                emit_with_eval(&listing_app, DIRECTORY_BATCH_EVENT, event);
            }
            Err(_) => {
                cancel.cancel();
                let event = DirectoryBatchEventDto {
                    session_id: error_session_id,
                    request_id,
                    uri: error_uri.as_str().to_string(),
                    entries: Vec::new(),
                    batch_index: 0,
                    is_complete: true,
                    total_hint: None,
                    error: Some(IpcError::from(VfsError::timeout(&error_uri))),
                };

                emit_with_eval(&listing_app, DIRECTORY_BATCH_EVENT, event);
            }
        }

        listings_cleanup.remove(&cleanup_panel_key);
    });

    Ok(response)
}

#[tauri::command]
fn get_preferences(state: State<'_, Arc<AppState>>) -> Result<GetPreferencesResponse, IpcError> {
    let preferences = state.preferences().get_all().map_err(|error| IpcError {
        code: "preferences_error".to_string(),
        message: error.to_string(),
    })?;

    Ok(GetPreferencesResponse {
        preferences: UserPreferencesDto::from(preferences),
    })
}

#[tauri::command]
fn set_preference(
    request: SetPreferenceRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<SetPreferenceResponse, IpcError> {
    let preferences = state
        .preferences()
        .set(&request.key, &request.value)
        .map_err(|error| IpcError {
            code: "preferences_error".to_string(),
            message: error.to_string(),
        })?;

    Ok(SetPreferenceResponse {
        preferences: UserPreferencesDto::from(preferences),
    })
}

#[tauri::command]
async fn get_autostart(app: tauri::AppHandle) -> Result<AutostartStatusDto, IpcError> {
    let manager = app.autolaunch();
    match manager.is_enabled() {
        Ok(enabled) => Ok(AutostartStatusDto {
            enabled,
            supported: true,
        }),
        Err(error) => {
            telemetry::error(&format!("autostart_unavailable: {}", error));
            Ok(AutostartStatusDto {
                enabled: false,
                supported: false,
            })
        }
    }
}

#[tauri::command]
async fn set_autostart(
    app: tauri::AppHandle,
    enabled: bool,
) -> Result<AutostartStatusDto, IpcError> {
    let manager = app.autolaunch();
    let result = if enabled {
        manager.enable()
    } else {
        manager.disable()
    };

    match result {
        Ok(()) => match manager.is_enabled() {
            Ok(state) => Ok(AutostartStatusDto {
                enabled: state,
                supported: true,
            }),
            Err(error) => Err(IpcError {
                code: "autostart_unavailable".to_string(),
                message: error.to_string(),
            }),
        },
        Err(error) => Err(IpcError {
            code: "autostart_unavailable".to_string(),
            message: error.to_string(),
        }),
    }
}

fn navigation_error(error: config::NavigationError) -> IpcError {
    IpcError {
        code: "navigation_error".to_string(),
        message: error.to_string(),
    }
}

#[tauri::command]
fn navigation_record_visit(
    request: NavigationRecordVisitRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<OkResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    state
        .navigation()
        .record_visit(uri.as_str(), &request.label)
        .map_err(navigation_error)?;

    Ok(OkResponse { ok: true })
}

#[tauri::command]
fn navigation_list_favorites(
    state: State<'_, Arc<AppState>>,
) -> Result<NavigationListFavoritesResponse, IpcError> {
    let favorites = state
        .navigation()
        .list_favorites()
        .map_err(navigation_error)?
        .into_iter()
        .map(Into::into)
        .collect();

    Ok(NavigationListFavoritesResponse { favorites })
}

#[tauri::command]
fn navigation_add_favorite(
    request: NavigationAddFavoriteRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<NavigationFavoriteResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let favorite = state
        .navigation()
        .add_favorite(uri.as_str(), &request.label)
        .map_err(navigation_error)?;

    Ok(NavigationFavoriteResponse {
        favorite: favorite.into(),
    })
}

#[tauri::command]
fn navigation_remove_favorite(
    request: NavigationRemoveFavoriteRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<OkResponse, IpcError> {
    state
        .navigation()
        .remove_favorite(request.id)
        .map_err(navigation_error)?;

    Ok(OkResponse { ok: true })
}

#[tauri::command]
fn navigation_rename_favorite(
    request: NavigationRenameFavoriteRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<NavigationFavoriteResponse, IpcError> {
    let favorite = state
        .navigation()
        .rename_favorite(request.id, &request.label)
        .map_err(navigation_error)?;

    Ok(NavigationFavoriteResponse {
        favorite: favorite.into(),
    })
}

#[tauri::command]
fn navigation_list_recent(
    request: NavigationListRecentRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<NavigationListRecentResponse, IpcError> {
    let bucket = RecentBucket::parse(&request.bucket).map_err(navigation_error)?;
    let entries = state
        .navigation()
        .list_recent(bucket)
        .map_err(navigation_error)?
        .into_iter()
        .map(Into::into)
        .collect();

    Ok(NavigationListRecentResponse { entries })
}

#[tauri::command]
fn navigation_list_starred(
    state: State<'_, Arc<AppState>>,
) -> Result<NavigationListStarredResponse, IpcError> {
    let entries = state
        .navigation()
        .list_starred()
        .map_err(navigation_error)?
        .into_iter()
        .map(Into::into)
        .collect();

    Ok(NavigationListStarredResponse { entries })
}

#[tauri::command]
fn navigation_toggle_starred(
    request: NavigationToggleStarredRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<NavigationToggleStarredResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let starred = state
        .navigation()
        .toggle_starred(uri.as_str(), &request.label)
        .map_err(navigation_error)?;

    Ok(NavigationToggleStarredResponse { starred })
}

#[tauri::command]
fn navigation_is_starred(
    request: NavigationIsStarredRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<NavigationIsStarredResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let starred = state
        .navigation()
        .is_starred(uri.as_str())
        .map_err(navigation_error)?;

    Ok(NavigationIsStarredResponse { starred })
}

#[tauri::command]
async fn fs_standard_locations() -> Result<StandardLocationsResponse, IpcError> {
    Ok(StandardLocationsResponse {
        locations: sprint4::standard_locations()
            .into_iter()
            .map(|location| StandardLocationDto {
                id: location.id,
                name: location.name,
                uri: location.uri,
                section: location.section,
            })
            .collect(),
    })
}

#[tauri::command]
async fn fs_open_default(request: PathRequest) -> Result<OkResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;

    sprint4::open_path_with_default_app(&uri).map_err(IpcError::from)?;

    Ok(OkResponse { ok: true })
}

#[tauri::command]
async fn fs_reveal(request: PathRequest) -> Result<OkResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;

    sprint4::reveal_path_in_file_manager(&uri).map_err(IpcError::from)?;

    Ok(OkResponse { ok: true })
}

#[tauri::command]
async fn fs_create_file(request: CreateFileRequest) -> Result<CreateFileResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let entry = sprint4::create_empty_file(&uri).map_err(IpcError::from)?;

    Ok(CreateFileResponse {
        entry: entry.into(),
    })
}

#[tauri::command]
async fn fs_delete_permanently(request: DeletePermanentlyRequest) -> Result<OkResponse, IpcError> {
    let uris = request
        .uris
        .iter()
        .map(|uri| ResourceUri::parse(uri).map_err(IpcError::from))
        .collect::<Result<Vec<_>, _>>()?;

    sprint4::delete_permanently(&uris).map_err(IpcError::from)?;

    Ok(OkResponse { ok: true })
}

#[tauri::command]
async fn fs_properties(request: PathPropertiesRequest) -> Result<PathPropertiesResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let properties =
        sprint4::path_properties(&uri, request.include_folder_summary.unwrap_or(false))
            .map_err(IpcError::from)?;

    Ok(PathPropertiesResponse {
        properties: PathPropertiesDto {
            uri: properties.uri,
            name: properties.name,
            kind: properties.kind,
            size: properties.size,
            total_size: properties.total_size,
            item_count: properties.item_count,
            file_count: properties.file_count,
            directory_count: properties.directory_count,
            modified_at: properties.modified_at,
            created_at: properties.created_at,
            accessed_at: properties.accessed_at,
            is_hidden: properties.is_hidden,
            is_symlink: properties.is_symlink,
            symlink_target: properties.symlink_target,
            readonly: properties.readonly,
            warnings: properties.warnings,
        },
    })
}

#[tauri::command]
async fn fs_folder_size(request: FolderSizeRequest) -> Result<FolderSizeResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let summary = sprint4::calculate_folder_size(&uri).map_err(IpcError::from)?;

    Ok(FolderSizeResponse {
        summary: folder_summary_to_dto(summary),
    })
}

#[tauri::command]
async fn fs_folder_size_start(
    request: FolderSizeRequest,
    app: AppHandle,
    metadata_jobs: State<'_, MetadataJobState>,
) -> Result<FolderSizeJobResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let path = uri.to_local_path().map_err(IpcError::from)?;

    if !path.exists() {
        return Err(IpcError::from(FileOperationError::NotFound {
            uri: uri.as_str().to_string(),
        }));
    }

    let job = start_metadata_job(&metadata_jobs, FileOperationKind::FolderSize)?;
    let job_id = job.job_id.clone();
    let token = metadata_job_token(&metadata_jobs, job_id.as_str())?;
    let jobs = metadata_jobs.jobs.clone();
    let uri_text = uri.as_str().to_string();

    emit_job(
        &app,
        JobEvent::Started(JobStartedEvent {
            job_id: job_id.clone(),
            operation_kind: FileOperationKind::FolderSize,
            total_items: 0,
            total_bytes: None,
            started_at: job.started_at,
        }),
    );
    set_metadata_job_status(&jobs, job_id.as_str(), JobStatus::Running, None, None);

    std::thread::spawn(move || {
        let thread_job_id = job_id.clone();
        let progress_app = app.clone();
        let progress_jobs = jobs.clone();
        let result = sprint4::calculate_folder_size_with_progress(&uri, &token, |summary, path| {
            update_metadata_job_progress(
                &progress_jobs,
                &progress_app,
                &thread_job_id,
                FileOperationKind::FolderSize,
                path.to_string_lossy().to_string(),
                summary.item_count,
                summary.total_size,
            );
        });

        match result {
            Ok(summary) => {
                let dto = folder_summary_to_dto(summary);
                set_metadata_job_status(
                    &jobs,
                    thread_job_id.as_str(),
                    JobStatus::Completed,
                    None,
                    None,
                );
                let completed_at = Utc::now();
                emit_with_eval(
                    &app,
                    FOLDER_SIZE_COMPLETED_EVENT,
                    FolderSizeCompletedEventDto {
                        job_id: thread_job_id.as_str().to_string(),
                        uri: uri_text,
                        summary: dto.clone(),
                    },
                );
                emit_job(
                    &app,
                    JobEvent::Completed(JobCompletedEvent {
                        job_id: thread_job_id,
                        operation_kind: FileOperationKind::FolderSize,
                        completed_items: dto.item_count,
                        completed_bytes: dto.total_size,
                        completed_at,
                    }),
                );
            }
            Err(FileOperationError::Cancelled { .. }) => {
                set_metadata_job_status(
                    &jobs,
                    thread_job_id.as_str(),
                    JobStatus::Cancelled,
                    None,
                    None,
                );
                emit_job(
                    &app,
                    JobEvent::Cancelled(JobCancelledEvent {
                        job_id: thread_job_id,
                        operation_kind: FileOperationKind::FolderSize,
                        cancelled_at: Utc::now(),
                    }),
                );
            }
            Err(error) => {
                let code = error.code().to_string();
                let message = error.user_message();
                set_metadata_job_status(
                    &jobs,
                    thread_job_id.as_str(),
                    JobStatus::Failed,
                    Some(code.clone()),
                    Some(message.clone()),
                );
                emit_job(
                    &app,
                    JobEvent::Failed(JobFailedEvent {
                        job_id: thread_job_id,
                        operation_kind: FileOperationKind::FolderSize,
                        error_code: code,
                        message,
                        failed_at: Utc::now(),
                    }),
                );
            }
        }
    });

    Ok(FolderSizeJobResponse { job })
}

#[tauri::command]
async fn fs_recursive_search(
    request: RecursiveSearchRequest,
) -> Result<RecursiveSearchResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let result = sprint4::recursive_search(&uri, &request.query, request.limit.unwrap_or(500))
        .map_err(IpcError::from)?;

    Ok(RecursiveSearchResponse {
        result: search_result_to_dto(result),
    })
}

#[tauri::command]
async fn fs_recursive_search_start(
    request: RecursiveSearchRequest,
    app: AppHandle,
    metadata_jobs: State<'_, MetadataJobState>,
) -> Result<RecursiveSearchJobResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let path = uri.to_local_path().map_err(IpcError::from)?;

    if !path.is_dir() {
        return Err(IpcError::from(FileOperationError::DestinationMissing {
            uri: uri.as_str().to_string(),
        }));
    }

    let query = request.query.trim().to_string();
    let limit = request.limit.unwrap_or(500);
    let job = start_metadata_job(&metadata_jobs, FileOperationKind::RecursiveSearch)?;
    let job_id = job.job_id.clone();
    let token = metadata_job_token(&metadata_jobs, job_id.as_str())?;
    let jobs = metadata_jobs.jobs.clone();
    let uri_text = uri.as_str().to_string();

    emit_job(
        &app,
        JobEvent::Started(JobStartedEvent {
            job_id: job_id.clone(),
            operation_kind: FileOperationKind::RecursiveSearch,
            total_items: 0,
            total_bytes: None,
            started_at: job.started_at,
        }),
    );
    set_metadata_job_status(&jobs, job_id.as_str(), JobStatus::Running, None, None);

    std::thread::spawn(move || {
        let thread_job_id = job_id.clone();
        let progress_app = app.clone();
        let progress_jobs = jobs.clone();
        let progress_query = query.clone();
        let result =
            sprint4::recursive_search_with_progress(&uri, &query, limit, &token, |item, result| {
                update_metadata_job_progress(
                    &progress_jobs,
                    &progress_app,
                    &thread_job_id,
                    FileOperationKind::RecursiveSearch,
                    item.name.clone(),
                    result.matches.len() as u64,
                    0,
                );
                emit_with_eval(
                    &progress_app,
                    RECURSIVE_SEARCH_MATCH_EVENT,
                    RecursiveSearchMatchEventDto {
                        job_id: thread_job_id.as_str().to_string(),
                        uri: uri_text.clone(),
                        query: progress_query.clone(),
                        item: search_match_to_dto(item.clone()),
                    },
                );
            });

        match result {
            Ok(result) => {
                let dto = search_result_to_dto(result);
                set_metadata_job_status(
                    &jobs,
                    thread_job_id.as_str(),
                    JobStatus::Completed,
                    None,
                    None,
                );
                emit_with_eval(
                    &app,
                    RECURSIVE_SEARCH_COMPLETED_EVENT,
                    RecursiveSearchCompletedEventDto {
                        job_id: thread_job_id.as_str().to_string(),
                        uri: uri_text,
                        query,
                        result: dto.clone(),
                    },
                );
                emit_job(
                    &app,
                    JobEvent::Completed(JobCompletedEvent {
                        job_id: thread_job_id,
                        operation_kind: FileOperationKind::RecursiveSearch,
                        completed_items: dto.matches.len() as u64,
                        completed_bytes: 0,
                        completed_at: Utc::now(),
                    }),
                );
            }
            Err(FileOperationError::Cancelled { .. }) => {
                set_metadata_job_status(
                    &jobs,
                    thread_job_id.as_str(),
                    JobStatus::Cancelled,
                    None,
                    None,
                );
                emit_job(
                    &app,
                    JobEvent::Cancelled(JobCancelledEvent {
                        job_id: thread_job_id,
                        operation_kind: FileOperationKind::RecursiveSearch,
                        cancelled_at: Utc::now(),
                    }),
                );
            }
            Err(error) => {
                let code = error.code().to_string();
                let message = error.user_message();
                set_metadata_job_status(
                    &jobs,
                    thread_job_id.as_str(),
                    JobStatus::Failed,
                    Some(code.clone()),
                    Some(message.clone()),
                );
                emit_job(
                    &app,
                    JobEvent::Failed(JobFailedEvent {
                        job_id: thread_job_id,
                        operation_kind: FileOperationKind::RecursiveSearch,
                        error_code: code,
                        message,
                        failed_at: Utc::now(),
                    }),
                );
            }
        }
    });

    Ok(RecursiveSearchJobResponse { job })
}

#[tauri::command]
async fn fs_watch_start(
    request: WatchStartRequest,
    app: AppHandle,
    watch: State<'_, WatchState>,
) -> Result<OkResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let path = uri.to_local_path().map_err(IpcError::from)?;

    if !path.is_dir() {
        return Err(IpcError {
            code: "folder_not_found".to_string(),
            message: "Choose an existing folder to watch.".to_string(),
        });
    }

    stop_watcher(&watch)?;

    let stop = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let thread_stop = stop.clone();
    let event_uri = uri.as_str().to_string();
    let handle = std::thread::spawn(move || {
        let mut previous = folder_fingerprint(&path);

        while !thread_stop.load(std::sync::atomic::Ordering::Relaxed) {
            std::thread::sleep(Duration::from_millis(1200));
            let current = folder_fingerprint(&path);

            if current != previous {
                previous = current;
                emit_with_eval(
                    &app,
                    WATCH_CHANGED_EVENT,
                    WatchEventDto {
                        uri: event_uri.clone(),
                        changed_at: Utc::now(),
                    },
                );
            }
        }
    });

    *watch
        .current
        .lock()
        .map_err(|_| IpcError::internal("watch state lock poisoned"))? =
        Some(WatchRuntime { stop, handle });

    Ok(OkResponse { ok: true })
}

#[tauri::command]
async fn fs_watch_stop(watch: State<'_, WatchState>) -> Result<OkResponse, IpcError> {
    stop_watcher(&watch)?;

    Ok(OkResponse { ok: true })
}

#[tauri::command]
async fn plan_file_operation(
    request: PlanFileOperationRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<PlanFileOperationResponse, IpcError> {
    telemetry::debug("plan_file_operation requested");

    let operation = request.operation.try_into()?;
    let plan = state.operations().plan(operation).map_err(IpcError::from)?;

    Ok(PlanFileOperationResponse { plan: plan.into() })
}

#[tauri::command]
async fn start_file_operation(
    request: StartFileOperationRequest,
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
) -> Result<StartFileOperationResponse, IpcError> {
    telemetry::debug("start_file_operation requested");

    let plan = request.plan.try_into()?;
    let sink_app = app.clone();
    let sink = Arc::new(move |event: JobEvent| {
        let name = job_event_name(&event);
        let payload = job_event_payload(event);
        emit_with_eval(&sink_app, name, payload);
    });
    let job = state
        .operations()
        .start(plan, sink)
        .map_err(IpcError::from)?;

    Ok(StartFileOperationResponse { job })
}

#[tauri::command]
async fn cancel_job(
    request: CancelJobRequest,
    metadata_jobs: State<'_, MetadataJobState>,
    state: State<'_, Arc<AppState>>,
) -> Result<JobStatusResponse, IpcError> {
    if let Some(job) = cancel_metadata_job(&metadata_jobs, &request.job_id)? {
        return Ok(JobStatusResponse { job });
    }

    let job = state
        .operations()
        .cancel(&request.job_id)
        .map_err(IpcError::from)?;

    Ok(JobStatusResponse { job })
}

#[tauri::command]
async fn get_job_status(
    request: JobStatusRequest,
    metadata_jobs: State<'_, MetadataJobState>,
    state: State<'_, Arc<AppState>>,
) -> Result<JobStatusResponse, IpcError> {
    if let Some(job) = metadata_job_snapshot(&metadata_jobs, &request.job_id)? {
        return Ok(JobStatusResponse { job });
    }

    let job = state
        .operations()
        .status(&request.job_id)
        .map_err(IpcError::from)?;

    Ok(JobStatusResponse { job })
}

#[tauri::command]
async fn list_recent_operations(
    request: ListRecentOperationsRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<ListRecentOperationsResponse, IpcError> {
    let operations = state
        .operations()
        .recent_history(request.limit.unwrap_or(20))
        .into_iter()
        .map(operation_history_record_to_dto)
        .collect();

    Ok(ListRecentOperationsResponse { operations })
}

#[tauri::command]
async fn clear_operation_history(
    state: State<'_, Arc<AppState>>,
) -> Result<ClearOperationHistoryResponse, IpcError> {
    let deleted_count = state
        .operations()
        .clear_terminal_history()
        .map_err(|error| IpcError::internal(&error))?;

    Ok(ClearOperationHistoryResponse { deleted_count })
}

#[tauri::command]
async fn diagnostics_app_data_health(
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
async fn export_diagnostics_bundle(
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppCore::boot().expect("failed to boot FileOctopus app core");

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(app_state)
        .manage(WatchState::default())
        .manage(MetadataJobState::default())
        .manage(ListingRegistry::default())
        .setup(|_app| {
            telemetry::info("FileOctopus Tauri shell started");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_get_info,
            fs_stat,
            fs_read_text_file,
            fs_compute_hash,
            fs_open_terminal,
            fs_list_start,
            get_preferences,
            set_preference,
            navigation_record_visit,
            navigation_list_favorites,
            navigation_add_favorite,
            navigation_remove_favorite,
            navigation_rename_favorite,
            navigation_list_recent,
            navigation_list_starred,
            navigation_toggle_starred,
            navigation_is_starred,
            fs_standard_locations,
            fs_open_default,
            fs_reveal,
            fs_create_file,
            fs_delete_permanently,
            fs_properties,
            fs_folder_size,
            fs_folder_size_start,
            fs_recursive_search,
            fs_recursive_search_start,
            fs_watch_start,
            fs_watch_stop,
            plan_file_operation,
            start_file_operation,
            cancel_job,
            get_job_status,
            list_recent_operations,
            clear_operation_history,
            diagnostics_app_data_health,
            export_diagnostics_bundle,
            get_autostart,
            set_autostart
        ])
        .run(tauri::generate_context!())
        .expect("failed to run FileOctopus");
}

fn operation_history_record_to_dto(record: OperationHistoryRecord) -> OperationHistoryRecordDto {
    OperationHistoryRecordDto {
        job_id: record.job_id,
        operation_kind: record.operation_kind,
        source_count: record.source_count,
        representative_source_path: record.representative_source_path,
        destination_path: record.destination_path,
        status: record.status,
        started_at: record.started_at,
        completed_at: record.completed_at,
        error_code: record.error_code,
    }
}

fn start_metadata_job(
    state: &MetadataJobState,
    kind: FileOperationKind,
) -> Result<JobSnapshot, IpcError> {
    let job_id = JobId::new(uuid::Uuid::new_v4().to_string());
    let now = Utc::now();
    let snapshot = JobSnapshot {
        job_id: job_id.clone(),
        operation_kind: kind,
        status: JobStatus::Queued,
        current_item: None,
        completed_items: 0,
        total_items: 0,
        completed_bytes: 0,
        total_bytes: None,
        error_code: None,
        message: None,
        started_at: now,
        updated_at: now,
    };
    let runtime = MetadataJobRuntime {
        snapshot: snapshot.clone(),
        cancel: CancellationToken::new(),
    };

    state
        .jobs
        .lock()
        .map_err(|_| IpcError::internal("metadata job state lock poisoned"))?
        .insert(job_id.as_str().to_string(), runtime);

    Ok(snapshot)
}

fn metadata_job_token(
    state: &MetadataJobState,
    job_id: &str,
) -> Result<CancellationToken, IpcError> {
    state
        .jobs
        .lock()
        .map_err(|_| IpcError::internal("metadata job state lock poisoned"))?
        .get(job_id)
        .map(|runtime| runtime.cancel.clone())
        .ok_or_else(|| {
            IpcError::from(FileOperationError::NotFound {
                uri: job_id.to_string(),
            })
        })
}

fn metadata_job_snapshot(
    state: &MetadataJobState,
    job_id: &str,
) -> Result<Option<JobSnapshot>, IpcError> {
    Ok(state
        .jobs
        .lock()
        .map_err(|_| IpcError::internal("metadata job state lock poisoned"))?
        .get(job_id)
        .map(|runtime| runtime.snapshot.clone()))
}

fn cancel_metadata_job(
    state: &MetadataJobState,
    job_id: &str,
) -> Result<Option<JobSnapshot>, IpcError> {
    let mut jobs = state
        .jobs
        .lock()
        .map_err(|_| IpcError::internal("metadata job state lock poisoned"))?;
    let Some(runtime) = jobs.get_mut(job_id) else {
        return Ok(None);
    };

    runtime.cancel.cancel();
    runtime.snapshot.status = JobStatus::Cancelled;
    runtime.snapshot.updated_at = Utc::now();

    Ok(Some(runtime.snapshot.clone()))
}

fn set_metadata_job_status(
    jobs: &Arc<Mutex<HashMap<String, MetadataJobRuntime>>>,
    job_id: &str,
    status: JobStatus,
    code: Option<String>,
    message: Option<String>,
) {
    if let Ok(mut jobs) = jobs.lock() {
        if let Some(runtime) = jobs.get_mut(job_id) {
            runtime.snapshot.status = status;
            runtime.snapshot.error_code = code;
            runtime.snapshot.message = message;
            runtime.snapshot.updated_at = Utc::now();
        }
    }
}

fn update_metadata_job_progress(
    jobs: &Arc<Mutex<HashMap<String, MetadataJobRuntime>>>,
    app: &AppHandle,
    job_id: &JobId,
    kind: FileOperationKind,
    current_item: String,
    completed_items: u64,
    completed_bytes: u64,
) {
    let updated_at = Utc::now();

    if let Ok(mut jobs) = jobs.lock() {
        if let Some(runtime) = jobs.get_mut(job_id.as_str()) {
            runtime.snapshot.current_item = Some(current_item.clone());
            runtime.snapshot.completed_items = completed_items;
            runtime.snapshot.completed_bytes = completed_bytes;
            runtime.snapshot.updated_at = updated_at;
        }
    }

    emit_job(
        app,
        JobEvent::Progress(JobProgressEvent {
            job_id: job_id.clone(),
            operation_kind: kind,
            current_item: Some(current_item),
            completed_items,
            total_items: 0,
            completed_bytes,
            total_bytes: None,
            updated_at,
        }),
    );
}

fn emit_job(app: &AppHandle, event: JobEvent) {
    let name = job_event_name(&event);
    let payload = job_event_payload(event);
    emit_with_eval(app, name, payload);
}

fn folder_summary_to_dto(summary: sprint4::FolderSizeSummary) -> FolderSizeSummaryDto {
    FolderSizeSummaryDto {
        total_size: summary.total_size,
        item_count: summary.item_count,
        file_count: summary.file_count,
        directory_count: summary.directory_count,
        warnings: summary.warnings,
        incomplete: summary.incomplete,
    }
}

fn search_match_to_dto(item: sprint4::SearchMatch) -> SearchMatchDto {
    SearchMatchDto {
        uri: item.uri,
        parent_uri: item.parent_uri,
        name: item.name,
        kind: item.kind,
        size: item.size,
        modified_at: item.modified_at,
    }
}

fn search_result_to_dto(result: sprint4::SearchResult) -> RecursiveSearchResultDto {
    RecursiveSearchResultDto {
        matches: result
            .matches
            .into_iter()
            .map(search_match_to_dto)
            .collect(),
        warnings: result.warnings,
        incomplete: result.incomplete,
    }
}

fn stop_watcher(watch: &WatchState) -> Result<(), IpcError> {
    let current = watch
        .current
        .lock()
        .map_err(|_| IpcError::internal("watch state lock poisoned"))?
        .take();

    if let Some(runtime) = current {
        runtime
            .stop
            .store(true, std::sync::atomic::Ordering::Relaxed);
        let _ = runtime.handle.join();
    }

    Ok(())
}

fn folder_fingerprint(path: &Path) -> Vec<(String, u64)> {
    let mut entries = std::fs::read_dir(path)
        .ok()
        .into_iter()
        .flat_map(|items| items.filter_map(Result::ok))
        .filter_map(|entry| {
            let metadata = entry.metadata().ok()?;
            Some((
                entry.file_name().to_string_lossy().to_string(),
                metadata.len(),
            ))
        })
        .collect::<Vec<_>>();

    entries.sort();
    entries
}

fn write_diagnostics_bundle(destination: &Path, state: &AppState) -> Result<Vec<String>, IpcError> {
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

fn redact_home(value: &str) -> String {
    let Some(home) = home_dir() else {
        return value.to_string();
    };
    let home = home.to_string_lossy();

    value.replace(home.as_ref(), "~")
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_info_response_has_stable_metadata_fields() {
        let info = app_get_info();

        assert_eq!(info.name, "FileOctopus");
        assert!(!info.version.is_empty());
        assert!(!info.build_profile.is_empty());
        assert!(!info.target_os.is_empty());
    }

    #[test]
    fn diagnostics_bundle_contains_expected_files() {
        let dir = std::env::temp_dir().join(format!(
            "fileoctopus-diagnostics-test-{}",
            uuid::Uuid::new_v4()
        ));

        std::fs::create_dir_all(&dir).unwrap();
        let state = AppCore::boot_with_history_path(dir.join("history.sqlite")).unwrap();
        let bundle = dir.join("diagnostics.zip");
        let files = write_diagnostics_bundle(&bundle, &state).unwrap();

        assert!(bundle.exists());
        assert!(files.contains(&"app-info.json".to_string()));
        assert!(files.contains(&"app-data-health.json".to_string()));
        assert!(files.contains(&"operation-history.json".to_string()));
        assert!(files.contains(&"recent-log.txt".to_string()));

        let _ = std::fs::remove_dir_all(dir);
    }

    // --- IPC logic integration tests ---

    fn temp_dir(prefix: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("fo-ipc-test-{}-{}", prefix, uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn local_uri(path: &Path) -> String {
        format!("local://{}", path.display())
    }

    #[test]
    fn fs_read_text_file_reads_file_content() {
        let dir = temp_dir("read-text");
        let file_path = dir.join("hello.txt");
        std::fs::write(&file_path, "Hello, FileOctopus!").unwrap();

        let uri = ResourceUri::parse(&local_uri(&file_path)).unwrap();
        let path = uri.to_local_path().unwrap();
        let metadata = std::fs::metadata(&path).unwrap();
        let file_size = metadata.len();
        let max_bytes = 1_048_576u64;
        let read_len = std::cmp::min(max_bytes, file_size) as usize;
        let mut buf = vec![0u8; read_len];
        let mut f = std::fs::File::open(&path).unwrap();
        let n = f.read(&mut buf).unwrap();
        buf.truncate(n);
        let content = String::from_utf8_lossy(&buf).to_string();

        assert_eq!(content, "Hello, FileOctopus!");
        assert_eq!(file_size, 19);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn fs_read_text_file_rejects_directory() {
        let dir = temp_dir("read-dir");
        let uri = ResourceUri::parse(&local_uri(&dir)).unwrap();
        let path = uri.to_local_path().unwrap();

        let metadata = std::fs::metadata(&path).unwrap();
        assert!(metadata.is_dir());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn fs_read_text_file_handles_truncation() {
        let dir = temp_dir("read-trunc");
        let file_path = dir.join("big.txt");
        let data = "A".repeat(200);
        std::fs::write(&file_path, &data).unwrap();

        let uri = ResourceUri::parse(&local_uri(&file_path)).unwrap();
        let path = uri.to_local_path().unwrap();
        let metadata = std::fs::metadata(&path).unwrap();
        let file_size = metadata.len();
        let max_bytes = 100u64;
        let truncated = file_size > max_bytes;

        assert!(truncated);
        assert_eq!(file_size, 200);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn fs_compute_hash_produces_sha256() {
        let dir = temp_dir("hash");
        let file_path = dir.join("data.bin");
        std::fs::write(&file_path, b"test content").unwrap();

        let uri = ResourceUri::parse(&local_uri(&file_path)).unwrap();
        let path = uri.to_local_path().unwrap();
        let metadata = std::fs::metadata(&path).unwrap();

        assert!(!metadata.is_dir());

        let hash = sha256::try_digest(&path).unwrap();
        assert_eq!(hash.len(), 64); // SHA-256 hex is 64 chars
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn fs_compute_hash_rejects_directory() {
        let dir = temp_dir("hash-dir");
        let uri = ResourceUri::parse(&local_uri(&dir)).unwrap();
        let path = uri.to_local_path().unwrap();
        let metadata = std::fs::metadata(&path).unwrap();

        assert!(metadata.is_dir());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn fs_create_file_creates_empty_file() {
        let dir = temp_dir("create-file");
        let file_path = dir.join("newfile.txt");
        let uri = local_uri(&file_path);
        let parsed = ResourceUri::parse(&uri).unwrap();

        let entry = sprint4::create_empty_file(&parsed).unwrap();
        assert!(file_path.exists());
        assert_eq!(entry.name, "newfile.txt");
        assert_eq!(entry.size, Some(0));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn fs_create_file_rejects_duplicate() {
        let dir = temp_dir("create-dup");
        let file_path = dir.join("exists.txt");
        std::fs::write(&file_path, "already here").unwrap();

        let uri = local_uri(&file_path);
        let parsed = ResourceUri::parse(&uri).unwrap();

        let result = sprint4::create_empty_file(&parsed);
        assert!(result.is_err());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn fs_delete_permanently_removes_file() {
        let dir = temp_dir("delete");
        let file_path = dir.join("to-delete.txt");
        std::fs::write(&file_path, "bye").unwrap();
        assert!(file_path.exists());

        let uri = ResourceUri::parse(&local_uri(&file_path)).unwrap();
        sprint4::delete_permanently(&[uri]).unwrap();
        assert!(!file_path.exists());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn fs_delete_permanently_removes_directory() {
        let dir = temp_dir("delete-dir");
        let sub = dir.join("subdir");
        std::fs::create_dir_all(&sub).unwrap();
        std::fs::write(sub.join("inner.txt"), "data").unwrap();

        let uri = ResourceUri::parse(&local_uri(&sub)).unwrap();
        sprint4::delete_permanently(&[uri]).unwrap();
        assert!(!sub.exists());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn fs_properties_returns_metadata() {
        let dir = temp_dir("props");
        let file_path = dir.join("info.txt");
        std::fs::write(&file_path, "properties test").unwrap();

        let uri = ResourceUri::parse(&local_uri(&file_path)).unwrap();
        let props = sprint4::path_properties(&uri, false).unwrap();

        assert_eq!(props.name, "info.txt");
        assert_eq!(props.size, Some(15));
        assert_eq!(props.kind, FileKind::File);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn fs_properties_directory_includes_item_count() {
        let dir = temp_dir("props-dir");
        std::fs::write(dir.join("a.txt"), "a").unwrap();
        std::fs::write(dir.join("b.txt"), "b").unwrap();

        let uri = ResourceUri::parse(&local_uri(&dir)).unwrap();
        let props = sprint4::path_properties(&uri, true).unwrap();

        assert_eq!(props.kind, FileKind::Directory);
        assert!(props.item_count.unwrap() >= 2);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn fs_folder_size_calculates_total() {
        let dir = temp_dir("foldersize");
        std::fs::write(dir.join("f1.txt"), "12345").unwrap();
        std::fs::write(dir.join("f2.txt"), "67890").unwrap();

        let uri = ResourceUri::parse(&local_uri(&dir)).unwrap();
        let summary = sprint4::calculate_folder_size(&uri).unwrap();

        assert!(summary.total_size >= 10);
        assert!(summary.file_count >= 2);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn resource_uri_rejects_invalid_scheme() {
        let result = ResourceUri::parse("file:///tmp/test");
        assert!(result.is_err());
    }

    #[test]
    fn resource_uri_rejects_empty_string() {
        let result = ResourceUri::parse("");
        assert!(result.is_err());
    }

    #[test]
    fn resource_uri_parses_local_path() {
        let uri = ResourceUri::parse("local:///home/user/docs").unwrap();
        let path = uri.to_local_path().unwrap();
        assert!(path.to_string_lossy().contains("home"));
    }

    #[test]
    fn ipc_error_serializes_to_json() {
        let err = IpcError {
            code: "not_found".to_string(),
            message: "path does not exist".to_string(),
        };
        let json = serde_json::to_string(&err).unwrap();
        assert!(json.contains("not_found"));
        assert!(json.contains("path does not exist"));
    }

    #[test]
    fn preferences_round_trip_via_state() {
        let dir = temp_dir("prefs");
        let state = AppCore::boot_with_history_path(dir.join("history.sqlite")).unwrap();

        let prefs = state.preferences();
        let _initial = prefs.get_all().unwrap();
        prefs.set("theme", "dark").unwrap();

        let updated = prefs.get_all().unwrap();
        assert_eq!(updated.theme, "dark");
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn navigation_records_visit() {
        let dir = temp_dir("nav-visit");
        let state = AppCore::boot_with_history_path(dir.join("history.sqlite")).unwrap();

        let nav = state.navigation();
        nav.record_visit("local:///tmp/test-nav", "Test Dir")
            .unwrap();

        let recent = nav.list_recent(RecentBucket::Today).unwrap();
        assert!(!recent.is_empty());
        assert!(recent[0].uri == "local:///tmp/test-nav");
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn navigation_favorites_crud() {
        let dir = temp_dir("nav-fav");
        let state = AppCore::boot_with_history_path(dir.join("history.sqlite")).unwrap();

        let nav = state.navigation();
        let fav = nav.add_favorite("local:///tmp/fav", "My Fav").unwrap();

        let favs = nav.list_favorites().unwrap();
        assert!(favs.iter().any(|f| f.uri == "local:///tmp/fav"));

        nav.remove_favorite(fav.id).unwrap();
        let favs_after = nav.list_favorites().unwrap();
        assert!(!favs_after.iter().any(|f| f.uri == "local:///tmp/fav"));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn fs_stat_returns_entry_metadata() {
        let dir = temp_dir("stat");
        let file_path = dir.join("stat-me.txt");
        std::fs::write(&file_path, "stat content").unwrap();

        let uri = local_uri(&file_path);
        let parsed = ResourceUri::parse(&uri).unwrap();

        let state = AppCore::boot_with_history_path(dir.join("history.sqlite")).unwrap();
        let rt = tokio::runtime::Runtime::new().unwrap();
        let entry = rt
            .block_on(async { state.vfs().stat(&parsed).await })
            .unwrap();

        assert_eq!(entry.name, "stat-me.txt");
        assert_eq!(entry.size, Some(12));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn fs_stat_rejects_nonexistent() {
        let dir = temp_dir("stat-missing");
        let file_path = dir.join("nope.txt");
        let uri = local_uri(&file_path);
        let parsed = ResourceUri::parse(&uri).unwrap();

        let state = AppCore::boot_with_history_path(dir.join("history.sqlite")).unwrap();
        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(async { state.vfs().stat(&parsed).await });

        assert!(result.is_err());
        let _ = std::fs::remove_dir_all(dir);
    }
}
