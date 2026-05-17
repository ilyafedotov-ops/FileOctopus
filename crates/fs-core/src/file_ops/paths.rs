use std::fs;
use std::path::{Path, PathBuf};

use vfs::{FileKind, FileOperationError, FileOperationKind, ResourceUri};

pub(super) fn require_existing_directory(
    path: &Path,
    uri: &ResourceUri,
) -> Result<(), FileOperationError> {
    if !path.is_dir() {
        return Err(FileOperationError::DestinationMissing {
            uri: uri.as_str().to_string(),
        });
    }

    Ok(())
}

pub(super) fn canonical_existing_path(
    path: &Path,
    uri: &ResourceUri,
) -> Result<PathBuf, FileOperationError> {
    path.canonicalize()
        .map_err(|error| map_io_error(uri, error))
}

pub(super) fn file_kind(metadata: &fs::Metadata) -> FileKind {
    if metadata.file_type().is_symlink() {
        FileKind::Symlink
    } else if metadata.is_dir() {
        FileKind::Directory
    } else if metadata.is_file() {
        FileKind::File
    } else {
        FileKind::Unknown
    }
}

pub(super) fn map_io_error(uri: &ResourceUri, error: std::io::Error) -> FileOperationError {
    match error.kind() {
        std::io::ErrorKind::NotFound => FileOperationError::NotFound {
            uri: uri.as_str().to_string(),
        },
        std::io::ErrorKind::PermissionDenied => FileOperationError::PermissionDenied {
            uri: uri.as_str().to_string(),
        },
        _ => FileOperationError::io(error.to_string()),
    }
}

pub(super) fn map_std_io_error(path: &Path, error: std::io::Error) -> FileOperationError {
    let uri = ResourceUri::from_local_path(path)
        .map(|uri| uri.as_str().to_string())
        .unwrap_or_else(|_| path.to_string_lossy().to_string());

    match error.kind() {
        std::io::ErrorKind::NotFound => FileOperationError::NotFound { uri },
        std::io::ErrorKind::PermissionDenied => FileOperationError::PermissionDenied { uri },
        _ => FileOperationError::io(error.to_string()),
    }
}

pub(super) fn is_cross_device_error(error: &std::io::Error) -> bool {
    error.raw_os_error() == Some(18)
}

pub(super) fn reject_self_or_descendant(
    kind: FileOperationKind,
    source: &Path,
    destination_dir: &Path,
) -> Result<(), FileOperationError> {
    let canonical_destination = destination_dir
        .canonicalize()
        .map_err(|error| map_std_io_error(destination_dir, error))?;

    if canonical_destination == source || canonical_destination.starts_with(source) {
        return Err(FileOperationError::RecursiveOperation {
            message: match kind {
                FileOperationKind::Move => "cannot move a directory into itself or a descendant",
                _ => "cannot copy a directory into itself or a descendant",
            }
            .to_string(),
        });
    }

    Ok(())
}
