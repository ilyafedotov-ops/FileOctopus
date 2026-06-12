use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use jobs::CancellationToken;
use vfs::{FileKind, FileOperationError, ResourceUri};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PathProperties {
    pub uri: String,
    pub name: String,
    pub kind: FileKind,
    pub size: Option<u64>,
    pub total_size: Option<u64>,
    pub item_count: Option<u64>,
    pub file_count: Option<u64>,
    pub directory_count: Option<u64>,
    pub modified_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
    pub accessed_at: Option<DateTime<Utc>>,
    pub is_hidden: bool,
    pub is_symlink: bool,
    pub symlink_target: Option<String>,
    pub readonly: bool,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FolderSizeSummary {
    pub total_size: u64,
    pub item_count: u64,
    pub file_count: u64,
    pub directory_count: u64,
    pub warnings: Vec<String>,
    pub incomplete: bool,
}

pub fn path_properties(
    uri: &ResourceUri,
    include_folder_summary: bool,
) -> Result<PathProperties, FileOperationError> {
    let path = uri.to_local_path()?;
    let metadata = fs::symlink_metadata(&path).map_err(|error| map_io_error(uri, error))?;
    let kind = file_kind(&metadata);
    let summary = if include_folder_summary && metadata.is_dir() {
        Some(calculate_folder_size(uri)?)
    } else {
        None
    };

    Ok(PathProperties {
        uri: uri.as_str().to_string(),
        name: display_name(&path, uri),
        kind,
        size: metadata.is_file().then_some(metadata.len()),
        total_size: summary.as_ref().map(|value| value.total_size),
        item_count: summary.as_ref().map(|value| value.item_count),
        file_count: summary.as_ref().map(|value| value.file_count),
        directory_count: summary.as_ref().map(|value| value.directory_count),
        modified_at: metadata.modified().ok().map(DateTime::<Utc>::from),
        created_at: metadata.created().ok().map(DateTime::<Utc>::from),
        accessed_at: metadata.accessed().ok().map(DateTime::<Utc>::from),
        is_hidden: is_hidden(&path),
        is_symlink: metadata.file_type().is_symlink(),
        symlink_target: fs::read_link(&path)
            .ok()
            .and_then(|target| absolute_symlink_target(&path, target))
            .and_then(|target| ResourceUri::from_local_path(&target).ok())
            .map(|target| target.as_str().to_string()),
        readonly: metadata.permissions().readonly(),
        warnings: summary.map(|value| value.warnings).unwrap_or_default(),
    })
}

pub fn calculate_folder_size(uri: &ResourceUri) -> Result<FolderSizeSummary, FileOperationError> {
    calculate_folder_size_with_progress(uri, &CancellationToken::new(), |_, _| {})
}

pub fn calculate_folder_size_with_progress(
    uri: &ResourceUri,
    cancel: &CancellationToken,
    mut progress: impl FnMut(&FolderSizeSummary, &Path),
) -> Result<FolderSizeSummary, FileOperationError> {
    let path = uri.to_local_path()?;

    if !path.is_dir() {
        if cancel.is_cancelled() {
            return Err(FileOperationError::Cancelled { job_id: None });
        }

        let metadata = fs::symlink_metadata(&path).map_err(|error| map_io_error(uri, error))?;

        return Ok(FolderSizeSummary {
            total_size: if metadata.is_file() {
                metadata.len()
            } else {
                0
            },
            item_count: 1,
            file_count: u64::from(metadata.is_file()),
            directory_count: u64::from(metadata.is_dir()),
            warnings: Vec::new(),
            incomplete: false,
        });
    }

    let mut summary = FolderSizeSummary {
        total_size: 0,
        item_count: 0,
        file_count: 0,
        directory_count: 0,
        warnings: Vec::new(),
        incomplete: false,
    };
    let mut visited = HashSet::new();

    visit_folder(&path, &mut visited, &mut summary, cancel, &mut progress)?;

    Ok(summary)
}

fn visit_folder(
    path: &Path,
    visited: &mut HashSet<PathBuf>,
    summary: &mut FolderSizeSummary,
    cancel: &CancellationToken,
    progress: &mut impl FnMut(&FolderSizeSummary, &Path),
) -> Result<(), FileOperationError> {
    if cancel.is_cancelled() {
        return Err(FileOperationError::Cancelled { job_id: None });
    }

    let canonical = match path.canonicalize() {
        Ok(value) => value,
        Err(error) => {
            summary.incomplete = true;
            summary.warnings.push(error.to_string());
            return Ok(());
        }
    };

    if !visited.insert(canonical) {
        return Ok(());
    }

    let read_dir = match fs::read_dir(path) {
        Ok(value) => value,
        Err(error) => {
            summary.incomplete = true;
            summary.warnings.push(error.to_string());
            return Ok(());
        }
    };

    for entry in read_dir {
        if cancel.is_cancelled() {
            return Err(FileOperationError::Cancelled { job_id: None });
        }

        let entry = match entry {
            Ok(value) => value,
            Err(error) => {
                summary.incomplete = true;
                summary.warnings.push(error.to_string());
                continue;
            }
        };
        let entry_path = entry.path();
        let metadata = match fs::symlink_metadata(&entry_path) {
            Ok(value) => value,
            Err(error) => {
                summary.incomplete = true;
                summary.warnings.push(error.to_string());
                continue;
            }
        };

        if metadata.file_type().is_symlink() {
            continue;
        }

        summary.item_count += 1;

        if metadata.is_dir() {
            summary.directory_count += 1;
            progress(summary, &entry_path);
            visit_folder(&entry_path, visited, summary, cancel, progress)?;
        } else if metadata.is_file() {
            summary.file_count += 1;
            summary.total_size += metadata.len();
            progress(summary, &entry_path);
        }
    }

    Ok(())
}

pub(crate) fn file_kind(metadata: &fs::Metadata) -> FileKind {
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

pub(crate) fn display_name(path: &Path, uri: &ResourceUri) -> String {
    path.file_name()
        .map(|value| value.to_string_lossy().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| uri.display_path())
}

pub(crate) fn is_hidden(path: &Path) -> bool {
    path.file_name()
        .map(|value| value.to_string_lossy().starts_with('.'))
        .unwrap_or(false)
}

pub(crate) fn absolute_symlink_target(path: &Path, target: PathBuf) -> Option<PathBuf> {
    if target.is_absolute() {
        return Some(target);
    }

    path.parent().map(|parent| parent.join(target))
}

fn map_io_error(uri: &ResourceUri, error: std::io::Error) -> FileOperationError {
    match error.kind() {
        std::io::ErrorKind::NotFound => FileOperationError::NotFound {
            uri: uri.as_str().to_string(),
        },
        std::io::ErrorKind::PermissionDenied => FileOperationError::PermissionDenied {
            uri: uri.as_str().to_string(),
        },
        std::io::ErrorKind::TimedOut => crate::placeholder::classify_timed_out_uri(uri, &error),
        _ => FileOperationError::io(error.to_string()),
    }
}
