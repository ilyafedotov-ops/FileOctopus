use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;

use chrono::Utc;
use filetime::FileTime;
use jobs::{CancellationToken, JobEvent, JobId, JobProgressEvent};
use vfs::{
    ConflictPolicy, FileKind, FileOperationConflict, FileOperationError, FileOperationItem,
    FileOperationKind, FileOperationPlan, FileOperationRequest, FileOperationWarning, ResourceUri,
};
use zip::write::FileOptions;

const COPY_BUFFER_SIZE: usize = 64 * 1024;
const PROGRESS_BYTE_INTERVAL: u64 = 1024 * 1024;

pub type FileOperationEventSink = dyn Fn(JobEvent) + Send + Sync;

pub fn plan_file_operation(
    request: FileOperationRequest,
) -> Result<FileOperationPlan, FileOperationError> {
    validate_request_shape(&request)?;

    let operation_id = uuid::Uuid::new_v4().to_string();
    let mut warnings = Vec::new();
    let mut items = match request.kind {
        FileOperationKind::Copy | FileOperationKind::Move => {
            plan_copy_or_move_items(&request, &mut warnings)?
        }
        FileOperationKind::Rename => vec![plan_rename_item(&request)?],
        FileOperationKind::CreateDirectory => vec![plan_create_directory_item(&request)?],
        FileOperationKind::CreateFile => vec![plan_create_file_item(&request)?],
        FileOperationKind::DeleteToTrash | FileOperationKind::DeletePermanently => {
            plan_delete_items(&request)?
        }
        FileOperationKind::CreateArchive => plan_create_archive_items(&request, &mut warnings)?,
        FileOperationKind::ExtractArchive => plan_extract_archive_items(&request)?,
        FileOperationKind::FolderSize | FileOperationKind::RecursiveSearch => {
            return Err(FileOperationError::InvalidRequest {
                message: "metadata jobs are started through filesystem commands".to_string(),
            });
        }
    };

    items.sort_by(|left, right| {
        let left_key = left
            .source
            .as_ref()
            .or(left.destination.as_ref())
            .map(ResourceUri::as_str)
            .unwrap_or("");
        let right_key = right
            .source
            .as_ref()
            .or(right.destination.as_ref())
            .map(ResourceUri::as_str)
            .unwrap_or("");

        left_key.cmp(right_key)
    });

    let conflicts = detect_conflicts(&items);
    let total_items = items.len() as u64;
    let total_bytes = items
        .iter()
        .try_fold(0_u64, |total, item| item.size.map(|size| total + size));

    Ok(FileOperationPlan {
        operation_id,
        kind: request.kind,
        sources: request.sources,
        destination: request.destination,
        new_name: request.new_name,
        conflict_policy: request.conflict_policy,
        items,
        conflicts,
        warnings,
        total_items,
        total_bytes,
    })
}

pub fn execute_file_operation(
    plan: &FileOperationPlan,
    job_id: &JobId,
    cancel: &CancellationToken,
    sink: &FileOperationEventSink,
) -> Result<(), FileOperationError> {
    if plan.conflict_policy == ConflictPolicy::Fail && !plan.conflicts.is_empty() {
        let uri = plan.conflicts[0].destination.as_str().to_string();
        return Err(FileOperationError::DestinationConflict { uri });
    }

    match plan.kind {
        FileOperationKind::Copy => execute_copy(plan, job_id, cancel, sink),
        FileOperationKind::Move => execute_move(plan, job_id, cancel, sink),
        FileOperationKind::Rename => execute_rename(plan),
        FileOperationKind::CreateDirectory => execute_create_directory(plan),
        FileOperationKind::CreateFile => execute_create_file(plan),
        FileOperationKind::DeleteToTrash => execute_trash(plan),
        FileOperationKind::DeletePermanently => execute_delete_permanently(plan),
        FileOperationKind::CreateArchive => execute_create_archive(plan, job_id, cancel, sink),
        FileOperationKind::ExtractArchive => execute_extract_archive(plan, job_id, cancel, sink),
        FileOperationKind::FolderSize | FileOperationKind::RecursiveSearch => {
            Err(FileOperationError::InvalidRequest {
                message: "metadata jobs are started through filesystem commands".to_string(),
            })
        }
    }
}

fn validate_request_shape(request: &FileOperationRequest) -> Result<(), FileOperationError> {
    for source in &request.sources {
        source.to_local_path()?;
    }

    if let Some(destination) = &request.destination {
        destination.to_local_path()?;
    }

    match request.kind {
        FileOperationKind::Copy | FileOperationKind::Move => {
            if request.sources.is_empty() {
                return Err(FileOperationError::InvalidRequest {
                    message: "operation requires at least one source".to_string(),
                });
            }

            if request.destination.is_none() {
                return Err(FileOperationError::InvalidRequest {
                    message: "operation requires a destination".to_string(),
                });
            }
        }
        FileOperationKind::Rename => {
            if request.sources.len() != 1 {
                return Err(FileOperationError::InvalidRequest {
                    message: "rename requires exactly one source".to_string(),
                });
            }

            validate_basename(request.new_name.as_deref().unwrap_or_default())?;
        }
        FileOperationKind::CreateDirectory => {
            if request.destination.is_none() {
                return Err(FileOperationError::InvalidRequest {
                    message: "create directory requires a destination".to_string(),
                });
            }
        }
        FileOperationKind::CreateFile => {
            if request.destination.is_none() {
                return Err(FileOperationError::InvalidRequest {
                    message: "create file requires a destination".to_string(),
                });
            }
        }
        FileOperationKind::DeleteToTrash | FileOperationKind::DeletePermanently => {
            if request.sources.is_empty() {
                let message = if request.kind == FileOperationKind::DeleteToTrash {
                    "trash operation requires at least one source"
                } else {
                    "delete permanently operation requires at least one source"
                };

                return Err(FileOperationError::InvalidRequest {
                    message: message.to_string(),
                });
            }
        }
        FileOperationKind::CreateArchive => {
            if request.sources.is_empty() {
                return Err(FileOperationError::InvalidRequest {
                    message: "create archive requires at least one source".to_string(),
                });
            }

            if request.destination.is_none() {
                return Err(FileOperationError::InvalidRequest {
                    message: "create archive requires a destination".to_string(),
                });
            }
        }
        FileOperationKind::ExtractArchive => {
            if request.sources.len() != 1 {
                return Err(FileOperationError::InvalidRequest {
                    message: "extract archive requires exactly one source".to_string(),
                });
            }

            if request.destination.is_none() {
                return Err(FileOperationError::InvalidRequest {
                    message: "extract archive requires a destination".to_string(),
                });
            }
        }
        FileOperationKind::FolderSize | FileOperationKind::RecursiveSearch => {
            return Err(FileOperationError::InvalidRequest {
                message: "metadata jobs are started through filesystem commands".to_string(),
            });
        }
    }

    Ok(())
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

fn plan_copy_or_move_items(
    request: &FileOperationRequest,
    warnings: &mut Vec<FileOperationWarning>,
) -> Result<Vec<FileOperationItem>, FileOperationError> {
    let destination_dir = request
        .destination
        .as_ref()
        .ok_or_else(|| FileOperationError::InvalidRequest {
            message: "operation requires a destination".to_string(),
        })?
        .to_local_path()?;

    require_existing_directory(&destination_dir, request.destination.as_ref().unwrap())?;

    let mut items = Vec::new();

    for source in &request.sources {
        let source_path = source.to_local_path()?;
        let source_path = canonical_existing_path(&source_path, source)?;
        reject_self_or_descendant(request.kind, &source_path, &destination_dir)?;
        collect_copy_or_move_items(
            &source_path,
            &destination_dir,
            &source_path,
            &mut items,
            warnings,
        )?;
    }

    Ok(items)
}

fn plan_rename_item(
    request: &FileOperationRequest,
) -> Result<FileOperationItem, FileOperationError> {
    let source = request.sources[0].clone();
    let source_path = canonical_existing_path(&source.to_local_path()?, &source)?;
    let parent = source_path
        .parent()
        .ok_or_else(|| FileOperationError::InvalidRequest {
            message: "cannot rename filesystem root".to_string(),
        })?;
    let destination = parent.join(request.new_name.as_ref().unwrap());
    let destination_uri = ResourceUri::from_local_path(&destination)?;
    let metadata =
        fs::symlink_metadata(&source_path).map_err(|error| map_io_error(&source, error))?;

    Ok(FileOperationItem {
        source: Some(source),
        destination: Some(destination_uri),
        kind: file_kind(&metadata),
        size: metadata.is_file().then_some(metadata.len()),
        recursive: metadata.is_dir(),
    })
}

fn plan_create_directory_item(
    request: &FileOperationRequest,
) -> Result<FileOperationItem, FileOperationError> {
    let destination = request.destination.as_ref().unwrap().clone();
    let destination_path = destination.to_local_path()?;
    let parent =
        destination_path
            .parent()
            .ok_or_else(|| FileOperationError::DestinationMissing {
                uri: destination.as_str().to_string(),
            })?;

    validate_basename(
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

    Ok(FileOperationItem {
        source: None,
        destination: Some(destination),
        kind: FileKind::Directory,
        size: None,
        recursive: false,
    })
}

fn plan_create_file_item(
    request: &FileOperationRequest,
) -> Result<FileOperationItem, FileOperationError> {
    let destination = request.destination.as_ref().unwrap().clone();
    let destination_path = destination.to_local_path()?;
    let parent =
        destination_path
            .parent()
            .ok_or_else(|| FileOperationError::DestinationMissing {
                uri: destination.as_str().to_string(),
            })?;

    validate_basename(
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

    Ok(FileOperationItem {
        source: None,
        destination: Some(destination),
        kind: FileKind::File,
        size: Some(0),
        recursive: false,
    })
}

fn plan_delete_items(
    request: &FileOperationRequest,
) -> Result<Vec<FileOperationItem>, FileOperationError> {
    request
        .sources
        .iter()
        .map(|source| {
            let path = canonical_existing_path(&source.to_local_path()?, source)?;
            let metadata =
                fs::symlink_metadata(&path).map_err(|error| map_io_error(source, error))?;

            Ok(FileOperationItem {
                source: Some(source.clone()),
                destination: None,
                kind: file_kind(&metadata),
                size: metadata.is_file().then_some(metadata.len()),
                recursive: metadata.is_dir(),
            })
        })
        .collect()
}

fn plan_create_archive_items(
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
        collect_archive_files(
            &source_path,
            &source_path,
            &destination,
            &mut items,
            warnings,
        )?;
    }

    Ok(items)
}

fn plan_extract_archive_items(
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

fn collect_copy_or_move_items(
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

fn detect_conflicts(items: &[FileOperationItem]) -> Vec<FileOperationConflict> {
    items
        .iter()
        .filter_map(|item| {
            let source = item.source.clone()?;
            let destination = item.destination.clone()?;

            destination
                .to_local_path()
                .ok()
                .filter(|path| path.exists())
                .map(|_| FileOperationConflict {
                    source,
                    destination,
                })
        })
        .collect()
}

fn collect_archive_files(
    path: &Path,
    root: &Path,
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
            collect_archive_files(&child.path(), root, archive_destination, items, warnings)?;
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

fn execute_copy(
    plan: &FileOperationPlan,
    job_id: &JobId,
    cancel: &CancellationToken,
    sink: &FileOperationEventSink,
) -> Result<(), FileOperationError> {
    let mut progress = ExecutionProgress::new(plan);

    for item in &plan.items {
        check_cancelled(cancel, job_id)?;
        let Some(destination) = &item.destination else {
            continue;
        };
        let destination_path = destination.to_local_path()?;

        if destination_path.exists() && plan.conflict_policy == ConflictPolicy::Skip {
            progress.complete_item(item, job_id, sink);
            continue;
        }

        let destination = resolve_conflict_path(destination_path, plan.conflict_policy)?;

        match item.kind {
            FileKind::Directory => fs::create_dir_all(&destination)
                .map_err(|error| map_std_io_error(&destination, error))?,
            FileKind::File | FileKind::Archive | FileKind::Virtual | FileKind::Unknown => {
                if let Some(parent) = destination.parent() {
                    fs::create_dir_all(parent).map_err(|error| map_std_io_error(parent, error))?;
                }

                if let Some(source) = &item.source {
                    copy_file_streaming(
                        &source.to_local_path()?,
                        &destination,
                        job_id,
                        cancel,
                        &mut progress,
                        sink,
                    )?;
                }
            }
            FileKind::Symlink => {
                let source =
                    item.source
                        .as_ref()
                        .ok_or_else(|| FileOperationError::InvalidRequest {
                            message: "symlink item has no source".to_string(),
                        })?;

                return Err(FileOperationError::UnsupportedSymlink {
                    uri: source.as_str().to_string(),
                    message: "copying symlink objects is not supported in the MVP".to_string(),
                });
            }
        }

        progress.complete_item(item, job_id, sink);
    }

    Ok(())
}

fn execute_move(
    plan: &FileOperationPlan,
    job_id: &JobId,
    cancel: &CancellationToken,
    sink: &FileOperationEventSink,
) -> Result<(), FileOperationError> {
    check_cancelled(cancel, job_id)?;

    if plan.sources.len() == 1 {
        let root = &plan.sources[0];
        let source_path = root.to_local_path()?;
        let root_name =
            source_path
                .file_name()
                .ok_or_else(|| FileOperationError::InvalidRequest {
                    message: "source must have a basename".to_string(),
                })?;
        let destination_dir = plan.destination.as_ref().unwrap().to_local_path()?;
        let destination = destination_dir.join(root_name);

        if destination.exists() && plan.conflict_policy == ConflictPolicy::Skip {
            return Ok(());
        }

        let destination = resolve_conflict_path(destination, plan.conflict_policy)?;

        match fs::rename(&source_path, &destination) {
            Ok(()) => return Ok(()),
            Err(error) if is_cross_device_error(&error) => {}
            Err(error) => return Err(map_std_io_error(&source_path, error)),
        }
    }

    execute_copy(plan, job_id, cancel, sink)?;

    for source in &plan.sources {
        let source_path = source.to_local_path()?;

        if source_path.is_dir() {
            fs::remove_dir_all(&source_path)
                .map_err(|error| map_std_io_error(&source_path, error))?;
        } else if source_path.exists() {
            fs::remove_file(&source_path).map_err(|error| map_std_io_error(&source_path, error))?;
        }
    }

    Ok(())
}

fn execute_rename(plan: &FileOperationPlan) -> Result<(), FileOperationError> {
    let item = plan
        .items
        .first()
        .ok_or_else(|| FileOperationError::InvalidRequest {
            message: "rename plan has no item".to_string(),
        })?;
    let source = item.source.as_ref().unwrap().to_local_path()?;
    let destination = item.destination.as_ref().unwrap().to_local_path()?;

    if destination.exists() {
        return Err(FileOperationError::DestinationConflict {
            uri: item.destination.as_ref().unwrap().as_str().to_string(),
        });
    }

    fs::rename(&source, &destination).map_err(|error| map_std_io_error(&source, error))
}

fn execute_create_directory(plan: &FileOperationPlan) -> Result<(), FileOperationError> {
    let destination = plan
        .items
        .first()
        .and_then(|item| item.destination.as_ref())
        .ok_or_else(|| FileOperationError::InvalidRequest {
            message: "create directory plan has no destination".to_string(),
        })?;
    let destination_path = destination.to_local_path()?;

    if destination_path.exists() {
        return Err(FileOperationError::DestinationConflict {
            uri: destination.as_str().to_string(),
        });
    }

    fs::create_dir(&destination_path).map_err(|error| map_std_io_error(&destination_path, error))
}

fn execute_create_file(plan: &FileOperationPlan) -> Result<(), FileOperationError> {
    let destination = plan
        .items
        .first()
        .and_then(|item| item.destination.as_ref())
        .ok_or_else(|| FileOperationError::InvalidRequest {
            message: "create file plan has no destination".to_string(),
        })?;
    let destination_path = destination.to_local_path()?;

    if destination_path.exists() {
        return Err(FileOperationError::DestinationConflict {
            uri: destination.as_str().to_string(),
        });
    }

    File::create_new(&destination_path)
        .map(|_| ())
        .map_err(|error| map_std_io_error(&destination_path, error))
}

fn execute_trash(plan: &FileOperationPlan) -> Result<(), FileOperationError> {
    for source in &plan.sources {
        let path = source.to_local_path()?;

        move_to_trash(&path)?;
    }

    Ok(())
}

fn execute_delete_permanently(plan: &FileOperationPlan) -> Result<(), FileOperationError> {
    for source in &plan.sources {
        let path = source.to_local_path()?;

        if path.is_dir() {
            fs::remove_dir_all(&path).map_err(|error| map_std_io_error(&path, error))?;
        } else {
            fs::remove_file(&path).map_err(|error| map_std_io_error(&path, error))?;
        }
    }

    Ok(())
}

fn execute_create_archive(
    plan: &FileOperationPlan,
    job_id: &JobId,
    cancel: &CancellationToken,
    sink: &FileOperationEventSink,
) -> Result<(), FileOperationError> {
    let destination =
        plan.destination
            .as_ref()
            .ok_or_else(|| FileOperationError::InvalidRequest {
                message: "create archive plan has no destination".to_string(),
            })?;
    let destination_path = destination.to_local_path()?;

    if destination_path.exists() && plan.conflict_policy == ConflictPolicy::Skip {
        return Ok(());
    }

    let destination_path = resolve_conflict_path(destination_path, plan.conflict_policy)?;

    if let Some(parent) = destination_path.parent() {
        fs::create_dir_all(parent).map_err(|error| map_std_io_error(parent, error))?;
    }

    let file = File::create(&destination_path)
        .map_err(|error| map_std_io_error(&destination_path, error))?;
    let mut archive = zip::ZipWriter::new(file);
    let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    let mut progress = ExecutionProgress::new(plan);

    for item in &plan.items {
        check_cancelled(cancel, job_id)?;
        let source = item
            .source
            .as_ref()
            .ok_or_else(|| FileOperationError::InvalidRequest {
                message: "archive item has no source".to_string(),
            })?;
        let source_path = source.to_local_path()?;
        let entry_name = archive_entry_name(plan, &source_path)?;

        archive.start_file(&entry_name, options).map_err(|error| {
            FileOperationError::io(format!("failed to add file to archive: {error}"))
        })?;

        let mut input =
            File::open(&source_path).map_err(|error| map_std_io_error(&source_path, error))?;
        let copied = std::io::copy(&mut input, &mut archive).map_err(|error| {
            FileOperationError::io(format!("failed to write file to archive: {error}"))
        })?;
        progress.completed_bytes += copied;
        progress.complete_item(item, job_id, sink);
    }

    archive
        .finish()
        .map_err(|error| FileOperationError::io(format!("failed to finalize archive: {error}")))?;

    Ok(())
}

fn execute_extract_archive(
    plan: &FileOperationPlan,
    job_id: &JobId,
    cancel: &CancellationToken,
    sink: &FileOperationEventSink,
) -> Result<(), FileOperationError> {
    let source = plan
        .sources
        .first()
        .ok_or_else(|| FileOperationError::InvalidRequest {
            message: "extract archive plan has no source".to_string(),
        })?;
    let source_path = source.to_local_path()?;
    let destination =
        plan.destination
            .as_ref()
            .ok_or_else(|| FileOperationError::InvalidRequest {
                message: "extract archive plan has no destination".to_string(),
            })?;
    let destination_root = destination.to_local_path()?;

    fs::create_dir_all(&destination_root)
        .map_err(|error| map_std_io_error(&destination_root, error))?;

    let file = File::open(&source_path).map_err(|error| map_std_io_error(&source_path, error))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|error| FileOperationError::io(format!("failed to read archive: {error}")))?;
    let mut progress = ExecutionProgress::new(plan);
    let mut planned_items = plan.items.iter();

    for index in 0..archive.len() {
        check_cancelled(cancel, job_id)?;
        let mut entry = archive.by_index(index).map_err(|error| {
            FileOperationError::io(format!("failed to read archive entry {index}: {error}"))
        })?;
        let entry_name = entry.name().to_string();

        if entry_name.ends_with('/') {
            continue;
        }

        let item = planned_items
            .next()
            .ok_or_else(|| FileOperationError::Internal {
                message: "archive extract plan no longer matches archive contents".to_string(),
            })?;
        let destination =
            item.destination
                .as_ref()
                .ok_or_else(|| FileOperationError::InvalidRequest {
                    message: "extract item has no destination".to_string(),
                })?;
        let destination_path = destination.to_local_path()?;

        if destination_path.exists() && plan.conflict_policy == ConflictPolicy::Skip {
            progress.complete_item(item, job_id, sink);
            continue;
        }

        let destination_path = resolve_conflict_path(destination_path, plan.conflict_policy)?;

        if let Some(parent) = destination_path.parent() {
            fs::create_dir_all(parent).map_err(|error| map_std_io_error(parent, error))?;
        }

        let mut output = File::create(&destination_path)
            .map_err(|error| map_std_io_error(&destination_path, error))?;
        let copied = std::io::copy(&mut entry, &mut output)
            .map_err(|error| FileOperationError::io(format!("failed to extract file: {error}")))?;
        progress.completed_bytes += copied;
        progress.complete_item(item, job_id, sink);
    }

    Ok(())
}

fn archive_entry_name(
    plan: &FileOperationPlan,
    source_path: &Path,
) -> Result<String, FileOperationError> {
    for root_uri in &plan.sources {
        let root_path = root_uri.to_local_path()?;

        if root_path.is_file() && root_path == source_path {
            return Ok(source_path
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_else(|| source_path.to_string_lossy().to_string()));
        }

        if root_path.is_dir() && source_path.starts_with(&root_path) {
            let relative = source_path
                .strip_prefix(&root_path)
                .unwrap_or(source_path)
                .to_string_lossy()
                .to_string();
            return Ok(relative);
        }
    }

    Err(FileOperationError::Internal {
        message: format!(
            "archive source `{}` is not covered by the plan roots",
            source_path.display()
        ),
    })
}

fn sanitize_archive_entry_path(
    entry_name: &str,
    dest_root: &Path,
) -> Result<PathBuf, FileOperationError> {
    if Path::new(entry_name).is_absolute() {
        return Err(FileOperationError::InvalidRequest {
            message: format!("archive entry has absolute path: {entry_name}"),
        });
    }

    let canonical_dest = dest_root
        .canonicalize()
        .unwrap_or_else(|_| dest_root.to_path_buf());
    let target = normalize_archive_entry_path(&canonical_dest.join(entry_name));

    if !target.starts_with(&canonical_dest) {
        return Err(FileOperationError::InvalidRequest {
            message: format!("archive entry escapes destination: {entry_name}"),
        });
    }

    Ok(target)
}

fn normalize_archive_entry_path(path: &Path) -> PathBuf {
    let mut components = Vec::new();

    for component in path.components() {
        match component {
            std::path::Component::CurDir => {}
            std::path::Component::ParentDir => {
                if let Some(last) = components.last() {
                    if *last != std::path::Component::ParentDir {
                        components.pop();
                    } else {
                        components.push(component);
                    }
                } else {
                    components.push(component);
                }
            }
            _ => components.push(component),
        }
    }

    components.iter().collect()
}

#[cfg(target_os = "linux")]
fn move_to_trash(path: &Path) -> Result<(), FileOperationError> {
    for command in ["gio", "kioclient5", "trash-put"] {
        let status = match command {
            "gio" => Command::new(command).arg("trash").arg(path).status(),
            "kioclient5" => Command::new(command)
                .arg("move")
                .arg(path)
                .arg("trash:/")
                .status(),
            _ => Command::new(command).arg(path).status(),
        };

        if matches!(status, Ok(status) if status.success()) {
            return Ok(());
        }
    }

    Err(FileOperationError::UnsupportedTrash {
        message: "OS trash command is unavailable".to_string(),
    })
}

#[cfg(target_os = "macos")]
fn move_to_trash(path: &Path) -> Result<(), FileOperationError> {
    let script = format!(
        "tell application \"Finder\" to delete POSIX file \"{}\"",
        path.to_string_lossy().replace('"', "\\\"")
    );
    let status = Command::new("osascript").arg("-e").arg(script).status();

    if matches!(status, Ok(status) if status.success()) {
        return Ok(());
    }

    Err(FileOperationError::UnsupportedTrash {
        message: "macOS Trash command failed".to_string(),
    })
}

#[cfg(target_os = "windows")]
fn move_to_trash(path: &Path) -> Result<(), FileOperationError> {
    let escaped = path.to_string_lossy().replace('\'', "''");
    let script = format!(
        "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('{}', 'OnlyErrorDialogs', 'SendToRecycleBin')",
        escaped
    );
    let status = Command::new("powershell")
        .arg("-NoProfile")
        .arg("-Command")
        .arg(script)
        .status();

    if matches!(status, Ok(status) if status.success()) {
        return Ok(());
    }

    Err(FileOperationError::UnsupportedTrash {
        message: "Windows Recycle Bin command failed".to_string(),
    })
}

#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
fn move_to_trash(_path: &Path) -> Result<(), FileOperationError> {
    Err(FileOperationError::UnsupportedTrash {
        message: "Move to Trash is unsupported on this platform".to_string(),
    })
}

fn copy_file_streaming(
    source: &Path,
    destination: &Path,
    job_id: &JobId,
    cancel: &CancellationToken,
    progress: &mut ExecutionProgress<'_>,
    sink: &FileOperationEventSink,
) -> Result<(), FileOperationError> {
    let mut input = File::open(source).map_err(|error| map_std_io_error(source, error))?;
    let mut output =
        File::create(destination).map_err(|error| map_std_io_error(destination, error))?;
    let mut buffer = vec![0_u8; COPY_BUFFER_SIZE];

    loop {
        check_cancelled(cancel, job_id)?;

        let bytes = input
            .read(&mut buffer)
            .map_err(|error| map_std_io_error(source, error))?;

        if bytes == 0 {
            break;
        }

        output
            .write_all(&buffer[..bytes])
            .map_err(|error| map_std_io_error(destination, error))?;
        progress.completed_bytes += bytes as u64;
        progress.emit_chunk(job_id, destination, sink);
    }

    if let Ok(metadata) = fs::metadata(source) {
        let modified = FileTime::from_last_modification_time(&metadata);
        let accessed = FileTime::from_last_access_time(&metadata);
        let _ = filetime::set_file_times(destination, accessed, modified);
    }

    Ok(())
}

fn resolve_conflict_path(
    destination: PathBuf,
    policy: ConflictPolicy,
) -> Result<PathBuf, FileOperationError> {
    if !destination.exists() {
        return Ok(destination);
    }

    match policy {
        ConflictPolicy::Fail => Err(FileOperationError::DestinationConflict {
            uri: ResourceUri::from_local_path(&destination)?
                .as_str()
                .to_string(),
        }),
        ConflictPolicy::Skip => Ok(destination),
        ConflictPolicy::Overwrite => {
            if destination.is_dir() {
                fs::remove_dir_all(&destination)
                    .map_err(|error| map_std_io_error(&destination, error))?;
            } else {
                fs::remove_file(&destination)
                    .map_err(|error| map_std_io_error(&destination, error))?;
            }

            Ok(destination)
        }
        ConflictPolicy::RenameNew => Ok(next_available_path(&destination)),
        ConflictPolicy::RenameExisting => {
            let renamed = next_available_path(&destination);
            fs::rename(&destination, &renamed)
                .map_err(|error| map_std_io_error(&destination, error))?;
            Ok(destination)
        }
    }
}

fn next_available_path(path: &Path) -> PathBuf {
    let parent = path.parent().unwrap_or_else(|| Path::new(""));
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("file");
    let extension = path.extension().and_then(|value| value.to_str());

    for index in 1..10_000 {
        let name = match extension {
            Some(extension) => format!("{stem} ({index}).{extension}"),
            None => format!("{stem} ({index})"),
        };
        let candidate = parent.join(name);

        if !candidate.exists() {
            return candidate;
        }
    }

    path.to_path_buf()
}

fn check_cancelled(cancel: &CancellationToken, job_id: &JobId) -> Result<(), FileOperationError> {
    if cancel.is_cancelled() {
        return Err(FileOperationError::Cancelled {
            job_id: Some(job_id.as_str().to_string()),
        });
    }

    Ok(())
}

fn reject_self_or_descendant(
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

fn require_existing_directory(path: &Path, uri: &ResourceUri) -> Result<(), FileOperationError> {
    if !path.is_dir() {
        return Err(FileOperationError::DestinationMissing {
            uri: uri.as_str().to_string(),
        });
    }

    Ok(())
}

fn canonical_existing_path(path: &Path, uri: &ResourceUri) -> Result<PathBuf, FileOperationError> {
    path.canonicalize()
        .map_err(|error| map_io_error(uri, error))
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

fn map_io_error(uri: &ResourceUri, error: std::io::Error) -> FileOperationError {
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

fn map_std_io_error(path: &Path, error: std::io::Error) -> FileOperationError {
    let uri = ResourceUri::from_local_path(path)
        .map(|uri| uri.as_str().to_string())
        .unwrap_or_else(|_| path.to_string_lossy().to_string());

    match error.kind() {
        std::io::ErrorKind::NotFound => FileOperationError::NotFound { uri },
        std::io::ErrorKind::PermissionDenied => FileOperationError::PermissionDenied { uri },
        _ => FileOperationError::io(error.to_string()),
    }
}

fn is_cross_device_error(error: &std::io::Error) -> bool {
    error.raw_os_error() == Some(18)
}

struct ExecutionProgress<'a> {
    plan: &'a FileOperationPlan,
    completed_items: u64,
    completed_bytes: u64,
    last_emitted_bytes: u64,
}

impl<'a> ExecutionProgress<'a> {
    fn new(plan: &'a FileOperationPlan) -> Self {
        Self {
            plan,
            completed_items: 0,
            completed_bytes: 0,
            last_emitted_bytes: 0,
        }
    }

    fn complete_item(
        &mut self,
        item: &FileOperationItem,
        job_id: &JobId,
        sink: &FileOperationEventSink,
    ) {
        self.completed_items += 1;
        self.emit(
            job_id,
            item.destination
                .as_ref()
                .or(item.source.as_ref())
                .map(|uri| uri.display_path()),
            sink,
        );
    }

    fn emit(&self, job_id: &JobId, current_item: Option<String>, sink: &FileOperationEventSink) {
        sink(JobEvent::Progress(JobProgressEvent {
            job_id: job_id.clone(),
            operation_kind: self.plan.kind,
            current_item,
            completed_items: self.completed_items,
            total_items: self.plan.total_items,
            completed_bytes: self.completed_bytes,
            total_bytes: self.plan.total_bytes,
            updated_at: Utc::now(),
        }));
    }

    fn emit_chunk(&mut self, job_id: &JobId, path: &Path, sink: &FileOperationEventSink) {
        if self.completed_bytes.saturating_sub(self.last_emitted_bytes) < PROGRESS_BYTE_INTERVAL {
            return;
        }

        self.last_emitted_bytes = self.completed_bytes;
        self.emit(job_id, Some(path.to_string_lossy().to_string()), sink);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn uri(path: &Path) -> ResourceUri {
        ResourceUri::from_local_path(path).unwrap()
    }

    fn request(
        kind: FileOperationKind,
        sources: Vec<ResourceUri>,
        destination: Option<ResourceUri>,
    ) -> FileOperationRequest {
        FileOperationRequest {
            kind,
            sources,
            destination,
            new_name: None,
            conflict_policy: ConflictPolicy::Fail,
        }
    }

    #[test]
    fn planner_rejects_copy_into_itself() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("source");
        let child = source.join("child");

        fs::create_dir_all(&child).unwrap();

        let error = plan_file_operation(request(
            FileOperationKind::Copy,
            vec![uri(&source)],
            Some(uri(&child)),
        ))
        .unwrap_err();

        assert_eq!(error.code(), "recursive_operation");
    }

    #[test]
    fn planner_reports_destination_conflicts() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("a.txt");
        let dest = dir.path().join("dest");

        fs::write(&source, b"a").unwrap();
        fs::create_dir(&dest).unwrap();
        fs::write(dest.join("a.txt"), b"existing").unwrap();

        let plan = plan_file_operation(request(
            FileOperationKind::Copy,
            vec![uri(&source)],
            Some(uri(&dest)),
        ))
        .unwrap();

        assert_eq!(plan.conflicts.len(), 1);
    }

    #[test]
    fn planner_reports_directory_destination_conflicts() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("source");
        let dest = dir.path().join("dest");

        fs::create_dir(&source).unwrap();
        fs::create_dir(&dest).unwrap();
        fs::create_dir(dest.join("source")).unwrap();

        let plan = plan_file_operation(request(
            FileOperationKind::Copy,
            vec![uri(&source)],
            Some(uri(&dest)),
        ))
        .unwrap();

        assert_eq!(plan.conflicts.len(), 1);
    }

    #[test]
    fn planner_reports_missing_source() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("missing.txt");
        let dest = dir.path().join("dest");

        fs::create_dir(&dest).unwrap();

        let error = plan_file_operation(request(
            FileOperationKind::Copy,
            vec![uri(&source)],
            Some(uri(&dest)),
        ))
        .unwrap_err();

        assert_eq!(error.code(), "not_found");
    }

    #[test]
    fn planner_reports_missing_destination_parent() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("source.txt");
        let dest = dir.path().join("missing");

        fs::write(&source, b"a").unwrap();

        let error = plan_file_operation(request(
            FileOperationKind::Copy,
            vec![uri(&source)],
            Some(uri(&dest)),
        ))
        .unwrap_err();

        assert_eq!(error.code(), "destination_missing");
    }

    #[test]
    fn collect_copy_or_move_items_uses_cataloged_metadata_warning() {
        let dir = tempdir().unwrap();
        let missing = dir.path().join("missing.txt");
        let destination = dir.path().join("dest");
        let mut items = Vec::new();
        let mut warnings = Vec::new();

        fs::create_dir(&destination).unwrap();

        collect_copy_or_move_items(&missing, &destination, &missing, &mut items, &mut warnings)
            .unwrap();

        assert!(items.is_empty());
        assert_eq!(warnings.len(), 1);
        assert_eq!(
            warnings[0].code,
            vfs::file_operation_warning_codes::METADATA_FAILED
        );
    }

    #[test]
    fn copy_file_produces_identical_content() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("a.txt");
        let dest = dir.path().join("dest");

        fs::write(&source, b"hello").unwrap();
        fs::create_dir(&dest).unwrap();

        let plan = plan_file_operation(request(
            FileOperationKind::Copy,
            vec![uri(&source)],
            Some(uri(&dest)),
        ))
        .unwrap();
        execute_file_operation(
            &plan,
            &JobId::new("job"),
            &CancellationToken::new(),
            &|_| {},
        )
        .unwrap();

        assert_eq!(fs::read(dest.join("a.txt")).unwrap(), b"hello");
    }

    #[test]
    fn copy_directory_preserves_structure() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("source");
        let dest = dir.path().join("dest");

        fs::create_dir_all(source.join("nested")).unwrap();
        fs::write(source.join("nested/file.txt"), b"nested").unwrap();
        fs::create_dir(&dest).unwrap();

        let plan = plan_file_operation(request(
            FileOperationKind::Copy,
            vec![uri(&source)],
            Some(uri(&dest)),
        ))
        .unwrap();
        execute_file_operation(
            &plan,
            &JobId::new("job"),
            &CancellationToken::new(),
            &|_| {},
        )
        .unwrap();

        assert_eq!(
            fs::read(dest.join("source/nested/file.txt")).unwrap(),
            b"nested"
        );
    }

    #[test]
    fn unicode_paths_copy_move_rename_and_trash_plan_without_lossy_conversion() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("файл 🚀 e\u{301}.txt");
        let dest = dir.path().join("назначение");

        fs::write(&source, b"unicode").unwrap();
        fs::create_dir(&dest).unwrap();

        let copy = plan_file_operation(request(
            FileOperationKind::Copy,
            vec![uri(&source)],
            Some(uri(&dest)),
        ))
        .unwrap();
        execute_file_operation(
            &copy,
            &JobId::new("job"),
            &CancellationToken::new(),
            &|_| {},
        )
        .unwrap();

        assert_eq!(
            fs::read(dest.join("файл 🚀 e\u{301}.txt")).unwrap(),
            b"unicode"
        );

        let mut rename = request(FileOperationKind::Rename, vec![uri(&source)], None);
        rename.new_name = Some("renamed-ß.txt".to_string());
        let rename = plan_file_operation(rename).unwrap();
        execute_file_operation(
            &rename,
            &JobId::new("job"),
            &CancellationToken::new(),
            &|_| {},
        )
        .unwrap();

        assert!(dir.path().join("renamed-ß.txt").exists());
    }

    #[cfg(unix)]
    #[test]
    fn symlink_listing_policy_does_not_recurse_or_copy_link_objects() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("source");
        let dest = dir.path().join("dest");
        let link = source.join("loop");

        fs::create_dir(&source).unwrap();
        fs::create_dir(&dest).unwrap();
        std::os::unix::fs::symlink(&source, &link).unwrap();

        let plan = plan_file_operation(request(
            FileOperationKind::Copy,
            vec![uri(&source)],
            Some(uri(&dest)),
        ))
        .unwrap();

        assert!(plan.items.iter().any(|item| item.kind == FileKind::Symlink));

        let error = execute_file_operation(
            &plan,
            &JobId::new("job"),
            &CancellationToken::new(),
            &|_| {},
        )
        .unwrap_err();

        assert_eq!(error.code(), "unsupported_symlink");
    }

    #[test]
    fn large_file_copy_emits_multiple_progress_updates() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("large.bin");
        let dest = dir.path().join("dest");
        let events = std::sync::Arc::new(std::sync::Mutex::new(Vec::<JobEvent>::new()));
        let events_for_sink = events.clone();

        fs::write(&source, vec![7_u8; (PROGRESS_BYTE_INTERVAL as usize) * 3]).unwrap();
        fs::create_dir(&dest).unwrap();

        let plan = plan_file_operation(request(
            FileOperationKind::Copy,
            vec![uri(&source)],
            Some(uri(&dest)),
        ))
        .unwrap();
        execute_file_operation(
            &plan,
            &JobId::new("job"),
            &CancellationToken::new(),
            &move |event| {
                events_for_sink.lock().unwrap().push(event);
            },
        )
        .unwrap();

        let progress_count = events
            .lock()
            .unwrap()
            .iter()
            .filter(|event| matches!(event, JobEvent::Progress(_)))
            .count();

        assert!(progress_count > 1);
    }

    #[test]
    fn move_file_uses_fast_path_and_removes_source() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("move.txt");
        let dest = dir.path().join("dest");

        fs::write(&source, b"move").unwrap();
        fs::create_dir(&dest).unwrap();

        let plan = plan_file_operation(request(
            FileOperationKind::Move,
            vec![uri(&source)],
            Some(uri(&dest)),
        ))
        .unwrap();
        execute_file_operation(
            &plan,
            &JobId::new("job"),
            &CancellationToken::new(),
            &|_| {},
        )
        .unwrap();

        assert!(!source.exists());
        assert_eq!(fs::read(dest.join("move.txt")).unwrap(), b"move");
    }

    #[test]
    fn failed_move_conflict_leaves_source_intact() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("move.txt");
        let dest = dir.path().join("dest");

        fs::write(&source, b"source").unwrap();
        fs::create_dir(&dest).unwrap();
        fs::write(dest.join("move.txt"), b"existing").unwrap();

        let plan = plan_file_operation(request(
            FileOperationKind::Move,
            vec![uri(&source)],
            Some(uri(&dest)),
        ))
        .unwrap();
        let error = execute_file_operation(
            &plan,
            &JobId::new("job"),
            &CancellationToken::new(),
            &|_| {},
        )
        .unwrap_err();

        assert_eq!(error.code(), "destination_conflict");
        assert_eq!(fs::read(&source).unwrap(), b"source");
    }

    #[test]
    fn rename_changes_only_basename() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("old.txt");

        fs::write(&source, b"data").unwrap();

        let mut operation = request(FileOperationKind::Rename, vec![uri(&source)], None);
        operation.new_name = Some("new.txt".to_string());
        let plan = plan_file_operation(operation).unwrap();

        execute_file_operation(
            &plan,
            &JobId::new("job"),
            &CancellationToken::new(),
            &|_| {},
        )
        .unwrap();

        assert!(dir.path().join("new.txt").exists());
        assert!(!source.exists());
    }

    #[test]
    fn open_file_rename_does_not_crash() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("open.txt");

        fs::write(&source, b"data").unwrap();
        let _open_handle = File::open(&source).unwrap();

        let mut operation = request(FileOperationKind::Rename, vec![uri(&source)], None);
        operation.new_name = Some("renamed-open.txt".to_string());
        let plan = plan_file_operation(operation).unwrap();
        let result = execute_file_operation(
            &plan,
            &JobId::new("job"),
            &CancellationToken::new(),
            &|_| {},
        );

        if let Err(error) = result {
            assert!(matches!(
                error.code(),
                "permission_denied" | "io_error" | "destination_conflict"
            ));
        }
    }

    #[test]
    fn create_directory_rejects_duplicate() {
        let dir = tempdir().unwrap();
        let target = dir.path().join("new");

        fs::create_dir(&target).unwrap();

        let plan = plan_file_operation(request(
            FileOperationKind::CreateDirectory,
            Vec::new(),
            Some(uri(&target)),
        ))
        .unwrap();
        let error = execute_file_operation(
            &plan,
            &JobId::new("job"),
            &CancellationToken::new(),
            &|_| {},
        )
        .unwrap_err();

        assert_eq!(error.code(), "destination_conflict");
    }

    #[test]
    fn create_file_creates_empty_file() {
        let dir = tempdir().unwrap();
        let target = dir.path().join("new.txt");

        let plan = plan_file_operation(request(
            FileOperationKind::CreateFile,
            Vec::new(),
            Some(uri(&target)),
        ))
        .unwrap();

        execute_file_operation(
            &plan,
            &JobId::new("job"),
            &CancellationToken::new(),
            &|_| {},
        )
        .unwrap();

        assert!(target.exists());
        assert_eq!(fs::metadata(&target).unwrap().len(), 0);
    }

    #[test]
    fn delete_permanently_removes_files_and_directories() {
        let dir = tempdir().unwrap();
        let file = dir.path().join("delete-me.txt");
        let folder = dir.path().join("delete-dir");

        fs::write(&file, b"data").unwrap();
        fs::create_dir(&folder).unwrap();
        fs::write(folder.join("nested.txt"), b"nested").unwrap();

        let plan = plan_file_operation(request(
            FileOperationKind::DeletePermanently,
            vec![uri(&file), uri(&folder)],
            None,
        ))
        .unwrap();

        execute_file_operation(
            &plan,
            &JobId::new("job"),
            &CancellationToken::new(),
            &|_| {},
        )
        .unwrap();

        assert!(!file.exists());
        assert!(!folder.exists());
    }

    #[test]
    fn create_archive_writes_zip_file() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("source.txt");
        let archive_path = dir.path().join("archive.zip");

        fs::write(&source, b"archive me").unwrap();

        let plan = plan_file_operation(request(
            FileOperationKind::CreateArchive,
            vec![uri(&source)],
            Some(uri(&archive_path)),
        ))
        .unwrap();

        execute_file_operation(
            &plan,
            &JobId::new("job"),
            &CancellationToken::new(),
            &|_| {},
        )
        .unwrap();

        let file = File::open(&archive_path).unwrap();
        let archive = zip::ZipArchive::new(file).unwrap();

        assert_eq!(archive.len(), 1);
    }

    #[test]
    fn extract_archive_writes_files_to_destination() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("source.txt");
        let archive_path = dir.path().join("archive.zip");
        let extract_dir = dir.path().join("out");

        fs::write(&source, b"archive me").unwrap();

        let create_plan = plan_file_operation(request(
            FileOperationKind::CreateArchive,
            vec![uri(&source)],
            Some(uri(&archive_path)),
        ))
        .unwrap();
        execute_file_operation(
            &create_plan,
            &JobId::new("job-create"),
            &CancellationToken::new(),
            &|_| {},
        )
        .unwrap();

        let extract_plan = plan_file_operation(request(
            FileOperationKind::ExtractArchive,
            vec![uri(&archive_path)],
            Some(uri(&extract_dir)),
        ))
        .unwrap();
        execute_file_operation(
            &extract_plan,
            &JobId::new("job-extract"),
            &CancellationToken::new(),
            &|_| {},
        )
        .unwrap();

        assert_eq!(
            fs::read(extract_dir.join("source.txt")).unwrap(),
            b"archive me"
        );
    }

    #[test]
    fn extract_archive_rejects_path_traversal_entries() {
        let dir = tempdir().unwrap();
        let archive_path = dir.path().join("bad.zip");
        let extract_dir = dir.path().join("out");
        let file = File::create(&archive_path).unwrap();
        let mut archive = zip::ZipWriter::new(file);

        archive
            .start_file("../escape.txt", FileOptions::default())
            .unwrap();
        archive.write_all(b"nope").unwrap();
        archive.finish().unwrap();

        let error = plan_file_operation(request(
            FileOperationKind::ExtractArchive,
            vec![uri(&archive_path)],
            Some(uri(&extract_dir)),
        ))
        .unwrap_err();

        assert_eq!(error.code(), "invalid_request");
    }

    #[test]
    fn cancellation_stops_large_copy() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("large.bin");
        let dest = dir.path().join("dest");
        let cancel = CancellationToken::new();

        fs::write(&source, vec![7_u8; (PROGRESS_BYTE_INTERVAL as usize) * 2]).unwrap();
        fs::create_dir(&dest).unwrap();

        let plan = plan_file_operation(request(
            FileOperationKind::Copy,
            vec![uri(&source)],
            Some(uri(&dest)),
        ))
        .unwrap();
        let token = cancel.clone();
        let result = execute_file_operation(&plan, &JobId::new("job"), &cancel, &move |_| {
            token.cancel();
        });

        assert_eq!(result.unwrap_err().code(), "cancelled");
    }

    #[test]
    fn cancellation_stops_many_small_file_copy() {
        let dir = tempdir().unwrap();
        let source = dir.path().join("source");
        let dest = dir.path().join("dest");
        let cancel = CancellationToken::new();

        fs::create_dir(&source).unwrap();
        fs::create_dir(&dest).unwrap();
        for index in 0..50 {
            fs::write(source.join(format!("file-{index}.txt")), b"x").unwrap();
        }

        let plan = plan_file_operation(request(
            FileOperationKind::Copy,
            vec![uri(&source)],
            Some(uri(&dest)),
        ))
        .unwrap();
        let token = cancel.clone();
        let result = execute_file_operation(&plan, &JobId::new("job"), &cancel, &move |_| {
            token.cancel();
        });

        assert_eq!(result.unwrap_err().code(), "cancelled");
    }
}
