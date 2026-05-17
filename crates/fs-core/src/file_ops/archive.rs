use std::fs::{self, File};
use std::path::{Path, PathBuf};

use jobs::{CancellationToken, JobId};
use vfs::{ConflictPolicy, FileOperationError, FileOperationPlan};
use zip::write::FileOptions;

use super::execution::{check_cancelled, resolve_conflict_path, ExecutionProgress};
use super::paths::map_std_io_error;
use super::FileOperationEventSink;

pub(super) fn execute_create_archive(
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

pub(super) fn execute_extract_archive(
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

pub(super) fn archive_entry_name(
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

pub(super) fn sanitize_archive_entry_path(
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

pub(super) fn normalize_archive_entry_path(path: &Path) -> PathBuf {
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
