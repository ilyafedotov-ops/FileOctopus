use std::fs::{self, File};
use std::path::Path;

use vfs::{
    FileKind, FileOperationConflict, FileOperationError, FileOperationItem, FileOperationRequest,
    FileOperationWarning, ResourceUri, REMOTE_SCHEMES,
};

use super::archive::sanitize_archive_entry_path;
use super::paths::{
    canonical_existing_path, file_kind, map_io_error, map_std_io_error, reject_self_or_descendant,
    require_existing_directory,
};
use crate::vfs_io::VfsFilesystem;

pub(super) fn plan_copy_or_move_items(
    vfs: &VfsFilesystem,
    request: &FileOperationRequest,
    warnings: &mut Vec<FileOperationWarning>,
) -> Result<Vec<FileOperationItem>, FileOperationError> {
    let destination_uri =
        request
            .destination
            .as_ref()
            .ok_or_else(|| FileOperationError::InvalidRequest {
                message: "operation requires a destination".to_string(),
            })?;

    if destination_uri.scheme() == "local" {
        let destination_dir = destination_uri.to_local_path()?;
        require_existing_directory(&destination_dir, destination_uri)?;
    } else if vfs.stat_kind(destination_uri)? != FileKind::Directory {
        return Err(FileOperationError::DestinationMissing {
            uri: destination_uri.as_str().to_string(),
        });
    }

    let mut items = Vec::new();

    for source in &request.sources {
        if source.scheme() == "local" && destination_uri.scheme() == "local" {
            let source_path = source.to_local_path()?;
            let source_path = canonical_existing_path(&source_path, source)?;
            let destination_dir = destination_uri.to_local_path()?;
            reject_self_or_descendant(request.kind, &source_path, &destination_dir)?;
            collect_copy_or_move_items(
                &source_path,
                &destination_dir,
                &source_path,
                &mut items,
                warnings,
            )?;
        } else {
            let mut source_items = vfs.collect_copy_items(source, destination_uri, warnings)?;
            items.append(&mut source_items);
        }
    }

    Ok(items)
}

pub(super) fn plan_rename_item(
    vfs: &VfsFilesystem,
    request: &FileOperationRequest,
) -> Result<FileOperationItem, FileOperationError> {
    let source = request.sources[0].clone();
    let new_name = request.new_name.as_ref().unwrap();
    let kind = vfs.stat_kind(&source)?;
    let destination_uri = if source.scheme() == "local" {
        let source_path = canonical_existing_path(&source.to_local_path()?, &source)?;
        let parent = source_path
            .parent()
            .ok_or_else(|| FileOperationError::InvalidRequest {
                message: "cannot rename filesystem root".to_string(),
            })?;
        ResourceUri::from_local_path(&parent.join(new_name))?
    } else {
        vfs.join_remote_parent(&source, new_name)?
    };
    let size = if kind == FileKind::File {
        vfs.file_size(&source).ok()
    } else {
        None
    };

    Ok(FileOperationItem {
        source: Some(source),
        destination: Some(destination_uri),
        kind,
        size,
        recursive: kind == FileKind::Directory,
    })
}

pub(super) fn plan_create_directory_item(
    vfs: &VfsFilesystem,
    request: &FileOperationRequest,
) -> Result<FileOperationItem, FileOperationError> {
    let destination = request.destination.as_ref().unwrap().clone();
    let name = if destination.scheme() == "local" {
        let destination_path = destination.to_local_path()?;
        let parent =
            destination_path
                .parent()
                .ok_or_else(|| FileOperationError::DestinationMissing {
                    uri: destination.as_str().to_string(),
                })?;
        super::validate_basename(
            destination_path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or_default(),
        )?;
        if destination.scheme() == "local" && !parent.is_dir() {
            return Err(FileOperationError::DestinationMissing {
                uri: destination.as_str().to_string(),
            });
        }
        destination_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_string()
    } else {
        destination
            .remote_path()
            .and_then(|path| {
                path.trim_end_matches('/')
                    .rsplit('/')
                    .next()
                    .map(str::to_string)
            })
            .unwrap_or_default()
    };
    super::validate_basename(&name)?;
    if REMOTE_SCHEMES.contains(&destination.scheme()) {
        let _ = vfs;
    }

    Ok(FileOperationItem {
        source: None,
        destination: Some(destination),
        kind: FileKind::Directory,
        size: None,
        recursive: false,
    })
}

pub(super) fn plan_create_file_item(
    vfs: &VfsFilesystem,
    request: &FileOperationRequest,
) -> Result<FileOperationItem, FileOperationError> {
    let destination = request.destination.as_ref().unwrap().clone();
    if destination.scheme() == "local" {
        let destination_path = destination.to_local_path()?;
        let parent =
            destination_path
                .parent()
                .ok_or_else(|| FileOperationError::DestinationMissing {
                    uri: destination.as_str().to_string(),
                })?;
        super::validate_basename(
            destination_path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or_default(),
        )?;
        if !parent.is_dir() {
            return Err(FileOperationError::DestinationMissing {
                uri: destination.as_str().to_string(),
            });
        }
    } else {
        let _ = vfs;
    }

    Ok(FileOperationItem {
        source: None,
        destination: Some(destination),
        kind: FileKind::File,
        size: Some(0),
        recursive: false,
    })
}

pub(super) fn plan_delete_items(
    vfs: &VfsFilesystem,
    request: &FileOperationRequest,
) -> Result<Vec<FileOperationItem>, FileOperationError> {
    request
        .sources
        .iter()
        .map(|source| {
            let kind = vfs.stat_kind(source)?;
            let size = if kind == FileKind::File {
                vfs.file_size(source).ok()
            } else {
                None
            };

            Ok(FileOperationItem {
                source: Some(source.clone()),
                destination: None,
                kind,
                size,
                recursive: kind == FileKind::Directory,
            })
        })
        .collect()
}

pub(super) fn plan_create_archive_items(
    request: &FileOperationRequest,
    warnings: &mut Vec<FileOperationWarning>,
) -> Result<Vec<FileOperationItem>, FileOperationError> {
    let destination = request.destination.as_ref().unwrap().clone();
    let destination_path = destination.to_local_path()?;

    if let Some(parent) = destination_path.parent() {
        if !parent.exists() {
            return Err(FileOperationError::DestinationMissing {
                uri: destination.as_str().to_string(),
            });
        }
    }

    let mut items = Vec::new();

    for source in &request.sources {
        let source_path = source.to_local_path()?;
        let source_path = canonical_existing_path(&source_path, source)?;
        collect_archive_files(&source_path, &destination, &mut items, warnings)?;
    }

    Ok(items)
}

pub(super) fn plan_extract_archive_items(
    request: &FileOperationRequest,
) -> Result<Vec<FileOperationItem>, FileOperationError> {
    let source = request.sources[0].clone();
    let source_path = canonical_existing_path(&source.to_local_path()?, &source)?;
    let destination = request.destination.as_ref().unwrap().clone();
    let destination_path = destination.to_local_path()?;

    if destination_path.exists() && !destination_path.is_dir() {
        return Err(FileOperationError::DestinationConflict {
            uri: destination.as_str().to_string(),
        });
    }

    let file = File::open(&source_path).map_err(|error| map_std_io_error(&source_path, error))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|error| FileOperationError::io(format!("failed to read archive: {error}")))?;
    let mut items = Vec::new();

    for index in 0..archive.len() {
        let entry = archive.by_index(index).map_err(|error| {
            FileOperationError::io(format!("failed to read archive entry {index}: {error}"))
        })?;
        let entry_name = entry.name().to_string();

        if entry_name.ends_with('/') {
            continue;
        }

        let target_path = sanitize_archive_entry_path(&entry_name, &destination_path)?;
        let target_uri = ResourceUri::from_local_path(&target_path)?;

        items.push(FileOperationItem {
            source: Some(source.clone()),
            destination: Some(target_uri),
            kind: FileKind::File,
            size: Some(entry.size()),
            recursive: false,
        });
    }

    Ok(items)
}

pub(crate) fn collect_copy_or_move_items(
    path: &Path,
    destination_dir: &Path,
    root: &Path,
    items: &mut Vec<FileOperationItem>,
    warnings: &mut Vec<FileOperationWarning>,
) -> Result<(), FileOperationError> {
    let uri = ResourceUri::from_local_path(path)?;
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) => {
            warnings.push(FileOperationWarning::metadata_failed(
                error.to_string(),
                uri,
            ));
            return Ok(());
        }
    };
    let relative = path.strip_prefix(root).unwrap_or(path);
    let root_name = root
        .file_name()
        .ok_or_else(|| FileOperationError::InvalidRequest {
            message: "source must have a basename".to_string(),
        })?;
    let destination = if relative.as_os_str().is_empty() {
        destination_dir.join(root_name)
    } else {
        destination_dir.join(root_name).join(relative)
    };

    items.push(FileOperationItem {
        source: Some(ResourceUri::from_local_path(path)?),
        destination: Some(ResourceUri::from_local_path(&destination)?),
        kind: file_kind(&metadata),
        size: metadata.is_file().then_some(metadata.len()),
        recursive: metadata.is_dir(),
    });

    if metadata.is_dir() {
        let path_uri = ResourceUri::from_local_path(path)?;
        let mut children = fs::read_dir(path)
            .map_err(|error| map_io_error(&path_uri, error))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| map_io_error(&path_uri, error))?;

        children.sort_by_key(|entry| entry.path());

        for child in children {
            collect_copy_or_move_items(&child.path(), destination_dir, root, items, warnings)?;
        }
    }

    Ok(())
}

pub(super) fn detect_conflicts(
    vfs: &VfsFilesystem,
    items: &[FileOperationItem],
) -> Vec<FileOperationConflict> {
    items
        .iter()
        .filter_map(|item| {
            let source = item.source.clone()?;
            let destination = item.destination.clone()?;

            vfs.exists(&destination)
                .ok()
                .filter(|exists| *exists)
                .map(|_| FileOperationConflict {
                    source,
                    destination,
                })
        })
        .collect()
}

pub(super) fn collect_archive_files(
    path: &Path,
    archive_destination: &ResourceUri,
    items: &mut Vec<FileOperationItem>,
    warnings: &mut Vec<FileOperationWarning>,
) -> Result<(), FileOperationError> {
    let uri = ResourceUri::from_local_path(path)?;
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) => {
            warnings.push(FileOperationWarning::metadata_failed(
                error.to_string(),
                uri,
            ));
            return Ok(());
        }
    };

    if metadata.is_dir() {
        let path_uri = ResourceUri::from_local_path(path)?;
        let mut children = fs::read_dir(path)
            .map_err(|error| map_io_error(&path_uri, error))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| map_io_error(&path_uri, error))?;

        children.sort_by_key(|entry| entry.path());

        for child in children {
            collect_archive_files(&child.path(), archive_destination, items, warnings)?;
        }

        return Ok(());
    }

    if metadata.file_type().is_symlink() {
        return Err(FileOperationError::UnsupportedSymlink {
            uri: uri.as_str().to_string(),
            message: "copying symlink objects into archives is not supported in the MVP"
                .to_string(),
        });
    }

    items.push(FileOperationItem {
        source: Some(uri),
        destination: Some(archive_destination.clone()),
        kind: FileKind::File,
        size: Some(metadata.len()),
        recursive: false,
    });

    Ok(())
}
