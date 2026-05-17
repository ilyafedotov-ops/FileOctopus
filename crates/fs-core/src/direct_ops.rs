use std::fs::{self, File};
use std::path::Path;

use chrono::{DateTime, Utc};
use vfs::{EntryCapabilities, FileEntry, FileKind, FileOperationError, ProviderId, ResourceUri};

use crate::metadata::{display_name, file_kind, is_hidden};

pub fn create_empty_file(uri: &ResourceUri) -> Result<FileEntry, FileOperationError> {
    let path = uri.to_local_path()?;
    let parent = path
        .parent()
        .ok_or_else(|| FileOperationError::DestinationMissing {
            uri: uri.as_str().to_string(),
        })?;

    validate_basename(
        path.file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default(),
    )?;

    if !parent.is_dir() {
        return Err(FileOperationError::DestinationMissing {
            uri: uri.as_str().to_string(),
        });
    }

    if path.exists() {
        return Err(FileOperationError::DestinationConflict {
            uri: uri.as_str().to_string(),
        });
    }

    File::create_new(&path).map_err(|error| map_std_io_error(&path, error))?;
    let metadata = fs::symlink_metadata(&path).map_err(|error| map_std_io_error(&path, error))?;

    entry_for_path(&path, uri.clone(), metadata)
}

pub fn delete_permanently(uris: &[ResourceUri]) -> Result<(), FileOperationError> {
    for uri in uris {
        let path = uri.to_local_path()?;

        if !path.exists() {
            return Err(FileOperationError::NotFound {
                uri: uri.as_str().to_string(),
            });
        }

        if path.is_dir() {
            fs::remove_dir_all(&path).map_err(|error| map_std_io_error(&path, error))?;
        } else {
            fs::remove_file(&path).map_err(|error| map_std_io_error(&path, error))?;
        }
    }

    Ok(())
}

fn entry_for_path(
    path: &Path,
    uri: ResourceUri,
    metadata: fs::Metadata,
) -> Result<FileEntry, FileOperationError> {
    let kind = file_kind(&metadata);
    let capabilities = if kind == FileKind::Directory {
        EntryCapabilities::read_only_directory()
    } else {
        EntryCapabilities::read_only_file()
    };

    Ok(FileEntry {
        uri,
        name: display_name(path, &ResourceUri::from_local_path(path)?),
        extension: path
            .extension()
            .map(|value| value.to_string_lossy().to_string()),
        kind,
        size: metadata.is_file().then_some(metadata.len()),
        modified_at: metadata.modified().ok().map(DateTime::<Utc>::from),
        created_at: metadata.created().ok().map(DateTime::<Utc>::from),
        accessed_at: metadata.accessed().ok().map(DateTime::<Utc>::from),
        is_hidden: is_hidden(path),
        is_symlink: metadata.file_type().is_symlink(),
        symlink_target: None,
        provider_id: ProviderId::new("local"),
        capabilities,
        permissions: None,
        owner: None,
    })
}

fn validate_basename(name: &str) -> Result<(), FileOperationError> {
    if name.trim().is_empty()
        || name.contains('/')
        || name.contains('\\')
        || name.contains('\0')
        || name == "."
        || name == ".."
    {
        return Err(FileOperationError::InvalidName {
            name: name.to_string(),
        });
    }

    Ok(())
}

fn map_std_io_error(path: &Path, error: std::io::Error) -> FileOperationError {
    let uri = ResourceUri::from_local_path(path)
        .map(|uri| uri.as_str().to_string())
        .unwrap_or_else(|_| path.to_string_lossy().to_string());

    match error.kind() {
        std::io::ErrorKind::AlreadyExists => FileOperationError::DestinationConflict { uri },
        std::io::ErrorKind::NotFound => FileOperationError::NotFound { uri },
        std::io::ErrorKind::PermissionDenied => FileOperationError::PermissionDenied { uri },
        _ => FileOperationError::io(error.to_string()),
    }
}
