use std::io::Read;
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

use app_core::AppState;
use app_ipc::{
    error_codes, ComputeHashRequest, ComputeHashResponse, DiffHunk, DiffLine, DiffTextRequest,
    DiffTextResponse, DirectoryBatchEventDto, DirectoryEntryDto, DiscoverVolumesResponse,
    EjectVolumeRequest, EjectVolumeResponse, ExifMetadataDto, ExifTagDto, FileEntryDto, IpcError,
    ListArchiveRequest, ListArchiveResponse, ListDirectoriesRequest, ListDirectoriesResponse,
    ListStartRequest, ListStartResponse, OkResponse, OpenTerminalRequest, OpenTerminalResponse,
    PathPropertiesDto, PathPropertiesRequest, PathPropertiesResponse, PathRequest,
    ReadFileAsDataUriRequest, ReadFileAsDataUriResponse, ReadFileRangeRequest,
    ReadFileRangeResponse, ReadImageAsDataUriRequest, ReadImageAsDataUriResponse,
    ReadTextFileRequest, ReadTextFileResponse, StandardLocationDto, StandardLocationsResponse,
    StatRequest, StatResponse, WriteTextFileRequest, WriteTextFileResponse, DIRECTORY_BATCH_EVENT,
};
use fs_core::{external_open, locations, metadata, vfs_io::VfsFilesystem};
use tauri::{AppHandle, State};
use vfs::{FileKind, ListOptions, ListSessionId, ResourceUri, VfsError};

use crate::emit::{emit_event, emit_job};
use crate::state::ListingRegistry;

pub(crate) const LISTING_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_HASH_BYTES: u64 = 100 * 1024 * 1024;
const MAX_LIST_BATCH_SIZE: usize = 4_096;
const MAX_LIST_IDENTIFIER_BYTES: usize = 128;

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
    let buf = tauri::async_runtime::spawn_blocking(move || vfs.read_file_prefix(&uri, read_len))
        .await
        .map_err(|_| IpcError::internal("read_text_file task join failed"))?
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
    let algorithm = request.algorithm;

    tauri::async_runtime::spawn_blocking(move || compute_hash_blocking(uri, algorithm))
        .await
        .map_err(|_| IpcError::internal("compute_hash task join failed"))?
}

fn compute_hash_blocking(
    uri: ResourceUri,
    algorithm: String,
) -> Result<ComputeHashResponse, IpcError> {
    let path = uri.to_local_path().map_err(IpcError::from)?;
    let metadata = std::fs::metadata(&path).map_err(|e| IpcError::io(e.to_string()))?;
    if metadata.is_dir() {
        return Err(IpcError::is_directory(
            "cannot compute hash for a directory",
        ));
    }

    let file_size = metadata.len();
    if file_size > MAX_HASH_BYTES {
        return Err(IpcError::file_too_large(format!(
            "file too large for hash computation ({} bytes, max 100 MB)",
            file_size
        )));
    }

    let algo = algorithm.to_lowercase();
    if algo != "sha256" && algo != "sha-256" {
        return Err(IpcError::unsupported_algorithm(format!(
            "unsupported hash algorithm: {}",
            algorithm
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
    let request_id = validate_list_identifier(&request.request_id, "requestId")?;
    let panel_key = request
        .panel_id
        .as_deref()
        .map(|value| validate_list_identifier(value, "panelId"))
        .transpose()?
        .unwrap_or_else(|| request_id.clone());
    let session_id = ListSessionId::new(&uuid::Uuid::new_v4().to_string());
    let response = ListStartResponse {
        session_id: session_id.as_str().to_string(),
        request_id: request_id.clone(),
    };
    let cancel = listings.register(&panel_key, &request_id)?;
    let options = ListOptions {
        session_id: session_id.clone(),
        request_id: request_id.clone(),
        batch_size: request
            .batch_size
            .unwrap_or(256)
            .clamp(1, MAX_LIST_BATCH_SIZE),
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
    let cleanup_request_id = request_id.clone();

    tauri::async_runtime::spawn(async move {
        while let Some(batch) = receiver.recv().await {
            let dto = DirectoryBatchEventDto::from(batch);
            emit_event(&events_app, DIRECTORY_BATCH_EVENT, dto);
        }
    });

    tauri::async_runtime::spawn(async move {
        let result =
            tokio::time::timeout(LISTING_TIMEOUT, vfs.list(&list_uri, options, sender)).await;

        match result {
            Ok(Ok(())) => {}
            Ok(Err(error)) if error.code() == "cancelled" => {}
            Ok(Err(error)) => {
                telemetry::error(&format!("directory listing failed code={}", error.code()));
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

                emit_event(&listing_app, DIRECTORY_BATCH_EVENT, event);
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

                emit_event(&listing_app, DIRECTORY_BATCH_EVENT, event);
            }
        }

        listings_cleanup.remove(&cleanup_panel_key, &cleanup_request_id);
    });

    Ok(response)
}

fn validate_list_identifier(value: &str, field: &str) -> Result<String, IpcError> {
    if value.is_empty()
        || value.len() > MAX_LIST_IDENTIFIER_BYTES
        || value != value.trim()
        || value.chars().any(char::is_control)
    {
        return Err(IpcError::invalid_request(format!(
            "{field} must be 1..={MAX_LIST_IDENTIFIER_BYTES} bytes without surrounding whitespace or control characters"
        )));
    }
    Ok(value.to_string())
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
    let include_exif = request.include_exif.unwrap_or(false);
    let properties = tauri::async_runtime::spawn_blocking(move || {
        metadata::path_properties(&uri, include_folder_summary, include_exif)
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
            exif: properties.exif.map(exif_metadata_to_dto),
        },
    })
}

fn exif_metadata_to_dto(value: metadata::ExifMetadata) -> ExifMetadataDto {
    ExifMetadataDto {
        camera_make: value.camera_make,
        camera_model: value.camera_model,
        lens_model: value.lens_model,
        date_taken: value.date_taken,
        width: value.width,
        height: value.height,
        orientation: value.orientation,
        exposure_time: value.exposure_time,
        f_number: value.f_number,
        iso: value.iso,
        focal_length: value.focal_length,
        gps_latitude: value.gps_latitude,
        gps_longitude: value.gps_longitude,
        tags: value
            .tags
            .into_iter()
            .map(|tag| ExifTagDto {
                group: tag.group,
                tag: tag.tag,
                label: tag.label,
                value: tag.value,
            })
            .collect(),
        warnings: value.warnings,
    }
}

const MAX_IMAGE_BYTES: u64 = 20 * 1024 * 1024; // 20 MB
const MAX_DATA_URI_BYTES: u64 = 20 * 1024 * 1024; // 20 MB

fn mime_for_extension(ext: &str) -> &'static str {
    match ext {
        ".pdf" => "application/pdf",
        ".png" => "image/png",
        ".jpg" | ".jpeg" => "image/jpeg",
        ".gif" => "image/gif",
        ".bmp" => "image/bmp",
        ".webp" => "image/webp",
        ".svg" => "image/svg+xml",
        ".ico" => "image/x-icon",
        ".mp3" => "audio/mpeg",
        ".ogg" | ".oga" => "audio/ogg",
        ".wav" => "audio/wav",
        ".flac" => "audio/flac",
        ".aac" => "audio/aac",
        ".m4a" => "audio/mp4",
        ".opus" => "audio/opus",
        ".mp4" | ".m4v" => "video/mp4",
        ".webm" => "video/webm",
        ".mkv" => "video/x-matroska",
        ".mov" => "video/quicktime",
        ".avi" => "video/x-msvideo",
        ".wmv" => "video/x-ms-wmv",
        ".mpg" | ".mpeg" => "video/mpeg",
        ".3gp" => "video/3gpp",
        _ => "application/octet-stream",
    }
}

#[tauri::command]
pub async fn fs_read_file_as_data_uri(
    request: ReadFileAsDataUriRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<ReadFileAsDataUriResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let entry = state.vfs().stat(&uri).await.map_err(IpcError::from)?;

    if entry.kind == FileKind::Directory {
        return Err(IpcError::is_directory(
            "cannot read a directory as data URI",
        ));
    }

    let max_bytes = request
        .max_bytes
        .unwrap_or(MAX_DATA_URI_BYTES)
        .min(MAX_DATA_URI_BYTES);

    if entry.size.is_some_and(|size| size > max_bytes) {
        return Err(IpcError::file_too_large(format!(
            "file too large: {} bytes (max {} bytes)",
            entry.size.unwrap_or(0),
            max_bytes
        )));
    }

    let vfs = VfsFilesystem::with_sessions(state.sessions(), state.vfs());
    let read_len = entry.size.unwrap_or(max_bytes);
    let buf = tauri::async_runtime::spawn_blocking(move || vfs.read_file_prefix(&uri, read_len))
        .await
        .map_err(|_| IpcError::internal("read_file_as_data_uri task join failed"))?
        .map_err(IpcError::from)?;
    let byte_size = entry.size.unwrap_or(buf.len() as u64);

    let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &buf);

    let ext = entry
        .extension
        .as_deref()
        .map(|e| format!(".{}", e.to_lowercase()))
        .unwrap_or_default();
    let mime = mime_for_extension(&ext);

    Ok(ReadFileAsDataUriResponse {
        data_uri: format!("data:{};base64,{}", mime, b64),
        byte_size,
        mime_type: mime.to_string(),
    })
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
    let buf = tauri::async_runtime::spawn_blocking(move || vfs.read_file_prefix(&uri, read_len))
        .await
        .map_err(|_| IpcError::internal("read_image_as_data_uri task join failed"))?
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

#[cfg(test)]
mod tests {
    use super::{
        compute_hash_blocking, mime_for_extension, validate_list_identifier,
        MAX_LIST_IDENTIFIER_BYTES,
    };
    use app_ipc::error_codes;
    use vfs::ResourceUri;

    #[test]
    fn mime_for_extension_maps_pdf() {
        assert_eq!(mime_for_extension(".pdf"), "application/pdf");
    }

    #[test]
    fn compute_hash_blocking_returns_sha256_response() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("data.bin");
        std::fs::write(&path, b"test content").unwrap();
        let uri = ResourceUri::from_local_path(&path).unwrap();

        let response = compute_hash_blocking(uri, "sha-256".to_string()).unwrap();

        assert_eq!(
            response.hash,
            "6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72"
        );
        assert_eq!(response.algorithm, "sha256");
        assert_eq!(response.byte_size, 12);
    }

    #[test]
    fn compute_hash_blocking_rejects_unsupported_algorithm() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("data.bin");
        std::fs::write(&path, b"test content").unwrap();
        let uri = ResourceUri::from_local_path(&path).unwrap();

        let error = compute_hash_blocking(uri, "sha1".to_string()).unwrap_err();

        assert_eq!(error.code, error_codes::UNSUPPORTED_ALGORITHM);
    }

    #[test]
    fn listing_identifiers_are_bounded_and_canonical() {
        assert_eq!(
            validate_list_identifier("request-1", "requestId").unwrap(),
            "request-1"
        );
        for invalid in ["", " request", "request ", "request\n"] {
            assert!(validate_list_identifier(invalid, "requestId").is_err());
        }
        assert!(
            validate_list_identifier(&"x".repeat(MAX_LIST_IDENTIFIER_BYTES + 1), "requestId")
                .is_err()
        );
    }
}

#[tauri::command]
pub async fn fs_discover_volumes() -> Result<DiscoverVolumesResponse, IpcError> {
    #[cfg(target_os = "macos")]
    let volumes = discover_macos_volumes();

    #[cfg(all(not(target_os = "linux"), not(target_os = "macos")))]
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

#[cfg(target_os = "macos")]
fn discover_macos_volumes() -> Vec<app_ipc::VolumeDto> {
    let mut volumes = Vec::new();
    let mut paths = vec![std::path::PathBuf::from("/")];
    if let Ok(read_dir) = std::fs::read_dir("/Volumes") {
        for entry in read_dir.flatten() {
            paths.push(entry.path());
        }
    }

    paths.sort();
    paths.dedup();

    for path in paths {
        if !path.exists() {
            continue;
        }
        let name = if path == std::path::Path::new("/") {
            "Macintosh HD".to_string()
        } else {
            path.file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("Volume")
                .to_string()
        };
        let uri = match ResourceUri::from_local_path(&path) {
            Ok(uri) => uri.as_str().to_string(),
            Err(_) => continue,
        };
        let lowered = name.to_lowercase();
        let is_network = lowered.contains("google")
            || lowered.contains("onedrive")
            || lowered.contains("icloud")
            || lowered.contains("smb")
            || lowered.contains("share");
        volumes.push(app_ipc::VolumeDto {
            name,
            mount_uri: uri,
            total_bytes: None,
            available_bytes: None,
            file_system_type: Some("apfs".to_string()),
            is_removable: false,
            is_network,
        });
    }

    volumes
}

#[tauri::command]
pub async fn fs_eject_volume(
    request: EjectVolumeRequest,
    _state: State<'_, Arc<AppState>>,
) -> Result<EjectVolumeResponse, IpcError> {
    telemetry::debug("fs.eject_volume requested");

    let mount_point = request.mount_point;

    #[cfg(target_os = "linux")]
    {
        let output = std::process::Command::new("umount")
            .arg(&mount_point)
            .output()
            .map_err(|e| IpcError::io(format!("failed to execute umount: {}", e)))?;

        if output.status.success() {
            return Ok(EjectVolumeResponse { success: true });
        }

        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("not found") || stderr.contains("not mounted") {
            return Ok(EjectVolumeResponse { success: true });
        }

        Err(IpcError::new(
            error_codes::PERMISSION_DENIED,
            format!("umount failed: {}", stderr.trim()),
        ))
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = mount_point;
        Err(IpcError::new(
            error_codes::NOT_FOUND,
            "eject is not supported on this platform",
        ))
    }
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

#[tauri::command]
pub async fn fs_list_archive(request: ListArchiveRequest) -> Result<ListArchiveResponse, IpcError> {
    let uri = ResourceUri::parse(&request.uri).map_err(IpcError::from)?;
    let path = uri.to_local_path().map_err(IpcError::from)?;

    let metadata = std::fs::metadata(&path).map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            IpcError::not_found(path.to_string_lossy().to_string())
        } else {
            IpcError::io(e.to_string())
        }
    })?;

    if metadata.is_dir() {
        return Err(IpcError::is_directory(
            "cannot list archive contents of a directory",
        ));
    }

    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default()
        .to_lowercase();

    let entries = if name.ends_with(".zip") {
        list_zip_entries(&path)?
    } else if name.ends_with(".tar.gz") || name.ends_with(".tgz") {
        list_tar_gz_entries(&path)?
    } else if name.ends_with(".tar.bz2") || name.ends_with(".tbz2") {
        list_tar_bz2_entries(&path)?
    } else if name.ends_with(".tar") {
        list_tar_entries_inner(&path)?
    } else {
        return Err(IpcError::invalid_request(format!(
            "unsupported archive format: {name}"
        )));
    };

    Ok(ListArchiveResponse { entries })
}

fn extension_for_archive_name(name: &str, is_dir: bool) -> Option<String> {
    if is_dir {
        return None;
    }
    let file_name = name.trim_end_matches('/');
    let file_name = file_name.split('/').next_back().unwrap_or(file_name);
    Path::new(file_name)
        .extension()
        .map(|e| e.to_string_lossy().to_string())
}

fn list_zip_entries(path: &std::path::Path) -> Result<Vec<FileEntryDto>, IpcError> {
    let file = std::fs::File::open(path).map_err(|e| IpcError::io(e.to_string()))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| IpcError::io(format!("failed to read zip archive: {e}")))?;

    let mut entries = Vec::new();
    for index in 0..archive.len() {
        let entry = archive
            .by_index(index)
            .map_err(|e| IpcError::io(format!("failed to read zip entry {index}: {e}")))?;
        let entry_name = entry.name().to_string();
        let is_dir = entry_name.ends_with('/');
        let name = entry_name
            .trim_end_matches('/')
            .split('/')
            .next_back()
            .unwrap_or("")
            .to_string();

        if name.is_empty() {
            continue;
        }

        let entry_uri = format!("archive://{}!/{}", path.display(), entry_name);

        entries.push(FileEntryDto {
            uri: entry_uri,
            name,
            extension: extension_for_archive_name(&entry_name, is_dir),
            kind: if is_dir {
                FileKind::Directory
            } else {
                FileKind::File
            },
            size: if is_dir { None } else { Some(entry.size()) },
            modified_at: None,
            created_at: None,
            accessed_at: None,
            is_hidden: false,
            is_symlink: false,
            is_placeholder: false,
            symlink_target: None,
            provider_id: "archive".to_string(),
            can_read: true,
            can_list: is_dir,
            can_write: false,
            can_delete: false,
            can_rename: false,
            permissions: None,
            owner: None,
            target_uri: None,
            virtual_kind: None,
            protocol: None,
            status: None,
            description: None,
        });
    }

    Ok(entries)
}

fn list_tar_reader<R: Read>(
    archive: &mut tar::Archive<R>,
    archive_prefix: &str,
) -> Result<Vec<FileEntryDto>, IpcError> {
    let mut entries = Vec::new();
    let iter = archive
        .entries()
        .map_err(|e| IpcError::io(format!("failed to read tar entries: {e}")))?;

    for entry_result in iter {
        let entry =
            entry_result.map_err(|e| IpcError::io(format!("failed to read tar entry: {e}")))?;
        let entry_path = entry
            .path()
            .map_err(|e| IpcError::io(format!("failed to read tar entry path: {e}")))?;
        let entry_name = entry_path.to_string_lossy().to_string();
        let is_dir = entry_name.ends_with('/');
        let name = entry_name
            .trim_end_matches('/')
            .split('/')
            .next_back()
            .unwrap_or("")
            .to_string();

        if name.is_empty() {
            continue;
        }

        let entry_uri = format!("archive://{archive_prefix}!/{entry_name}");

        entries.push(FileEntryDto {
            uri: entry_uri,
            name,
            extension: extension_for_archive_name(&entry_name, is_dir),
            kind: if is_dir {
                FileKind::Directory
            } else {
                FileKind::File
            },
            size: if is_dir { None } else { Some(entry.size()) },
            modified_at: None,
            created_at: None,
            accessed_at: None,
            is_hidden: false,
            is_symlink: entry.link_name().ok().flatten().is_some(),
            is_placeholder: false,
            symlink_target: entry
                .link_name()
                .ok()
                .flatten()
                .map(|p| p.to_string_lossy().to_string()),
            provider_id: "archive".to_string(),
            can_read: true,
            can_list: is_dir,
            can_write: false,
            can_delete: false,
            can_rename: false,
            permissions: None,
            owner: None,
            target_uri: None,
            virtual_kind: None,
            protocol: None,
            status: None,
            description: None,
        });
    }

    Ok(entries)
}

fn list_tar_gz_entries(path: &std::path::Path) -> Result<Vec<FileEntryDto>, IpcError> {
    let file = std::fs::File::open(path).map_err(|e| IpcError::io(e.to_string()))?;
    let gz = flate2::read::GzDecoder::new(file);
    let mut archive = tar::Archive::new(gz);
    list_tar_reader(&mut archive, &path.display().to_string())
}

fn list_tar_bz2_entries(path: &std::path::Path) -> Result<Vec<FileEntryDto>, IpcError> {
    let file = std::fs::File::open(path).map_err(|e| IpcError::io(e.to_string()))?;
    let bz = bzip2::read::BzDecoder::new(file);
    let mut archive = tar::Archive::new(bz);
    list_tar_reader(&mut archive, &path.display().to_string())
}

fn list_tar_entries_inner(path: &std::path::Path) -> Result<Vec<FileEntryDto>, IpcError> {
    let file = std::fs::File::open(path).map_err(|e| IpcError::io(e.to_string()))?;
    let mut archive = tar::Archive::new(file);
    list_tar_reader(&mut archive, &path.display().to_string())
}

#[tauri::command]
pub async fn fs_diff_text(
    request: DiffTextRequest,
    _state: State<'_, Arc<AppState>>,
) -> Result<DiffTextResponse, IpcError> {
    let left_uri = ResourceUri::parse(&request.left_uri).map_err(IpcError::from)?;
    let left_path = left_uri.to_local_path().map_err(IpcError::from)?;

    let right_uri = ResourceUri::parse(&request.right_uri).map_err(IpcError::from)?;
    let right_path = right_uri.to_local_path().map_err(IpcError::from)?;

    let left_meta = std::fs::metadata(&left_path).map_err(|e| IpcError::io(e.to_string()))?;
    if left_meta.is_dir() {
        return Err(IpcError::is_directory("cannot diff a directory"));
    }

    let right_meta = std::fs::metadata(&right_path).map_err(|e| IpcError::io(e.to_string()))?;
    if right_meta.is_dir() {
        return Err(IpcError::is_directory("cannot diff a directory"));
    }

    let max_bytes = request.max_bytes.unwrap_or(512 * 1024);

    let left_bytes = std::fs::read(&left_path).map_err(|e| IpcError::io(e.to_string()))?;
    let right_bytes = std::fs::read(&right_path).map_err(|e| IpcError::io(e.to_string()))?;

    let left_truncated = left_bytes.len() as u64 > max_bytes;
    let right_truncated = right_bytes.len() as u64 > max_bytes;

    let left_str =
        String::from_utf8_lossy(&left_bytes[..(left_bytes.len().min(max_bytes as usize))]);
    let right_str =
        String::from_utf8_lossy(&right_bytes[..(right_bytes.len().min(max_bytes as usize))]);

    let left_lines: Vec<&str> = left_str.lines().collect();
    let right_lines: Vec<&str> = right_str.lines().collect();

    let diff = similar::TextDiff::from_lines(&left_str, &right_str);

    let mut hunks: Vec<DiffHunk> = Vec::new();
    let mut current_lines: Vec<DiffLine> = Vec::new();
    let mut current_old_start: u64 = 0;
    let mut current_new_start: u64 = 0;
    let mut in_hunk = false;

    for change in diff.iter_all_changes() {
        let (kind, old_line, new_line) = match change.tag() {
            similar::ChangeTag::Equal => (
                "equal",
                Some(change.old_index().unwrap() as u64 + 1),
                Some(change.new_index().unwrap() as u64 + 1),
            ),
            similar::ChangeTag::Delete => {
                ("delete", Some(change.old_index().unwrap() as u64 + 1), None)
            }
            similar::ChangeTag::Insert => {
                ("insert", None, Some(change.new_index().unwrap() as u64 + 1))
            }
        };

        let line = DiffLine {
            kind: kind.to_string(),
            content: change.to_string_lossy().to_string(),
            old_line,
            new_line,
        };

        if kind == "equal" && in_hunk {
            let equal_count = current_lines
                .iter()
                .rev()
                .take_while(|l| l.kind == "equal")
                .count();
            if equal_count >= 3 {
                current_lines.push(line);
                let old_count = current_lines
                    .iter()
                    .filter(|l| l.kind == "equal" || l.kind == "delete")
                    .count() as u64;
                let new_count = current_lines
                    .iter()
                    .filter(|l| l.kind == "equal" || l.kind == "insert")
                    .count() as u64;
                hunks.push(DiffHunk {
                    old_start: current_old_start,
                    old_count,
                    new_start: current_new_start,
                    new_count,
                    lines: current_lines.clone(),
                });
                current_lines.clear();
                in_hunk = false;
                continue;
            }
        }

        if !in_hunk && kind != "equal" {
            if !current_lines.is_empty() {
                let eq_count = current_lines
                    .iter()
                    .rev()
                    .take_while(|l| l.kind == "equal")
                    .count();
                let context_count = eq_count.min(3);
                current_lines.truncate(current_lines.len() - eq_count);
                let context: Vec<DiffLine> = current_lines
                    .drain(current_lines.len().saturating_sub(context_count)..)
                    .collect();
                current_lines.extend(context);
            }
            current_old_start = old_line.unwrap_or(1);
            current_new_start = new_line.unwrap_or(1);
            in_hunk = true;
        }

        current_lines.push(line);
    }

    if !current_lines.is_empty() && in_hunk {
        let old_count = current_lines
            .iter()
            .filter(|l| l.kind == "equal" || l.kind == "delete")
            .count() as u64;
        let new_count = current_lines
            .iter()
            .filter(|l| l.kind == "equal" || l.kind == "insert")
            .count() as u64;
        hunks.push(DiffHunk {
            old_start: current_old_start,
            old_count,
            new_start: current_new_start,
            new_count,
            lines: current_lines,
        });
    }

    Ok(DiffTextResponse {
        hunks,
        left_line_count: left_lines.len() as u64,
        right_line_count: right_lines.len() as u64,
        left_truncated,
        right_truncated,
    })
}
