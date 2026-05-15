use std::collections::HashSet;
use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::process::Command;

use chrono::{DateTime, Utc};
use jobs::CancellationToken;
use vfs::{EntryCapabilities, FileEntry, FileKind, FileOperationError, ProviderId, ResourceUri};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StandardLocation {
    pub id: String,
    pub name: String,
    pub uri: String,
    pub section: String,
}

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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SearchResult {
    pub matches: Vec<SearchMatch>,
    pub warnings: Vec<String>,
    pub incomplete: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SearchMatch {
    pub uri: String,
    pub parent_uri: String,
    pub name: String,
    pub kind: FileKind,
    pub size: Option<u64>,
    pub modified_at: Option<DateTime<Utc>>,
}

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

pub fn recursive_search(
    uri: &ResourceUri,
    query: &str,
    limit: usize,
) -> Result<SearchResult, FileOperationError> {
    recursive_search_with_progress(uri, query, limit, &CancellationToken::new(), |_, _| {})
}

pub fn recursive_search_with_progress(
    uri: &ResourceUri,
    query: &str,
    limit: usize,
    cancel: &CancellationToken,
    mut on_match: impl FnMut(&SearchMatch, &SearchResult),
) -> Result<SearchResult, FileOperationError> {
    let path = uri.to_local_path()?;
    let query = query.trim().to_lowercase();
    let mut result = SearchResult {
        matches: Vec::new(),
        warnings: Vec::new(),
        incomplete: false,
    };

    if query.is_empty() {
        return Ok(result);
    }

    if !path.is_dir() {
        return Err(FileOperationError::DestinationMissing {
            uri: uri.as_str().to_string(),
        });
    }

    search_folder(
        &path,
        &query,
        limit.max(1),
        &mut result,
        cancel,
        &mut on_match,
    )?;

    Ok(result)
}

pub fn standard_locations() -> Vec<StandardLocation> {
    let mut locations = Vec::new();
    let mut seen = HashSet::new();

    if let Some(home) = home_dir() {
        push_location(
            &mut locations,
            &mut seen,
            "home",
            "Home",
            "Favorites",
            home.clone(),
        );

        for (id, name) in [
            ("desktop", "Desktop"),
            ("documents", "Documents"),
            ("downloads", "Downloads"),
            ("pictures", "Pictures"),
            ("music", "Music"),
            ("videos", "Videos"),
        ] {
            push_location(
                &mut locations,
                &mut seen,
                id,
                name,
                "User folders",
                home.join(name),
            );
        }
    }

    for root in platform_roots() {
        let name = root
            .file_name()
            .and_then(|value| value.to_str())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| root.to_str().unwrap_or("/"))
            .to_string();
        push_location(
            &mut locations,
            &mut seen,
            &name,
            &name,
            "Devices/Volumes",
            root,
        );
    }

    locations
}

pub fn open_path_with_default_app(uri: &ResourceUri) -> Result<(), FileOperationError> {
    let path = existing_path(uri)?;

    launch_open_command(&path)
}

pub fn reveal_path_in_file_manager(uri: &ResourceUri) -> Result<(), FileOperationError> {
    let path = existing_path(uri)?;

    launch_reveal_command(&path)
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

fn search_folder(
    path: &Path,
    query: &str,
    limit: usize,
    result: &mut SearchResult,
    cancel: &CancellationToken,
    on_match: &mut impl FnMut(&SearchMatch, &SearchResult),
) -> Result<(), FileOperationError> {
    if cancel.is_cancelled() {
        return Err(FileOperationError::Cancelled { job_id: None });
    }

    if result.matches.len() >= limit {
        return Ok(());
    }

    let read_dir = match fs::read_dir(path) {
        Ok(value) => value,
        Err(error) => {
            result.incomplete = true;
            result.warnings.push(error.to_string());
            return Ok(());
        }
    };

    for entry in read_dir {
        if cancel.is_cancelled() {
            return Err(FileOperationError::Cancelled { job_id: None });
        }

        if result.matches.len() >= limit {
            return Ok(());
        }

        let entry = match entry {
            Ok(value) => value,
            Err(error) => {
                result.incomplete = true;
                result.warnings.push(error.to_string());
                continue;
            }
        };
        let entry_path = entry.path();
        let metadata = match fs::symlink_metadata(&entry_path) {
            Ok(value) => value,
            Err(error) => {
                result.incomplete = true;
                result.warnings.push(error.to_string());
                continue;
            }
        };
        let name = entry.file_name().to_string_lossy().to_string();

        if name.to_lowercase().contains(query) {
            if let (Ok(uri), Some(parent)) = (
                ResourceUri::from_local_path(&entry_path),
                entry_path
                    .parent()
                    .and_then(|value| ResourceUri::from_local_path(value).ok()),
            ) {
                result.matches.push(SearchMatch {
                    uri: uri.as_str().to_string(),
                    parent_uri: parent.as_str().to_string(),
                    name: name.clone(),
                    kind: file_kind(&metadata),
                    size: metadata.is_file().then_some(metadata.len()),
                    modified_at: metadata.modified().ok().map(DateTime::<Utc>::from),
                });
                if let Some(last) = result.matches.last().cloned() {
                    on_match(&last, result);
                }
            }
        }

        if metadata.is_dir() && !metadata.file_type().is_symlink() {
            search_folder(&entry_path, query, limit, result, cancel, on_match)?;
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

fn existing_path(uri: &ResourceUri) -> Result<PathBuf, FileOperationError> {
    let path = uri.to_local_path()?;

    if !path.exists() {
        return Err(FileOperationError::NotFound {
            uri: uri.as_str().to_string(),
        });
    }

    Ok(path)
}

fn launch_open_command(path: &Path) -> Result<(), FileOperationError> {
    let status = if cfg!(target_os = "macos") {
        Command::new("open").arg(path).status()
    } else if cfg!(target_os = "windows") {
        Command::new("powershell")
            .arg("-NoProfile")
            .arg("-Command")
            .arg("Start-Process")
            .arg("-LiteralPath")
            .arg(path)
            .status()
    } else {
        Command::new("xdg-open").arg(path).status()
    };

    match status {
        Ok(status) if status.success() => Ok(()),
        Ok(_) => Err(FileOperationError::Io {
            code: "launch_failed".to_string(),
            message: "The operating system could not open this item.".to_string(),
        }),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Err(FileOperationError::Io {
            code: "no_default_app".to_string(),
            message: "No default application is available for this item.".to_string(),
        }),
        Err(error) => Err(FileOperationError::Io {
            code: "launch_failed".to_string(),
            message: error.to_string(),
        }),
    }
}

fn launch_reveal_command(path: &Path) -> Result<(), FileOperationError> {
    let status = if cfg!(target_os = "macos") {
        Command::new("open").arg("-R").arg(path).status()
    } else if cfg!(target_os = "windows") {
        Command::new("explorer")
            .arg(format!("/select,{}", path.to_string_lossy()))
            .status()
    } else {
        let target = if path.is_dir() {
            path
        } else {
            path.parent().unwrap_or(path)
        };
        Command::new("xdg-open").arg(target).status()
    };

    match status {
        Ok(status) if status.success() => Ok(()),
        Ok(_) => Err(FileOperationError::Io {
            code: "reveal_failed".to_string(),
            message: "The operating system could not reveal this item.".to_string(),
        }),
        Err(error) => Err(FileOperationError::Io {
            code: "reveal_failed".to_string(),
            message: error.to_string(),
        }),
    }
}

fn push_location(
    locations: &mut Vec<StandardLocation>,
    seen: &mut HashSet<String>,
    id: &str,
    name: &str,
    section: &str,
    path: PathBuf,
) {
    if !path.exists() {
        return;
    }

    if should_skip_volume_path(&path) {
        return;
    }

    let resolved = path.canonicalize().unwrap_or(path);
    let Ok(uri) = ResourceUri::from_local_path(&resolved) else {
        return;
    };

    if seen.insert(uri.as_str().to_string()) {
        locations.push(StandardLocation {
            id: id.to_string(),
            name: name.to_string(),
            uri: uri.as_str().to_string(),
            section: section.to_string(),
        });
    }
}

fn should_skip_volume_path(path: &Path) -> bool {
    let value = path.to_string_lossy().to_ascii_lowercase();
    value.contains("timemachine")
        || value.contains("com.apple.time_machine")
        || value.ends_with(".timemachine")
}

fn platform_roots() -> Vec<PathBuf> {
    if cfg!(target_os = "windows") {
        return ('A'..='Z')
            .map(|letter| PathBuf::from(format!("{letter}:/")))
            .filter(|path| path.exists())
            .collect();
    }

    let mut roots = vec![PathBuf::from("/")];

    if cfg!(target_os = "macos") {
        roots.extend(read_existing_children(Path::new("/Volumes")));
    } else {
        roots.extend(read_existing_children(Path::new("/mnt")));
        roots.extend(read_existing_children(Path::new("/media")));
    }

    roots
}

fn read_existing_children(path: &Path) -> Vec<PathBuf> {
    fs::read_dir(path)
        .ok()
        .into_iter()
        .flat_map(|items| items.filter_map(Result::ok))
        .map(|entry| entry.path())
        .filter(|path| path.exists() && !should_skip_volume_path(path))
        .collect()
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("USERPROFILE").map(PathBuf::from))
}

fn display_name(path: &Path, uri: &ResourceUri) -> String {
    path.file_name()
        .map(|value| value.to_string_lossy().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| uri.display_path())
}

fn absolute_symlink_target(path: &Path, target: PathBuf) -> Option<PathBuf> {
    if target.is_absolute() {
        return Some(target);
    }

    path.parent().map(|parent| parent.join(target))
}

fn file_kind(metadata: &fs::Metadata) -> FileKind {
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

fn is_hidden(path: &Path) -> bool {
    path.file_name()
        .map(|value| value.to_string_lossy().starts_with('.'))
        .unwrap_or(false)
}

fn map_io_error(uri: &ResourceUri, error: std::io::Error) -> FileOperationError {
    match error.kind() {
        std::io::ErrorKind::NotFound => FileOperationError::NotFound {
            uri: uri.as_str().to_string(),
        },
        std::io::ErrorKind::PermissionDenied => FileOperationError::PermissionDenied {
            uri: uri.as_str().to_string(),
        },
        _ => FileOperationError::Io {
            code: error
                .raw_os_error()
                .map(|code| code.to_string())
                .unwrap_or_else(|| "io".to_string()),
            message: error.to_string(),
        },
    }
}

fn map_std_io_error(path: &Path, error: std::io::Error) -> FileOperationError {
    let uri = ResourceUri::from_local_path(path)
        .map(|uri| uri.as_str().to_string())
        .unwrap_or_else(|_| path.to_string_lossy().to_string());

    match error.kind() {
        std::io::ErrorKind::AlreadyExists => FileOperationError::DestinationConflict { uri },
        std::io::ErrorKind::NotFound => FileOperationError::NotFound { uri },
        std::io::ErrorKind::PermissionDenied => FileOperationError::PermissionDenied { uri },
        _ => FileOperationError::Io {
            code: error
                .raw_os_error()
                .map(|code| code.to_string())
                .unwrap_or_else(|| "io".to_string()),
            message: error.to_string(),
        },
    }
}
