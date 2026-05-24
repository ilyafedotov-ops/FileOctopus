use std::sync::Arc;
use std::time::Duration;

use app_core::AppState;
use app_ipc::{
    error_codes, ComputeHashRequest, ComputeHashResponse, DirectoryBatchEventDto,
    DirectoryEntryDto, DiscoverVolumesResponse, IpcError, ListDirectoriesRequest,
    ListDirectoriesResponse, ListStartRequest, ListStartResponse, OkResponse, OpenTerminalRequest,
    OpenTerminalResponse, PathPropertiesDto, PathPropertiesRequest, PathPropertiesResponse,
    PathRequest, ReadFileRangeRequest, ReadFileRangeResponse, ReadImageAsDataUriRequest,
    ReadImageAsDataUriResponse, ReadTextFileRequest, ReadTextFileResponse, StandardLocationDto,
    StandardLocationsResponse, StatRequest, StatResponse, WriteTextFileRequest,
    WriteTextFileResponse, DIRECTORY_BATCH_EVENT,
};
use fs_core::{external_open, locations, metadata, vfs_io::VfsFilesystem};
use tauri::{AppHandle, State};
use vfs::{FileKind, ListOptions, ListSessionId, ResourceUri, VfsError};

use crate::emit::{emit_job, emit_with_eval};
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
    state: State<'_, Arc<AppState>>,
) -> Result<ReadTextFileResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let entry = state.vfs().stat(&uri).await.map_err(IpcError::from)?;

    if entry.kind == FileKind::Directory {
        return Err(IpcError::is_directory("cannot read a directory as text"));
    }

    let file_size = entry.size;
    let max_bytes = request.max_bytes.unwrap_or(1_048_576); // 1 MB default
    let read_len = file_size
        .map(|size| size.min(max_bytes))
        .unwrap_or(max_bytes);

    let vfs = VfsFilesystem::with_sessions(state.sessions(), state.vfs());
    let buf = vfs
        .read_file_prefix(&uri, read_len)
        .map_err(IpcError::from)?;
    let byte_size = file_size.unwrap_or(buf.len() as u64);

    let content = String::from_utf8_lossy(&buf).to_string();

    Ok(ReadTextFileResponse {
        content,
        truncated: byte_size > max_bytes,
        byte_size,
    })
}

const MAX_RANGE_READ_BYTES: u64 = 4 * 1024 * 1024; // 4 MiB per request

#[tauri::command]
pub async fn fs_read_file_range(
    request: ReadFileRangeRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<ReadFileRangeResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;

    if request.length > MAX_RANGE_READ_BYTES {
        return Err(IpcError::new(
            error_codes::INVALID_REQUEST,
            format!(
                "requested length {} exceeds max {}",
                request.length, MAX_RANGE_READ_BYTES
            ),
        ));
    }

    let vfs = VfsFilesystem::with_sessions(state.sessions(), state.vfs());
    let (bytes, total) = tauri::async_runtime::spawn_blocking(move || {
        vfs.read_file_range(&uri, request.offset, request.length)
    })
    .await
    .map_err(|_| IpcError::internal("read_file_range task join failed"))?
    .map_err(IpcError::from)?;

    let bytes_read = bytes.len() as u64;
    let eof = request.offset.saturating_add(bytes_read) >= total;
    let bytes_base64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes);

    Ok(ReadFileRangeResponse {
        bytes_base64,
        bytes_read,
        byte_size: total,
        eof,
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

    platform::open_external_terminal(&path).map_err(|error| IpcError::no_terminal(error.0))?;
    Ok(OpenTerminalResponse { success: true })
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
    let include_folder_summary = request.include_folder_summary.unwrap_or(false);
    let properties = tauri::async_runtime::spawn_blocking(move || {
        metadata::path_properties(&uri, include_folder_summary)
    })
    .await
    .map_err(|_| IpcError::internal("properties task join failed"))?
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
    state: State<'_, Arc<AppState>>,
) -> Result<ReadImageAsDataUriResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let entry = state.vfs().stat(&uri).await.map_err(IpcError::from)?;

    if entry.kind == FileKind::Directory {
        return Err(IpcError::is_directory("cannot read a directory as image"));
    }

    if entry.size.is_some_and(|size| size > MAX_IMAGE_BYTES) {
        return Err(IpcError::file_too_large(format!(
            "image file too large: {} bytes (max {} bytes)",
            entry.size.unwrap_or(0),
            MAX_IMAGE_BYTES
        )));
    }

    let vfs = VfsFilesystem::with_sessions(state.sessions(), state.vfs());
    let read_len = entry.size.unwrap_or(MAX_IMAGE_BYTES);
    let buf = vfs
        .read_file_prefix(&uri, read_len)
        .map_err(IpcError::from)?;
    let byte_size = entry.size.unwrap_or(buf.len() as u64);

    let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &buf);

    let ext = entry
        .extension
        .as_deref()
        .map(|e| format!(".{}", e.to_lowercase()))
        .unwrap_or_default();

    let mime = mime_for_extension(&ext);

    Ok(ReadImageAsDataUriResponse {
        data_uri: format!("data:{};base64,{}", mime, b64),
        byte_size,
        mime_type: mime.to_string(),
    })
}

#[tauri::command]
pub async fn fs_discover_volumes() -> Result<DiscoverVolumesResponse, IpcError> {
    #[cfg(not(target_os = "linux"))]
    let volumes = Vec::new();

    #[cfg(target_os = "linux")]
    let mut volumes = Vec::new();

    #[cfg(target_os = "linux")]
    {
        let mounts = std::fs::read_to_string("/proc/mounts").unwrap_or_default();
        for line in mounts.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() < 4 {
                continue;
            }
            let device = parts[0];
            let mount_point = parts[1];
            let fs_type = parts[2];

            // Skip pseudo/virtual filesystems
            if fs_type.starts_with("sysfs")
                || fs_type.starts_with("proc")
                || fs_type.starts_with("dev")
                || fs_type.starts_with("cgroup")
                || fs_type.starts_with("securityfs")
                || fs_type.starts_with("debugfs")
                || fs_type.starts_with("pstore")
                || fs_type.starts_with("bpf")
                || fs_type.starts_with("tracefs")
                || fs_type.starts_with("configfs")
                || fs_type.starts_with("fusectl")
                || fs_type.starts_with("hugetlbfs")
                || fs_type.starts_with("mqueue")
                || fs_type.starts_with("binfmt_misc")
                || fs_type.starts_with("efivarfs")
                || fs_type.starts_with("fuse.gvfsd-fuse")
                || fs_type.starts_with("fuse.portal")
            {
                continue;
            }

            // Skip bind mounts and rootfs
            if device == "none" || device == "tmpfs" || device == "rootfs" {
                continue;
            }

            let is_removable = device.starts_with("/dev/sd")
                || device.starts_with("/dev/usb")
                || device.starts_with("/dev/sr");
            let is_network = device.contains(':')
                || device.starts_with("//")
                || fs_type == "nfs"
                || fs_type == "nfs4"
                || fs_type == "cifs"
                || fs_type == "smb";

            let name = mount_point
                .rsplit('/')
                .next()
                .unwrap_or(mount_point)
                .to_string();

            volumes.push(app_ipc::VolumeDto {
                name,
                mount_uri: format!("local://{}", mount_point),
                total_bytes: None,
                available_bytes: None,
                file_system_type: Some(fs_type.to_string()),
                is_removable,
                is_network,
            });
        }
    }

    Ok(DiscoverVolumesResponse { volumes })
}

const MAX_WRITE_TEXT_BYTES_DEFAULT: u64 = 10 * 1024 * 1024; // 10 MiB

#[tauri::command]
pub async fn fs_write_text_file(
    request: WriteTextFileRequest,
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
) -> Result<WriteTextFileResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let cap = request.max_bytes.unwrap_or(MAX_WRITE_TEXT_BYTES_DEFAULT);
    let bytes = request.content.into_bytes();

    if bytes.len() as u64 > cap {
        return Err(IpcError::file_too_large(format!(
            "content {} bytes exceeds cap {} bytes",
            bytes.len(),
            cap
        )));
    }

    let byte_size = bytes.len() as u64;
    let sink_app = app.clone();
    let (terminal_sender, terminal_receiver) = std::sync::mpsc::channel();
    let sink = Arc::new(move |event: jobs::JobEvent| {
        emit_job(&sink_app, event.clone());
        if matches!(
            event,
            jobs::JobEvent::Completed(_) | jobs::JobEvent::Failed(_) | jobs::JobEvent::Cancelled(_)
        ) {
            let _ = terminal_sender.send(event);
        }
    });
    let started_job = state
        .operations()
        .write_text_file_atomic(uri, bytes, sink)
        .map_err(IpcError::from)?;
    let terminal_event = tauri::async_runtime::spawn_blocking(move || terminal_receiver.recv())
        .await
        .map_err(|_| IpcError::internal("write_text_file task join failed"))?
        .map_err(|_| IpcError::internal("write_text_file task ended without a terminal event"))?;

    match terminal_event {
        jobs::JobEvent::Completed(_) => {
            let job = state
                .operations()
                .status(started_job.job_id.as_str())
                .unwrap_or(started_job);
            Ok(WriteTextFileResponse { byte_size, job })
        }
        jobs::JobEvent::Failed(failed) => Err(IpcError {
            code: failed.error_code,
            message: failed.message,
        }),
        jobs::JobEvent::Cancelled(_) => Err(IpcError {
            code: "cancelled".to_string(),
            message: "write text file was cancelled".to_string(),
        }),
        _ => Err(IpcError::internal(
            "write_text_file received a non-terminal completion event",
        )),
    }
}

#[tauri::command]
pub async fn fs_list_directories(
    request: ListDirectoriesRequest,
    _state: State<'_, Arc<AppState>>,
) -> Result<ListDirectoriesResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let path = uri.to_local_path().map_err(IpcError::from)?;

    if !path.is_dir() {
        return Err(IpcError::is_directory(format!(
            "not a directory: {}",
            path.display()
        )));
    }

    let mut dirs: Vec<DirectoryEntryDto> = Vec::new();
    let entries = std::fs::read_dir(&path).map_err(|e| IpcError::io(e.to_string()))?;

    for entry in entries {
        let entry = entry.map_err(|e| IpcError::io(e.to_string()))?;
        let file_type = entry.file_type().map_err(|e| IpcError::io(e.to_string()))?;
        if !file_type.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        let child_path = entry.path();
        let child_uri = format!("local://{}", child_path.display());
        dirs.push(DirectoryEntryDto {
            name,
            uri: child_uri,
        });
    }

    dirs.sort_by_key(|a| a.name.to_lowercase());

    Ok(ListDirectoriesResponse { directories: dirs })
}
