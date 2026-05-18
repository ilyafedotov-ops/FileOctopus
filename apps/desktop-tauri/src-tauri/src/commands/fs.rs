use std::fs::File;
use std::io::Read;
use std::sync::Arc;
use std::time::Duration;

use app_core::AppState;
use app_ipc::{
    error_codes, ComputeHashRequest, ComputeHashResponse, DirectoryBatchEventDto, IpcError,
    ListStartRequest, ListStartResponse, OkResponse, OpenTerminalRequest, OpenTerminalResponse,
    PathPropertiesDto, PathPropertiesRequest, PathPropertiesResponse, PathRequest,
    ReadImageAsDataUriRequest, ReadImageAsDataUriResponse, ReadTextFileRequest,
    ReadTextFileResponse, StandardLocationDto, StandardLocationsResponse, StatRequest,
    StatResponse, DIRECTORY_BATCH_EVENT,
};
use fs_core::{external_open, locations, metadata};
use tauri::{AppHandle, State};
use vfs::{ListOptions, ListSessionId, ResourceUri, VfsError};

use crate::emit::emit_with_eval;
use crate::state::ListingRegistry;

pub(crate) const LISTING_TIMEOUT: Duration = Duration::from_secs(30);

#[tauri::command]
pub async fn fs_stat(
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
pub async fn fs_read_text_file(
    request: ReadTextFileRequest,
    _state: State<'_, Arc<AppState>>,
) -> Result<ReadTextFileResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let path = uri.to_local_path().map_err(IpcError::from)?;

    let metadata = std::fs::metadata(&path).map_err(|e| IpcError::io(e.to_string()))?;

    if metadata.is_dir() {
        return Err(IpcError::is_directory("cannot read a directory as text"));
    }

    let file_size = metadata.len();
    let max_bytes = request.max_bytes.unwrap_or(1_048_576); // 1 MB default
    let read_len = if file_size > max_bytes {
        max_bytes
    } else {
        file_size
    };

    let mut buf = vec![0u8; read_len as usize];
    let mut f = File::open(&path).map_err(|e| IpcError::io(e.to_string()))?;
    f.read_exact(&mut buf)
        .map_err(|e| IpcError::io(e.to_string()))?;

    let content = String::from_utf8_lossy(&buf).to_string();

    Ok(ReadTextFileResponse {
        content,
        truncated: file_size > max_bytes,
        byte_size: file_size,
    })
}

#[tauri::command]
pub async fn fs_compute_hash(
    request: ComputeHashRequest,
    _state: State<'_, Arc<AppState>>,
) -> Result<ComputeHashResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let path = uri.to_local_path().map_err(IpcError::from)?;

    let metadata = std::fs::metadata(&path).map_err(|e| IpcError::io(e.to_string()))?;

    if metadata.is_dir() {
        return Err(IpcError::is_directory(
            "cannot compute hash for a directory",
        ));
    }

    let file_size = metadata.len();

    // Limit to 100 MB for safety
    if file_size > 100 * 1024 * 1024 {
        return Err(IpcError::file_too_large(format!(
            "file too large for hash computation ({} bytes, max 100 MB)",
            file_size
        )));
    }

    let algo = request.algorithm.to_lowercase();
    if algo != "sha256" && algo != "sha-256" {
        return Err(IpcError::unsupported_algorithm(format!(
            "unsupported hash algorithm: {}",
            request.algorithm
        )));
    }

    let hash = sha256::try_digest(&path).map_err(|e| IpcError::io(e.to_string()))?;

    Ok(ComputeHashResponse {
        hash,
        algorithm: "sha256".to_string(),
        byte_size: file_size,
    })
}

#[tauri::command]
pub async fn fs_open_terminal(
    request: OpenTerminalRequest,
    _state: State<'_, Arc<AppState>>,
) -> Result<OpenTerminalResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let path = uri.to_local_path().map_err(IpcError::from)?;

    if !path.exists() || !path.is_dir() {
        return Err(IpcError::new(
            error_codes::NOT_FOUND,
            format!("directory not found: {}", path.display()),
        ));
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
                .map_err(|e| IpcError::spawn_error(e.to_string()))?;
            Ok(OpenTerminalResponse { success: true })
        }
        None => Err(IpcError::no_terminal("no terminal emulator found")),
    }
}

#[tauri::command]
pub async fn fs_list_start(
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
    let (sender, mut receiver) = tokio::sync::mpsc::channel::<vfs::DirectoryBatch>(16);
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
pub async fn fs_standard_locations() -> Result<StandardLocationsResponse, IpcError> {
    Ok(StandardLocationsResponse {
        locations: locations::standard_locations()
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
pub async fn fs_open_default(request: PathRequest) -> Result<OkResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;

    external_open::open_path_with_default_app(&uri).map_err(IpcError::from)?;

    Ok(OkResponse { ok: true })
}

#[tauri::command]
pub async fn fs_reveal(request: PathRequest) -> Result<OkResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;

    external_open::reveal_path_in_file_manager(&uri).map_err(IpcError::from)?;

    Ok(OkResponse { ok: true })
}

#[tauri::command]
pub async fn fs_properties(
    request: PathPropertiesRequest,
) -> Result<PathPropertiesResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let properties =
        metadata::path_properties(&uri, request.include_folder_summary.unwrap_or(false))
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

const MAX_IMAGE_BYTES: u64 = 20 * 1024 * 1024; // 20 MB

fn mime_for_extension(ext: &str) -> &'static str {
    match ext {
        ".png" => "image/png",
        ".jpg" | ".jpeg" => "image/jpeg",
        ".gif" => "image/gif",
        ".bmp" => "image/bmp",
        ".webp" => "image/webp",
        ".svg" => "image/svg+xml",
        ".ico" => "image/x-icon",
        _ => "application/octet-stream",
    }
}

#[tauri::command]
pub async fn fs_read_image_as_data_uri(
    request: ReadImageAsDataUriRequest,
    _state: State<'_, Arc<AppState>>,
) -> Result<ReadImageAsDataUriResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let path = uri.to_local_path().map_err(IpcError::from)?;

    let metadata = std::fs::metadata(&path).map_err(|e| IpcError::io(e.to_string()))?;

    if metadata.is_dir() {
        return Err(IpcError::is_directory("cannot read a directory as image"));
    }

    let file_size = metadata.len();
    if file_size > MAX_IMAGE_BYTES {
        return Err(IpcError::file_too_large(format!(
            "image file too large: {} bytes (max {} bytes)",
            file_size, MAX_IMAGE_BYTES
        )));
    }

    let mut buf = vec![0u8; file_size as usize];
    let mut f = File::open(&path).map_err(|e| IpcError::io(e.to_string()))?;
    f.read_exact(&mut buf)
        .map_err(|e| IpcError::io(e.to_string()))?;

    let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &buf);

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| format!(".{}", e.to_lowercase()))
        .unwrap_or_default();

    let mime = mime_for_extension(&ext);

    Ok(ReadImageAsDataUriResponse {
        data_uri: format!("data:{};base64,{}", mime, b64),
        byte_size: file_size,
        mime_type: mime.to_string(),
    })
}
